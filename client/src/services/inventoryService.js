import api from './api';

export const inventoryService = {
  async getAllProducts() {
    const response = await api.get('/inventory');
    return response.data;
  },

  async getProductById(id) {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  async createProduct(productData) {
    const response = await api.post('/inventory', productData);
    return response.data;
  },

  async updateProduct(id, productData) {
    const response = await api.put(`/inventory/${id}`, productData);
    return response.data;
  },

  async deleteProduct(id) {
    const response = await api.delete(`/inventory/${id}`);
    return response.data;
  },

  async getLowStockItems() {
    const response = await api.get('/inventory/low-stock');
    return response.data;
  },

  async updateStock(id, stockData) {
    const response = await api.put(`/inventory/${id}/stock`, stockData);
    return response.data;
  },

  // ✅ NEW: Get stock status for all products with threshold info
  async getStockStatus() {
    const response = await api.get('/inventory/stock-status');
    return response.data;
  },
};
