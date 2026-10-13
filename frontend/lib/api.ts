import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Добавить access token к каждому запросу
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// При 401 — пробовать refresh token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && typeof window !== 'undefined') {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refresh,
        });
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }

        // Синхронизируем Zustand store, иначе WebSocket продолжит
        // использовать старый (уже недействительный) токен.
        // Динамический импорт — чтобы избежать циклической зависимости.
        const { useAuthStore } = await import('@/store/useStore');
        useAuthStore.getState().setToken(data.access_token);
        if (data.refresh_token) {
          useAuthStore.getState().setRefreshToken(data.refresh_token);
        }

        // Сообщаем хуку WebSocket, что токен сменился и сокет
        // нужно пересоздать, иначе он останется на мёртвом токене.
        window.dispatchEvent(new Event('auth-token-changed'));

        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        const { useAuthStore } = await import('@/store/useStore');
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  sendCode: (phone: string) =>
    api.post('/auth/send-code', { phone }),
  verify: (phone: string, code: string, display_name?: string) =>
    api.post('/auth/verify', { phone, code, display_name }),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: { username?: string; display_name?: string; bio?: string }) =>
    api.patch('/users/me', data),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  search: (q: string) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  getById: (id: string) => api.get(`/users/${id}`),
};

// ─── Chats ───────────────────────────────────────────────────────────────────
export const chatsApi = {
  list: () => api.get('/chats'),
  create: (data: { type: string; title?: string; description?: string; member_ids: string[] }) =>
    api.post('/chats', data),
  getById: (id: string) => api.get(`/chats/${id}`),
  addMember: (chatId: string, userId: string) =>
    api.post(`/chats/${chatId}/members/${userId}`),
  markAsRead: (chatId: string) =>
    api.post(`/chats/${chatId}/read`),
  pinMessage: (chatId: string, messageId: string) =>
    api.post(`/chats/${chatId}/pin/${messageId}`),
  unpinMessage: (chatId: string) =>
    api.delete(`/chats/${chatId}/pin`),
  removeMember: (chatId: string, userId: string) =>
    api.delete(`/chats/${chatId}/members/${userId}`),
  updateMemberRole: (chatId: string, userId: string, data: any) =>
    api.patch(`/chats/${chatId}/members/${userId}/role`, typeof data === 'string' ? { role: data } : data),
  listRoles: (chatId: string) =>
    api.get(`/chats/${chatId}/roles`),
  createRole: (chatId: string, data: any) =>
    api.post(`/chats/${chatId}/roles`, data),
  updateRole: (chatId: string, roleId: string, data: any) =>
    api.patch(`/chats/${chatId}/roles/${roleId}`, data),
  deleteRole: (chatId: string, roleId: string) =>
    api.delete(`/chats/${chatId}/roles/${roleId}`),
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesApi = {
  getHistory: (chatId: string, beforeId?: string, limit = 50) =>
    api.get(
      `/chats/${chatId}/messages?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`
    ),
  send: (chatId: string, content: string, reply_to_id?: string) =>
    api.post(`/chats/${chatId}/messages`, { content, type: 'text', reply_to_id }),
  uploadFile: (chatId: string, file: File, reply_to_id?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (reply_to_id) form.append('reply_to_id', reply_to_id);
    return api.post(`/chats/${chatId}/messages/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  edit: (chatId: string, messageId: string, content: string) =>
    api.patch(`/chats/${chatId}/messages/${messageId}`, { content }),
  delete: (chatId: string, messageId: string) =>
    api.delete(`/chats/${chatId}/messages/${messageId}`),
  toggleReaction: (chatId: string, messageId: string, emoji: string) =>
    api.post(`/chats/${chatId}/messages/${messageId}/reactions`, { emoji }),
};
