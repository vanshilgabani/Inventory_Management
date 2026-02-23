import api from './api';

export const salesService = {
  // Create marketplace sale
  async createSale(saleData) {
    const response = await api.post('/sales', saleData);
    return response.data.data;
  },

  // ✅ UPDATED: Get all sales with cursor-based pagination and search
  async getAllSales(accountName = 'all', status = 'all', startDate = null, endDate = null, page = 1, limit = 50, search = '', cursor = null) {
    const params = {};
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (status && status !== 'all') {
      params.status = status;
    }
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    // Pagination parameters
    params.page = page;
    params.limit = limit;
    
    // Search parameter
    if (search) {
      params.search = search;
    }
    
    // ✅ NEW: Cursor for infinite scroll
    if (cursor) {
      params.cursor = cursor;
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

  // ✅ NEW: Get stats for cards
  async getStatsForCards(accountName = 'all', status = 'all', startDate = null, endDate = null) {
    const params = {};
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (status && status !== 'all') {
      params.status = status;
    }
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/sales/stats-cards', { params });
    return response.data.data;
  },

  // ✅ NEW: Get orders grouped by dates
  async getOrdersByDateGroups(accountName = 'all', status = 'all', startDate = null, endDate = null, dateGroups = 3, beforeDate = null) {
    const params = {
      dateGroups
    };
    
    if (accountName && accountName !== 'all') {
      params.accountName = accountName;
    }
    
    if (status && status !== 'all') {
      params.status = status;
    }
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (beforeDate) params.beforeDate = beforeDate;
    
    const response = await api.get('/sales/by-date-groups', { params });
    return response.data.data;
  },

    searchByDate: async (date, accountName = 'all', status = 'all') => {
  const response = await api.get('/sales/search-by-date', {
    params: { date, accountName, status }
  });
  return response.data;
},

  searchGlobally: async (query, statusFilter = null) => {
    const params = { query };
    if (statusFilter) params.statusFilter = statusFilter;  // ✅ pass status for status-keyword search
    const response = await api.get('/sales/search-global', { params });
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
