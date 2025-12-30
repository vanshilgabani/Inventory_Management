import api from './api';

export const directSalesService = {
  async getAllDirectSales() {
    const response = await api.get('/direct-sales');
    return response.data;
  },

  async createDirectSale(saleData) {
    const response = await api.post('/direct-sales', saleData);
    return response.data;
  },

  async getDirectSaleById(id) {
    const response = await api.get(`/direct-sales/${id}`);
    return response.data;
  },

  async deleteDirectSale(id) {
    const response = await api.delete(`/direct-sales/${id}`);
    return response.data;
  },

  async getAllCustomers() {
    const response = await api.get('/direct-sales/customers');
    return response.data;
  },

  async getCustomerByMobile(mobile) {
    const response = await api.get(`/direct-sales/customers/${mobile}`);
    return response.data;
  },
};
