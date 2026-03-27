import api from './api';

// Initialize trial
export const initializeTrial = async () => {
  const response = await api.post('/subscription/trial/initialize', {});
  return response.data;
};

// Get current subscription
export const getSubscription = async () => {
  const response = await api.get('/subscription/');
  return response.data;
};

// Upgrade plan
export const upgradePlan = async (planType, paymentData) => {
  const response = await api.post('/subscription/upgrade', { planType, ...paymentData });
  return response.data;
};

// Generate monthly invoice (order-based plan)
export const generateMonthlyInvoice = async () => {
  const response = await api.post('/subscription/generate-invoice', {});
  return response.data;
};

// Get invoices
export const getInvoices = async (params = {}) => {
  const response = await api.get('/subscription/invoices', { params });
  return response.data;
};

// Mark invoice as paid
export const markInvoicePaid = async (invoiceId, paymentData) => {
  const response = await api.put(`/subscription/invoices/${invoiceId}/mark-paid`, paymentData);
  return response.data;
};

export default {
  initializeTrial,
  getSubscription,
  upgradePlan,
  generateMonthlyInvoice,
  getInvoices,
  markInvoicePaid,
};
