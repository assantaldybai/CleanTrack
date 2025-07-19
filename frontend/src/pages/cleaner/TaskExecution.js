import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Camera, 
  Check, 
  X, 
  ArrowLeft, 
  MapPin, 
  Building2, 
  Clock, 
  Calendar,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const TaskExecution = () => {
  const { user } = useAuth();
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const finalPhotoInputRef = useRef(null);

  const [assignment, setAssignment] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [zone, setZone] = useState(null);
  const [building, setBuilding] = useState(null);
  const [completedItems, setCompletedItems] = useState([]);
  const [finalPhoto, setFinalPhoto] = useState(null);
  const [notes, setNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    loadTaskData();
  }, [taskId]);

  const loadTaskData = () => {
    const assignments = getFromStorage('amp_assignments', []);
    const checklists = getFromStorage('amp_checklists', []);
    const zones = getFromStorage('amp_zones', []);
    const buildings = getFromStorage('amp_buildings', []);
    const completedTasks = getFromStorage('amp_completed_tasks', []);

    const currentAssignment = assignments.find(a => a.id === taskId);
    if (!currentAssignment) {
      navigate('/cleaner/dashboard');
      return;
    }

    if (currentAssignment.cleanerId !== user.id) {
      toast({
        title: "Ошибка доступа",
        description: "У вас нет прав на выполнение этого задания.",
        variant: "destructive"
      });
      navigate('/cleaner/dashboard');
      return;
    }

    const currentChecklist = checklists.find(c => c.id === currentAssignment.checklistId);
    const currentZone = zones.find(z => z.id === currentAssignment.zoneId);
    const currentBuilding = buildings.find(b => b.id === currentZone?.buildingId);

    setAssignment(currentAssignment);
    setChecklist(currentChecklist);
    setZone(currentZone);
    setBuilding(currentBuilding);

    // Load existing progress if task is in progress or completed
    const existingTask = completedTasks.find(ct => ct.assignmentId === taskId);
    if (existingTask) {
      setCompletedItems(existingTask.completedItems || []);
      setFinalPhoto(existingTask.finalPhoto);
      setNotes(existingTask.notes || '');
    } else if (currentChecklist) {
      // Initialize with uncompleted items
      setCompletedItems(
        currentChecklist.items.map(item => ({
          id: item.id,
          completed: false,
          photo: null
        }))
      );
    }
  };

  const handleItemToggle = (itemId) => {
    setCompletedItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };

  const handlePhotoUpload = (itemId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Файл слишком большой",
        description: "Размер фото не должен превышать 5MB.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCompletedItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, photo: e.target.result }
            : item
        )
      );
      
      toast({
        title: "Фото добавлено",
        description: "Фотография успешно загружена.",
      });
    };
    reader.readAsDataURL(file);
    
    // Clear the input
    event.target.value = '';
  };

  const handleFinalPhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Файл слишком большой",
        description: "Размер фото не должен превышать 5MB.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFinalPhoto(e.target.result);
      toast({
        title: "Итоговое фото добавлено",
        description: "Фотография результата успешно загружена.",
      });
    };
    reader.readAsDataURL(file);
    
    // Clear the input
    event.target.value = '';
  };

  const removePhoto = (itemId) => {
    setCompletedItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, photo: null }
          : item
      )
    );
  };

  const removeFinalPhoto = () => {
    setFinalPhoto(null);
  };

  const saveProgress = () => {
    const completedTasksData = getFromStorage('amp_completed_tasks', []);
    const existingIndex = completedTasksData.findIndex(ct => ct.assignmentId === taskId);
    
    const taskData = {
      id: existingIndex >= 0 ? completedTasksData[existingIndex].id : Date.now().toString(),
      assignmentId: taskId,
      cleanerId: user.id,
      completedItems,
      finalPhoto,
      notes,
      completedAt: assignment?.status === 'completed' ? new Date().toISOString() : null
    };

    if (existingIndex >= 0) {
      completedTasksData[existingIndex] = taskData;
    } else {
      completedTasksData.push(taskData);
    }
    
    saveToStorage('amp_completed_tasks', completedTasksData);
    
    // Update assignment status to in_progress if it was pending
    const assignments = getFromStorage('amp_assignments', []);
    const updatedAssignments = assignments.map(a => 
      a.id === taskId && a.status === 'pending'
        ? { ...a, status: 'in_progress' }
        : a
    );
    saveToStorage('amp_assignments', updatedAssignments);
  };

  const completeTask = async () => {
    if (!finalPhoto) {
      toast({
        title: "Требуется итоговое фото",
        description: "Добавьте фотографию результата работы перед завершением.",
        variant: "destructive"
      });
      return;
    }

    const requiredItems = checklist.items.filter(item => item.required);
    const completedRequired = completedItems.filter(item => {
      const checklistItem = checklist.items.find(ci => ci.id === item.id);
      return checklistItem?.required && item.completed;
    });

    if (completedRequired.length < requiredItems.length) {
      toast({
        title: "Не все обязательные задачи выполнены",
        description: `Выполните все ${requiredItems.length} обязательных задач перед завершением.`,
        variant: "destructive"
      });
      return;
    }

    setIsCompleting(true);

    try {
      // Save final task data
      const completedTasksData = getFromStorage('amp_completed_tasks', []);
      const existingIndex = completedTasksData.findIndex(ct => ct.assignmentId === taskId);
      
      const taskData = {
        id: existingIndex >= 0 ? completedTasksData[existingIndex].id : Date.now().toString(),
        assignmentId: taskId,
        cleanerId: user.id,
        completedItems,
        finalPhoto,
        notes,
        completedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        completedTasksData[existingIndex] = taskData;
      } else {
        completedTasksData.push(taskData);
      }
      
      saveToStorage('amp_completed_tasks', completedTasksData);

      // Update assignment status to completed
      const assignments = getFromStorage('amp_assignments', []);
      const updatedAssignments = assignments.map(a => 
        a.id === taskId 
          ? { ...a, status: 'completed', completedAt: new Date().toISOString() }
          : a
      );
      saveToStorage('amp_assignments', updatedAssignments);

      toast({
        title: "Задание выполнено!",
        description: "Отличная работа! Задание успешно завершено.",
      });

      setTimeout(() => {
        navigate('/cleaner/dashboard');
      }, 1500);

    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при завершении задания.",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // Auto-save progress every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (assignment?.status !== 'completed') {
        saveProgress();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [completedItems, finalPhoto, notes, assignment]);

  if (!assignment || !checklist || !zone || !building) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const completedCount = completedItems.filter(item => item.completed).length;
  const totalCount = completedItems.length;
  const requiredCount = checklist.items.filter(item => item.required).length;
  const completedRequiredCount = completedItems.filter(item => {
    const checklistItem = checklist.items.find(ci => ci.id === item.id);
    return checklistItem?.required && item.completed;
  }).length;

  const canComplete = assignment.status !== 'completed' && 
                     completedRequiredCount === requiredCount && 
                     finalPhoto;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/cleaner/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{zone.name}</h1>
            <p className="text-gray-600">{building.name}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {assignment.status === 'completed' ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Выполнено
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800">
              В процессе
            </Badge>
          )}
        </div>
      </div>

      {/* Task Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{building.name}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{zone.floor} этаж</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{assignment.scheduledDate}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{assignment.scheduledTime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Прогресс выполнения</CardTitle>
            <div className="text-sm text-gray-600">
              {completedCount}/{totalCount} задач • {completedRequiredCount}/{requiredCount} обязательных
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            ></div>
          </div>
          
          {completedRequiredCount < requiredCount && (
            <div className="flex items-center space-x-2 text-red-600 text-sm mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                Выполните все {requiredCount} обязательных задач для завершения
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>{checklist.name}</CardTitle>
          <CardDescription>
            Отмечайте выполненные задачи и добавляйте фотографии при необходимости
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checklist.items.map((item) => {
            const completedItem = completedItems.find(ci => ci.id === item.id);
            const isCompleted = completedItem?.completed || false;
            const hasPhoto = completedItem?.photo;

            return (
              <div 
                key={item.id} 
                className={`p-4 rounded-lg border transition-all ${
                  isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                } ${assignment.status === 'completed' ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex items-center space-x-2 flex-1">
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={isCompleted}
                      onCheckedChange={() => handleItemToggle(item.id)}
                      disabled={assignment.status === 'completed'}
                    />
                    
                    <label 
                      htmlFor={`item-${item.id}`} 
                      className={`flex-1 cursor-pointer ${
                        isCompleted ? 'line-through text-gray-600' : ''
                      }`}
                    >
                      {item.task}
                      {item.required && (
                        <Badge variant="outline" className="ml-2 text-xs border-red-200 text-red-600">
                          Обязательно
                        </Badge>
                      )}
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {hasPhoto && (
                      <div className="relative">
                        <img 
                          src={hasPhoto} 
                          alt="Задача" 
                          className="w-16 h-16 object-cover rounded-lg border-2 border-green-200"
                        />
                        {assignment.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 bg-red-500 hover:bg-red-600 text-white border-red-500"
                            onClick={() => removePhoto(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {assignment.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-1"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{hasPhoto ? 'Заменить' : 'Фото'}</span>
                      </Button>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(item.id, e)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Final Photo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>Итоговое фото зоны</span>
            {!finalPhoto && (
              <Badge variant="outline" className="border-red-200 text-red-600">
                Обязательно
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Сделайте фото зоны после завершения всех работ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {finalPhoto ? (
            <div className="relative inline-block">
              <img 
                src={finalPhoto} 
                alt="Итоговое фото" 
                className="max-w-sm w-full h-48 object-cover rounded-lg border-2 border-green-200"
              />
              {assignment.status !== 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white border-red-500"
                  onClick={removeFinalPhoto}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            assignment.status !== 'completed' && (
              <Button
                variant="outline"
                onClick={() => finalPhotoInputRef.current?.click()}
                className="flex items-center space-x-2 h-32 w-48 border-dashed border-2 border-gray-300 hover:border-gray-400"
              >
                <Upload className="h-6 w-6" />
                <span>Добавить фото</span>
              </Button>
            )
          )}
          
          <input
            ref={finalPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFinalPhotoUpload}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Дополнительные заметки</CardTitle>
          <CardDescription>
            Добавьте комментарии о выполненной работе (не обязательно)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Опишите особенности выполнения, найденные проблемы или другую полезную информацию..."
            rows={4}
            disabled={assignment.status === 'completed'}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      {assignment.status !== 'completed' && (
        <div className="flex space-x-4">
          <Button
            onClick={saveProgress}
            variant="outline"
            className="flex-1"
          >
            Сохранить прогресс
          </Button>
          
          <Button
            onClick={completeTask}
            disabled={!canComplete || isCompleting}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          >
            {isCompleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Завершаем...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Завершить задание
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskExecution;