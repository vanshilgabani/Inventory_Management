import api from './api';

export const flipkartService = {
  // Get Flipkart settings
  async getSettings() {
    const response = await api.get('/flipkart/settings');
    return response.data;
  },

  // Update Flipkart settings
  async updateSettings(settingsData) {
    const response = await api.put('/flipkart/settings', settingsData);
    return response.data;
  },

  // Test API credentials
  async testCredentials(appId, appSecret) {
    const response = await api.post('/flipkart/test-credentials', {
      appId,
      appSecret
    });
    return response.data;
  },

  // Get all products with Flipkart status
  async getProducts() {
    const response = await api.get('/flipkart/products');
    return response.data;
  },

  // Toggle Flipkart sync for a product
  async toggleProductSync(productId, data) {
    const response = await api.put(`/flipkart/products/${productId}/toggle`, data);
    return response.data;
  },

  // Update product mapping
  async updateProductMapping(productId, mappingData) {
    const response = await api.put(`/flipkart/products/${productId}/mapping`, mappingData);
    return response.data;
  },

  // Bulk update products
  async bulkUpdateProducts(productIds, data) {
    const response = await api.post('/flipkart/products/bulk-update', {
      productIds,
      ...data
    });
    return response.data;
  },

  // Manual sync
  async manualSync(productIds = []) {
    const response = await api.post('/flipkart/sync/manual', { productIds });
    return response.data;
  },

  // Get sync status
  async getSyncStatus() {
    const response = await api.get('/flipkart/sync/status');
    return response.data;
  },

  // Get sync history
  async getSyncHistory() {
    const response = await api.get('/flipkart/sync/history');
    return response.data;
  }
};
