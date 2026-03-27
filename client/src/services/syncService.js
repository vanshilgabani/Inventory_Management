import api from './api';

// Get tenant sync logs
export const getTenantSyncLogs = async (params = {}) => {
  const response = await api.get('/sync/tenant/logs', { params });
  return response.data;
};

// Accept synced order
export const acceptSyncedOrder = async (syncLogId) => {
  const response = await api.put(`/sync/tenant/logs/${syncLogId}/accept`, {});
  return response.data;
};

// Report sync issue
export const reportSyncIssue = async (syncLogId, issueData) => {
  const response = await api.put(`/sync/tenant/logs/${syncLogId}/report-issue`, issueData);
  return response.data;
};

// Get supplier sync logs
export const getSupplierSyncLogs = async (params = {}) => {
  const response = await api.get('/sync/supplier/logs', { params });
  return response.data;
};

export default {
  getTenantSyncLogs,
  acceptSyncedOrder,
  reportSyncIssue,
  getSupplierSyncLogs,
};
