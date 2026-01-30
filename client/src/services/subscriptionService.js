// src/services/subscriptionService.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Get auth token from localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// Initialize trial
export const initializeTrial = async () => {
  const response = await axios.post(
    `${API_URL}/subscription/trial/initialize`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get current subscription
export const getSubscription = async () => {
  const response = await axios.get(`${API_URL}/subscription/`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

// Upgrade plan
export const upgradePlan = async (planType, paymentData) => {
  const response = await axios.post(
    `${API_URL}/subscription/upgrade`,
    {
      planType,
      ...paymentData,
    },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Generate monthly invoice (order-based plan)
export const generateMonthlyInvoice = async () => {
  const response = await axios.post(
    `${API_URL}/subscription/generate-invoice`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get invoices
export const getInvoices = async (params = {}) => {
  const response = await axios.get(`${API_URL}/subscription/invoices`, {
    headers: getAuthHeader(),
    params,
  });
  return response.data;
};

// Mark invoice as paid
export const markInvoicePaid = async (invoiceId, paymentData) => {
  const response = await axios.put(
    `${API_URL}/subscription/invoices/${invoiceId}/mark-paid`,
    paymentData,
    { headers: getAuthHeader() }
  );
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
