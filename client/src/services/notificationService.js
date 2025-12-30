import api from './api';

// Get all notifications
const getAllNotifications = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(`/notifications?${params}`);
  return response.data;
};

// Get notification count
const getNotificationCount = async () => {
  const response = await api.get('/notifications/count');
  return response.data;
};

// Get notification summary
const getNotificationSummary = async () => {
  const response = await api.get('/notifications/summary');
  return response.data;
};

// Dismiss notification
const dismissNotification = async (id) => {
  const response = await api.post(`/notifications/${id}/dismiss`);
  return response.data;
};

// Snooze notification
const snoozeNotification = async (id, data) => {
  const response = await api.post(`/notifications/${id}/snooze`, data);
  return response.data;
};

// Resolve notification (mark as paid)
const resolveNotification = async (id, data) => {
  const response = await api.post(`/notifications/${id}/resolve`, data);
  return response.data;
};

// Add contact note
const addContactNote = async (id, data) => {
  const response = await api.post(`/notifications/${id}/contact`, data);
  return response.data;
};

// Set payment promise
const setPaymentPromise = async (id, data) => {
  const response = await api.post(`/notifications/${id}/promise`, data);
  return response.data;
};

// Send bulk emails
const sendBulkEmails = async (notificationIds) => {
  const response = await api.post('/notifications/bulk-email', { notificationIds });
  return response.data;
};

// Get notification settings
const getNotificationSettings = async () => {
  const response = await api.get('/settings/notifications');
  return response.data;
};

// Update notification settings
const updateNotificationSettings = async (data) => {
  const response = await api.put('/settings/notifications', data);
  return response.data;
};

export const notificationService = {
  getAllNotifications,
  getNotificationCount,
  getNotificationSummary,
  dismissNotification,
  snoozeNotification,
  resolveNotification,
  addContactNote,
  setPaymentPromise,
  sendBulkEmails,
  getNotificationSettings,
  updateNotificationSettings
};
