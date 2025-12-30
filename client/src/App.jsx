import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Wholesale from './pages/Wholesale';
import DirectSales from './pages/DirectSales';
import FactoryReceiving from './pages/FactoryReceiving';
import Sales from './pages/Sales';
import WholesaleBuyers from './pages/WholesaleBuyers';
import Customers from './pages/Customers';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import ChallanSettings from './pages/ChallanSettings';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  console.log('🔒 PROTECTED ROUTE DEBUG:', { user: !!user, loading }); // Keep this for now
  
  // ✅ FIX: Shorter timeout, direct user check
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 min-h-screen">
        <div className="text-lg text-gray-600 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    console.log('🚫 Redirecting to login - no user');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ Rendering protected content');
  return children;
};

// Admin Only Route Component
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-100">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} /> {/* Fixed case */}

          {/* Protected Routes - WRAPPED with Layout */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="factory-receiving" element={<FactoryReceiving />} />
            <Route path="wholesale" element={<Wholesale />} />
            <Route path="direct-sales" element={<DirectSales />} />
            <Route path="marketplace-sales" element={<Sales />} />
            <Route path="wholesale-buyers" element={<WholesaleBuyers />} />
            <Route path="customers" element={<Customers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="notifications" element={<Notifications />} />
            
            {/* Admin Routes */}
            <Route path="users" element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            } />
            <Route path="challan-settings" element={
              <AdminRoute>
                <ChallanSettings />
              </AdminRoute>
            } />
            <Route path="settings" element={
              <AdminRoute>
                <Settings />
              </AdminRoute>
            } />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
