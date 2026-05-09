import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { apiRequest, roleLabel } from '../lib/api';
import { Building2, Plus, ShieldCheck, Sparkles, Users } from 'lucide-react';

const emptyOrg = { name: '', inn: '', city: '', notes: '' };
const emptyCompany = { name: '', type: 'company', organization_id: '', notes: '' };
const emptyUser = { username: '', password: '', name: '', role: 'organization_admin', organization_id: '', cleaning_company_id: '' };

const Metric = ({ label, value, icon: Icon }) => (
  <Card className="border-2 border-black/10 shadow-sm">
    <CardContent className="p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-black text-gray-900">{value ?? 0}</p>
      </div>
      <div className="h-12 w-12 rounded-2xl bg-yellow-400 flex items-center justify-center border-2 border-black">
        <Icon className="h-6 w-6 text-black" />
      </div>
    </CardContent>
  </Card>
);

const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState({});
  const [organizations, setOrganizations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [orgForm, setOrgForm] = useState(emptyOrg);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [userForm, setUserForm] = useState(emptyUser);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [overview, orgs, cleaningCompanies, allUsers] = await Promise.all([
      apiRequest('/analytics/overview'),
      apiRequest('/organizations'),
      apiRequest('/cleaning-companies'),
      apiRequest('/users'),
    ]);
    setAnalytics(overview);
    setOrganizations(orgs);
    setCompanies(cleaningCompanies);
    setUsers(allUsers);
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  const submit = async (event, action) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await action();
      await loadData();
      setMessage('Готово: изменения сохранены');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createOrg = () => apiRequest('/organizations', { method: 'POST', body: JSON.stringify(orgForm) }).then(() => setOrgForm(emptyOrg));

  const createCompany = () => {
    const payload = {
      name: companyForm.name,
      type: companyForm.type,
      notes: companyForm.notes,
      organization_ids: companyForm.organization_id ? [companyForm.organization_id] : [],
    };
    return apiRequest('/cleaning-companies', { method: 'POST', body: JSON.stringify(payload) }).then(() => setCompanyForm(emptyCompany));
  };

  const createUser = () => {
    const payload = {
      username: userForm.username,
      password: userForm.password,
      name: userForm.name,
      role: userForm.role,
      organization_id: userForm.role === 'organization_admin' ? userForm.organization_id : null,
      cleaning_company_id: ['cleaning_company_admin', 'cleaner'].includes(userForm.role) ? userForm.cleaning_company_id : null,
    };
    return apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) }).then(() => setUserForm(emptyUser));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-600">SKYX SaaS Control</p>
          <h1 className="text-4xl font-black text-gray-950">Кабинет супер-админа</h1>
          <p className="text-gray-600 mt-2">Создание тенантов, клининговых компаний, администраторов и контроль KPI всей платформы.</p>
        </div>
        <Badge className="w-fit bg-black text-yellow-400 text-sm px-4 py-2">RLS включена: роли видят только свой контур</Badge>
      </div>

      {message && <div className="rounded-xl border-2 border-black bg-yellow-50 px-4 py-3 font-semibold text-black">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Организаций" value={analytics.organizations} icon={Building2} />
        <Metric label="Клинингов" value={analytics.cleaning_companies} icon={Sparkles} />
        <Metric label="Задач всего" value={analytics.assignments_total} icon={ShieldCheck} />
        <Metric label="Выполнение" value={`${analytics.completion_rate || 0}%`} icon={Users} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Новая организация</CardTitle>
            <CardDescription>Например: Газпром, частная школа, Билайн.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createOrg)} className="space-y-3">
              <Input placeholder="Название" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required />
              <Input placeholder="ИНН (необязательно)" value={orgForm.inn} onChange={(e) => setOrgForm({ ...orgForm, inn: e.target.value })} />
              <Input placeholder="Город" value={orgForm.city} onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })} />
              <Input placeholder="Заметка" value={orgForm.notes} onChange={(e) => setOrgForm({ ...orgForm, notes: e.target.value })} />
              <Button disabled={loading} className="w-full bg-black text-yellow-400 hover:bg-gray-900"><Plus className="h-4 w-4 mr-2" />Создать</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Новый клининг</CardTitle>
            <CardDescription>Привязка к организации нужна для RLS и назначения задач.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createCompany)} className="space-y-3">
              <Input placeholder="Название клининга" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} required />
              <select className="w-full h-10 rounded-md border border-input px-3" value={companyForm.organization_id} onChange={(e) => setCompanyForm({ ...companyForm, organization_id: e.target.value })} required>
                <option value="">Организация-заказчик</option>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
              <Input placeholder="Тип: company/private" value={companyForm.type} onChange={(e) => setCompanyForm({ ...companyForm, type: e.target.value })} />
              <Input placeholder="Заметка" value={companyForm.notes} onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })} />
              <Button disabled={loading} className="w-full bg-yellow-400 text-black hover:bg-yellow-500 border-2 border-black"><Plus className="h-4 w-4 mr-2" />Создать</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Создать аккаунт без email/телефона</CardTitle>
            <CardDescription>Только логин + пароль. Роль определяет кабинет.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createUser)} className="space-y-3">
              <Input placeholder="Логин" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
              <Input placeholder="Имя/название" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
              <Input type="password" placeholder="Пароль" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
              <select className="w-full h-10 rounded-md border border-input px-3" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                <option value="organization_admin">Админ организации</option>
                <option value="cleaning_company_admin">Админ клининга</option>
                <option value="cleaner">Клинер</option>
              </select>
              {userForm.role === 'organization_admin' && (
                <select className="w-full h-10 rounded-md border border-input px-3" value={userForm.organization_id} onChange={(e) => setUserForm({ ...userForm, organization_id: e.target.value })} required>
                  <option value="">Выберите организацию</option>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              )}
              {['cleaning_company_admin', 'cleaner'].includes(userForm.role) && (
                <select className="w-full h-10 rounded-md border border-input px-3" value={userForm.cleaning_company_id} onChange={(e) => setUserForm({ ...userForm, cleaning_company_id: e.target.value })} required>
                  <option value="">Выберите клининг</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              )}
              <Button disabled={loading} className="w-full"><Plus className="h-4 w-4 mr-2" />Создать пользователя</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ListCard title="Организации" items={organizations} render={(item) => <><b>{item.name}</b><span>{item.city || 'город не указан'}</span></>} />
        <ListCard title="Клининги" items={companies} render={(item) => <><b>{item.name}</b><span>{item.type}</span></>} />
        <ListCard title="Пользователи" items={users} render={(item) => <><b>{item.name}</b><span>{item.username} • {roleLabel(item.role)}</span></>} />
      </div>
    </div>
  );
};

const ListCard = ({ title, items, render }) => (
  <Card>
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="space-y-3 max-h-96 overflow-auto">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border bg-gray-50 p-3 flex flex-col text-sm">
          {render(item)}
        </div>
      ))}
      {items.length === 0 && <p className="text-gray-500">Пока пусто</p>}
    </CardContent>
  </Card>
);

export default SuperAdminDashboard;
