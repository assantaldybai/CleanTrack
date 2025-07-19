import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Building2, Users, ClipboardList, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { getFromStorage } from '../../mockData';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalZones: 0,
    totalCleaners: 0,
    totalAssignments: 0,
    completedToday: 0,
    pendingToday: 0
  });
  
  const [recentAssignments, setRecentAssignments] = useState([]);

  useEffect(() => {
    const buildings = getFromStorage('amp_buildings', []);
    const zones = getFromStorage('amp_zones', []);
    const cleaners = getFromStorage('amp_users', []).filter(u => u.role === 'cleaner');
    const assignments = getFromStorage('amp_assignments', []);
    
    const today = new Date().toISOString().split('T')[0];
    const todayAssignments = assignments.filter(a => a.scheduledDate === today);
    
    setStats({
      totalBuildings: buildings.length,
      totalZones: zones.length,
      totalCleaners: cleaners.length,
      totalAssignments: assignments.length,
      completedToday: todayAssignments.filter(a => a.status === 'completed').length,
      pendingToday: todayAssignments.filter(a => a.status === 'pending').length
    });

    // Get recent assignments with details
    const assignmentsWithDetails = assignments.slice(0, 5).map(assignment => {
      const zone = zones.find(z => z.id === assignment.zoneId);
      const building = buildings.find(b => b.id === zone?.buildingId);
      const cleaner = cleaners.find(c => c.id === assignment.cleanerId);
      
      return {
        ...assignment,
        zoneName: zone?.name || 'Неизвестная зона',
        buildingName: building?.name || 'Неизвестное здание',
        cleanerName: cleaner?.name || 'Неизвестный уборщик'
      };
    });
    
    setRecentAssignments(assignmentsWithDetails);
  }, []);

  const StatCard = ({ title, value, icon: Icon, description, trend }) => (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
    </Card>
  );

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <p className="text-gray-600 mt-1">Обзор системы управления уборкой AMP</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Зданий"
          value={stats.totalBuildings}
          icon={Building2}
          description="Всего объектов"
          trend="+12% с прошлого месяца"
        />
        
        <StatCard
          title="Зон уборки"
          value={stats.totalZones}
          icon={ClipboardList}
          description="Активных зон"
        />
        
        <StatCard
          title="Уборщиков"
          value={stats.totalCleaners}
          icon={Users}
          description="В команде"
        />
        
        <StatCard
          title="Заданий сегодня"
          value={stats.pendingToday + stats.completedToday}
          icon={Calendar}
          description={`${stats.completedToday} выполнено, ${stats.pendingToday} в ожидании`}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Недавние задания</span>
            </CardTitle>
            <CardDescription>
              Последние назначенные задания
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {assignment.zoneName}
                    </div>
                    <div className="text-xs text-gray-600">
                      {assignment.buildingName} • {assignment.cleanerName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {assignment.scheduledDate} в {assignment.scheduledTime}
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(assignment.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Статистика</span>
            </CardTitle>
            <CardDescription>
              Ключевые показатели
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Выполнено сегодня</span>
                <span className="font-semibold text-green-600">{stats.completedToday}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">В ожидании</span>
                <span className="font-semibold text-yellow-600">{stats.pendingToday}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Всего заданий</span>
                <span className="font-semibold text-blue-600">{stats.totalAssignments}</span>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>Эффективность выросла на 15%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.pendingToday > 5 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <span>Внимание</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-800">
              У вас {stats.pendingToday} заданий в ожидании на сегодня. 
              Рекомендуется проверить распределение задач.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;