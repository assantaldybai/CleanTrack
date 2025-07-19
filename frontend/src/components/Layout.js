import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LogOut, Building2, Users, ClipboardList, Calendar } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
  const { user, logout, isAdmin, isCleaner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminMenuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: Building2 },
    { path: '/admin/buildings', label: 'Здания', icon: Building2 },
    { path: '/admin/zones', label: 'Зоны', icon: Building2 },
    { path: '/admin/checklists', label: 'Чек-листы', icon: ClipboardList },
    { path: '/admin/cleaners', label: 'Клинеры', icon: Users },
    { path: '/admin/assignments', label: 'Задания', icon: Calendar },
  ];

  const cleanerMenuItems = [
    { path: '/cleaner/dashboard', label: 'Мои задания', icon: ClipboardList },
    { path: '/cleaner/history', label: 'История', icon: Calendar },
  ];

  const menuItems = isAdmin ? adminMenuItems : cleanerMenuItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-black">
                  SKY<span className="text-white">X</span>
                </h1>
                <p className="text-xs text-black font-medium">Система управления клинингом</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-black">
                <span className="font-medium">{user?.name}</span>
                <span className="ml-2 px-3 py-1 bg-black text-yellow-400 rounded-full text-xs font-bold">
                  {isAdmin ? 'АДМИНИСТРАТОР' : 'КЛИНЕР'}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-1 border-2 border-black text-black hover:bg-black hover:text-yellow-400 font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-black shadow-xl min-h-screen border-r-4 border-yellow-400">
          <div className="p-4">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 font-medium ${
                      isActive 
                        ? 'bg-yellow-400 text-black shadow-lg transform scale-105' 
                        : 'text-yellow-400 hover:bg-yellow-400 hover:text-black hover:transform hover:scale-105'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;