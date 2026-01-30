import api from './api';

export const skuMappingService = {
  // Get all mappings for tenant
  async getAllMappings(accountName = 'all') {
    const params = {};
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    const response = await api.get('/sku-mappings', { params });
    return response.data.data;
  },

  // Get suggestions for SKU
  async getSuggestions(sku, accountName) {
    const response = await api.get('/sku-mappings/suggestions', {
      params: { sku, accountName }
    });
    return response.data.data;
  },

  // Create new mapping
  async createMapping(mappingData) {
    const response = await api.post('/sku-mappings', mappingData);
    return response.data.data;
  },

  // Delete mapping
  async deleteMapping(id) {
    const response = await api.delete(`/sku-mappings/${id}`);
    return response.data;
  },

  // Get bulk mappings for multiple SKUs
  async getBulkMappings(accountName, skus) {
    try {
      const response = await api.post('/sku-mappings/bulk-lookup', {
        skus
      });
      return response.data;
    } catch (error) {
      console.error('Bulk mapping lookup failed:', error);
      throw error;
    }
  },
};
