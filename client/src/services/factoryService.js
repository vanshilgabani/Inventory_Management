import api from './api';

export const factoryService = {
  getAllReceivings: async () => {
    const response = await api.get('/factory');
    return response.data;
  },

  createReceiving: async (data) => {
    const response = await api.post('/factory', data);
    return response.data;
  },

  getReceivingById: async (id) => {
    const response = await api.get(`/factory/${id}`);
    return response.data;
  },

  updateReceiving: async (id, data) => {
    const response = await api.put(`/factory/${id}`, data);
    return response.data;
  },

  deleteReceiving: async (id) => {
    const response = await api.delete(`/factory/${id}`);
    return response.data;
  },

  returnBorrowedStock: async (receivingId, data) => {
    const response = await api.post(`/factory/${receivingId}/return`, data);
    return response.data;
  },

  markPaymentDone: async (receivingId, data) => {
    const response = await api.post(`/factory/${receivingId}/mark-payment`, data);
    return response.data;
  },

  getBorrowHistoryBySource: async (sourceName) => {
    const response = await api.get(`/factory/borrow-history/${encodeURIComponent(sourceName)}`);
    return response.data;
  },

  // ✅ NEW: Get deleted receivings
  getDeletedReceivings: async () => {
    const response = await api.get('/factory/deleted/all');
    return response.data;
  },

  // ✅ NEW: Restore receiving
  restoreReceiving: async (id) => {
    const response = await api.post(`/factory/${id}/restore`);
    return response.data;
  },

  // ✅ NEW: Permanently delete
  permanentlyDeleteReceiving: async (id) => {
    const response = await api.delete(`/factory/${id}/permanent`);
    return response.data;
  },
};
