import api from './api';

export const analyticsService = {
  async getDashboardStats() {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  },

  async getSalesByChannel() {
    const response = await api.get('/analytics/sales-by-channel');
    return response.data;
  },

  async getBestSellingDesigns() {
    const response = await api.get('/analytics/best-selling');
    return response.data;
  },

  async getRevenueTrends() {
    const response = await api.get('/analytics/revenue-trends');
    return response.data;
  },
};
