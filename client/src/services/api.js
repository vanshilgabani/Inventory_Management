import axios from 'axios';

// Use environment variable with fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log('API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Default 15 second timeout
});

// Request interceptor - Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ INCREASE TIMEOUT FOR CSV IMPORT
    if (config.url && config.url.includes('/sales/import-csv')) {
      config.timeout = 120000; // 2 minutes for CSV import
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.error('401 Unauthorized - Token invalid or expired');
      
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login only if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network Error:', error.message);
      return Promise.reject({ message: 'Network error. Please check your connection.', code: 'NETWORK_ERROR' });
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Request Timeout');
      return Promise.reject({ message: 'Request timeout. The operation is taking longer than expected.', code: 'TIMEOUT' });
    }

    return Promise.reject(error);
  }
);

export default api;
