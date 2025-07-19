// Mock данные для системы управления клинингом SKY X
export const mockUsers = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Администратор SKY X',
    email: 'admin@skyx.com'
  },
  {
    id: '2', 
    username: 'cleaner1',
    password: 'cleaner123',
    role: 'cleaner',
    name: 'Мария Иванова',
    email: 'maria@skyx.com',
    phone: '+7 (999) 123-45-67'
  },
  {
    id: '3',
    username: 'cleaner2', 
    password: 'cleaner123',
    role: 'cleaner',
    name: 'Анна Петрова',
    email: 'anna@skyx.com',
    phone: '+7 (999) 765-43-21'
  }
];

export const mockBuildings = [
  {
    id: '1',
    name: 'Офисный центр "Москва-Сити"',
    address: 'г. Москва, ММДЦ "Москва-Сити", башня "Федерация"',
    type: 'office',
    floors: 45,
    totalArea: 15000,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2', 
    name: 'Торговый центр "Мега"',
    address: 'г. Москва, Ленинградский просп., 16А',
    type: 'shopping',
    floors: 3,
    totalArea: 8500,
    createdAt: '2024-02-10T14:30:00Z'
  }
];

export const mockZones = [
  {
    id: '1',
    buildingId: '1',
    name: 'Офис 1001',
    floor: 10,
    type: 'office',
    area: 150,
    description: 'Открытое офисное пространство с 20 рабочими местами',
    createdAt: '2024-01-15T11:00:00Z'
  },
  {
    id: '2',
    buildingId: '1', 
    name: 'Туалет мужской 10 этаж',
    floor: 10,
    type: 'restroom',
    area: 25,
    description: 'Мужской туалет с 4 кабинками',
    createdAt: '2024-01-15T11:15:00Z'
  },
  {
    id: '3',
    buildingId: '2',
    name: 'Торговый зал 1 этаж',
    floor: 1,
    type: 'retail',
    area: 500,
    description: 'Основной торговый зал первого этажа',
    createdAt: '2024-02-10T15:00:00Z'
  }
];

export const mockChecklists = [
  {
    id: '1',
    name: 'Стандартный клининг офиса',
    zoneType: 'office',
    items: [
      { id: '1', task: 'Пропылесосить ковровое покрытие', required: true },
      { id: '2', task: 'Протереть столы и рабочие поверхности', required: true },
      { id: '3', task: 'Вынести мусор', required: true },
      { id: '4', task: 'Протереть окна', required: false },
      { id: '5', task: 'Полить растения', required: false }
    ]
  },
  {
    id: '2',
    name: 'Глубокий клининг туалета',
    zoneType: 'restroom', 
    items: [
      { id: '1', task: 'Очистить унитазы дезинфицирующим средством', required: true },
      { id: '2', task: 'Вымыть полы с моющим средством', required: true },
      { id: '3', task: 'Пополнить туалетную бумагу', required: true },
      { id: '4', task: 'Пополнить мыло', required: true },
      { id: '5', task: 'Протереть зеркала', required: true },
      { id: '6', task: 'Вынести мусор', required: true }
    ]
  },
  {
    id: '3',
    name: 'Клининг торгового зала',
    zoneType: 'retail',
    items: [
      { id: '1', task: 'Пропылесосить или вымыть полы', required: true },
      { id: '2', task: 'Протереть витрины', required: true },
      { id: '3', task: 'Убрать мусор из корзин', required: true },
      { id: '4', task: 'Протереть поручни эскалаторов', required: false }
    ]
  }
];

export const mockAssignments = [
  {
    id: '1',
    cleanerId: '2',
    zoneId: '1',
    checklistId: '1', 
    scheduledDate: '2025-01-20',
    scheduledTime: '09:00',
    status: 'pending', // pending, in_progress, completed
    createdAt: '2025-01-19T18:00:00Z'
  },
  {
    id: '2',
    cleanerId: '2',
    zoneId: '2', 
    checklistId: '2',
    scheduledDate: '2025-01-20',
    scheduledTime: '09:30', 
    status: 'pending',
    createdAt: '2025-01-19T18:00:00Z'
  },
  {
    id: '3',
    cleanerId: '3',
    zoneId: '3',
    checklistId: '3',
    scheduledDate: '2025-01-20', 
    scheduledTime: '10:00',
    status: 'completed',
    createdAt: '2025-01-19T18:00:00Z',
    completedAt: '2025-01-20T11:30:00Z'
  }
];

export const mockCompletedTasks = [
  {
    id: '1',
    assignmentId: '3',
    cleanerId: '3',
    completedItems: [
      { id: '1', completed: true, photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...' },
      { id: '2', completed: true, photo: null },
      { id: '3', completed: true, photo: null }
    ],
    finalPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    notes: 'Все задачи выполнены в срок',
    completedAt: '2025-01-20T11:30:00Z'
  }
];

// Утилиты для работы с localStorage
export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getFromStorage = (key, defaultValue = []) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

// Инициализация данных в localStorage
export const initializeMockData = () => {
  if (!localStorage.getItem('amp_users')) {
    saveToStorage('amp_users', mockUsers);
  }
  if (!localStorage.getItem('amp_buildings')) {
    saveToStorage('amp_buildings', mockBuildings);
  }
  if (!localStorage.getItem('amp_zones')) {
    saveToStorage('amp_zones', mockZones);
  }
  if (!localStorage.getItem('amp_checklists')) {
    saveToStorage('amp_checklists', mockChecklists);
  }
  if (!localStorage.getItem('amp_assignments')) {
    saveToStorage('amp_assignments', mockAssignments);
  }
  if (!localStorage.getItem('amp_completed_tasks')) {
    saveToStorage('amp_completed_tasks', mockCompletedTasks);
  }
};