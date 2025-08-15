import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Clock, MapPin, Building2, CheckCircle, Camera } from 'lucide-react';
import { getFromStorage } from '../../mockData';

const CleanerHistory = () => {
  const { user } = useAuth();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [zones, setZones] = useState([]);
  const [checklists, setChecklists] = useState([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = () => {
    const assignmentsData = getFromStorage('skyx_assignments', []);
    const buildingsData = getFromStorage('skyx_buildings', []);
    const zonesData = getFromStorage('skyx_zones', []);
    const checklistsData = getFromStorage('skyx_checklists', []);
    const completedTasksData = getFromStorage('skyx_completed_tasks', []);
    
    // Filter completed assignments for current user
    const myCompletedAssignments = assignmentsData.filter(
      a => a.cleanerId === user.id && a.status === 'completed'
    );
    
    // Add completion details to assignments
    const tasksWithDetails = myCompletedAssignments.map(assignment => {
      const completedTask = completedTasksData.find(ct => ct.assignmentId === assignment.id);
      const zone = zonesData.find(z => z.id === assignment.zoneId);
      const building = buildingsData.find(b => b.id === zone?.buildingId);
      const checklist = checklistsData.find(c => c.id === assignment.checklistId);
      
      return {
        ...assignment,
        completionDetails: completedTask,
        zoneName: zone?.name || 'Неизвестная зона',
        buildingName: building?.name || 'Неизвестное здание',
        checklistName: checklist?.name || 'Неизвестный чек-лист',
        zoneFloor: zone?.floor || '?',
        taskCount: checklist?.items?.length || 0
      };
    });
    
    // Sort by completion date (newest first)
    tasksWithDetails.sort((a, b) => 
      new Date(b.completedAt || b.scheduledDate) - new Date(a.completedAt || a.scheduledDate)
    );
    
    setCompletedTasks(tasksWithDetails);
    setBuildings(buildingsData);
    setZones(zonesData);
    setChecklists(checklistsData);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Неизвестно';
    
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (dateStr.startsWith(today.toISOString().split('T')[0])) {
      return `Сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (dateStr.startsWith(yesterday.toISOString().split('T')[0])) {
      return `Вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getCompletionStats = (completionDetails) => {
    if (!completionDetails) return { completed: 0, total: 0 };
    
    const completed = completionDetails.completedItems?.filter(item => item.completed).length || 0;
    const total = completionDetails.completedItems?.length || 0;
    
    return { completed, total };
  };

  const getCompletionColor = (stats) => {
    const percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    
    if (percentage === 100) return 'bg-green-100 text-green-800';
    if (percentage >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">История работ</h1>
        <p className="text-gray-600 mt-1">Просмотр выполненных заданий</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Всего выполнено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs opacity-75">заданий</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">За неделю</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTasks.filter(task => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(task.completedAt || task.scheduledDate) >= weekAgo;
              }).length}
            </div>
            <p className="text-xs opacity-75">заданий</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">За месяц</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTasks.filter(task => {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                return new Date(task.completedAt || task.scheduledDate) >= monthAgo;
              }).length}
            </div>
            <p className="text-xs opacity-75">заданий</p>
          </CardContent>
        </Card>
      </div>

      {/* Completed Tasks List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Выполненные задания</h2>
        
        {completedTasks.map((task) => {
          const stats = getCompletionStats(task.completionDetails);
          
          return (
            <Card key={task.id} className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold text-lg">{task.zoneName}</h3>
                      <Badge className={getCompletionColor(stats)}>
                        {stats.completed}/{stats.total} задач
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{task.buildingName}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{task.zoneFloor} этаж</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>Запланировано: {task.scheduledDate}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Выполнено: {formatDate(task.completedAt)}</span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      Чек-лист: {task.checklistName}
                    </div>
                    
                    {task.completionDetails?.notes && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Заметки:</strong> {task.completionDetails.notes}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center space-y-2">
                    {task.completionDetails?.finalPhoto && (
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Camera className="h-4 w-4" />
                        <span>Фото</span>
                      </div>
                    )}
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500">выполнено</div>
                    </div>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {completedTasks.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет выполненных заданий</h3>
            <p className="text-gray-600">Выполненные задания будут отображаться здесь</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CleanerHistory;