import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiRequest } from '../lib/api';
import { CheckCircle2, ClipboardCheck, Play, Star } from 'lucide-react';

const CleanerCabinet = () => {
  const [assignments, setAssignments] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState({});

  const loadData = async () => {
    const [assignmentList, overview] = await Promise.all([
      apiRequest('/assignments'),
      apiRequest('/analytics/overview'),
    ]);
    setAssignments(assignmentList);
    setAnalytics(overview);
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  const startTask = async (assignmentId) => {
    try {
      await apiRequest(`/assignments/${assignmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) });
      await loadData();
      setMessage('Задача начата');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const toggleItem = (assignmentId, checklistItem) => {
    const current = reports[assignmentId] || { completedItems: {}, final_notes: '', quality_score: 5 };
    setReports({
      ...reports,
      [assignmentId]: {
        ...current,
        completedItems: {
          ...current.completedItems,
          [checklistItem.id]: !current.completedItems[checklistItem.id],
        },
      },
    });
  };

  const updateReport = (assignmentId, patch) => {
    setReports({ ...reports, [assignmentId]: { ...(reports[assignmentId] || { completedItems: {}, final_notes: '', quality_score: 5 }), ...patch } });
  };

  const submitReport = async (assignment) => {
    const report = reports[assignment.id] || { completedItems: {}, final_notes: '', quality_score: 5 };
    const completed_items = assignment.checklist_items.map((item) => ({
      item_id: item.id,
      task: item.task,
      completed: Boolean(report.completedItems[item.id]),
      comment: '',
    }));
    try {
      await apiRequest(`/assignments/${assignment.id}/report`, {
        method: 'POST',
        body: JSON.stringify({ completed_items, final_notes: report.final_notes, quality_score: Number(report.quality_score || 5), photo_urls: [] }),
      });
      await loadData();
      setMessage('Отчет отправлен');
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-600">Cleaner mobile workspace</p>
        <h1 className="text-4xl font-black text-gray-950">Кабинет клинера</h1>
        <p className="text-gray-600 mt-2">Мои задачи, чек-лист выполнения и отправка отчета без лишних полей.</p>
      </div>

      {message && <div className="rounded-xl border-2 border-black bg-yellow-50 px-4 py-3 font-semibold text-black">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric icon={ClipboardCheck} label="Моих задач" value={analytics.assignments_total} />
        <Metric icon={CheckCircle2} label="Выполнено" value={analytics.completed} />
        <Metric icon={Star} label="Средняя оценка" value={analytics.average_quality || 0} />
      </div>

      <div className="space-y-4">
        {assignments.map((assignment) => {
          const report = reports[assignment.id] || { completedItems: {}, final_notes: '', quality_score: 5 };
          return (
            <Card key={assignment.id} className="border-2 border-black/10">
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <CardTitle>{assignment.title}</CardTitle>
                    <CardDescription>{assignment.organization_name} • {assignment.building_name} • {assignment.zone_name} • {assignment.scheduled_date} {assignment.scheduled_time}</CardDescription>
                  </div>
                  <Badge>{assignment.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment.status === 'assigned' && <Button onClick={() => startTask(assignment.id)} className="bg-black text-yellow-400 hover:bg-gray-900"><Play className="h-4 w-4 mr-2" />Начать задачу</Button>}
                {assignment.status !== 'completed' && (
                  <div className="space-y-3">
                    <div className="font-bold">Чек-лист: {assignment.checklist_name}</div>
                    {assignment.checklist_items.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 rounded-xl border bg-gray-50 p-3 cursor-pointer">
                        <input type="checkbox" checked={Boolean(report.completedItems[item.id])} onChange={() => toggleItem(assignment.id, item)} />
                        <span className="font-medium">{item.task}</span>
                        {item.required && <Badge variant="secondary">обязательно</Badge>}
                      </label>
                    ))}
                    <textarea className="min-h-24 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="Комментарий к отчету" value={report.final_notes} onChange={(e) => updateReport(assignment.id, { final_notes: e.target.value })} />
                    <select className="h-10 rounded-md border border-input px-3" value={report.quality_score} onChange={(e) => updateReport(assignment.id, { quality_score: e.target.value })}>
                      <option value="5">Оценка 5</option>
                      <option value="4">Оценка 4</option>
                      <option value="3">Оценка 3</option>
                      <option value="2">Оценка 2</option>
                      <option value="1">Оценка 1</option>
                    </select>
                    <Button onClick={() => submitReport(assignment)}><CheckCircle2 className="h-4 w-4 mr-2" />Отправить отчет</Button>
                  </div>
                )}
                {assignment.status === 'completed' && <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-800 font-semibold">Отчет отправлен: {assignment.report?.final_notes || 'без комментария'}</div>}
              </CardContent>
            </Card>
          );
        })}
        {assignments.length === 0 && <Card><CardContent className="p-8 text-center text-gray-500">Назначенных задач пока нет</CardContent></Card>}
      </div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value }) => <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-yellow-600" /><p className="text-sm text-gray-500 mt-2">{label}</p><p className="text-2xl font-black">{value ?? 0}</p></CardContent></Card>;

export default CleanerCabinet;
