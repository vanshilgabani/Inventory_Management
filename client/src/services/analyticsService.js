import api from './api';

export const analyticsService = {
  // Old functions (keep if still needed elsewhere)
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

  // ==========================================
  // NEW: Section 1: Wholesale & Direct
  // ==========================================
  async getTopWholesaleBuyers(params = {}) {
    const response = await api.get('/analytics/wholesale/top-buyers', { params });
    return response.data;
  },

  async getTopProductsPerBuyer(params = {}) {
    const response = await api.get('/analytics/wholesale/buyer-products', { params });
    return response.data;
  },

  async getBuyerDesignDrilldown(params = {}) {
    const response = await api.get('/analytics/wholesale/buyer-design-drilldown', { params });
    return response.data;
  },

  async getWholesaleRevenueTrends(params = {}) {
    const response = await api.get('/analytics/wholesale/revenue-trends', { params });
    return response.data;
  },

  async getDirectSalesAmount(params = {}) {
    const response = await api.get('/analytics/direct/sales-amount', { params });
    return response.data;
  },

  async getSalesVelocityByProduct(params = {}) {
    const response = await api.get('/analytics/sales-velocity', { params });
    return response.data;
  },

  // ==========================================
  // NEW: Section 2: Marketplace
  // ==========================================
  async getMarketplaceAccountStats(params = {}) {
    const response = await api.get('/analytics/marketplace/account-stats', { params });
    return response.data;
  },

  async getReturnRateByProduct(params = {}) {
    const response = await api.get('/analytics/marketplace/return-rate', { params });
    return response.data;
  },

  async getBestSellingMarketplaceProducts(params = {}) {
    const response = await api.get('/analytics/marketplace/best-selling', { params });
    return response.data;
  },

  async getStockRecommendations(params = {}) {
    const response = await api.get('/analytics/marketplace/stock-recommendations', { params });
    return response.data;
  },

  // ==========================================
  // NEW: Inventory Intelligence
  // ==========================================
  async getCurrentStockLevels(params = {}) {
    const response = await api.get('/analytics/inventory/stock-levels', { params });
    return response.data;
  },

  async getStockTurnoverRate(params = {}) {
    const response = await api.get('/analytics/inventory/turnover-rate', { params });
    return response.data;
  },

  async getStockValueByType() {
    const response = await api.get('/analytics/inventory/stock-value');
    return response.data;
  },

  async getOptimalReorderPoints(params = {}) {
    const response = await api.get('/analytics/inventory/reorder-points', { params });
    return response.data;
  },

  async getColorSizeDistribution(params = {}) {
    const response = await api.get('/analytics/inventory/color-size-distribution', { params });
    return response.data;
  },

  // ==========================================
  // NEW: Growth Metrics
  // ==========================================
  async getGrowthMetrics() {
    const response = await api.get('/analytics/growth-metrics');
    return response.data;
  }
};
