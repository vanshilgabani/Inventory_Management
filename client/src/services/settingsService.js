import axios from 'axios';
import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Get auth token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// Get settings
const getSettings = async () => {
  const response = await axios.get(`${API_URL}/settings`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// ✅ UPDATED: Get enabled sizes (uses new API endpoint)
const getEnabledSizes = async () => {
  try {
    const response = await axios.get(`${API_URL}/settings/sizes/enabled`, {
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch enabled sizes:', error);
    // Fallback to default sizes
    return ['S', 'M', 'L', 'XL', 'XXL'];
  }
};

// ✅ NEW: Get all sizes (enabled + disabled)
const getAllSizes = async () => {
  const response = await axios.get(`${API_URL}/settings/sizes`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// ✅ NEW: Add new size
const addSize = async (sizeName) => {
  const response = await axios.post(
    `${API_URL}/settings/sizes`,
    { name: sizeName },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// ✅ NEW: Toggle size enable/disable
const toggleSize = async (sizeName, isEnabled) => {
  const response = await axios.put(
    `${API_URL}/settings/sizes/${sizeName}/toggle`,
    { isEnabled },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// ✅ NEW: Reorder sizes
const reorderSizes = async (sizes) => {
  const response = await axios.put(
    `${API_URL}/settings/sizes/reorder`,
    { sizes },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Update settings
const updateSettings = async (settingsData) => {
  const response = await axios.put(`${API_URL}/settings`, settingsData, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Add marketplace account
const addMarketplaceAccount = async (accountData) => {
  const response = await axios.post(
    `${API_URL}/settings/marketplace-accounts`,
    accountData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Update marketplace account
const updateMarketplaceAccount = async (accountId, accountData) => {
  const response = await axios.put(
    `${API_URL}/settings/marketplace-accounts/${accountId}`,
    accountData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Delete marketplace account
const deleteMarketplaceAccount = async (accountId) => {
  const response = await axios.delete(
    `${API_URL}/settings/marketplace-accounts/${accountId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Set default marketplace account
const setDefaultMarketplaceAccount = async (accountId) => {
  const response = await axios.put(
    `${API_URL}/settings/marketplace-accounts/${accountId}/set-default`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Get stock thresholds
const getStockThresholds = async () => {
  const response = await axios.get(`${API_URL}/settings/stock-thresholds`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Update stock thresholds (Admin only)
const updateStockThresholds = async (thresholdData) => {
  const response = await axios.put(
    `${API_URL}/settings/stock-thresholds`,
    thresholdData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Add or update design-specific threshold (Admin only)
const addDesignThreshold = async (design, threshold) => {
  const response = await axios.post(
    `${API_URL}/settings/stock-thresholds/design`,
    { design, threshold },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Remove design threshold override (Admin only)
const removeDesignThreshold = async (design) => {
  const response = await axios.delete(
    `${API_URL}/settings/stock-thresholds/design/${design}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Color Palette APIs
const getColorPalette = async () => {
  const response = await axios.get(`${API_URL}/settings/color-palette`, {
    headers: getAuthHeader()
  });
  return response.data;
};

const addColorToPalette = async (colorData) => {
  const response = await axios.post(
    `${API_URL}/settings/color-palette`,
    colorData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const updateColorInPalette = async (colorId, colorData) => {
  const response = await axios.put(
    `${API_URL}/settings/color-palette/${colorId}`,
    colorData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const deleteColorFromPalette = async (colorId) => {
  const response = await axios.delete(
    `${API_URL}/settings/color-palette/${colorId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const reorderColors = async (orderedColorIds) => {
  const response = await axios.put(
    `${API_URL}/settings/color-palette/reorder`,
    { orderedColorIds },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Company Management APIs
const getCompanies = async () => {
  const response = await axios.get(`${API_URL}/settings/companies`, {
    headers: getAuthHeader()
  });
  return response.data;
};

const addCompany = async (companyData) => {
  const response = await axios.post(
    `${API_URL}/settings/companies`,
    companyData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const updateCompany = async (companyId, companyData) => {
  const response = await axios.put(
    `${API_URL}/settings/companies/${companyId}`,
    companyData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const deleteCompany = async (companyId) => {
  const response = await axios.delete(
    `${API_URL}/settings/companies/${companyId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

const toggleCompanyActive = async (companyId, isActive) => {
  const response = await axios.put(
    `${API_URL}/settings/companies/${companyId}/toggle-active`,
    { isActive },
    { headers: getAuthHeader() }
  );
  return response.data;
};

const setDefaultCompany = async (companyId) => {
  const response = await axios.put(
    `${API_URL}/settings/companies/${companyId}/set-default`,
    {},
    { headers: getAuthHeader() }
  );
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
  const response = await axios.post(
    `${API_URL}/settings/sizes/sync-products`,
    {},
    { headers: getAuthHeader() }
  );
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
