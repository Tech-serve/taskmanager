import axios from 'axios';

/**
 * UI ↔ API адаптеры и безопасные обёртки
 */

// → к бэку (snake → camel) для Task
const toBackendTask = (data = {}) => {
  const out = { ...data };
  if ('board_key'   in out) { out.boardKey   = out.board_key;   delete out.board_key; }
  if ('column_id'   in out) { out.columnId   = out.column_id;   delete out.column_id; }
  if ('assignee_id' in out) { out.assigneeId = out.assignee_id; delete out.assignee_id; }
  if ('due_date'    in out) { out.dueDate    = out.due_date;    delete out.due_date; }
  if ('receipt_url' in out) { out.receiptUrl = out.receipt_url; delete out.receipt_url; }
  return out;
};

// ← из бэка (camel → snake) для Task
const fromBackendTask = (t = {}) => {
  const out = { ...t };
  if ('boardKey'  in out) { out.board_key   = out.boardKey;   delete out.boardKey; }
  if ('columnId'  in out) { out.column_id   = out.columnId;   delete out.columnId; }
  if ('assigneeId'in out) { out.assignee_id = out.assigneeId; delete out.assigneeId; }
  if ('dueDate'   in out) { out.due_date    = out.dueDate;    delete out.dueDate; }
  if ('receiptUrl'in out) { out.receipt_url = out.receiptUrl; delete out.receiptUrl; }
  return out;
};

// ==== безопасные обёртки для window/localStorage ====
const hasWindow = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const safeLocalStorage = {
  getItem(key) {
    try { return hasWindow && window.localStorage ? window.localStorage.getItem(key) : null; } catch { return null; }
  },
  setItem(key, val) {
    try { if (hasWindow && window.localStorage) window.localStorage.setItem(key, val); } catch {}
  },
  removeItem(key) {
    try { if (hasWindow && window.localStorage) window.localStorage.removeItem(key); } catch {}
  }
};

// ==== роли: канонизация и объединение ====
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const upper = (s) => String(s ?? '').trim().toUpperCase();
const upperList = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map(upper).filter(Boolean)));
const ROLE_ALIASES = {
  admin: 'admin',
  buyer: 'buyer',
  designer: 'designer',
  tech: 'tech',
  team_lead: 'team_lead',
  'team-lead': 'team_lead',
  teamlead: 'team_lead',
  head: 'team_lead',
  head_lead: 'team_lead',
  headelite: 'team_lead',
  'head-elite': 'team_lead',
  tl: 'team_lead',
};
const canonRole = (r) => ROLE_ALIASES[norm(r)] ?? norm(r);
const canonRoles = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map(canonRole)));

const withEffectiveRoles = (userLike) => {
  if (!userLike || typeof userLike !== 'object') return userLike;
  const real = canonRoles(userLike.roles || []);
  const extra = canonRoles(userLike.effective_roles || []);
  const effective = Array.from(new Set([...real, ...extra]));
  // департаменты — приводим к UPPERCASE массиву
  const departments = upperList(userLike.departments || userLike.department || []);
  return { ...userLike, roles: real, effective_roles: effective, departments };
};

// ==== axios базовая настройка ====
const BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
const API_BASE = BASE ? `${BASE}/api` : '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// токен → заголовок
api.interceptors.request.use((config) => {
  const token = safeLocalStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → logout + редирект (кроме /auth/login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error.config?._isRetry) {
      error.config._isRetry = true;
      safeLocalStorage.removeItem('token');

      const pathname = hasWindow ? window.location.pathname : '';
      const isLoginPage = pathname === '/login' || pathname === '/';
      const reqUrl = error.config?.url || '';
      const isLoginRequest = typeof reqUrl === 'string' && reqUrl.includes('/auth/login');

      if (!isLoginPage && !isLoginRequest && hasWindow) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== helpers для Tasks-ответов =====
const mapTasksArrayFromBackend = (res) => {
  if (Array.isArray(res.data)) {
    res.data = res.data.map(fromBackendTask);
  } else if (res.data && Array.isArray(res.data.data)) {
    res.data.data = res.data.data.map(fromBackendTask);
  }
  return res;
};
const mapTaskFromBackend = (res) => {
  if (res?.data && typeof res.data === 'object') {
    res.data = fromBackendTask(res.data);
  }
  return res;
};

// ===== helpers для User-ответов (везде гарантируем effective_roles, departments[]) =====
const mapUserFromAuthLogin = (res) => {
  if (res?.data?.user) {
    if (res.data.access_token) {
      safeLocalStorage.setItem('token', res.data.access_token);
    }
    res.data.user = withEffectiveRoles(res.data.user);
  }
  return res;
};

const mapUserFromAuthMe = (res) => {
  if (res?.data && typeof res.data === 'object') {
    res.data = withEffectiveRoles(res.data);
  }
  return res;
};

const mapUsersArray = (res) => {
  if (Array.isArray(res?.data)) {
    res.data = res.data.map(withEffectiveRoles);
  } else if (res?.data?.user) {
    res.data.user = withEffectiveRoles(res.data.user);
  }
  return res;
};

// ==================== API ====================

// ---------- Auth ----------
export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', {
      email: String(email ?? '').trim().toLowerCase(),
      password: String(password ?? ''),
    });
    return mapUserFromAuthLogin(res);
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    if (res?.data && typeof res.data === 'object') {
      res.data = withEffectiveRoles(res.data);
    }
    return res;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return mapUserFromAuthMe(res);
  },
  logout: () => safeLocalStorage.removeItem('token'),
};

