import api from './api';

export const settlementService = {
  // Get units preview before creating settlement
  async getUnitsPreview(accountName, settlementDate) {
    const response = await api.get('/settlements/preview-units', {
      params: { accountName, settlementDate }
    });
    return response.data.data;
  },

  // Create settlement
  async createSettlement(settlementData) {
    const response = await api.post('/settlements', settlementData);
    return response.data.data;
  },

  // Get all settlements
  async getAllSettlements(accountName = 'all', startDate = null, endDate = null) {
    const params = {};
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/settlements', { params });
    return response.data;
  },

  // Get settlement by ID
  async getSettlementById(id) {
    const response = await api.get(`/settlements/${id}`);
    return response.data.data;
  },

  // Update settlement
  async updateSettlement(id, settlementData) {
    const response = await api.put(`/settlements/${id}`, settlementData);
    return response.data.data;
  },

  // Delete settlement
  async deleteSettlement(id) {
    const response = await api.delete(`/settlements/${id}`);
    return response.data;
  }
};
