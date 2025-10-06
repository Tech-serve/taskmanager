// src/lib/api.js
import axios from 'axios';

/**
 * UI работает со snake_case, бэкенд — с camelCase.
 * Эти адаптеры конвертируют данные туда/обратно.
 */

// → к бэку (snake → camel)
const toBackendTask = (data = {}) => {
  const out = { ...data };
  if ('board_key'   in out) { out.boardKey   = out.board_key;   delete out.board_key; }
  if ('column_id'   in out) { out.columnId   = out.column_id;   delete out.column_id; }
  if ('assignee_id' in out) { out.assigneeId = out.assignee_id; delete out.assignee_id; }
  if ('due_date'    in out) { out.dueDate    = out.due_date;    delete out.due_date; }
  if ('receipt_url' in out) { out.receiptUrl = out.receipt_url; delete out.receipt_url; }
  return out;
};

// ← из бэка (camel → snake), при этом camel-ключи удаляем,
// чтобы React везде работал только с snake_case
const fromBackendTask = (t = {}) => {
  const out = { ...t };
  if ('boardKey'  in out) { out.board_key   = out.boardKey;   delete out.boardKey; }
  if ('columnId'  in out) { out.column_id   = out.columnId;   delete out.columnId; }
  if ('assigneeId'in out) { out.assignee_id = out.assigneeId; delete out.assigneeId; }
  if ('dueDate'   in out) { out.due_date    = out.dueDate;    delete out.dueDate; }
  if ('receiptUrl'in out) { out.receipt_url = out.receiptUrl; delete out.receiptUrl; }
  return out;
};

// Безопасные обёртки для окружений без window/localStorage (SSR/тесты)
const hasWindow = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const safeLocalStorage = {
  getItem(key) {
    try { return hasWindow && window.localStorage ? window.localStorage.getItem(key) : null; } catch { return null; }
  },
  removeItem(key) {
    try { if (hasWindow && window.localStorage) window.localStorage.removeItem(key); } catch {}
  }
};

const BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
const API_BASE = BASE ? `${BASE}/api` : '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = safeLocalStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

// ---------- Auth ----------
export const authAPI = {
  login: (email, password) => api.post('/auth/login', {
    email: String(email ?? '').trim().toLowerCase(),
    password: String(password ?? ''),
  }),
  register: (userData) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me'),
};

// ---------- Boards ----------
export const boardsAPI = {
  getAll: () => api.get('/boards'),
  getByKey: (key) => api.get(`/boards/by-key/${encodeURIComponent(String(key).toUpperCase())}`),
  create: (data) => api.post('/boards', data),
  update: (id, data) => api.patch(`/boards/${id}`, data),
  delete: (id) => api.delete(`/boards/${id}`),
};

// ---------- Columns ----------
export const columnsAPI = {
  getByBoardId: (boardId) => api.get(`/boards/${boardId}/columns`),
  create: (boardId, data) => api.post(`/boards/${boardId}/columns`, data),
  update: (id, data) => api.patch(`/columns/${id}`, data),
  delete: (id) => api.delete(`/columns/${id}`),
};

// Вспомогалки для Tasks
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

// ---------- Tasks ----------
export const tasksAPI = {
  // GET /boards/:boardKey/tasks   (если этот маршрут у тебя есть на другом роутере)
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

  // POST /tasks  ← это соответствует твоему бэку (router.post('/', ...) в /api/tasks)
  create: async (data = {}) => {
    // базовая валидация на фронте — чтобы дать человеку быстрый фидбек
    if (!data.board_key) throw new Error('tasksAPI.create: board_key is required');
    if (!data.column_id) throw new Error('tasksAPI.create: column_id is required');
    if (!data.title)     throw new Error('tasksAPI.create: title is required');

    // приведение ключа борда к верхнему регистру (бэк тоже нормализует, но сделаем заранее)
    const payload = toBackendTask({ ...data, board_key: String(data.board_key).toUpperCase() });

    const res = await api.post('/tasks', payload);
    return mapTaskFromBackend(res);
  },

  // PATCH /tasks/:id
  update: async (id, data) => {
    const res = await api.patch(`/tasks/${id}`, toBackendTask(data));
    return mapTaskFromBackend(res);
  },

  delete: (id) => api.delete(`/tasks/${id}`),

  addComment: (taskId, commentData) => api.post(`/tasks/${taskId}/comments`, commentData),

  getMyTasks: async () => {
    const res = await api.get('/me/tasks');
    return mapTasksArrayFromBackend(res);
  },
};

// ---------- Users ----------
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  // Тихий fallback: если бэка для assignable-users нет — берём /users
  getAssignableUsers: async (boardKey) => {
    try {
      return await api.get(`/boards/${encodeURIComponent(String(boardKey).toUpperCase())}/assignable-users`);
    } catch {
      return await api.get('/users');
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