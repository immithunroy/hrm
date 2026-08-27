import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginFormValues, RegisterFormValues } from '../types/auth';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginFormValues) => Promise<void>;
  register: (userData: RegisterFormValues) => Promise<void>;
  logout: () => void;
  handleGoogleCallback: (token: string) => Promise<void>;
}

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
        localStorage.removeItem('accessToken');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (credentials: LoginFormValues) => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.employee);
  };

  const register = async (userData: RegisterFormValues) => {
    const res = await api.post<AuthResponse>('/auth/register', userData);
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.employee);
  };

  const handleGoogleCallback = useCallback(async (token: string) => {
    localStorage.setItem('accessToken', token);
    try {
      const res = await api.get<{ success: boolean; data: User }>('/auth/me');
      setUser(res.data);
    } catch {
      localStorage.removeItem('accessToken');
      setUser(null);
      throw new Error('Failed to load user profile after Google authentication.');
    }
  }, []);

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, handleGoogleCallback }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
