import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { apiRequest } from '../lib/api';
import { AlertTriangle, ClipboardList, Plus, Sparkles, Target, UserCheck, Users } from 'lucide-react';

const CleaningCabinet = () => {
  const [analytics, setAnalytics] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [message, setMessage] = useState('');
  const [cleanerForm, setCleanerForm] = useState({ username: '', password: '', name: '', role: 'cleaner' });
  const [selectedCleaners, setSelectedCleaners] = useState({});

  const loadData = async () => {
    const [overview, assignmentList, userList] = await Promise.all([
      apiRequest('/analytics/overview'),
      apiRequest('/assignments'),
      apiRequest('/users?role=cleaner'),
    ]);
    setAnalytics(overview);
    setAssignments(assignmentList);
    setCleaners(userList);
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  const createCleaner = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify(cleanerForm) });
      setCleanerForm({ username: '', password: '', name: '', role: 'cleaner' });
      await loadData();
      setMessage('Клинер создан');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const assignCleaner = async (assignmentId) => {
    const cleaner_user_id = selectedCleaners[assignmentId];
    if (!cleaner_user_id) {
      setMessage('Выберите клинера');
      return;
    }
    try {
      await apiRequest(`/assignments/${assignmentId}/assign-cleaner`, { method: 'PATCH', body: JSON.stringify({ cleaner_user_id }) });
      await loadData();
      setMessage('Клинер назначен');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const unassignedTasks = assignments.filter((item) => !item.cleaner_user_id || item.status === 'pending');
  const overdueTasks = assignments.filter((item) => item.scheduled_date < today && item.status !== 'completed');
  const todayTasks = assignments.filter((item) => item.scheduled_date === today && item.status !== 'completed');
  const primaryConstraint = unassignedTasks.length > 0
    ? 'Нераспределенные задачи'
    : overdueTasks.length > 0
      ? 'Просрочки'
      : todayTasks.length > 0
        ? 'Задачи на сегодня'
        : 'Исполнение под контролем';
  const nextTask = unassignedTasks[0] || overdueTasks[0] || todayTasks[0];


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-600">Cleaning operator workspace</p>
        <h1 className="text-4xl font-black text-gray-950">Кабинет клининга</h1>
      </div>

      {message && <div className="rounded-xl border-2 border-black bg-yellow-50 px-4 py-3 font-semibold text-black">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric icon={ClipboardList} label="Задач" value={analytics.assignments_total} />
        <Metric icon={Users} label="Клинеров" value={analytics.active_cleaners} />
        <Metric icon={UserCheck} label="Выполнено" value={analytics.completed} />
        <Metric icon={Sparkles} label="Средняя оценка" value={analytics.average_quality || 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-2 border-black bg-black text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-yellow-400"><Target className="h-5 w-5" />Главное ограничение</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{primaryConstraint}</div>
            <div className="mt-3 text-yellow-100 font-semibold">{nextTask ? `${nextTask.title} • ${nextTask.organization_name}` : 'Новых действий нет'}</div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Диспетчеризация</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ControlTile icon={Users} label="Без клинера" value={unassignedTasks.length} tone="red" />
            <ControlTile icon={AlertTriangle} label="Просрочено" value={overdueTasks.length} tone="red" />
            <ControlTile icon={ClipboardList} label="Сегодня" value={todayTasks.length} tone="yellow" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Задачи от организаций</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {assignments.map((item) => (
            <div key={item.id} className="rounded-xl border bg-gray-50 p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{item.title}</div>
                  <div className="text-sm text-gray-600">{item.organization_name} • {item.building_name} • {item.zone_name}</div>
                  <div className="text-xs text-gray-500">{item.scheduled_date} {item.scheduled_time} • клинер: {item.cleaner_name}</div>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              {item.status !== 'completed' && (
                <div className="flex flex-col md:flex-row gap-2">
                  <select className="h-10 rounded-md border border-input px-3 flex-1" value={selectedCleaners[item.id] || ''} onChange={(e) => setSelectedCleaners({ ...selectedCleaners, [item.id]: e.target.value })}>
                    <option value="">Назначить клинера</option>
                    {cleaners.map((cleaner) => <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>)}
                  </select>
                  <Button onClick={() => assignCleaner(item.id)}>Назначить</Button>
                </div>
              )}
            </div>
          ))}
          {assignments.length === 0 && <p className="text-gray-500">Задач пока нет</p>}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px bg-gray-200 flex-1"></div>
        <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Настройка</span>
        <div className="h-px bg-gray-200 flex-1"></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Добавить клинера</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createCleaner} className="space-y-3">
              <Input placeholder="Логин" value={cleanerForm.username} onChange={(e) => setCleanerForm({ ...cleanerForm, username: e.target.value })} required />
              <Input placeholder="ФИО" value={cleanerForm.name} onChange={(e) => setCleanerForm({ ...cleanerForm, name: e.target.value })} required />
              <Input type="password" placeholder="Пароль" value={cleanerForm.password} onChange={(e) => setCleanerForm({ ...cleanerForm, password: e.target.value })} required />
              <Button className="w-full bg-black text-yellow-400 hover:bg-gray-900"><Plus className="h-4 w-4 mr-2" />Создать клинера</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Команда клинеров</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cleaners.map((cleaner) => <div key={cleaner.id} className="rounded-xl border bg-gray-50 p-3"><b>{cleaner.name}</b><div className="text-sm text-gray-500">{cleaner.username}</div></div>)}
            {cleaners.length === 0 && <p className="text-gray-500">Клинеров пока нет</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

const ControlTile = ({ icon: Icon, label, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-black'}`}>
    <Icon className="h-5 w-5" />
    <div className="text-sm font-bold mt-2">{label}</div>
    <div className="text-3xl font-black">{value}</div>
  </div>
);

const Metric = ({ icon: Icon, label, value }) => <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-yellow-600" /><p className="text-sm text-gray-500 mt-2">{label}</p><p className="text-2xl font-black">{value ?? 0}</p></CardContent></Card>;

export default CleaningCabinet;
