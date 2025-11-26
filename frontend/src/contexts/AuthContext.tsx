import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = authApi.getStoredUser();
    if (storedUser && authApi.isAuthenticated()) {
      setUser(storedUser);
      // Refresh user data from server
      authApi.getCurrentUser()
        .then(setUser)
        .catch(() => {
          // Token might be invalid, clear storage
          authApi.logout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    await authApi.login({ username, password });
    const userData = await authApi.getCurrentUser();
    setUser(userData);
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const register = async (username: string, email: string, password: string, fullName?: string) => {
    await authApi.register({ username, email, password, full_name: fullName });
    // After registration, user needs to login
  };

  const refreshUser = async () => {
    if (authApi.isAuthenticated()) {
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      } catch (error) {
        logout();
      }
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    refreshUser,
    isAuthenticated: !!user && authApi.isAuthenticated(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

