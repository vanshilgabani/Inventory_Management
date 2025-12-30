import api from './api';

// Start a new edit session
export const startEditSession = async () => {
  const response = await api.post('/api/edit-sessions/start');
  return response.data;
};

// Get active session for current user
export const getActiveSession = async () => {
  const response = await api.get('/api/edit-sessions/active');
  return response.data;
};

// End active session
export const endEditSession = async () => {
  const response = await api.post('/api/edit-sessions/end');
  return response.data;
};

// Get session history
export const getSessionHistory = async () => {
  const response = await api.get('/api/edit-sessions/history');
  return response.data;
};
