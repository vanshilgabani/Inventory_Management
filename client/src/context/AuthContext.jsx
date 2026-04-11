import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // ── Auto logout at 3 AM ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const { exp } = JSON.parse(atob(token.split('.')[1]));
        if (exp * 1000 < Date.now()) {
          clearInterval(interval);
          logout();
        }
      } catch {
        logout();
      }
    }, 30 * 1000); // check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);
  // ────────────────────────────────────────────────────

  const checkAuth = async () => {
    const token    = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && token !== 'undefined' && token !== 'null' && userData) {
      try {
        // ── Also check token expiry on page load/refresh ──
        const { exp } = JSON.parse(atob(token.split('.')[1]));
        if (exp * 1000 < Date.now()) {
          logout();
          return;
        }

        if (userData === 'undefined' || userData === 'null') {
          logout();
          return;
        }
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      console.log('🔗 API Login call...');
      const response = await api.post('/auth/login', { email, password });
      console.log('🔗 API Response:', response.data);

      const {
        token, _id, id, name, email: userEmail, role, organizationId,
        businessName, phone, isSupplier, isTenant, linkedSupplier, syncPreference
      } = response.data;

      if (!token) {
        console.error('No token received from server:', response.data);
        return { success: false, message: 'Authentication failed. No token received.' };
      }

      const userData = {
        _id: _id || id,
        id: id || _id,
        name,
        email: userEmail,
        role,
        organizationId,
        businessName,
        phone,
        isSupplier,
        isTenant,
        linkedSupplier,
        syncPreference,
      };

      console.log('👤 Setting user:', userData);

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      console.log('✅ Login complete, user set');
      return { success: true };
    } catch (error) {
      console.error('💥 Login API error:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token, _id, name, email, role } = response.data;
      const newUser = { _id, name, email, role };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = () => user?.role === 'admin';
  const isSales = () => user?.role === 'sales';

  const value = { user, loading, login, register, logout, isAdmin, isSales };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;