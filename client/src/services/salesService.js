import api from './api';

export const salesService = {
  // Create marketplace sale
  async createSale(saleData) {
    const response = await api.post('/sales', saleData);
    return response.data.data;
  },

  // ✅ UPDATED: Get all sales with pagination and search
  async getAllSales(accountName = 'all', status = 'all', startDate = null, endDate = null, options = {}) {
    const params = {};
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (status && status !== 'all') {
      params.status = status;
    }
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    // ✅ NEW: Pagination parameters
    params.page = options.page || 1;
    params.limit = options.limit || 100;
    
    // ✅ NEW: Search parameter
    if (options.search) {
      params.search = options.search;
    }
    
    const response = await api.get('/sales', { params });
    return response.data; // Return full response with pagination info
  },

  // ✅ NEW: Global search across all pages
  async searchSales(query, accountName = 'all', status = 'all') {
    const params = { query };
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (status && status !== 'all') {
      params.status = status;
    }
    
    const response = await api.get('/sales/search', { params });
    return response.data;
  },

  // Get sale by ID
  async getSaleById(id) {
    const response = await api.get(`/sales/${id}`);
    return response.data.data;
  },

  // Update sale
  async updateSale(id, saleData) {
    console.log('API call - updateSale:', id, saleData);
    const response = await api.put(`/sales/${id}`, saleData);
    return response.data;
  },

  // Delete sale
  async deleteSale(id) {
    const response = await api.delete(`/sales/${id}`);
    return response.data;
  },

  // Get sales statistics
  async getSalesStats(accountName = 'all', startDate = null, endDate = null) {
    const params = {};
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/sales/stats', { params });
    return response.data.data;
  },

  // Bulk mark as delivered
  async bulkMarkDelivered(orderIds, comments) {
    const response = await api.post('/sales/bulk/delivered', { orderIds, comments });
    return response.data;
  },

  async createSaleWithMainStock(data) {
    const response = await api.post('/sales/with-main-stock', data);
    return response.data;
  },

  getDateSummary: async (accountName, status, startDate, endDate) => {
    const params = {};
    if (accountName && accountName !== 'all') params.accountName = accountName;
    if (status && status !== 'all') params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/sales/dates-summary', { params });
    return response.data;
  },

  // ✅ NEW: Get all orders for specific date
  getOrdersByDate: async (date, accountName, status) => {
    const params = { date };
    if (accountName && accountName !== 'all') params.accountName = accountName;
    if (status && status !== 'all') params.status = status;
    
    const response = await api.get('/sales/by-date', { params });
    return response.data;
  },

  // Import orders from CSV
  async importFromCSV(csvData, accountName, dispatchDate) {
    const payload = {
      csvData,
      accountName: accountName,
      dispatchDate
    };
    
    const response = await api.post('/sales/import-csv', payload);
    return response.data;
  },

  // Export orders to Excel
  async exportOrders(accountName, status, startDate, endDate) {
    const params = {};
    
    if (accountName && accountName !== 'all') params.accountName = accountName;
    if (status && status !== 'all') params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/sales/export/excel', {
      params,
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `marketplace-sales-${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};
