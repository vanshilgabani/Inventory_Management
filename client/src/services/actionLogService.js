import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Log action with screenshot
export const logAction = async (data) => {
  const response = await axios.post(
    `${API_URL}/action-logs`,
    data,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get all action logs (admin)
export const getActionLogs = async (filters = {}) => {
  const response = await axios.get(
    `${API_URL}/action-logs`,
    { 
      headers: getAuthHeader(),
      params: filters
    }
  );
  return response.data;
};

// Get action log by ID
export const getActionLogById = async (id) => {
  const response = await axios.get(
    `${API_URL}/action-logs/${id}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get logs by salesperson
export const getLogsBySalesperson = async (userId, filters = {}) => {
  const response = await axios.get(
    `${API_URL}/action-logs/salesperson/${userId}`,
    { 
      headers: getAuthHeader(),
      params: filters
    }
  );
  return response.data;
};

// Mark action as undone
export const markAsUndone = async (id) => {
  const response = await axios.put(
    `${API_URL}/action-logs/${id}/undo`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

export default {
  logAction,
  getActionLogs,
  getActionLogById,
  getLogsBySalesperson,
  markAsUndone
};
