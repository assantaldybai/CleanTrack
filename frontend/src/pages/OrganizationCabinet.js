import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { apiRequest } from '../lib/api';
import { BarChart3, Building2, CheckSquare, ClipboardList, MapPin, Plus } from 'lucide-react';

const OrganizationCabinet = () => {
  const [analytics, setAnalytics] = useState({});
  const [buildings, setBuildings] = useState([]);
  const [zones, setZones] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  const [buildingForm, setBuildingForm] = useState({ name: '', address: '', type: 'office', floors: 1, total_area: 0 });
  const [zoneForm, setZoneForm] = useState({ building_id: '', name: '', floor: 1, type: 'office', area: 0, description: '' });
  const [checklistForm, setChecklistForm] = useState({ name: '', zone_type: 'office', itemsText: 'Вымыть пол\nПротереть поверхности\nВынести мусор' });
  const [assignmentForm, setAssignmentForm] = useState({ zone_id: '', checklist_id: '', cleaning_company_id: '', title: 'Плановая уборка', description: '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00', priority: 'normal' });

  const loadData = async () => {
    const [overview, buildingList, zoneList, checklistList, companyList, assignmentList] = await Promise.all([
      apiRequest('/analytics/overview'),
      apiRequest('/buildings'),
      apiRequest('/zones'),
      apiRequest('/checklists'),
      apiRequest('/cleaning-companies'),
      apiRequest('/assignments'),
    ]);
    setAnalytics(overview);
    setBuildings(buildingList);
    setZones(zoneList);
    setChecklists(checklistList);
    setCompanies(companyList);
    setAssignments(assignmentList);
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  const submit = async (event, action) => {
    event.preventDefault();
    setMessage('');
    try {
      await action();
      await loadData();
      setMessage('Сохранено');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const availableChecklists = useMemo(() => {
    const zone = zones.find((item) => item.id === assignmentForm.zone_id);
    return zone ? checklists.filter((item) => item.zone_type === zone.type) : checklists;
  }, [assignmentForm.zone_id, zones, checklists]);

  const createBuilding = () => apiRequest('/buildings', { method: 'POST', body: JSON.stringify({ ...buildingForm, floors: Number(buildingForm.floors), total_area: Number(buildingForm.total_area) }) });
  const createZone = () => apiRequest('/zones', { method: 'POST', body: JSON.stringify({ ...zoneForm, floor: Number(zoneForm.floor), area: Number(zoneForm.area) }) });
  const createChecklist = () => {
    const items = checklistForm.itemsText.split('\n').map((task) => task.trim()).filter(Boolean).map((task) => ({ task, required: true }));
    return apiRequest('/checklists', { method: 'POST', body: JSON.stringify({ name: checklistForm.name, zone_type: checklistForm.zone_type, items }) });
  };
  const createAssignment = () => apiRequest('/assignments', { method: 'POST', body: JSON.stringify(assignmentForm) });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-600">Organization workspace</p>
        <h1 className="text-4xl font-black text-gray-950">Кабинет организации</h1>
      </div>

      {message && <div className="rounded-xl border-2 border-black bg-yellow-50 px-4 py-3 font-semibold text-black">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric icon={Building2} label="Объектов" value={buildings.length} />
        <Metric icon={MapPin} label="Зон" value={zones.length} />
        <Metric icon={CheckSquare} label="Чек-листов" value={checklists.length} />
        <Metric icon={ClipboardList} label="Задач" value={analytics.assignments_total} />
        <Metric icon={BarChart3} label="Выполнение" value={`${analytics.completion_rate || 0}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <FormCard title="Объект" description="Здание или территория организации" onSubmit={(e) => submit(e, createBuilding)}>
          <Input placeholder="Название" value={buildingForm.name} onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })} required />
          <Input placeholder="Адрес" value={buildingForm.address} onChange={(e) => setBuildingForm({ ...buildingForm, address: e.target.value })} required />
          <Input placeholder="Тип" value={buildingForm.type} onChange={(e) => setBuildingForm({ ...buildingForm, type: e.target.value })} />
          <Input type="number" placeholder="Этажей" value={buildingForm.floors} onChange={(e) => setBuildingForm({ ...buildingForm, floors: e.target.value })} />
          <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Добавить объект</Button>
        </FormCard>

        <FormCard title="Зона" description="Конкретная территория уборки" onSubmit={(e) => submit(e, createZone)}>
          <select className="w-full h-10 rounded-md border border-input px-3" value={zoneForm.building_id} onChange={(e) => setZoneForm({ ...zoneForm, building_id: e.target.value })} required>
            <option value="">Выберите объект</option>
            {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Input placeholder="Название зоны" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} required />
          <Input placeholder="Тип зоны" value={zoneForm.type} onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })} />
          <Input type="number" placeholder="Этаж" value={zoneForm.floor} onChange={(e) => setZoneForm({ ...zoneForm, floor: e.target.value })} />
          <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Добавить зону</Button>
        </FormCard>

        <FormCard title="Чек-лист" description="Пункты контроля для зоны" onSubmit={(e) => submit(e, createChecklist)}>
          <Input placeholder="Название" value={checklistForm.name} onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })} required />
          <Input placeholder="Тип зоны" value={checklistForm.zone_type} onChange={(e) => setChecklistForm({ ...checklistForm, zone_type: e.target.value })} />
          <textarea className="min-h-28 w-full rounded-md border border-input px-3 py-2 text-sm" value={checklistForm.itemsText} onChange={(e) => setChecklistForm({ ...checklistForm, itemsText: e.target.value })} />
          <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Добавить чек-лист</Button>
        </FormCard>

        <FormCard title="Задача клинингу" description="Организация назначает агентство" onSubmit={(e) => submit(e, createAssignment)}>
          <Input placeholder="Название задачи" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} required />
          <select className="w-full h-10 rounded-md border border-input px-3" value={assignmentForm.zone_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, zone_id: e.target.value, checklist_id: '' })} required>
            <option value="">Зона</option>
            {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="w-full h-10 rounded-md border border-input px-3" value={assignmentForm.checklist_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, checklist_id: e.target.value })} required>
            <option value="">Чек-лист</option>
            {availableChecklists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="w-full h-10 rounded-md border border-input px-3" value={assignmentForm.cleaning_company_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, cleaning_company_id: e.target.value })} required>
            <option value="">Клининг</option>
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2"><Input type="date" value={assignmentForm.scheduled_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, scheduled_date: e.target.value })} /><Input type="time" value={assignmentForm.scheduled_time} onChange={(e) => setAssignmentForm({ ...assignmentForm, scheduled_time: e.target.value })} /></div>
          <Button className="w-full bg-black text-yellow-400 hover:bg-gray-900"><Plus className="h-4 w-4 mr-2" />Назначить</Button>
        </FormCard>
      </div>

      <Card>
        <CardHeader><CardTitle>Назначенные задачи</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {assignments.map((item) => <AssignmentRow key={item.id} item={item} />)}
          {assignments.length === 0 && <p className="text-gray-500">Задач пока нет</p>}
        </CardContent>
      </Card>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value }) => <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-yellow-600" /><p className="text-sm text-gray-500 mt-2">{label}</p><p className="text-2xl font-black">{value ?? 0}</p></CardContent></Card>;
const FormCard = ({ title, onSubmit, children }) => <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><form onSubmit={onSubmit} className="space-y-3">{children}</form></CardContent></Card>;
const AssignmentRow = ({ item }) => <div className="rounded-xl border bg-gray-50 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><div className="font-bold">{item.title}</div><div className="text-sm text-gray-600">{item.building_name} • {item.zone_name} • {item.cleaning_company_name}</div><div className="text-xs text-gray-500">{item.scheduled_date} {item.scheduled_time} • клинер: {item.cleaner_name}</div></div><Badge>{item.status}</Badge></div>;

export default OrganizationCabinet;
