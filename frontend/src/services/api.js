import apiClient from './apiClient'

export const authApi = {
  login: (payload) => apiClient.post('/api/auth/login', payload),
  me: () => apiClient.get('/api/auth/me'),
}

export const dashboardApi = {
  admin: () => apiClient.get('/api/dashboard/admin'),
  user: () => apiClient.get('/api/dashboard/user'),
}

export const userApi = {
  list: () => apiClient.get('/api/users'),
  create: (payload) => apiClient.post('/api/users', payload),
  update: (userId, payload) => apiClient.patch(`/api/users/${userId}`, payload),
  remove: (userId) => apiClient.delete(`/api/users/${userId}`),
}

export const projectApi = {
  list: () => apiClient.get('/api/projects'),
  create: (payload) => apiClient.post('/api/projects', payload),
  update: (projectId, payload) => apiClient.patch(`/api/projects/${projectId}`, payload),
  remove: (projectId) => apiClient.delete(`/api/projects/${projectId}`),
  kanban: (projectId, params = {}) => apiClient.get(`/api/projects/${projectId}/kanban`, { params }),
  gantt: (projectId, params = {}) => apiClient.get(`/api/projects/${projectId}/gantt`, { params }),
}

export const taskApi = {
  list: (params = {}) => apiClient.get('/api/tasks', { params }),
  create: (payload) => apiClient.post('/api/tasks', payload),
  update: (taskId, payload) => apiClient.patch(`/api/tasks/${taskId}`, payload),
  updateStatus: (taskId, payload) =>
    apiClient.patch(`/api/tasks/${taskId}/status`, payload),
  remove: (taskId) => apiClient.delete(`/api/tasks/${taskId}`),
}

export const sessionApi = {
  mySessions: () => apiClient.get('/api/sessions/me'),
  myOverview: (params = {}) => apiClient.get('/api/sessions/me/overview', { params }),
  myToday: (date) => apiClient.get('/api/sessions/me/today', { params: { date } }),
  checkIn: (payload) => apiClient.post('/api/sessions/check-in', payload),
  checkOut: (sessionId, payload) =>
    apiClient.post(`/api/sessions/${sessionId}/check-out`, payload),
  adminOverview: (params = {}) =>
    apiClient.get('/api/sessions/admin/overview', { params }),
}
