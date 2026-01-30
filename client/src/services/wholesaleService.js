import api from './api';

// Get all wholesale orders
const getAllOrders = async () => {
  const response = await api.get('/wholesale');
  return response.data;
};

// Get single order by ID
const getOrderById = async (id) => {
  const response = await api.get(`/wholesale/${id}`);
  return response.data;
};

// Create wholesale order
const createOrder = async (orderData) => {
  const response = await api.post('/wholesale', orderData);
  return response.data;
};

// Update wholesale order
const updateOrder = async (id, orderData) => {
  const response = await api.put(`/wholesale/${id}`, orderData);
  return response.data;
};

// Update payment history
const updateOrderPaymentHistory = async (id, data) => {
  const response = await api.put(`/wholesale/${id}/payment-history`, data);
  return response.data;
};

// Delete wholesale order
const deleteOrder = async (id) => {
  const response = await api.delete(`/wholesale/${id}`);
  return response.data;
};

// Get pending payments
const getPendingPayments = async () => {
  const response = await api.get('/wholesale/pending-payments');
  return response.data;
};

// Get all buyers
const getAllBuyers = async () => {
  const response = await api.get('/wholesale/buyers');
  return response.data;
};

// Get buyer by mobile
const getBuyerByMobile = async (mobile) => {
  const response = await api.get(`/wholesale/buyers/${mobile}`);
  return response.data;
};

// Get buyer history
const getBuyerHistory = async (mobile) => {
  const response = await api.get(`/wholesale/buyers/${mobile}/history`);
  return response.data;
};

// Update buyer credit limit
const updateBuyerCredit = async (id, data) => {
  const response = await api.put(`/wholesale/buyers/${id}/credit`, data);
  return response.data;
};

// Update buyer trust status
const updateBuyerTrust = async (id, data) => {
  const response = await api.put(`/wholesale/buyers/${id}/trust`, data);
  return response.data;
};

// Update buyer email
const updateBuyerEmail = async (id, data) => {
  const response = await api.put(`/wholesale/buyers/${id}/email`, data);
  return response.data;
};

// Send 80% credit warning
const sendCreditWarning = async (id) => {
  const response = await api.post(`/wholesale/buyers/${id}/send-credit-warning`);
  return response.data;
};

// Preview challan number
const previewChallanNumber = async (businessName, buyerContact) => {
  const response = await api.post('/wholesale/preview-challan', {
    businessName,
    buyerContact
  });
  return response.data;
};

// ============================================
// NEW: BULK PAYMENT FUNCTIONS
// ============================================

// Get buyer statistics
const getBuyerStats = async () => {
  const response = await api.get('/wholesale/stats');
  return response.data;
};

// Record bulk payment
const recordBulkPayment = async (buyerId, paymentData) => {
  const response = await api.post(`/wholesale/buyers/${buyerId}/bulk-payment`, paymentData);
  return response.data;
};

// Preview payment allocation
const previewPaymentAllocation = async (buyerId, amount) => {
  const response = await api.post(`/wholesale/buyers/${buyerId}/preview-payment`, { amount });
  return response.data.data;
};

// Get bulk payment history
const getBulkPaymentHistory = async (buyerId) => {
  const response = await api.get(`/wholesale/buyers/${buyerId}/payment-history`);
  return response.data.data;
};

// Update bulk payment (Admin only)
const updateBulkPayment = async (buyerId, paymentId, data) => {
  const response = await api.put(`/wholesale/buyers/${buyerId}/payments/${paymentId}`, data);
  return response.data;
};

// Delete bulk payment (Admin only)
const deleteBulkPayment = async (buyerId, paymentId) => {
  const response = await api.delete(`/wholesale/buyers/${buyerId}/payments/${paymentId}`);
  return response.data;
};

const createOrderWithReservedBorrow = async (data) => {
  const response = await api.post('/wholesale/with-reserved-borrow', {...data, borrowedFromReserved: true, allowBorrowFromReserved: true });
  return response.data;
};

// ✅ NEW: Smart payment recording (bill-aware)
const recordSmartPayment = async (buyerId, paymentData) => {
  const response = await api.post(`/wholesale/buyers/${buyerId}/smart-payment`, paymentData);
  return response.data;
};

const getBuyerMonthlyHistory = async (buyerId) => {
  const response = await api.get(`/wholesale/buyers/${buyerId}/monthly-history`);
  return response.data;
};

// Delete a specific payment from order
const deleteOrderPayment = async (orderId, paymentIndex) => {
  const response = await api.delete(`/wholesale/${orderId}/payments/${paymentIndex}`);
  return response.data;
};

// Get tenant users
const getTenantUsers = async () => {
  const response = await api.get('/wholesale/tenants');
  return response.data.data;
};

// Link buyer to tenant
const linkBuyerToTenant = async (buyerId, customerTenantId) => {
  const response = await api.put(`/wholesale/buyers/${buyerId}/link-tenant`, {
    customerTenantId
  });
  return response.data;
};

// Get buyer tenant info
const getBuyerTenantInfo = async (buyerId) => {
  const response = await api.get(`/wholesale/buyers/${buyerId}/tenant-info`);
  return response.data.data;
};

export const wholesaleService = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderPaymentHistory,
  deleteOrder,
  getPendingPayments,
  getAllBuyers,
  getBuyerByMobile,
  getBuyerHistory,
  updateBuyerCredit,
  updateBuyerEmail,
  updateBuyerTrust,
  sendCreditWarning,
  previewChallanNumber,
  getBuyerStats,
  recordBulkPayment,
  previewPaymentAllocation,
  getBulkPaymentHistory,
  updateBulkPayment,
  deleteBulkPayment,
  createOrderWithReservedBorrow,
  recordSmartPayment,
  getBuyerMonthlyHistory,
  deleteOrderPayment,
  getTenantUsers,           // ✅ ADD
  linkBuyerToTenant,        // ✅ ADD
  getBuyerTenantInfo
};
