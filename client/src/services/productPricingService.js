import api from './api';

// Get all pricings
const getAllPricings = async () => {
  const response = await api.get('/product-pricing');
  return response.data;
};

// Get pricing by ID
const getPricingById = async (id) => {
  const response = await api.get(`/product-pricing/${id}`);
  return response.data;
};

// Get pricing for specific product + account
const getPricingByProductAndAccount = async (design, account) => {
  const response = await api.get('/product-pricing/find', { params: { design, account } });
  return response.data;
};

// Get accounts configured for a product
const getAccountsForProduct = async (design) => {
  const response = await api.get(`/product-pricing/accounts/${design}`);
  return response.data;
};

// Create pricing
const createPricing = async (pricingData) => {
  const response = await api.post('/product-pricing', pricingData);
  return response.data;
};

// Update pricing
const updatePricing = async (id, pricingData) => {
  const response = await api.put(`/product-pricing/${id}`, pricingData);
  return response.data;
};

// Delete pricing
const deletePricing = async (id) => {
  const response = await api.delete(`/product-pricing/${id}`);
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
