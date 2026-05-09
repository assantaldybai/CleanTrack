import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, Building2, Sparkles, UserCheck, Zap } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { roleHome } from '../lib/api';

const demos = [
  { label: 'ОРГАНИЗАЦИЯ', username: 'org_gazprom', password: 'Org2025!', icon: Building2 },
  { label: 'КЛИНИНГ', username: 'cleaning_admin', password: 'Clean2025!', icon: Sparkles },
  { label: 'КЛИНЕР', username: 'cleaner_maria', password: 'Cleaner2025!', icon: UserCheck },
];

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
      navigate(roleHome(result.user.role));
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const fillDemo = (demo) => {
    setUsername(demo.username);
    setPassword(demo.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-300 via-yellow-500 to-black px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.35),transparent_35%)]"></div>
      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="text-black">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-black rounded-3xl mb-6 shadow-2xl border-4 border-yellow-300">
            <Zap className="h-14 w-14 text-yellow-400" />
          </div>
          <h1 className="text-6xl font-black tracking-tight">SKY<span className="text-white">X</span></h1>
          <p className="text-2xl font-black mt-3">SaaS-платформа контроля уборки</p>
          <p className="text-lg text-black/80 mt-4 max-w-xl font-medium">
            Контроль уборки для организаций, клининга и исполнителей.
          </p>
        </div>

        <Card className="shadow-2xl border-4 border-black bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-t-lg">
            <CardTitle className="text-2xl font-black text-center">Вход</CardTitle>
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
                <Label htmlFor="username" className="text-black font-semibold">Логин</Label>
                <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 border-2 border-gray-300 focus:border-yellow-400 font-medium" placeholder="Введите выданный логин" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-black font-semibold">Пароль</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 border-2 border-gray-300 focus:border-yellow-400 font-medium" placeholder="Введите пароль" />
              </div>

              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-black text-lg border-2 border-black shadow-lg" disabled={loading}>
                {loading ? 'Вход...' : 'ВОЙТИ'}
              </Button>
            </form>

            <div className="pt-4 border-t-2 border-gray-200 space-y-3">
              <p className="text-sm text-gray-700 text-center font-bold">Демо:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {demos.map((demo) => {
                  const Icon = demo.icon;
                  return (
                    <Button key={demo.username} variant="outline" size="sm" onClick={() => fillDemo(demo)} className="text-xs font-black border-2 border-black text-black hover:bg-black hover:text-yellow-400">
                      <Icon className="h-4 w-4 mr-1" />{demo.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;