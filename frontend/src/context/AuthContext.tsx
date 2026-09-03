/**
 * Authentication context and provider.
 *
 * Provides global auth state (current user, loading flag) and actions
 * (login, register, logout) to the entire component tree.
 *
 * On mount, the provider checks localStorage for an existing JWT and
 * validates it against the server via GET /auth/me. If invalid, the
 * token is cleared and the user is set to null.
 *
 * Multi-tab synchronization: logout broadcasts an 'auth:logout' message
 * via BroadcastChannel so other open tabs also clear their session.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginFormValues, RegisterFormValues } from '../types/auth';
import { api } from '../services/api';

/** Shape of the auth context exposed via useAuth(). */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginFormValues) => Promise<void>;
  register: (userData: RegisterFormValues) => Promise<void>;
  logout: () => void;
}

/** Expected server response for login/register endpoints. */
interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    employee: User;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount, attempt to restore the session from a persisted token.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get<{ success: boolean; data: User }>('/auth/me')
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        // Token is invalid or expired – clear it
        localStorage.removeItem('accessToken');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  /** Authenticate with username/password and persist the JWT. */
  const login = async (credentials: LoginFormValues) => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.employee);
  };

  /** Create a new account and automatically log in. */
  const register = async (userData: RegisterFormValues) => {
    const res = await api.post<AuthResponse>('/auth/register', userData);
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.employee);
  };

  /**
   * Clear local session and notify other tabs.
   * Uses BroadcastChannel so that if the user logs out in one tab,
   * all other open tabs also redirect to the login page.
   */
  const logout = useCallback(() => {
    // Notify other tabs before clearing
    try {
      const bc = new BroadcastChannel('hrm-auth');
      bc.postMessage({ type: 'auth:logout' });
      bc.close();
    } catch {
      // BroadcastChannel not supported or already closed
    }
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  // Show a minimal loading state while the initial auth check runs.
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook to consume the auth context. Must be used inside <AuthProvider>. */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
