import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDollarSign,
  FiMail, FiPhone, FiPackage, FiSearch, FiShoppingCart,
  FiShoppingBag, FiBarChart2, FiSettings, FiSave, FiX,
  FiFileText, FiCreditCard, FiActivity, FiClock, FiZap,
  FiEye, FiEdit3, FiShield, FiAlertCircle, FiCheck,
  FiLock, FiUnlock, FiMoreVertical, FiCalendar, FiTrendingUp,
  FiTrendingDown, FiFilter, FiChevronRight, FiGrid, FiList
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL;

// Date formatting utility - dd/mmm/yyyy format
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const CustomerManagement = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [tempPermissions, setTempPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [updatingSyncFor, setUpdatingSyncFor] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('customers');
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState('pending');

  const availableSidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiActivity, locked: true, section: 'Main Menu', color: 'text-sky-600', bgColor: 'bg-sky-50', gradient: 'from-sky-400 to-blue-500' },
    { id: 'inventory', label: 'Inventory', icon: FiPackage, section: 'Main Menu', color: 'text-violet-600', bgColor: 'bg-violet-50', gradient: 'from-violet-400 to-purple-500' },
    { id: 'wholesale', label: 'Wholesale Orders', icon: FiShoppingCart, section: 'Main Menu', color: 'text-amber-600', bgColor: 'bg-amber-50', gradient: 'from-amber-400 to-orange-500' },
    { id: 'direct-sales', label: 'Direct Sales', icon: FiShoppingBag, section: 'Main Menu', color: 'text-rose-600', bgColor: 'bg-rose-50', gradient: 'from-rose-400 to-pink-500' },
    { id: 'marketplace-sales', label: 'Marketplace Sales', icon: FiBarChart2, section: 'Main Menu', color: 'text-indigo-600', bgColor: 'bg-indigo-50', gradient: 'from-indigo-400 to-purple-500' },
    { id: 'customers', label: 'Customers', icon: FiUsers, section: 'Main Menu', color: 'text-blue-600', bgColor: 'bg-blue-50', gradient: 'from-blue-400 to-indigo-500' },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart2, section: 'Main Menu', color: 'text-red-600', bgColor: 'bg-red-50', gradient: 'from-red-400 to-pink-500' },
    { id: 'settings', label: 'Settings', icon: FiSettings, locked: false, section: 'Settings', color: 'text-slate-600', bgColor: 'bg-slate-50', gradient: 'from-slate-400 to-gray-500' }
  ];

  const groupedItems = availableSidebarItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  useEffect(() => {
    if (isAdmin) fetchCustomers();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === 'payment-requests') {
      fetchPaymentRequests(requestsFilter);
    }
  }, [isAdmin, activeTab, requestsFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/admin/customers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data.customers || []);
        setStats(data.data.stats || {});
      } else {
        toast.error(data.message || 'Failed to load customers');
      }
    } catch (error) {
      toast.error('Failed to load customers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentRequests = async (status = 'pending') => {
    try {
      setLoadingRequests(true);
      const response = await fetch(`${API_URL}/payment/admin/payment-requests?status=${status}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setPaymentRequests(data.data.requests || []);
      } else {
        toast.error(data.message || 'Failed to load payment requests');
      }
    } catch (error) {
      toast.error('Failed to load payment requests');
      console.error(error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApprovePayment = async (requestId) => {
    if (!confirm('Are you sure you want to approve this payment and activate the subscription?')) return;
    try {
      const response = await fetch(`${API_URL}/payment/admin/payment-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Payment approved! Subscription activated.');
        fetchPaymentRequests(requestsFilter);
        fetchCustomers();
      } else {
        toast.error(data.message || 'Failed to approve payment');
      }
    } catch (error) {
      toast.error('Failed to approve payment');
      console.error(error);
    }
  };

  const handleRejectPayment = async (requestId) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;
    try {
      const response = await fetch(`${API_URL}/payment/admin/payment-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: reason || 'Payment not verified' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Payment request rejected');
        fetchPaymentRequests(requestsFilter);
      } else {
        toast.error(data.message || 'Failed to reject payment');
      }
    } catch (error) {
      toast.error('Failed to reject payment');
      console.error(error);
    }
  };

  const openPermissionsModal = (customer) => {
    setSelectedCustomer(customer);
    setTempPermissions(customer.allowedSidebarItems || ['dashboard', 'inventory', 'marketplace-sales']);
    setShowPermissionsModal(true);
  };

  const openDetailsModal = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsModal(true);
  };

  const closePermissionsModal = () => {
    setShowPermissionsModal(false);
    setSelectedCustomer(null);
    setTempPermissions([]);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedCustomer(null);
  };

  const togglePermission = (itemId) => {
    const item = availableSidebarItems.find(i => i.id === itemId);
    if (item?.locked) return;
    setTempPermissions(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/admin/customers/${selectedCustomer._id}/sidebar-permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ allowedSidebarItems: tempPermissions })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Permissions updated successfully!');
        setCustomers(prev => prev.map(c => (c._id === selectedCustomer._id ? { ...c, allowedSidebarItems: tempPermissions } : c)));
        closePermissionsModal();
      } else {
        toast.error(data.message || 'Failed to update permissions');
      }
    } catch (error) {
      toast.error('Failed to save permissions');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPreferenceChange = async (customerId, newPreference) => {
    try {
      setUpdatingSyncFor(customerId);
      const response = await fetch(`${API_URL}/admin/customers/${customerId}/sync-preference`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ syncPreference: newPreference })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Sync mode updated to ${newPreference === 'direct' ? 'Direct' : 'Manual'}!`);
        setCustomers(prev => prev.map(c => (c._id === customerId ? { ...c, syncPreference: newPreference } : c)));
      } else {
        toast.error(data.message || 'Failed to update sync preference');
      }
    } catch (error) {
      console.error('Failed to update sync preference:', error);
      toast.error('Failed to update sync preference');
    } finally {
      setUpdatingSyncFor(null);
    }
  };

  const getFilteredCustomers = () => {
    let filtered = [...customers];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.companyName?.toLowerCase().includes(query) ||
        customer.businessName?.toLowerCase().includes(query) ||
        customer.phone?.includes(query)
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(customer => {
        if (filterStatus === 'active') return customer.subscription?.status === 'active';
        if (filterStatus === 'trial') return customer.subscription?.status === 'trial';
        if (filterStatus === 'expired') return customer.subscription?.status === 'expired' || !customer.subscription;
        return true;
      });
    }
    return filtered;
  };

  const filteredCustomers = getFilteredCustomers();
  const pendingCount = paymentRequests.filter(r => r.status === 'pending').length;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <div className="text-center px-8 py-12 bg-white rounded-2xl shadow-2xl border border-red-100 max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <FiShield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Access Denied</h2>
          <p className="text-gray-600 mb-2">Administrator privileges required</p>
          <p className="text-sm text-gray-500">Manage subscriptions, permissions & payments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 backdrop-blur-sm bg-white/90 animate-slide-down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Customer Management
              </h1>
              <p className="text-gray-600 text-lg">Monitor subscriptions, orders, and permissions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                {viewMode === 'grid' ? <FiList className="w-5 h-5" /> : <FiGrid className="w-5 h-5" />}
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
              </button>
              <button
                onClick={fetchCustomers}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <StatCard
                icon={FiUsers}
                label="Total Customers"
                value={stats.totalCustomers || 0}
                gradient="from-blue-500 to-indigo-500"
                bgColor="bg-blue-50"
              />
              <StatCard
                icon={FiCheckCircle}
                label="Active"
                value={stats.activeSubscriptions || 0}
                gradient="from-green-500 to-emerald-500"
                bgColor="bg-green-50"
              />
              <StatCard
                icon={FiClock}
                label="Trial Users"
                value={stats.trialUsers || 0}
                gradient="from-amber-500 to-orange-500"
                bgColor="bg-amber-50"
              />
              <StatCard
                icon={FiPackage}
                label="Total Orders"
                value={stats.totalOrdersThisMonth || 0}
                gradient="from-purple-500 to-pink-500"
                bgColor="bg-purple-50"
              />
              <StatCard
                icon={FiDollarSign}
                label="Est. Revenue"
                value={`₹${(stats.estimatedRevenue || 0).toFixed(2)}`}
                gradient="from-rose-500 to-red-500"
                bgColor="bg-rose-50"
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-3 animate-fade-in">
          <TabButton
            active={activeTab === 'customers'}
            onClick={() => setActiveTab('customers')}
            icon={FiUsers}
            label="Customers"
            count={customers.length}
          />
          <TabButton
            active={activeTab === 'payment-requests'}
            onClick={() => setActiveTab('payment-requests')}
            icon={FiCreditCard}
            label="Payment Requests"
            count={pendingCount}
            badge={pendingCount > 0}
          />
        </div>

        {/* Content */}
        {activeTab === 'customers' ? (
          <>
            {/* Search & Filters */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, company, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FiFilter className="text-gray-500 w-5 h-5" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg">Loading customers...</p>
                </div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center animate-fade-in">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No customers found</h3>
                <p className="text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {filteredCustomers.map((customer, index) => (
                  <CustomerCard
                    key={customer._id}
                    customer={customer}
                    viewMode={viewMode}
                    onViewDetails={() => openDetailsModal(customer)}
                    onEditPermissions={() => openPermissionsModal(customer)}
                    onSyncChange={handleSyncPreferenceChange}
                    updatingSyncFor={updatingSyncFor}
                    index={index}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <PaymentRequestsTab
            requests={paymentRequests}
            loading={loadingRequests}
            filter={requestsFilter}
            onFilterChange={setRequestsFilter}
            onApprove={handleApprovePayment}
            onReject={handleRejectPayment}
          />
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && (
          <PermissionsModal
            customer={selectedCustomer}
            tempPermissions={tempPermissions}
            groupedItems={groupedItems}
            onToggle={togglePermission}
            onSave={savePermissions}
            onClose={closePermissionsModal}
            saving={saving}
          />
        )}

        {/* Details Modal */}
        {showDetailsModal && (
          <DetailsModal
            customer={selectedCustomer}
            onClose={closeDetailsModal}
          />
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, gradient, bgColor }) => (
  <div className={`${bgColor} rounded-xl p-6 border border-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 animate-fade-in`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
  </div>
);

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, label, count, badge }) => (
  <button
    onClick={onClick}
    className={`relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
      active
        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105'
        : 'bg-white text-gray-700 hover:bg-gray-50 border border-slate-200'
    }`}
  >
    <Icon className="w-5 h-5" />
    {label}
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
      {count}
    </span>
    {badge && (
      <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
    )}
  </button>
);

// Customer Card Component
const CustomerCard = ({ customer, viewMode, onViewDetails, onEditPermissions, onSyncChange, updatingSyncFor, index }) => {
  const statusColors = {
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  const totalOrders = customer.billing?.currentMonth?.total || 0;
  const marketplaceOrders = customer.billing?.currentMonth?.marketplace || 0;
  const directOrders = customer.billing?.currentMonth?.direct || 0;
  const wholesaleOrders = customer.billing?.currentMonth?.wholesale || 0;

  if (viewMode === 'list') {
    return (
      <div 
        className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300 animate-slide-up"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {customer.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{customer.name || 'Unknown'}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span className="flex items-center gap-1">
                  <FiMail className="w-4 h-4" />
                  {customer.email}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <FiPhone className="w-4 h-4" />
                    {customer.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Marketplace</p>
              <p className="text-2xl font-bold text-indigo-600">{marketplaceOrders}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Direct</p>
              <p className="text-2xl font-bold text-rose-600">{directOrders}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Wholesale</p>
              <p className="text-2xl font-bold text-amber-600">{wholesaleOrders}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
            </div>

            <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusColors[customer.subscription?.statusColor || 'gray']}`}>
              {customer.subscription?.statusLabel || 'No Plan'}
            </span>

            <button
              onClick={onViewDetails}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <FiEye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={onEditPermissions}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              <FiSettings className="w-4 h-4" />
              Permissions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {customer.name?.charAt(0).toUpperCase() || 'C'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{customer.name || 'Unknown'}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[customer.subscription?.statusColor || 'gray']} inline-block mt-1`}>
              {customer.subscription?.statusLabel || 'No Plan'}
            </span>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <FiMoreVertical className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiMail className="w-4 h-4 text-indigo-500" />
          <span>{customer.email}</span>
        </div>
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiPhone className="w-4 h-4 text-green-500" />
            <span>{customer.phone}</span>
          </div>
        )}
        {(customer.companyName || customer.businessName) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiActivity className="w-4 h-4 text-purple-500" />
            <span>{customer.companyName || customer.businessName}</span>
          </div>
        )}
      </div>

      {/* Orders Breakdown */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FiPackage className="w-4 h-4" />
          Orders This Month
        </h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-indigo-600">Marketplace</span>
              <FiBarChart2 className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-indigo-700">{marketplaceOrders}</p>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-3 border border-rose-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-rose-600">Direct</span>
              <FiShoppingBag className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-700">{directOrders}</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-amber-600">Wholesale</span>
            <FiShoppingCart className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{wholesaleOrders}</p>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 mb-4 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Total Orders</span>
          <span className="text-2xl font-bold text-gray-900">{totalOrders}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Estimated Bill</span>
          <span className="text-xl font-bold text-green-600">₹{(customer.billing?.currentMonth?.estimatedAmount || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Sync Toggle */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <label className="text-sm font-medium text-gray-700 mb-2 block">Sync Mode</label>
        <button
          onClick={() => onSyncChange(customer._id, customer.syncPreference === 'direct' ? 'manual' : 'direct')}
          disabled={updatingSyncFor === customer._id}
          className={`w-full py-2 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
            customer.syncPreference === 'direct'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
          } ${updatingSyncFor === customer._id ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl transform hover:scale-105'}`}
        >
          {updatingSyncFor === customer._id ? (
            <FiRefreshCw className="w-4 h-4 animate-spin" />
          ) : customer.syncPreference === 'direct' ? (
            <>
              <FiZap className="w-4 h-4" />
              Direct Sync
            </>
          ) : (
            <>
              <FiClock className="w-4 h-4" />
              Manual Sync
            </>
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onViewDetails}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
        >
          <FiEye className="w-4 h-4" />
          Details
        </button>
        <button
          onClick={onEditPermissions}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
        >
          <FiSettings className="w-4 h-4" />
          Permissions
        </button>
      </div>
    </div>
  );
};

// Payment Requests Tab Component
const PaymentRequestsTab = ({ requests, loading, filter, onFilterChange, onApprove, onReject }) => {
  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 flex gap-3">
        {['pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${
              filter === status
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${filter === status ? 'bg-white/20' : 'bg-gray-200'}`}>
              {requests.filter(r => r.status === status).length}
            </span>
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading requests...</p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCreditCard className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No payment requests to review</h3>
          <p className="text-gray-500">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request, index) => (
            <div
              key={request._id}
              className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {request.userDetails?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{request.userDetails?.name || 'Unknown'}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <FiMail className="w-4 h-4" />
                        {request.userDetails?.email}
                      </span>
                      {request.userDetails?.phone && (
                        <span className="flex items-center gap-1">
                          <FiPhone className="w-4 h-4" />
                          {request.userDetails?.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Plan</p>
                    <p className="text-lg font-bold text-indigo-600 capitalize">{request.planType}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Amount</p>
                    <p className="text-lg font-bold text-green-600">₹{request.amount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Method</p>
                    <p className="text-lg font-bold text-purple-600 uppercase">{request.paymentMethod}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Date</p>
                    <p className="text-sm font-medium text-gray-800">{formatDate(request.createdAt)}</p>
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprove(request._id)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                      >
                        <FiCheck className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(request._id)}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                      >
                        <FiX className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-semibold border border-green-200">
                      Approved
                    </span>
                  )}

                  {request.status === 'rejected' && (
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold border border-red-200">
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Permissions Modal Component
const PermissionsModal = ({ customer, tempPermissions, groupedItems, onToggle, onSave, onClose, saving }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden animate-scale-in">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Edit Permissions</h2>
            <p className="text-indigo-100">{customer.name} - {customer.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section} className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <FiShield className="w-5 h-5 text-indigo-600" />
              {section}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const Icon = item.icon;
                const isEnabled = tempPermissions.includes(item.id);
                const isLocked = item.locked;

                return (
                  <button
                    key={item.id}
                    onClick={() => !isLocked && onToggle(item.id)}
                    disabled={isLocked}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      isLocked
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                        : isEnabled
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300 shadow-md transform scale-105'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.bgColor}`}>
                          <Icon className={`w-5 h-5 ${item.color}`} />
                        </div>
                        <span className="font-medium text-gray-800">{item.label}</span>
                      </div>
                      {isLocked ? (
                        <FiLock className="w-5 h-5 text-gray-400" />
                      ) : isEnabled ? (
                        <FiCheckCircle className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 font-medium disabled:opacity-50"
        >
          {saving ? (
            <>
              <FiRefreshCw className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <FiSave className="w-5 h-5" />
              Save Permissions
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

// Details Modal Component
const DetailsModal = ({ customer, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden animate-scale-in">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {customer.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">{customer.name}</h2>
              <p className="text-indigo-100">{customer.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FiUsers className="w-5 h-5 text-indigo-600" />
            Contact Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoCard icon={FiMail} label="Email" value={customer.email} />
            <InfoCard icon={FiPhone} label="Phone" value={customer.phone || 'N/A'} />
            <InfoCard icon={FiActivity} label="Business" value={customer.businessName || customer.companyName || 'N/A'} />
            <InfoCard icon={FiCalendar} label="Joined" value={formatDate(customer.createdAt)} />
          </div>
        </div>

        {/* Subscription Details */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FiCreditCard className="w-5 h-5 text-purple-600" />
            Subscription Details
          </h3>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                  customer.subscription?.statusColor === 'green' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  customer.subscription?.statusColor === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  customer.subscription?.statusColor === 'purple' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                  'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {customer.subscription?.statusLabel || 'No Plan'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Plan Type</p>
                <p className="text-lg font-bold text-gray-900 capitalize">{customer.subscription?.planType || 'None'}</p>
              </div>
              {customer.subscription?.daysRemaining && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Days Remaining</p>
                  <p className="text-lg font-bold text-orange-600">{customer.subscription.daysRemaining}</p>
                </div>
              )}
            </div>
            {customer.billing?.nextBillDate && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Next Bill Date</p>
                <p className="text-base font-semibold text-gray-800">{formatDate(customer.billing.nextBillDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Orders Statistics */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FiPackage className="w-5 h-5 text-indigo-600" />
            Order Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-indigo-700">Marketplace Orders</span>
                <FiBarChart2 className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-3xl font-bold text-indigo-700">{customer.billing?.currentMonth?.marketplace || 0}</p>
              <p className="text-xs text-indigo-600 mt-1">This month</p>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-rose-700">Direct Sales</span>
                <FiShoppingBag className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-3xl font-bold text-rose-700">{customer.billing?.currentMonth?.direct || 0}</p>
              <p className="text-xs text-rose-600 mt-1">This month</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-700">Wholesale Orders</span>
                <FiShoppingCart className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-3xl font-bold text-amber-700">{customer.billing?.currentMonth?.wholesale || 0}</p>
              <p className="text-xs text-amber-600 mt-1">This month</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-slate-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Total Orders</span>
                <FiActivity className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{customer.billing?.currentMonth?.total || 0}</p>
              <p className="text-xs text-gray-600 mt-1">This month</p>
            </div>
          </div>
        </div>

        {/* Billing Details */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 text-green-600" />
            Billing Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm font-medium text-green-700 mb-2">Current Month Estimated</p>
              <p className="text-3xl font-bold text-green-700">₹{(customer.billing?.currentMonth?.estimatedAmount || 0).toFixed(2)}</p>
              {customer.billing?.currentMonth?.breakdown && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Chargeable: {customer.billing.currentMonth.breakdown.chargeable}</span>
                    <span>Free: {customer.billing.currentMonth.breakdown.unchargeable}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-700 mb-2">Last Month Total</p>
              <p className="text-3xl font-bold text-blue-700">₹{(customer.billing?.lastMonth?.amount || 0).toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-2">{customer.billing?.lastMonth?.total || 0} orders</p>
            </div>
          </div>
        </div>

        {/* Sync Preference */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FiRefreshCw className="w-5 h-5 text-purple-600" />
            Sync Preference
          </h3>
          <div className={`rounded-xl p-4 border-2 ${
            customer.syncPreference === 'direct'
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
              : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300'
          }`}>
            <div className="flex items-center gap-3">
              {customer.syncPreference === 'direct' ? (
                <>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <FiZap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-700">Direct Sync Enabled</p>
                    <p className="text-sm text-green-600">Orders sync automatically</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                    <FiClock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-orange-700">Manual Sync</p>
                    <p className="text-sm text-orange-600">Customer controls sync timing</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-6 flex justify-end border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

// Info Card Component
const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-indigo-600" />
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
    <p className="text-base font-semibold text-gray-900">{value}</p>
  </div>
);

export default CustomerManagement;
