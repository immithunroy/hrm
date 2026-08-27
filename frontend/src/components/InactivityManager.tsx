import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // 25 minutes
const ACTIVITY_THROTTLE_MS = 5000; // 5 seconds

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

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

  const dismissWarning = useCallback(() => {
    window.dispatchEvent(new CustomEvent('inactivity:dismiss'));
  }, []);

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

  const handleActivity = useCallback(() => {
    if (!user) return;
    dismissWarning();
    resetTimers();
  }, [user, dismissWarning, resetTimers]);

  // BroadcastChannel for multi-tab sync
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

  // Activity listeners
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

  // Listen for token removal from other tabs
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

  return null;
}
