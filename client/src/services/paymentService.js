import api from './api';

// Create Razorpay order
export const createPaymentOrder = async (planType) => {
  const response = await api.post('/payment/create-order', { planType });
  return response.data;
};

// Verify payment after successful transaction
export const verifyPayment = async (paymentData) => {
  const response = await api.post('/payment/verify-payment', paymentData);
  return response.data;
};

// Upgrade to order-based plan (no payment)
export const upgradePlanFree = async (planType) => {
  const response = await api.post('/subscription/upgrade', { planType });
  return response.data;
};

export const paymentService = {
  createPaymentOrder,
  verifyPayment,
  upgradePlanFree
};
