const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const deletedOrdersService = {
  // Get all deleted orders
  getAllDeletedOrders: async (filters = {}) => {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/deleted-orders?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  },

  // Get deleted orders by type
  getDeletedOrdersByType: async (type) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/deleted-orders/${type}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  },

  // Restore deleted order
  restoreOrder: async (type, id) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/deleted-orders/restore/${type}/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  },

  // Permanently delete order
  permanentlyDeleteOrder: async (type, id) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/deleted-orders/permanent/${type}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  }
};

export default deletedOrdersService;
