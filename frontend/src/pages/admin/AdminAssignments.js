import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Calendar, Plus, Edit2, Trash2, Clock, User, MapPin, Building2 } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const AdminAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [zones, setZones] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cleanerId: '',
    zoneId: '',
    checklistId: '',
    scheduledDate: '',
    scheduledTime: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const assignmentsData = getFromStorage('skyx_assignments', []);
    const buildingsData = getFromStorage('skyx_buildings', []);
    const zonesData = getFromStorage('skyx_zones', []);
    const checklistsData = getFromStorage('skyx_checklists', []);
    const users = getFromStorage('skyx_users', []);
    const cleanersData = users.filter(u => u.role === 'cleaner');
    
    setAssignments(assignmentsData);
    setBuildings(buildingsData);
    setZones(zonesData);
    setChecklists(checklistsData);
    setCleaners(cleanersData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const assignmentsData = getFromStorage('skyx_assignments', []);
    
    if (editingAssignment) {
      const updatedAssignments = assignmentsData.map(a => 
        a.id === editingAssignment.id 
          ? { ...formData, id: editingAssignment.id, status: editingAssignment.status, createdAt: editingAssignment.createdAt }
          : a
      );
      saveToStorage('skyx_assignments', updatedAssignments);
      
      toast({
        title: "Задание обновлено",
        description: "Задание успешно обновлено.",
      });
    } else {
      const newAssignment = {
        ...formData,
        id: Date.now().toString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      const updatedAssignments = [...assignmentsData, newAssignment];
      saveToStorage('skyx_assignments', updatedAssignments);
      
      toast({
        title: "Задание создано",
        description: "Новое задание успешно создано.",
      });
    }
    
    loadData();
    resetForm();
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      cleanerId: assignment.cleanerId,
      zoneId: assignment.zoneId,
      checklistId: assignment.checklistId,
      scheduledDate: assignment.scheduledDate,
      scheduledTime: assignment.scheduledTime
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (assignmentId) => {
    if (window.confirm('Вы уверены, что хотите удалить это задание?')) {
      const assignmentsData = getFromStorage('skyx_assignments', []);
      const updatedAssignments = assignmentsData.filter(a => a.id !== assignmentId);
      saveToStorage('skyx_assignments', updatedAssignments);
      
      loadData();
      
      toast({
        title: "Задание удалено",
        description: "Задание успешно удалено.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      cleanerId: '',
      zoneId: '',
      checklistId: '',
      scheduledDate: '',
      scheduledTime: ''
    });
    setEditingAssignment(null);
    setIsDialogOpen(false);
  };

  const getAssignmentDetails = (assignment) => {
    const cleaner = cleaners.find(c => c.id === assignment.cleanerId);
    const zone = zones.find(z => z.id === assignment.zoneId);
    const building = buildings.find(b => b.id === zone?.buildingId);
    const checklist = checklists.find(c => c.id === assignment.checklistId);
    
    return {
      cleanerName: cleaner?.name || 'Неизвестный уборщик',
      zoneName: zone?.name || 'Неизвестная зона',
      buildingName: building?.name || 'Неизвестное здание',
      checklistName: checklist?.name || 'Неизвестный чек-лист',
      zoneFloor: zone?.floor || '?'
    };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Выполнено</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800">В процессе</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800">Ожидание</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getZonesForBuilding = (buildingId) => {
    return zones.filter(z => z.buildingId === buildingId);
  };

  const getChecklistsForZone = (zoneId) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return [];
    return checklists.filter(c => c.zoneType === zone.type);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric',
      month: 'short',
      weekday: 'short'
    });
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление заданиями</h1>
          <p className="text-gray-600 mt-1">Назначайте задания уборщикам</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Создать задание
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? 'Редактировать задание' : 'Создать новое задание'}
              </DialogTitle>
              <DialogDescription>
                Назначьте задание уборщику
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cleanerId">Уборщик</Label>
                <Select value={formData.cleanerId} onValueChange={(value) => setFormData({...formData, cleanerId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите уборщика" />
                  </SelectTrigger>
                  <SelectContent>
                    {cleaners.map(cleaner => (
                      <SelectItem key={cleaner.id} value={cleaner.id}>
                        {cleaner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="zoneId">Зона</Label>
                <Select value={formData.zoneId} onValueChange={(value) => setFormData({...formData, zoneId: value, checklistId: ''})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите зону" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(building => (
                      <div key={building.id}>
                        <div className="px-2 py-1 text-sm font-medium text-gray-500 bg-gray-100">
                          {building.name}
                        </div>
                        {getZonesForBuilding(building.id).map(zone => (
                          <SelectItem key={zone.id} value={zone.id}>
                            <span className="ml-2">{zone.name} ({zone.floor} этаж)</span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.zoneId && (
                <div className="space-y-2">
                  <Label htmlFor="checklistId">Чек-лист</Label>
                  <Select value={formData.checklistId} onValueChange={(value) => setFormData({...formData, checklistId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите чек-лист" />
                    </SelectTrigger>
                    <SelectContent>
                      {getChecklistsForZone(formData.zoneId).map(checklist => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Дата</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                    min={today}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Время</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingAssignment ? 'Обновить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {assignments.map((assignment) => {
          const details = getAssignmentDetails(assignment);
          
          return (
            <Card key={assignment.id} className="group hover:shadow-md transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{details.cleanerName}</span>
                      </div>
                      
                      {getStatusBadge(assignment.status)}
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-4 w-4" />
                        <span>{details.buildingName}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{details.zoneName}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(assignment.scheduledDate)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{assignment.scheduledTime}</span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      Чек-лист: {details.checklistName}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(assignment)}
                      disabled={assignment.status === 'completed'}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Изменить
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет заданий</h3>
            <p className="text-gray-600 mb-4">Создайте первое задание для начала работы</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать задание
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAssignments;