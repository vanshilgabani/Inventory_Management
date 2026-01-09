import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import TransferHistory from './pages/TransferHistory';
import ReservedInventory from './pages/ReservedInventory';
import Wholesale from './pages/Wholesale';
import DirectSales from './pages/DirectSales';
import FactoryReceiving from './pages/FactoryReceiving';
import Sales from './pages/Sales';
import WholesaleBuyers from './pages/WholesaleBuyers';
import Customers from './pages/Customers';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import MonthlyBills from './pages/MonthlyBills';
import Notifications from './pages/Notifications';
import ActivityAuditPage from './pages/ActivityAuditPage';
import GlobalNotificationBanner from './components/GlobalNotificationBanner';
import AdminRequestNotificationWidget from './components/widgets/AdminRequestNotificationWidget';
import ActiveSessionsMonitorWidget from './components/widgets/ActiveSessionsMonitorWidget';
import MyPendingRequests from './pages/MyPendingRequests';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  console.log('🔒 PROTECTED ROUTE DEBUG:', { user: !!user, loading });
  
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

// ✅ NEW: Separate component for routes that uses useAuth INSIDE AuthProvider
const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <>
      <Toaster position="top-right" />
      <GlobalNotificationBanner />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
          <Route path="reserved-inventory" element={<ReservedInventory />} />
          <Route path="transfer-history" element={<TransferHistory />} />
          <Route path="factory-receiving" element={<FactoryReceiving />} />
          <Route path="wholesale" element={<Wholesale />} />
          <Route path="direct-sales" element={<DirectSales />} />
          <Route path="marketplace-sales" element={<Sales />} />
          <Route path="wholesale-buyers" element={<WholesaleBuyers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="/activity-audit" element={<ActivityAuditPage />} />
          <Route path="my-requests" element={<MyPendingRequests />} />
          
          {/* Admin Routes */}
          <Route path="monthly-bills" element={
            <AdminRoute>
              <MonthlyBills />
            </AdminRoute>
          } />
          <Route path="users" element={
            <AdminRoute>
              <UserManagement />
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

      {/* ✅ Admin Widgets - Now inside AuthProvider */}
      {user?.role === 'admin' && (
        <>
          <AdminRequestNotificationWidget />
          <ActiveSessionsMonitorWidget />
        </>
      )}
    </>
  );
};

// ✅ Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
