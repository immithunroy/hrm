/**
 * InactivityWarning – session timeout warning modal.
 *
 * Listens for 'inactivity:warning' and 'inactivity:dismiss' custom events
 * dispatched by InactivityManager. When shown, displays a 5-minute countdown
 * before forced logout. The user can:
 *   - Click "Stay Signed In" → dismisses the modal and resets the inactivity
 *     timers (also broadcasts activity to other tabs).
 *   - Click "Sign Out" → immediately logs out across all tabs.
 *   - Do nothing → auto-logs out when the countdown reaches zero.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

/** How many seconds the countdown starts from when the warning appears. */
const COUNTDOWN_SECONDS = 300; // 5 minutes

export default function InactivityWarning() {
  const { logout } = useAuth();
  /** Whether the warning modal is currently visible. */
  const [visible, setVisible] = useState(false);
  /** Seconds remaining before forced logout. */
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Dismiss the warning modal and reset state.
   * Broadcasts an activity event so other tabs also reset their timers.
   */
  const handleDismiss = useCallback(() => {
    setVisible(false);
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Broadcast activity to other tabs
    try {
      const bc = new BroadcastChannel('hrm-auth');
      bc.postMessage({ type: 'auth:activity' });
      bc.close();
    } catch {}
  }, []);

  /**
   * Immediately log the user out.
   * Notifies other tabs, calls the server logout endpoint (best-effort),
   * clears local state, and redirects to the login page.
   */
  const handleLogout = useCallback(async () => {
    setVisible(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Notify other tabs
    try {
      const bc = new BroadcastChannel('hrm-auth');
      bc.postMessage({ type: 'auth:logout' });
      bc.close();
    } catch {}
    try {
      await api.post('/auth/logout', {});
    } catch {}
    logout();
    window.location.href = '/login?error=session_expired';
  }, [logout]);

  // Listen for custom events from InactivityManager.
  useEffect(() => {
    const onWarning = () => {
      setVisible(true);
      setCountdown(COUNTDOWN_SECONDS);
    };
    const onDismiss = () => handleDismiss();

    window.addEventListener('inactivity:warning', onWarning);
    window.addEventListener('inactivity:dismiss', onDismiss);

    return () => {
      window.removeEventListener('inactivity:warning', onWarning);
      window.removeEventListener('inactivity:dismiss', onDismiss);
    };
  }, [handleDismiss]);

  // Run the countdown timer while the modal is visible.
  useEffect(() => {
    if (!visible) return;

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [visible, handleLogout]);

  if (!visible) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg border shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Session Expiring</h3>
          <p className="text-sm text-muted-foreground">
            You have been inactive for 25 minutes. You will be signed out in{' '}
            <span className="font-mono font-medium text-foreground">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
          >
            Stay Signed In
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
