import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { apiRequest, roleLabel } from '../lib/api';
import { Activity, AlertTriangle, Ban, Building2, CheckCircle2, Link2, Plus, ShieldCheck, Sparkles, Users } from 'lucide-react';

const emptyOrg = { name: '', inn: '', city: '', subscription_plan: 'beta', notes: '' };
const emptyCompany = { name: '', type: 'company', organization_id: '', subscription_plan: 'beta', notes: '' };
const emptyUser = { username: '', password: '', name: '', role: 'organization_admin', organization_id: '', cleaning_company_id: '' };
const statuses = ['active', 'suspended', 'archived'];
const plans = ['beta', 'growth', 'enterprise'];

const statusLabels = {
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'Архив',
};

const statusClass = {
  active: 'bg-green-100 text-green-800 border-green-200',
  suspended: 'bg-orange-100 text-orange-800 border-orange-200',
  archived: 'bg-gray-200 text-gray-800 border-gray-300',
};

const Metric = ({ label, value, icon: Icon, tone = 'yellow', hint }) => (
  <Card className="border-2 border-black/10 shadow-sm overflow-hidden">
    <CardContent className="p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500 font-bold">{label}</p>
        <p className="text-3xl font-black text-gray-950">{value ?? 0}</p>
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      </div>
      <div className={`h-12 w-12 rounded-2xl ${tone === 'black' ? 'bg-black' : 'bg-yellow-400'} flex items-center justify-center border-2 border-black`}>
        <Icon className={`h-6 w-6 ${tone === 'black' ? 'text-yellow-400' : 'text-black'}`} />
      </div>
    </CardContent>
  </Card>
);

