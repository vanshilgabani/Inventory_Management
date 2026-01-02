import api from './api';

const transferService = {
  // Get all transfers with filters
  getAllTransfers: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.design) params.append('design', filters.design);
    if (filters.color) params.append('color', filters.color);
    if (filters.size) params.append('size', filters.size);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.limit) params.append('limit', filters.limit);
    const response = await api.get(`/transfers?${params.toString()}`);
    return response.data;
  },

  // Get recent transfers (last 10)
  getRecentTransfers: async () => {
    const response = await api.get('/transfers/recent');
    return response.data;
  },

  // Transfer from main to reserved
  transferToReserved: async (data) => {
    const response = await api.post('/transfers/to-reserved', data);
    return response.data;
  },

  // Transfer from reserved to main
  transferToMain: async (data) => {
    const response = await api.post('/transfers/to-main', data);
    return response.data;
  },

  // Bulk transfer to reserved
  bulkTransferToReserved: async (data) => {
    const response = await api.post('/transfers/bulk-to-reserved', data);
    return response.data;
  },

  // Bulk transfer to main (ADD THIS)
  bulkTransferToMain: async (data) => {
    const response = await api.post('/transfers/bulk-to-main', data);
    return response.data;
  }
};

export default transferService;
