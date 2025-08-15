import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Building2, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { getFromStorage, saveToStorage } from '../../mockData';
import { useToast } from '../../hooks/use-toast';

const CleanerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [zones, setZones] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [stats, setStats] = useState({
    todayTasks: 0,
    todayCompleted: 0,
    totalCompleted: 0,
    inProgress: 0
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = () => {
    const assignmentsData = getFromStorage('skyx_assignments', []);
    const buildingsData = getFromStorage('skyx_buildings', []);
    const zonesData = getFromStorage('skyx_zones', []);
    const checklistsData = getFromStorage('skyx_checklists', []);
    
    // Filter assignments for current user
    const myAssignments = assignmentsData.filter(a => a.cleanerId === user.id);
    
    setAssignments(myAssignments);
    setBuildings(buildingsData);
    setZones(zonesData);
    setChecklists(checklistsData);
    
    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = myAssignments.filter(a => a.scheduledDate === today);
    
    setStats({
      todayTasks: todayTasks.length,
      todayCompleted: todayTasks.filter(a => a.status === 'completed').length,
      totalCompleted: myAssignments.filter(a => a.status === 'completed').length,
      inProgress: myAssignments.filter(a => a.status === 'in_progress').length
    });
  };

  const getAssignmentDetails = (assignment) => {
    const zone = zones.find(z => z.id === assignment.zoneId);
    const building = buildings.find(b => b.id === zone?.buildingId);
    const checklist = checklists.find(c => c.id === assignment.checklistId);
    
    return {
      zoneName: zone?.name || 'Неизвестная зона',
      buildingName: building?.name || 'Неизвестное здание',
      checklistName: checklist?.name || 'Неизвестный чек-лист',
      zoneFloor: zone?.floor || '?',
      taskCount: checklist?.items?.length || 0
    };
  };

  const handleStartTask = (assignmentId) => {
    const assignmentsData = getFromStorage('skyx_assignments', []);
    const updatedAssignments = assignmentsData.map(a => 
      a.id === assignmentId 
        ? { ...a, status: 'in_progress' }
        : a
    );
    saveToStorage('skyx_assignments', updatedAssignments);
    
    navigate(`/cleaner/task/${assignmentId}`);
  };

  const handleContinueTask = (assignmentId) => {
    navigate(`/cleaner/task/${assignmentId}`);
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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Сегодня';
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return 'Завтра';
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric',
        month: 'short',
        weekday: 'short'
      });
    }
  };

  const isOverdue = (assignment) => {
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    
    if (assignment.scheduledDate < today) return true;
    if (assignment.scheduledDate === today && assignment.scheduledTime < currentTime && assignment.status === 'pending') {
      return true;
    }
    return false;
  };

  // Sort assignments: in_progress first, then by date and time
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    
    const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
    if (dateCompare !== 0) return dateCompare;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои задания</h1>
        <p className="text-gray-600 mt-1">Добро пожаловать, {user.name}!</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Сегодня</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTasks}</div>
            <p className="text-xs opacity-75">заданий</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Выполнено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCompleted}</div>
            <p className="text-xs opacity-75">из {stats.todayTasks} сегодня</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">В процессе</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs opacity-75">активных задач</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Всего</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompleted}</div>
            <p className="text-xs opacity-75">выполнено</p>
          </CardContent>
        </Card>
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Список заданий</h2>
        
        {sortedAssignments.map((assignment) => {
          const details = getAssignmentDetails(assignment);
          const overdue = isOverdue(assignment);
          
          return (
            <Card key={assignment.id} className={`group hover:shadow-lg transition-all duration-300 ${
              overdue ? 'border-red-200 bg-red-50/50' : ''
            } ${assignment.status === 'in_progress' ? 'border-yellow-200 bg-yellow-50/30' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      {overdue && <AlertCircle className="h-5 w-5 text-red-500" />}
                      <h3 className="font-semibold text-lg">{details.zoneName}</h3>
                      {getStatusBadge(assignment.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{details.buildingName}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{details.zoneFloor} этаж</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(assignment.scheduledDate)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {assignment.scheduledTime}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <span>Чек-лист: {details.checklistName}</span>
                      <span className="ml-4">({details.taskCount} задач)</span>
                    </div>
                    
                    {overdue && (
                      <div className="flex items-center space-x-2 text-red-600 text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        <span>Задание просрочено</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    {assignment.status === 'pending' && (
                      <Button 
                        onClick={() => handleStartTask(assignment.id)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Начать
                      </Button>
                    )}
                    
                    {assignment.status === 'in_progress' && (
                      <Button 
                        onClick={() => handleContinueTask(assignment.id)}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                      >
                        Продолжить
                      </Button>
                    )}
                    
                    {assignment.status === 'completed' && (
                      <Button 
                        onClick={() => navigate(`/cleaner/task/${assignment.id}`)}
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Просмотр
                      </Button>
                    )}
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
            <p className="text-gray-600">Администратор ещё не назначил вам заданий</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CleanerDashboard;