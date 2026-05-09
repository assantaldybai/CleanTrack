import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Building2, LogOut, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { roleHome, roleLabel } from '../lib/api';

const menus = {
  super_admin: [
    { path: '/super-admin', label: 'SaaS контроль', icon: ShieldCheck },
  ],
  organization_admin: [
    { path: '/organization', label: 'Организация', icon: Building2 },
  ],
  cleaning_company_admin: [
    { path: '/cleaning', label: 'Клининг', icon: Sparkles },
  ],
  cleaner: [
    { path: '/cleaner', label: 'Мои задачи', icon: UserCheck },
  ],
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const menuItems = menus[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg border-b-4 border-black sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <button className="flex items-center text-left" onClick={() => navigate(roleHome(user?.role))}>
              <div>
                <h1 className="text-2xl font-black text-black">SKY<span className="text-white">X</span></h1>
                <p className="text-xs text-black font-bold">Cleaning SaaS</p>
              </div>
            </button>

            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-sm text-black text-right">
                <div className="font-black">{user?.name}</div>
                <div className="text-xs font-bold">{user?.username}</div>
              </div>
              <span className="px-3 py-1 bg-black text-yellow-400 rounded-full text-xs font-black border border-yellow-300">
                {roleLabel(user?.role)}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center space-x-1 border-2 border-black text-black hover:bg-black hover:text-yellow-400 font-bold">
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="w-64 bg-black shadow-xl min-h-[calc(100vh-4rem)] border-r-4 border-yellow-400 hidden lg:block">
          <div className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 font-bold ${isActive ? 'bg-yellow-400 text-black shadow-lg' : 'text-yellow-400 hover:bg-yellow-400 hover:text-black'}`}>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-6 bg-gray-50 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;