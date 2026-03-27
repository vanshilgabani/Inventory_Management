import api from './api';

// Get settings
const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

// ✅ UPDATED: Get enabled sizes (uses new API endpoint)
const getEnabledSizes = async (design = null) => {
  try {
    const url = design
      ? `/settings/sizes/enabled?design=${encodeURIComponent(design)}`
      : '/settings/sizes/enabled';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    return ['S', 'M', 'L', 'XL', 'XXL'];
  }
};

// ✅ NEW: Get all sizes (enabled + disabled)
const getAllSizes = async () => {
  const response = await api.get('/settings/sizes');
  return response.data;
};

// ✅ NEW: Add new size
const addSize = async (sizeName) => {
  const response = await api.post('/settings/sizes', { name: sizeName });
  return response.data;
};

// ✅ NEW: Toggle size enable/disable
const toggleSize = async (sizeName, isEnabled, design = null) => {
  const response = await api.put(`/settings/sizes/${sizeName}/toggle`, {
    isEnabled,
    ...(design && { design })
  });
  return response.data;
};

// ✅ NEW: Reorder sizes
const reorderSizes = async (sizes) => {
  const response = await api.put('/settings/sizes/reorder', { sizes });
  return response.data;
};

// Update settings
const updateSettings = async (settingsData) => {
  const response = await api.put('/settings', settingsData);
  return response.data;
};

// Add marketplace account
const addMarketplaceAccount = async (accountData) => {
  const response = await api.post('/settings/marketplace-accounts', accountData);
  return response.data;
};

// Update marketplace account
const updateMarketplaceAccount = async (accountId, accountData) => {
  const response = await api.put(`/settings/marketplace-accounts/${accountId}`, accountData);
  return response.data;
};

// Delete marketplace account
const deleteMarketplaceAccount = async (accountId) => {
  const response = await api.delete(`/settings/marketplace-accounts/${accountId}`);
  return response.data;
};

// Set default marketplace account
const setDefaultMarketplaceAccount = async (accountId) => {
  const response = await api.put(`/settings/marketplace-accounts/${accountId}/set-default`, {});
  return response.data;
};

// Get stock thresholds
const getStockThresholds = async () => {
  const response = await api.get('/settings/stock-thresholds');
  return response.data;
};

// Update stock thresholds (Admin only)
const updateStockThresholds = async (thresholdData) => {
  const response = await api.put('/settings/stock-thresholds', thresholdData);
  return response.data;
};

// Add or update design-specific threshold (Admin only)
const addDesignThreshold = async (design, threshold) => {
  const response = await api.post('/settings/stock-thresholds/design', { design, threshold });
  return response.data;
};

// Remove design threshold override (Admin only)
const removeDesignThreshold = async (design) => {
  const response = await api.delete(`/settings/stock-thresholds/design/${design}`);
  return response.data;
};

// Color Palette APIs
const getColorPalette = async () => {
  const response = await api.get('/settings/color-palette');
  return response.data;
};

const addColorToPalette = async (colorData) => {
  const response = await api.post('/settings/color-palette', colorData);
  return response.data;
};

const updateColorInPalette = async (colorId, colorData) => {
  const response = await api.put(`/settings/color-palette/${colorId}`, colorData);
  return response.data;
};

const deleteColorFromPalette = async (colorId) => {
  const response = await api.delete(`/settings/color-palette/${colorId}`);
  return response.data;
};

const reorderColors = async (orderedColorIds) => {
  const response = await api.put('/settings/color-palette/reorder', { orderedColorIds });
  return response.data;
};

// Company Management APIs
const getCompanies = async () => {
  const response = await api.get('/settings/companies');
  return response.data;
};

const addCompany = async (companyData) => {
  const response = await api.post('/settings/companies', companyData);
  return response.data;
};

const updateCompany = async (companyId, companyData) => {
  const response = await api.put(`/settings/companies/${companyId}`, companyData);
  return response.data;
};

const deleteCompany = async (companyId) => {
  const response = await api.delete(`/settings/companies/${companyId}`);
  return response.data;
};

const toggleCompanyActive = async (companyId, isActive) => {
  const response = await api.put(`/settings/companies/${companyId}/toggle-active`, { isActive });
  return response.data;
};

const setDefaultCompany = async (companyId) => {
  const response = await api.put(`/settings/companies/${companyId}/set-default`, {});
  return response.data;
};

export const getTenantSettings = async () => {
  const response = await api.get('/tenant-settings/my-settings');
  console.log('🔍 API Response:', response.data);
  
  if (response.data.success && response.data.data) {
    return response.data.data;
  }
  return response.data;
};

export const updateInventoryMode = async (mode) => {
  const response = await api.put('/tenant-settings/inventory-mode', { mode });
  return response.data;
};

// Flipkart Integration
const getFlipkartSettings = async () => {
  const response = await api.get('/flipkart/settings');
  return response.data;
};

const updateFlipkartSettings = async (settingsData) => {
  const response = await api.put('/flipkart/settings', settingsData);
  return response.data;
};

const testFlipkartCredentials = async (appId, appSecret) => {
  const response = await api.post('/flipkart/test-credentials', {
    appId,
    appSecret
  });
  return response.data;
};

const updateAccountFlipkart = async (accountId, flipkartConfig) => {
  const response = await api.put(`/settings/marketplace-accounts/${accountId}/flipkart`, flipkartConfig);
  return response.data;
};

const syncProductsWithSizes = async () => {
  const response = await api.post('/settings/sizes/sync-products', {});
  return response.data;
};

export const settingsService = {
  getSettings,
  updateSettings,
  
  // ✅ Size Management
  getAllSizes,
  getEnabledSizes,
  addSize,
  toggleSize,
  reorderSizes,
  syncProductsWithSizes,
  
  // Marketplace Accounts
  addMarketplaceAccount,
  updateMarketplaceAccount,
  deleteMarketplaceAccount,
  setDefaultMarketplaceAccount,
  
  // Stock Thresholds
  getStockThresholds,
  updateStockThresholds,
  addDesignThreshold,
  removeDesignThreshold,
  
  // Color Palette
  getColorPalette,
  addColorToPalette,
  updateColorInPalette,
  deleteColorFromPalette,
  reorderColors,
  
  // Company Management
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyActive,
  setDefaultCompany,
  
  // Tenant Settings
  getTenantSettings,
  updateInventoryMode,
  
  // Flipkart Integration
  getFlipkartSettings,
  updateFlipkartSettings,
  testFlipkartCredentials,
  updateAccountFlipkart
};
