import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Building2, Plus, Edit2, Trash2, MapPin, Layers, Square } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const AdminBuildings = () => {
  const [buildings, setBuildings] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: '',
    floors: '',
    totalArea: ''
  });

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = () => {
    const buildingsData = getFromStorage('amp_buildings', []);
    setBuildings(buildingsData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const buildingsData = getFromStorage('amp_buildings', []);
    
    if (editingBuilding) {
      // Update existing building
      const updatedBuildings = buildingsData.map(b => 
        b.id === editingBuilding.id 
          ? { ...formData, id: editingBuilding.id, createdAt: editingBuilding.createdAt }
          : b
      );
      saveToStorage('amp_buildings', updatedBuildings);
      setBuildings(updatedBuildings);
      
      toast({
        title: "Здание обновлено",
        description: "Информация о здании успешно обновлена.",
      });
    } else {
      // Create new building
      const newBuilding = {
        ...formData,
        id: Date.now().toString(),
        floors: parseInt(formData.floors),
        totalArea: parseInt(formData.totalArea),
        createdAt: new Date().toISOString()
      };
      
      const updatedBuildings = [...buildingsData, newBuilding];
      saveToStorage('amp_buildings', updatedBuildings);
      setBuildings(updatedBuildings);
      
      toast({
        title: "Здание добавлено",
        description: "Новое здание успешно добавлено в систему.",
      });
    }
    
    resetForm();
  };

  const handleEdit = (building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      type: building.type,
      floors: building.floors.toString(),
      totalArea: building.totalArea.toString()
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (buildingId) => {
    if (window.confirm('Вы уверены, что хотите удалить это здание?')) {
      const buildingsData = getFromStorage('amp_buildings', []);
      const updatedBuildings = buildingsData.filter(b => b.id !== buildingId);
      saveToStorage('amp_buildings', updatedBuildings);
      setBuildings(updatedBuildings);
      
      toast({
        title: "Здание удалено",
        description: "Здание успешно удалено из системы.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      type: '',
      floors: '',
      totalArea: ''
    });
    setEditingBuilding(null);
    setIsDialogOpen(false);
  };

  const getBuildingTypeLabel = (type) => {
    const types = {
      office: 'Офисное',
      shopping: 'ТЦ',
      residential: 'Жилое',
      industrial: 'Промышленное',
      hotel: 'Отель',
      medical: 'Медицинское'
    };
    return types[type] || type;
  };

  const getBuildingTypeColor = (type) => {
    const colors = {
      office: 'bg-blue-100 text-blue-800',
      shopping: 'bg-purple-100 text-purple-800',
      residential: 'bg-green-100 text-green-800',
      industrial: 'bg-orange-100 text-orange-800',
      hotel: 'bg-pink-100 text-pink-800',
      medical: 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление зданиями</h1>
          <p className="text-gray-600 mt-1">Добавляйте и управляйте объектами для уборки</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Добавить здание
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBuilding ? 'Редактировать здание' : 'Добавить новое здание'}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о здании для добавления в систему
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название здания</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Офисный центр «Москва-Сити»"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Адрес</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Тип здания</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип здания" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Офисное</SelectItem>
                    <SelectItem value="shopping">Торговый центр</SelectItem>
                    <SelectItem value="residential">Жилое</SelectItem>
                    <SelectItem value="industrial">Промышленное</SelectItem>
                    <SelectItem value="hotel">Отель</SelectItem>
                    <SelectItem value="medical">Медицинское</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floors">Этажей</Label>
                  <Input
                    id="floors"
                    type="number"
                    value={formData.floors}
                    onChange={(e) => setFormData({...formData, floors: e.target.value})}
                    placeholder="10"
                    min="1"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="totalArea">Площадь (м²)</Label>
                  <Input
                    id="totalArea"
                    type="number"
                    value={formData.totalArea}
                    onChange={(e) => setFormData({...formData, totalArea: e.target.value})}
                    placeholder="5000"
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingBuilding ? 'Обновить' : 'Добавить'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buildings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {buildings.map((building) => (
          <Card key={building.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{building.name}</CardTitle>
                </div>
                <Badge className={getBuildingTypeColor(building.type)}>
                  {getBuildingTypeLabel(building.type)}
                </Badge>
              </div>
              <CardDescription className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{building.address}</span>
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{building.floors} эт.</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Square className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{building.totalArea} м²</span>
                </div>
              </div>
              
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEdit(building)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Изменить
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(building.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {buildings.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет зданий</h3>
            <p className="text-gray-600 mb-4">Добавьте первое здание для начала работы с системой</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить здание
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBuildings;