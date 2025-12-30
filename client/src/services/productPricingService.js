import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

// Get all pricings
const getAllPricings = async () => {
  const response = await axios.get(`${API_URL}/product-pricing`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Get pricing by ID
const getPricingById = async (id) => {
  const response = await axios.get(`${API_URL}/product-pricing/${id}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Get pricing for specific product + account
const getPricingByProductAndAccount = async (design, account) => {
  const response = await axios.get(`${API_URL}/product-pricing/find`, {
    params: { design, account },
    headers: getAuthHeader()
  });
  return response.data;
};

// Get accounts configured for a product
const getAccountsForProduct = async (design) => {
  const response = await axios.get(`${API_URL}/product-pricing/accounts/${design}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Create pricing
const createPricing = async (pricingData) => {
  const response = await axios.post(`${API_URL}/product-pricing`, pricingData, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Update pricing
const updatePricing = async (id, pricingData) => {
  const response = await axios.put(`${API_URL}/product-pricing/${id}`, pricingData, {
    headers: getAuthHeader()
  });
  return response.data;
};

// Delete pricing
const deletePricing = async (id) => {
  const response = await axios.delete(`${API_URL}/product-pricing/${id}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const productPricingService = {
  getAllPricings,
  getPricingById,
  getPricingByProductAndAccount,
  getAccountsForProduct,
  createPricing,
  updatePricing,
  deletePricing
};
