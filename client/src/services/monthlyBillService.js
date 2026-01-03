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
  }
};
