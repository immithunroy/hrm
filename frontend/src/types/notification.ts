/**
 * Notification model used across the app (toast messages, notification center, etc.).
 *
 * type – determines the visual style (icon color, background) of the notification.
 * isRead – tracks whether the recipient has acknowledged the notification.
 */

export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  /** Visual severity: INFO (blue), WARNING (yellow), ERROR (red), SUCCESS (green). */
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  isRead: boolean;
  /** ISO 8601 timestamp of when the notification was created. */
  createdAt: string;
}