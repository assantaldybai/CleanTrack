import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { ClipboardList, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const AdminChecklists = () => {
  const [checklists, setChecklists] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    zoneType: '',
    items: []
  });

  const [newTask, setNewTask] = useState('');
  const [newTaskRequired, setNewTaskRequired] = useState(true);

  useEffect(() => {
    loadChecklists();
  }, []);

  const loadChecklists = () => {
    const checklistsData = getFromStorage('amp_checklists', []);
    setChecklists(checklistsData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      toast({
        title: "Ошибка",
        description: "Добавьте хотя бы одну задачу в чек-лист.",
        variant: "destructive"
      });
      return;
    }
    
    const checklistsData = getFromStorage('amp_checklists', []);
    
    if (editingChecklist) {
      const updatedChecklists = checklistsData.map(c => 
        c.id === editingChecklist.id 
          ? { ...formData, id: editingChecklist.id }
          : c
      );
      saveToStorage('amp_checklists', updatedChecklists);
      setChecklists(updatedChecklists);
      
      toast({
        title: "Чек-лист обновлен",
        description: "Чек-лист успешно обновлен.",
      });
    } else {
      const newChecklist = {
        ...formData,
        id: Date.now().toString()
      };
      
      const updatedChecklists = [...checklistsData, newChecklist];
      saveToStorage('amp_checklists', updatedChecklists);
      setChecklists(updatedChecklists);
      
      toast({
        title: "Чек-лист добавлен",
        description: "Новый чек-лист успешно добавлен.",
      });
    }
    
    resetForm();
  };

  const handleEdit = (checklist) => {
    setEditingChecklist(checklist);
    setFormData({
      name: checklist.name,
      zoneType: checklist.zoneType,
      items: [...checklist.items]
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (checklistId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот чек-лист?')) {
      const checklistsData = getFromStorage('amp_checklists', []);
      const updatedChecklists = checklistsData.filter(c => c.id !== checklistId);
      saveToStorage('amp_checklists', updatedChecklists);
      setChecklists(updatedChecklists);
      
      toast({
        title: "Чек-лист удален",
        description: "Чек-лист успешно удален.",
        variant: "destructive"
      });
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    
    const newTaskItem = {
      id: Date.now().toString(),
      task: newTask.trim(),
      required: newTaskRequired
    };
    
    setFormData({
      ...formData,
      items: [...formData.items, newTaskItem]
    });
    
    setNewTask('');
    setNewTaskRequired(true);
  };

  const removeTask = (taskId) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.id !== taskId)
    });
  };

  const toggleTaskRequired = (taskId) => {
    setFormData({
      ...formData,
      items: formData.items.map(item => 
        item.id === taskId 
          ? { ...item, required: !item.required }
          : item
      )
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      zoneType: '',
      items: []
    });
    setNewTask('');
    setNewTaskRequired(true);
    setEditingChecklist(null);
    setIsDialogOpen(false);
  };

  const getZoneTypeLabel = (type) => {
    const types = {
      office: 'Офис',
      restroom: 'Туалет',
      kitchen: 'Кухня',
      corridor: 'Коридор',
      lobby: 'Холл',
      meeting_room: 'Переговорная',
      retail: 'Торговый зал',
      warehouse: 'Склад',
      parking: 'Парковка'
    };
    return types[type] || type;
  };

  const getZoneTypeColor = (type) => {
    const colors = {
      office: 'bg-blue-100 text-blue-800',
      restroom: 'bg-red-100 text-red-800',
      kitchen: 'bg-orange-100 text-orange-800',
      corridor: 'bg-gray-100 text-gray-800',
      lobby: 'bg-purple-100 text-purple-800',
      meeting_room: 'bg-green-100 text-green-800',
      retail: 'bg-pink-100 text-pink-800',
      warehouse: 'bg-yellow-100 text-yellow-800',
      parking: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление чек-листами</h1>
          <p className="text-gray-600 mt-1">Создавайте чек-листы для разных типов зон</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Создать чек-лист
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingChecklist ? 'Редактировать чек-лист' : 'Создать новый чек-лист'}
              </DialogTitle>
              <DialogDescription>
                Настройте задачи для определенного типа зон
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название чек-листа</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Стандартная уборка офиса"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zoneType">Тип зоны</Label>
                  <Select value={formData.zoneType} onValueChange={(value) => setFormData({...formData, zoneType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип зоны" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Офис</SelectItem>
                      <SelectItem value="restroom">Туалет</SelectItem>
                      <SelectItem value="kitchen">Кухня</SelectItem>
                      <SelectItem value="corridor">Коридор</SelectItem>
                      <SelectItem value="lobby">Холл</SelectItem>
                      <SelectItem value="meeting_room">Переговорная</SelectItem>
                      <SelectItem value="retail">Торговый зал</SelectItem>
                      <SelectItem value="warehouse">Склад</SelectItem>
                      <SelectItem value="parking">Парковка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Add Task Section */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <Label>Добавить задачу</Label>
                <div className="flex space-x-2">
                  <Input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Описание задачи..."
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="required"
                      checked={newTaskRequired}
                      onCheckedChange={setNewTaskRequired}
                    />
                    <Label htmlFor="required" className="text-sm">Обязательная</Label>
                  </div>
                  <Button type="button" onClick={addTask}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Tasks List */}
              {formData.items.length > 0 && (
                <div className="space-y-2">
                  <Label>Задачи в чек-листе ({formData.items.length})</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {formData.items.map((item, index) => (
                      <div key={item.id} className="flex items-center space-x-2 p-3 bg-white border rounded-lg">
                        <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                        <span className="flex-1">{item.task}</span>
                        <button
                          type="button"
                          onClick={() => toggleTaskRequired(item.id)}
                          className={`text-xs px-2 py-1 rounded ${
                            item.required 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.required ? 'Обязательная' : 'Опциональная'}
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTask(item.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingChecklist ? 'Обновить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Checklists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {checklists.map((checklist) => (
          <Card key={checklist.id} className="group hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">{checklist.name}</CardTitle>
                </div>
                <Badge className={getZoneTypeColor(checklist.zoneType)}>
                  {getZoneTypeLabel(checklist.zoneType)}
                </Badge>
              </div>
              <CardDescription>
                {checklist.items.length} задач • {checklist.items.filter(i => i.required).length} обязательных
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {checklist.items.slice(0, 5).map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2 text-sm">
                    {item.required ? (
                      <Check className="h-4 w-4 text-red-500" />
                    ) : (
                      <Check className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={item.required ? 'text-gray-900' : 'text-gray-600'}>
                      {item.task}
                    </span>
                  </div>
                ))}
                {checklist.items.length > 5 && (
                  <p className="text-xs text-gray-500">
                    И ещё {checklist.items.length - 5} задач...
                  </p>
                )}
              </div>
              
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEdit(checklist)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Изменить
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(checklist.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {checklists.length === 0 && (
          <div className="col-span-full text-center py-12">
            <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет чек-листов</h3>
            <p className="text-gray-600 mb-4">Создайте первый чек-лист для начала работы</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать чек-лист
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChecklists;