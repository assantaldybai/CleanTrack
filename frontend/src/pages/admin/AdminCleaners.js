import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarInitials } from '../../components/ui/avatar';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Calendar, Activity } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const AdminCleaners = () => {
  const [cleaners, setCleaners] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCleaner, setEditingCleaner] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    password: 'cleaner123' // Default password
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const users = getFromStorage('skyx_users', []);
    const cleanersData = users.filter(u => u.role === 'cleaner');
    const assignmentsData = getFromStorage('skyx_assignments', []);
    setCleaners(cleanersData);
    setAssignments(assignmentsData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const users = getFromStorage('skyx_users', []);
    
    // Check if username already exists
    if (!editingCleaner && users.some(u => u.username === formData.username)) {
      toast({
        title: "Ошибка",
        description: "Пользователь с таким именем уже существует.",
        variant: "destructive"
      });
      return;
    }
    
    if (editingCleaner) {
      const updatedUsers = users.map(u => 
        u.id === editingCleaner.id 
          ? { ...formData, id: editingCleaner.id, role: 'cleaner' }
          : u
      );
      saveToStorage('skyx_users', updatedUsers);
      
      toast({
        title: "Уборщик обновлен",
        description: "Информация о уборщике успешно обновлена.",
      });
    } else {
      const newCleaner = {
        ...formData,
        id: Date.now().toString(),
        role: 'cleaner'
      };
      
      const updatedUsers = [...users, newCleaner];
      saveToStorage('skyx_users', updatedUsers);
      
      toast({
        title: "Уборщик добавлен",
        description: "Новый уборщик успешно добавлен в систему.",
      });
    }
    
    loadData();
    resetForm();
  };

  const handleEdit = (cleaner) => {
    setEditingCleaner(cleaner);
    setFormData({
      username: cleaner.username,
      name: cleaner.name,
      email: cleaner.email || '',
      phone: cleaner.phone || '',
      password: cleaner.password || 'cleaner123'
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (cleanerId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого уборщика?')) {
      const users = getFromStorage('skyx_users', []);
      const updatedUsers = users.filter(u => u.id !== cleanerId);
      saveToStorage('skyx_users', updatedUsers);
      
      // Also remove assignments for this cleaner
      const assignmentsData = getFromStorage('skyx_assignments', []);
      const updatedAssignments = assignmentsData.filter(a => a.cleanerId !== cleanerId);
      saveToStorage('skyx_assignments', updatedAssignments);
      
      loadData();
      
      toast({
        title: "Уборщик удален",
        description: "Уборщик успешно удален из системы.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      name: '',
      email: '',
      phone: '',
      password: 'cleaner123'
    });
    setEditingCleaner(null);
    setIsDialogOpen(false);
  };

  const getCleanerStats = (cleanerId) => {
    const cleanerAssignments = assignments.filter(a => a.cleanerId === cleanerId);
    const today = new Date().toISOString().split('T')[0];
    
    return {
      total: cleanerAssignments.length,
      completed: cleanerAssignments.filter(a => a.status === 'completed').length,
      todayTasks: cleanerAssignments.filter(a => a.scheduledDate === today).length,
      todayCompleted: cleanerAssignments.filter(a => a.scheduledDate === today && a.status === 'completed').length
    };
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление уборщиками</h1>
          <p className="text-gray-600 mt-1">Управляйте командой уборщиков</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Добавить уборщика
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCleaner ? 'Редактировать уборщика' : 'Добавить нового уборщика'}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о уборщике
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Полное имя</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Мария Иванова"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="maria_ivanova"
                  required
                  disabled={editingCleaner} // Don't allow username change when editing
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="maria@amp.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="cleaner123"
                  required
                />
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingCleaner ? 'Обновить' : 'Добавить'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cleaners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cleaners.map((cleaner) => {
          const stats = getCleanerStats(cleaner.id);
          
          return (
            <Card key={cleaner.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      {getInitials(cleaner.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <CardTitle className="text-lg">{cleaner.name}</CardTitle>
                    <CardDescription>@{cleaner.username}</CardDescription>
                  </div>
                  
                  <Badge className="bg-green-100 text-green-800">
                    Активный
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Contact Info */}
                <div className="space-y-2">
                  {cleaner.email && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{cleaner.email}</span>
                    </div>
                  )}
                  
                  {cleaner.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{cleaner.phone}</span>
                    </div>
                  )}
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 py-3 border-t border-b">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">{stats.completed}</div>
                    <div className="text-xs text-gray-500">Выполнено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{stats.todayCompleted}</div>
                    <div className="text-xs text-gray-500">Сегодня</div>
                  </div>
                </div>
                
                {/* Today's Tasks */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Задач на сегодня: {stats.todayTasks}
                    </span>
                  </div>
                  
                  {stats.todayTasks > 0 && (
                    <div className="flex items-center space-x-1">
                      <Activity className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-600">
                        {Math.round((stats.todayCompleted / stats.todayTasks) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(cleaner)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Изменить
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDelete(cleaner.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {cleaners.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет уборщиков</h3>
            <p className="text-gray-600 mb-4">Добавьте первого уборщика для начала работы</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить уборщика
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCleaners;