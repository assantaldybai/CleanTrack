import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeMockData, getFromStorage } from '../mockData';

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
    initializeMockData();
    
    // Проверяем сохраненного пользователя
    const savedUser = localStorage.getItem('amp_current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const users = getFromStorage('amp_users', []);
    const foundUser = users.find(u => u.username === username && u.password === password);
    
    if (foundUser) {
      const userWithoutPassword = { ...foundUser };
      delete userWithoutPassword.password;
      
      setUser(userWithoutPassword);
      localStorage.setItem('amp_current_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    } else {
      return { success: false, error: 'Неверные данные для входа' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('amp_current_user');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAdmin: user?.role === 'admin',
    isCleaner: user?.role === 'cleaner'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};