import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    captchaToken: string,
  ) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  setAuth: (token: string, user: User) => void;
}

export const AuthContext = createContext<AuthContextValue>(null!);

function loadSaved(): AuthState {
  // Migrate token out of localStorage
  const legacy = localStorage.getItem('blog_auth');
  if (legacy) {
    sessionStorage.setItem('blog_auth', legacy);
    localStorage.removeItem('blog_auth');
  }

  const saved = sessionStorage.getItem('blog_auth');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { token: parsed.token, user: parsed.user };
    } catch {
      sessionStorage.removeItem('blog_auth');
    }
  }
  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadSaved);

  useEffect(() => {
    if (state.token && state.user) {
      sessionStorage.setItem(
        'blog_auth',
        JSON.stringify({ token: state.token, user: state.user }),
      );
    } else {
      sessionStorage.removeItem('blog_auth');
    }
  }, [state.token, state.user]);

  useEffect(() => {
    const onExpired = () => setState({ user: null, token: null });
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setState({ token: data.access_token, user: data.user });
  }, []);

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      captchaToken: string,
    ) => {
      await authApi.register(username, email, password, captchaToken);
    },
    [],
  );

  const logout = useCallback(() => {
    setState({ user: null, token: null });
  }, []);

  const updateUser = useCallback((user: User) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  const setAuth = useCallback((token: string, user: User) => {
    setState({ token, user });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, updateUser, setAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}
