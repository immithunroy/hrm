/**
 * InactivityManager – silently enforces session timeout.
 *
 * This component renders nothing (returns null) but manages two timers:
 *   1. Warning timer  – fires after 25 min of inactivity, dispatches an
 *      'inactivity:warning' custom event so InactivityWarning can show a modal.
 *   2. Timeout timer  – fires after 30 min of inactivity, forces logout.
 *
 * Any detected user activity (mouse, keyboard, scroll, touch) resets both
 * timers via a throttled handler (once every 5 s) to avoid excessive work.
 *
 * Multi-tab synchronization:
 *   - BroadcastChannel 'hrm-auth' listens for 'auth:logout' (forced sign-out)
 *     and 'auth:activity' (another tab had activity) messages.
 *   - A storage event listener catches token removal from another tab.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

/** Time after which the user is forcibly logged out (30 minutes). */
const TIMEOUT_MS = 30 * 60 * 1000;
/** Time after which a warning modal is shown (25 minutes – 5 min before timeout). */
const WARNING_MS = 25 * 60 * 1000;
/** Minimum interval between activity handler invocations (prevents flood). */
const ACTIVITY_THROTTLE_MS = 5000;

/** DOM events considered as user activity. */
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

/** Simple leading-edge throttle: invokes fn at most once per `limit` ms. */
function throttle<T extends (...args: any[]) => void>(fn: T, limit: number): T {
  let lastCall = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

export default function InactivityManager() {
  const { user, logout } = useAuth();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const activityRef = useRef<ReturnType<typeof throttle> | null>(null);

  /** Clear both the warning and timeout timers. */
  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  /** Dispatch a custom event to hide the inactivity warning modal. */
  const dismissWarning = useCallback(() => {
    window.dispatchEvent(new CustomEvent('inactivity:dismiss'));
  }, []);

  /**
   * Reset both timers from zero.
   * - Warning fires at WARNING_MS (shows modal)
   * - Timeout fires at TIMEOUT_MS (forces logout)
   */
  const resetTimers = useCallback(() => {
    clearTimers();

    warningTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('inactivity:warning'));
    }, WARNING_MS);

    timeoutTimerRef.current = setTimeout(() => {
      // Force logout on timeout
      clearTimers();
      try {
        api.post('/auth/logout', {}).catch(() => {});
      } catch {}
      logout();
      window.location.href = '/login?error=session_expired';
    }, TIMEOUT_MS);
  }, [clearTimers, logout]);

  /**
   * Called on any user activity.
   * Dismisses any visible warning and restarts the inactivity timers.
   */
  const handleActivity = useCallback(() => {
    if (!user) return;
    dismissWarning();
    resetTimers();
  }, [user, dismissWarning, resetTimers]);

  // BroadcastChannel: listen for cross-tab logout and activity events.
  useEffect(() => {
    if (!user) return;

    try {
      channelRef.current = new BroadcastChannel('hrm-auth');

      channelRef.current.onmessage = (event) => {
        if (event.data.type === 'auth:logout') {
          clearTimers();
          logout();
          window.location.href = '/login?error=session_expired';
        }
        if (event.data.type === 'auth:activity') {
          // Another tab had activity – reset our timers too
          handleActivity();
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [user, handleActivity, clearTimers, logout]);

  // Attach DOM activity event listeners and start the initial timers.
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    const throttledActivity = throttle(handleActivity, ACTIVITY_THROTTLE_MS);
    activityRef.current = throttledActivity;

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // Start initial timers
    resetTimers();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, throttledActivity);
      });
    };
  }, [user, handleActivity, clearTimers, resetTimers]);

  // Fallback: detect token removal from another tab via the storage event.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'accessToken' && !e.newValue) {
        clearTimers();
        logout();
        window.location.href = '/login?error=session_expired';
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [clearTimers, logout]);

  // This component manages timers only – no visual output.
  return null;
}
