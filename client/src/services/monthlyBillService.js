import api from './api';

export const monthlyBillService = {
  // Get all bills
  getAllBills: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);
    if (filters.buyerId) params.append('buyerId', filters.buyerId);

    const response = await api.get(`/monthly-bills?${params.toString()}`);
    return response.data.data;
  },

  // Get single bill
  getBillById: async (id) => {
    const response = await api.get(`/monthly-bills/${id}`);
    return response.data.data;
  },

  // Generate bill
  generateBill: async (data) => {
    const response = await api.post('/monthly-bills/generate', data);
    return response.data;
  },

  // ✅ NEW: Customize bill
  async customizeBill(id, customizations) {
    const response = await api.put(`/monthly-bills/${id}/customize`, customizations);
    return response.data;
  },
  
  // Switch company
  switchCompany: async (billId, companyId) => {
    const response = await api.put(`/monthly-bills/${billId}/switch-company`, { companyId });
    return response.data;
  },

  // Finalize bill
  finalizeBill: async (billId) => {
    const response = await api.put(`/monthly-bills/${billId}/finalize`);
    return response.data;
  },

  // Record payment
  recordPayment: async (billId, paymentData) => {
    const response = await api.post(`/monthly-bills/${billId}/payment`, paymentData);
    return response.data;
  },

  // Delete bill
  deleteBill: async (billId) => {
    const response = await api.delete(`/monthly-bills/${billId}`);
    return response.data;
  },

  // Get stats
  getBillsStats: async () => {
    const response = await api.get('/monthly-bills/stats');
    return response.data.data;
  },

  // ✅ NEW: Buyer bill management
  getBuyerBills: async (buyerId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);
    if (filters.status) params.append('status', filters.status);
    
    const response = await api.get(`/monthly-bills/buyer/${buyerId}/bills?${params.toString()}`);
    return response.data;
  },

  // Get current month pending for buyer
  getBuyerCurrentMonthPending: async (buyerId) => {
    const response = await api.get(`/monthly-bills/buyer/${buyerId}/current-month`);
    return response.data;
  },

  // Record advance payment (before bill generation)
  recordAdvancePayment: async (buyerId, paymentData) => {
    const response = await api.post(`/monthly-bills/buyer/${buyerId}/advance-payment`, paymentData);
    return response.data;
  },

  // Delete advance payment
  deleteAdvancePayment: async (buyerId, paymentId) => {
    const response = await api.delete(`/monthly-bills/buyer/${buyerId}/advance-payment/${paymentId}`);
    return response.data;
  },

  // Record payment for existing bill
  recordPaymentForBill: async (billId, paymentData) => {
    const response = await api.post(`/monthly-bills/${billId}/payment`, paymentData);
    return response.data;
  },

  // ✅ NEW: Get complete payment history for a bill
  getBillPaymentHistory: async (billId) => {
    const response = await api.get(`/monthly-bills/bills/${billId}/payment-history`);
    return response.data;
  },

  // ✅ NEW: Delete payment from bill
  deletePayment: async (billId, paymentIndex) => {
    const response = await api.delete(`/monthly-bills/${billId}/payments/${paymentIndex}`);
    return response.data;
  },

  customizeBill: async (billId, customizeData) => {
    const response = await api.put(`/monthly-bills/${billId}/customize`, customizeData);
    return response.data;
  },

  // NEW: Update bill number for draft bill
  updateBillNumber: async (billId, customSequence) => {
    const response = await api.put(`/monthly-bills/${billId}/update-bill-number`, {
      customSequence
    });
    return response.data;
  },
};
