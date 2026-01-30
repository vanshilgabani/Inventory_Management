// src/services/syncService.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// Get tenant sync logs
export const getTenantSyncLogs = async (params = {}) => {
  const response = await axios.get(`${API_URL}/sync/tenant/logs`, {
    headers: getAuthHeader(),
    params,
  });
  return response.data;
};

// Accept synced order
export const acceptSyncedOrder = async (syncLogId) => {
  const response = await axios.put(
    `${API_URL}/sync/tenant/logs/${syncLogId}/accept`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Report sync issue
export const reportSyncIssue = async (syncLogId, issueData) => {
  const response = await axios.put(
    `${API_URL}/sync/tenant/logs/${syncLogId}/report-issue`,
    issueData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get supplier sync logs
export const getSupplierSyncLogs = async (params = {}) => {
  const response = await axios.get(`${API_URL}/sync/supplier/logs`, {
    headers: getAuthHeader(),
    params,
  });
  return response.data;
};

export default {
  getTenantSyncLogs,
  acceptSyncedOrder,
  reportSyncIssue,
  getSupplierSyncLogs,
};