const SuperAdminDashboard = () => {
  const [command, setCommand] = useState({ platform: {}, organizations: [], cleaning_companies: [], recent_audit: [], plan_presets: {} });
  const [organizations, setOrganizations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [orgForm, setOrgForm] = useState(emptyOrg);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [userForm, setUserForm] = useState(emptyUser);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [center, orgs, cleaningCompanies, allUsers] = await Promise.all([
      apiRequest('/super-admin/command-center'),
      apiRequest('/organizations'),
      apiRequest('/cleaning-companies'),
      apiRequest('/users'),
    ]);
    setCommand(center);
    setOrganizations(orgs);
    setCompanies(cleaningCompanies);
    setUsers(allUsers);
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  const runAction = async (action, successMessage = 'Готово: изменения сохранены') => {
    setLoading(true);
    setMessage('');
    try {
      await action();
      await loadData();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event, action, successMessage) => {
    event.preventDefault();
    runAction(action, successMessage);
  };

  const createOrg = () => apiRequest('/organizations', { method: 'POST', body: JSON.stringify(orgForm) }).then(() => setOrgForm(emptyOrg));

  const createCompany = () => {
    const payload = {
      name: companyForm.name,
      type: companyForm.type,
      notes: companyForm.notes,
      subscription_plan: companyForm.subscription_plan,
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

  const updateOrgStatus = (id, nextStatus) => runAction(
    () => apiRequest(`/super-admin/organizations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, reason: 'Изменено супер-админом из command center' }) }),
    `Статус организации обновлен: ${statusLabels[nextStatus]}`
  );

  const updateOrgPlan = (id, plan) => runAction(
    () => apiRequest(`/super-admin/organizations/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ subscription_plan: plan }) }),
    `Тариф организации обновлен: ${plan}`
  );

  const updateCompanyStatus = (id, nextStatus) => runAction(
    () => apiRequest(`/super-admin/cleaning-companies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, reason: 'Изменено супер-админом из command center' }) }),
    `Статус клининга обновлен: ${statusLabels[nextStatus]}`
  );

  const updateCompanyPlan = (id, plan) => runAction(
    () => apiRequest(`/super-admin/cleaning-companies/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ subscription_plan: plan }) }),
    `Тариф клининга обновлен: ${plan}`
  );

  const linkCompanyToOrg = (company, organizationId) => {
    if (!organizationId) return;
    const nextLinks = Array.from(new Set([...(company.organization_ids || []), organizationId]));
    runAction(
      () => apiRequest(`/super-admin/cleaning-companies/${company.id}/organizations`, { method: 'PATCH', body: JSON.stringify({ organization_ids: nextLinks, reason: 'Связь добавлена из command center' }) }),
      'Связь организация ↔ клининг обновлена'
    );
  };

  const toggleUser = (user) => runAction(
    () => apiRequest(`/super-admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: !user.is_active, reason: 'Изменено супер-админом' }) }),
    user.is_active ? 'Пользователь заблокирован' : 'Пользователь активирован'
  );

  const platform = command.platform || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-600">SKYX SaaS Command Center</p>
          <h1 className="text-4xl font-black text-gray-950">Супер-админ платформы</h1>
        </div>
      </div>

      {message && <div className="rounded-xl border-2 border-black bg-yellow-50 px-4 py-3 font-bold text-black">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Metric label="Health score" value={platform.health_score ?? 0} icon={Activity} tone="black" hint="по рискам и просрочкам" />
        <Metric label="Организаций" value={platform.organizations_total} icon={Building2} hint={`${platform.organizations_suspended || 0} suspended`} />
        <Metric label="Клинингов" value={platform.cleaning_companies_total} icon={Sparkles} hint={`${platform.companies_active || 0} active`} />
        <Metric label="Пользователей" value={platform.users_total} icon={Users} hint={`${platform.active_users || 0} active`} />
        <Metric label="Задач" value={platform.assignments_total} icon={ShieldCheck} hint={`${platform.completion_rate || 0}% done`} />
        <Metric label="Рисков" value={platform.risk_tenants} icon={AlertTriangle} tone="black" hint={`${platform.overdue || 0} overdue`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Создать организацию</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createOrg, 'Организация создана')} className="space-y-3">
              <Input placeholder="Название" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required />
              <Input placeholder="ИНН" value={orgForm.inn} onChange={(e) => setOrgForm({ ...orgForm, inn: e.target.value })} />
              <Input placeholder="Город" value={orgForm.city} onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })} />
              <select className="w-full h-10 rounded-md border border-input px-3" value={orgForm.subscription_plan} onChange={(e) => setOrgForm({ ...orgForm, subscription_plan: e.target.value })}>
                {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              <Input placeholder="Заметка" value={orgForm.notes} onChange={(e) => setOrgForm({ ...orgForm, notes: e.target.value })} />
              <Button disabled={loading} className="w-full bg-black text-yellow-400 hover:bg-gray-900"><Plus className="h-4 w-4 mr-2" />Создать</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Создать клининг</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createCompany, 'Клининг создан')} className="space-y-3">
              <Input placeholder="Название клининга" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} required />
              <select className="w-full h-10 rounded-md border border-input px-3" value={companyForm.organization_id} onChange={(e) => setCompanyForm({ ...companyForm, organization_id: e.target.value })} required>
                <option value="">Первичная организация-заказчик</option>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
              <select className="w-full h-10 rounded-md border border-input px-3" value={companyForm.subscription_plan} onChange={(e) => setCompanyForm({ ...companyForm, subscription_plan: e.target.value })}>
                {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              <Input placeholder="Тип: company/private" value={companyForm.type} onChange={(e) => setCompanyForm({ ...companyForm, type: e.target.value })} />
              <Input placeholder="Заметка" value={companyForm.notes} onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })} />
              <Button disabled={loading} className="w-full bg-yellow-400 text-black hover:bg-yellow-500 border-2 border-black"><Plus className="h-4 w-4 mr-2" />Создать</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2 border-black/10">
          <CardHeader>
            <CardTitle>Создать аккаунт</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => submit(e, createUser, 'Пользователь создан')} className="space-y-3">
              <Input placeholder="Логин" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
              <Input placeholder="Имя/название" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
              <Input type="password" placeholder="Пароль" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
              <select className="w-full h-10 rounded-md border border-input px-3" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                <option value="organization_admin">Админ организации</option>
                <option value="cleaning_company_admin">Админ клининга</option>
                <option value="cleaner">Клинер</option>
              </select>
              {userForm.role === 'organization_admin' && <TenantSelect value={userForm.organization_id} onChange={(value) => setUserForm({ ...userForm, organization_id: value })} organizations={organizations} />}
              {['cleaning_company_admin', 'cleaner'].includes(userForm.role) && <CompanySelect value={userForm.cleaning_company_id} onChange={(value) => setUserForm({ ...userForm, cleaning_company_id: value })} companies={companies} />}
              <Button disabled={loading} className="w-full"><Plus className="h-4 w-4 mr-2" />Создать пользователя</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Организации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[760px] overflow-auto">
            {command.organizations.map((entry) => <OrganizationCard key={entry.organization.id} entry={entry} onStatus={updateOrgStatus} onPlan={updateOrgPlan} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Клининги</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[760px] overflow-auto">
            {command.cleaning_companies.map((entry) => (
              <CompanyCard key={entry.company.id} entry={entry} organizations={organizations} onStatus={updateCompanyStatus} onPlan={updateCompanyPlan} onLink={linkCompanyToOrg} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <Card className="2xl:col-span-2">
          <CardHeader>
            <CardTitle>Пользователи</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-auto">
            {users.map((item) => (
              <div key={item.id} className="rounded-xl border bg-gray-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div><b>{item.name}</b><div className="text-sm text-gray-500">{item.username}</div></div>
                  <Badge className={item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{item.is_active ? 'active' : 'blocked'}</Badge>
                </div>
                <div className="text-xs text-gray-600">{roleLabel(item.role)}</div>
                <Button size="sm" variant="outline" onClick={() => toggleUser(item)} className="w-full">
                  {item.is_active ? <Ban className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {item.is_active ? 'Заблокировать' : 'Активировать'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Аудит</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-auto">
            {command.recent_audit.map((item) => (
              <div key={item.id} className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="font-black">{item.action}</div>
                <div className="text-gray-600">{item.actor_username} • {item.target_type}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString('ru-RU')}</div>
              </div>
            ))}
            {command.recent_audit.length === 0 && <p className="text-gray-500">Аудит пока пуст</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const TenantSelect = ({ value, onChange, organizations }) => (
  <select className="w-full h-10 rounded-md border border-input px-3" value={value} onChange={(e) => onChange(e.target.value)} required>
    <option value="">Выберите организацию</option>
    {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
  </select>
);

const CompanySelect = ({ value, onChange, companies }) => (
  <select className="w-full h-10 rounded-md border border-input px-3" value={value} onChange={(e) => onChange(e.target.value)} required>
    <option value="">Выберите клининг</option>
    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
  </select>
);

const OrganizationCard = ({ entry, onStatus, onPlan }) => {
  const org = entry.organization;
  const usage = entry.usage;
  return (
    <div className="rounded-2xl border-2 border-black/10 bg-white p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-lg">{org.name}</h3><Badge className={statusClass[org.status || 'active']}>{statusLabels[org.status || 'active']}</Badge></div>
          <p className="text-sm text-gray-500">{org.city || 'город не указан'} • plan: <b>{org.subscription_plan || 'beta'}</b></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => <Button key={status} size="sm" variant="outline" onClick={() => onStatus(org.id, status)}>{statusLabels[status]}</Button>)}
        </div>
      </div>
      <UsageGrid usage={usage} />
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => <Button key={plan} size="sm" className={plan === org.subscription_plan ? 'bg-black text-yellow-400' : ''} variant={plan === org.subscription_plan ? 'default' : 'outline'} onClick={() => onPlan(org.id, plan)}>{plan}</Button>)}
      </div>
      <RiskList risks={entry.risks} />
    </div>
  );
};

const CompanyCard = ({ entry, organizations, onStatus, onPlan, onLink }) => {
  const company = entry.company;
  const usage = entry.usage;
  const linkedNames = organizations.filter((org) => (company.organization_ids || []).includes(org.id)).map((org) => org.name).join(', ') || 'нет связей';
  return (
    <div className="rounded-2xl border-2 border-black/10 bg-white p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-lg">{company.name}</h3><Badge className={statusClass[company.status || 'active']}>{statusLabels[company.status || 'active']}</Badge></div>
          <p className="text-sm text-gray-500">{company.type} • plan: <b>{company.subscription_plan || 'beta'}</b></p>
          <p className="text-xs text-gray-500 mt-1">Связи: {linkedNames}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => <Button key={status} size="sm" variant="outline" onClick={() => onStatus(company.id, status)}>{statusLabels[status]}</Button>)}
        </div>
      </div>
      <UsageGrid usage={usage} />
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => <Button key={plan} size="sm" className={plan === company.subscription_plan ? 'bg-black text-yellow-400' : ''} variant={plan === company.subscription_plan ? 'default' : 'outline'} onClick={() => onPlan(company.id, plan)}>{plan}</Button>)}
      </div>
      <div className="flex flex-col md:flex-row gap-2">
        <select className="h-10 rounded-md border border-input px-3 flex-1" onChange={(e) => onLink(company, e.target.value)} defaultValue="">
          <option value="">Добавить связь с организацией</option>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <Badge className="w-fit bg-yellow-100 text-black"><Link2 className="h-3 w-3 mr-1" />{usage.linked_organizations} связей</Badge>
      </div>
      <RiskList risks={entry.risks} />
    </div>
  );
};

const UsageGrid = ({ usage }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {Object.entries(usage || {}).map(([key, value]) => (
      <div key={key} className="rounded-xl bg-gray-50 border p-2">
        <div className="text-[11px] uppercase text-gray-400 font-bold">{key}</div>
        <div className="font-black text-gray-900">{value}</div>
      </div>
    ))}
  </div>
);

const RiskList = ({ risks }) => {
  if (!risks || risks.length === 0) {
    return <div className="rounded-xl bg-green-50 border border-green-200 p-2 text-green-800 text-sm font-bold">Рисков не обнаружено</div>;
  }
  return <div className="flex flex-wrap gap-2">{risks.map((risk) => <Badge key={risk} className="bg-red-100 text-red-800 border border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />{risk}</Badge>)}</div>;
};

export default SuperAdminDashboard;
