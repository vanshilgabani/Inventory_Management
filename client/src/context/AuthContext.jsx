import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set axios defaults
  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (token && userData) {
    try {
      // ✅ Check if userData is valid JSON before parsing
      if (userData === 'undefined' || userData === 'null') {
        console.log('Invalid user data in localStorage, clearing...');
        logout();
        return;
      }
      
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

    } catch (error) {
      console.error('Auth check failed:', error);
      // ✅ Clear invalid data
      logout();
    }
  } else {
    // No token or user data, ensure clean state
    logout();
  }
  setLoading(false);
};

const login = async (email, password) => {
  try {
    console.log('🔗 API Login call...');
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    console.log('🔗 API Response:', response.data);

    const { 
      token, _id, id, name, email: userEmail, role, organizationId, 
      businessName, phone, isSupplier, isTenant, linkedSupplier, syncPreference
    } = response.data;

    const userData = {
      _id: _id || id,
      id: id || _id,
      name,
      email: userEmail,
      role,
      organizationId,
      businessName,
      phone,
      isSupplier,      // ✅ ADD THIS
      isTenant,        // ✅ ADD THIS
      linkedSupplier,  // ✅ ADD THIS
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
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      
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
    window.location.href = '/login';
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Check if user is sales
  const isSales = () => {
    return user?.role === 'sales';
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAdmin,
    isSales,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
