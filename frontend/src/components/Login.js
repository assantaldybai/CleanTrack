import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      // Redirect based on user role
      const users = JSON.parse(localStorage.getItem('skyx_users') || '[]');
      const user = users.find(u => u.username === username);
      
      if (user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/cleaner/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const loginAsDemo = (role) => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('cleaner1');
      setPassword('cleaner123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="w-full max-w-md p-6 relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-black rounded-2xl mb-4 shadow-2xl">
            <Zap className="h-12 w-12 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold text-black mb-2">
            SKY<span className="text-white">X</span>
          </h1>
          <p className="text-black font-semibold text-lg">Система управления клинингом</p>
          <p className="text-black/80 mt-1">Будущее уборки уже здесь</p>
        </div>

        <Card className="shadow-2xl border-4 border-black bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-t-lg">
            <CardTitle className="text-2xl font-bold text-center">Вход в систему</CardTitle>
            <CardDescription className="text-center text-black/80 font-medium">
              Авторизуйтесь для доступа к платформе
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 p-6">
            {error && (
              <Alert variant="destructive" className="border-2 border-red-500">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-black font-semibold">Имя пользователя</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 border-2 border-gray-300 focus:border-yellow-400 font-medium"
                  placeholder="Введите имя пользователя"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-black font-semibold">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 border-2 border-gray-300 focus:border-yellow-400 font-medium"
                  placeholder="Введите пароль"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold text-lg border-2 border-black shadow-lg transform transition-all hover:scale-105"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                    <span>Вход...</span>
                  </div>
                ) : (
                  'ВОЙТИ'
                )}
              </Button>
            </form>

            {/* Demo buttons */}
            <div className="pt-4 border-t-2 border-gray-200">
              <p className="text-sm text-gray-700 text-center mb-3 font-semibold">Демо-доступ:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loginAsDemo('admin')}
                  className="text-xs font-bold border-2 border-black text-black hover:bg-black hover:text-yellow-400"
                >
                  АДМИНИСТРАТОР
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loginAsDemo('cleaner')}
                  className="text-xs font-bold border-2 border-black text-black hover:bg-black hover:text-yellow-400"
                >
                  КЛИНЕР
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;