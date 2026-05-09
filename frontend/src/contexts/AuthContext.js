import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, setToken } from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('skyx_current_user');
      const token = localStorage.getItem('skyx_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const freshUser = await apiRequest('/auth/me');
        setUser(freshUser);
        localStorage.setItem('skyx_current_user', JSON.stringify(freshUser));
      } catch (error) {
        setToken(null);
        localStorage.removeItem('skyx_current_user');
        if (savedUser) {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (username, password) => {
    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem('skyx_current_user', JSON.stringify(result.user));
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message || 'Неверные данные для входа' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('skyx_current_user');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isSuperAdmin: user?.role === 'super_admin',
    isOrganizationAdmin: user?.role === 'organization_admin',
    isCleaningAdmin: user?.role === 'cleaning_company_admin',
    isCleaner: user?.role === 'cleaner',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};