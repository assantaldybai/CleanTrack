import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { MapPin, Plus, Edit2, Trash2, Building2, Layers, Square } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const AdminZones = () => {
  const [zones, setZones] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    buildingId: '',
    floor: '',
    type: '',
    area: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const zonesData = getFromStorage('amp_zones', []);
    const buildingsData = getFromStorage('amp_buildings', []);
    setZones(zonesData);
    setBuildings(buildingsData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const zonesData = getFromStorage('amp_zones', []);
    
    if (editingZone) {
      const updatedZones = zonesData.map(z => 
        z.id === editingZone.id 
          ? { 
              ...formData, 
              id: editingZone.id, 
              floor: parseInt(formData.floor),
              area: parseInt(formData.area),
              createdAt: editingZone.createdAt 
            }
          : z
      );
      saveToStorage('amp_zones', updatedZones);
      setZones(updatedZones);
      
      toast({
        title: "Зона обновлена",
        description: "Информация о зоне успешно обновлена.",
      });
    } else {
      const newZone = {
        ...formData,
        id: Date.now().toString(),
        floor: parseInt(formData.floor),
        area: parseInt(formData.area),
        createdAt: new Date().toISOString()
      };
      
      const updatedZones = [...zonesData, newZone];
      saveToStorage('amp_zones', updatedZones);
      setZones(updatedZones);
      
      toast({
        title: "Зона добавлена",
        description: "Новая зона успешно добавлена в систему.",
      });
    }
    
    resetForm();
  };

  const handleEdit = (zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      buildingId: zone.buildingId,
      floor: zone.floor.toString(),
      type: zone.type,
      area: zone.area.toString(),
      description: zone.description
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (zoneId) => {
    if (window.confirm('Вы уверены, что хотите удалить эту зону?')) {
      const zonesData = getFromStorage('amp_zones', []);
      const updatedZones = zonesData.filter(z => z.id !== zoneId);
      saveToStorage('amp_zones', updatedZones);
      setZones(updatedZones);
      
      toast({
        title: "Зона удалена",
        description: "Зона успешно удалена из системы.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      buildingId: '',
      floor: '',
      type: '',
      area: '',
      description: ''
    });
    setEditingZone(null);
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

  const getBuildingName = (buildingId) => {
    const building = buildings.find(b => b.id === buildingId);
    return building ? building.name : 'Неизвестное здание';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление зонами</h1>
          <p className="text-gray-600 mt-1">Настройте зоны для уборки в ваших зданиях</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Добавить зону
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Редактировать зону' : 'Добавить новую зону'}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о зоне уборки
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название зоны</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Офис 1001"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="buildingId">Здание</Label>
                <Select value={formData.buildingId} onValueChange={(value) => setFormData({...formData, buildingId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите здание" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floor">Этаж</Label>
                  <Input
                    id="floor"
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({...formData, floor: e.target.value})}
                    placeholder="1"
                    min="1"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="area">Площадь (м²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={formData.area}
                    onChange={(e) => setFormData({...formData, area: e.target.value})}
                    placeholder="100"
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Тип зоны</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
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
              
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Дополнительная информация о зоне..."
                  rows={3}
                />
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingZone ? 'Обновить' : 'Добавить'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones.map((zone) => (
          <Card key={zone.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">{zone.name}</CardTitle>
                </div>
                <Badge className={getZoneTypeColor(zone.type)}>
                  {getZoneTypeLabel(zone.type)}
                </Badge>
              </div>
              <CardDescription className="flex items-center space-x-1">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{getBuildingName(zone.buildingId)}</span>
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{zone.floor} этаж</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Square className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{zone.area} м²</span>
                </div>
              </div>
              
              {zone.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {zone.description}
                </p>
              )}
              
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEdit(zone)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Изменить
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(zone.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {zones.length === 0 && (
          <div className="col-span-full text-center py-12">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет зон</h3>
            <p className="text-gray-600 mb-4">Добавьте первую зону для начала работы</p>
            {buildings.length === 0 ? (
              <p className="text-sm text-red-600">Сначала добавьте здания</p>
            ) : (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить зону
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminZones;