import axios from 'axios';

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

// ✅ Get enabled sizes
const getEnabledSizes = async () => {
  const response = await axios.get(`${API_URL}/settings`, {
    headers: getAuthHeader()
  });
  return response.data.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'];
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

// ✅ NEW: Get stock thresholds
const getStockThresholds = async () => {
  const response = await axios.get(`${API_URL}/settings/stock-thresholds`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// ✅ NEW: Update stock thresholds (Admin only)
const updateStockThresholds = async (thresholdData) => {
  const response = await axios.put(
    `${API_URL}/settings/stock-thresholds`,
    thresholdData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// ✅ NEW: Add or update design-specific threshold (Admin only)
const addDesignThreshold = async (design, threshold) => {
  const response = await axios.post(
    `${API_URL}/settings/stock-thresholds/design`,
    { design, threshold },
    { headers: getAuthHeader() }
  );
  return response.data;
};

// ✅ NEW: Remove design threshold override (Admin only)
const removeDesignThreshold = async (design) => {
  const response = await axios.delete(
    `${API_URL}/settings/stock-thresholds/design/${design}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

// ✅ NEW: Color Palette APIs
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

// ✅✅ NEW: Company Management APIs
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

export const settingsService = {
  getSettings,
  getEnabledSizes,
  updateSettings,
  addMarketplaceAccount,
  updateMarketplaceAccount,
  deleteMarketplaceAccount,
  setDefaultMarketplaceAccount,
  getStockThresholds,
  updateStockThresholds,
  addDesignThreshold,
  removeDesignThreshold,
  getColorPalette,
  addColorToPalette,
  updateColorInPalette,
  deleteColorFromPalette,
  reorderColors,
  // ✅✅ Company Management
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyActive,
  setDefaultCompany
};
