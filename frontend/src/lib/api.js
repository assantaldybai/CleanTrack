const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = `${rawBackendUrl.replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem('skyx_token');

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('skyx_token', token);
  } else {
    localStorage.removeItem('skyx_token');
  }
};

export const apiRequest = async (path, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || 'Ошибка API';
    throw new ApiError(message, response.status);
  }

  return data;
};

export const roleHome = (role) => {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'organization_admin':
      return '/organization';
    case 'cleaning_company_admin':
      return '/cleaning';
    case 'cleaner':
      return '/cleaner';
    default:
      return '/login';
  }
};

export const roleLabel = (role) => {
  switch (role) {
    case 'super_admin':
      return 'СУПЕР-АДМИН';
    case 'organization_admin':
      return 'ОРГАНИЗАЦИЯ';
    case 'cleaning_company_admin':
      return 'КЛИНИНГ';
    case 'cleaner':
      return 'КЛИНЕР';
    default:
      return role || 'РОЛЬ';
  }
};
