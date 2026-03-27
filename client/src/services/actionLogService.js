import api from './api';

// Log action with screenshot
export const logAction = async (data) => {
  const response = await api.post('/action-logs', data);
  return response.data;
};

// Get all action logs (admin)
export const getActionLogs = async (filters = {}) => {
  const response = await api.get('/action-logs', { params: filters });
  return response.data;
};

// Get action log by ID
export const getActionLogById = async (id) => {
  const response = await api.get(`/action-logs/${id}`);
  return response.data;
};

// Get logs by salesperson
export const getLogsBySalesperson = async (userId, filters = {}) => {
  const response = await api.get(`/action-logs/salesperson/${userId}`, { params: filters });
  return response.data;
};

// Mark action as undone
export const markAsUndone = async (id) => {
  const response = await api.put(`/action-logs/${id}/undo`, {});
  return response.data;
};

export default {
  logAction,
  getActionLogs,
  getActionLogById,
  getLogsBySalesperson,
  markAsUndone
};
