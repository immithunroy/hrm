/**
 * Authentication-related TypeScript interfaces.
 *
 * User – represents the authenticated employee returned by /auth/me and login/register.
 * LoginFormValues – payload for the POST /auth/login endpoint.
 * RegisterFormValues – payload for the POST /auth/register endpoint.
 */

/** Authenticated user profile returned by the API. */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  employeeId?: string;
  role?: string;
}

/** Login form payload – username + password. */
export interface LoginFormValues {
  username: string;
  password: string;
}

/** Registration form payload – creates a new employee account. */
export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}