// ---------- Boards ----------
export const boardsAPI = {
  getAll: () => api.get('/boards'),
  getByKey: (key) => api.get(`/boards/by-key/${encodeURIComponent(String(key).toUpperCase())}`),
  create: (data) => {
    const payload = { ...data };
    if (payload.visible_departments) {
      payload.visibleDepartments = upperList(payload.visible_departments);
    }
    return api.post('/boards', payload);
  },
  update: (id, data) => {
    const payload = { ...data };
    if (payload.visible_departments) {
      payload.visibleDepartments = upperList(payload.visible_departments);
    }
    return api.patch(`/boards/${id}`, payload);
  },
  delete: (id) => api.delete(`/boards/${id}`),
};

// ---------- Columns ----------
export const columnsAPI = {
  getByBoardId: (boardId) => api.get(`/boards/${boardId}/columns`),
  create: (boardId, data) => api.post(`/boards/${boardId}/columns`, data),
  update: (id, data) => api.patch(`/columns/${id}`, data),
  delete: (id) => api.delete(`/columns/${id}`),
};

// ---------- Tasks ----------
export const tasksAPI = {
  getByBoard: async (boardKey, params = {}) => {
    const key = encodeURIComponent(String(boardKey).toUpperCase());
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, v);
    });
    const url = `/boards/${key}/tasks${q.toString() ? `?${q.toString()}` : ''}`;
    const res = await api.get(url);
    return mapTasksArrayFromBackend(res);
  },

  create: async (data = {}) => {
    if (!data.board_key) throw new Error('tasksAPI.create: board_key is required');
    if (!data.column_id) throw new Error('tasksAPI.create: column_id is required');
    if (!data.title)     throw new Error('tasksAPI.create: title is required');

    const payload = toBackendTask({ ...data, board_key: String(data.board_key).toUpperCase() });
    const res = await api.post('/tasks', payload);
    return mapTaskFromBackend(res);
  },

  update: async (id, data) => {
    const res = await api.patch(`/tasks/${id}`, toBackendTask(data));
    return mapTaskFromBackend(res);
  },

  delete: (id) => api.delete(`/tasks/${id}`),

  addComment: (taskId, commentData) => api.post(`/tasks/${taskId}/comments`, commentData),

  getMyTasks: async () => {
    const res = await api.get('/tasks/me/tasks');;
    return mapTasksArrayFromBackend(res);
  },
};

// ---------- Users ----------
export const usersAPI = {
  getAll: async () => {
    const res = await api.get('/users');
    return mapUsersArray(res);
  },
  getById: async (id) => {
    const res = await api.get(`/users/${id}`);
    return mapUsersArray(res);
  },
  getAssignableUsers: async (boardKey) => {
    try {
      const res = await api.get(`/boards/${encodeURIComponent(String(boardKey).toUpperCase())}/assignable-users`);
      return mapUsersArray(res);
    } catch {
      const res = await api.get('/users');
      return mapUsersArray(res);
    }
  },
};

// ---------- Roles (Admin) ----------
export const rolesAPI = {
  list:   () => api.get('/admin/roles'),
  create: (data) => api.post('/admin/roles', data),
  update: (id, data) => api.patch(`/admin/roles/${id}`, data),
  remove: (id) => api.delete(`/admin/roles/${id}`),
};

export const departmentsAPI = {
  list:    () => api.get('/departments'),
  create:  (data) => api.post('/departments', data),
  update:  (id, data) => api.patch(`/departments/${id}`, data),
  remove:  (id) => api.delete(`/departments/${id}`),
};