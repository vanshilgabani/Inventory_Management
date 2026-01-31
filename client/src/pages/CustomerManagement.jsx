import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDollarSign, 
  FiToggleRight, FiToggleLeft, FiMail, FiPhone, FiPackage, 
  FiTrendingUp, FiSearch, FiFilter, FiShoppingCart, FiShoppingBag, 
  FiBarChart2, FiSettings, FiSave, FiX, FiFileText, FiCreditCard, 
  FiActivity, FiClock, FiZap 
} from 'react-icons/fi';
import Card from '../components/common/Card';
const API_URL = import.meta.env.VITE_API_URL

const CustomerManagement = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [tempPermissions, setTempPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [updatingSyncFor, setUpdatingSyncFor] = useState(null);

  // NEW: Payment requests state
  const [activeTab, setActiveTab] = useState('customers');
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState('pending');

  // Enhanced sidebar items with sections
  const availableSidebarItems = [
    // Main Menu Section
    { id: 'dashboard', label: 'Dashboard', icon: FiActivity, locked: true, section: 'Main Menu', color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { id: 'inventory', label: 'Inventory', icon: FiPackage, section: 'Main Menu', color: 'text-purple-500', bgColor: 'bg-purple-50' },
    { id: 'factory-receiving', label: 'Factory Receiving', icon: FiTrendingUp, section: 'Main Menu', color: 'text-green-500', bgColor: 'bg-green-50' },
    { id: 'received-from-supplier', label: 'Received from Supplier', icon: FiRefreshCw, section: 'Main Menu', color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
    { id: 'wholesale', label: 'Wholesale Orders', icon: FiShoppingCart, section: 'Main Menu', color: 'text-orange-500', bgColor: 'bg-orange-50' },
    { id: 'direct-sales', label: 'Direct Sales', icon: FiShoppingBag, section: 'Main Menu', color: 'text-pink-500', bgColor: 'bg-pink-50' },
    { id: 'marketplace-sales', label: 'Marketplace Sales', icon: FiBarChart2, section: 'Main Menu', color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    { id: 'wholesale-buyers', label: 'Wholesale Buyers', icon: FiUsers, section: 'Main Menu', color: 'text-teal-500', bgColor: 'bg-teal-50' },
    { id: 'customers', label: 'Customers', icon: FiUsers, section: 'Main Menu', color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart2, section: 'Main Menu', color: 'text-red-500', bgColor: 'bg-red-50' },
    
    // Subscription Section
    { id: 'subscription', label: 'Subscription', icon: FiCreditCard, section: 'Subscription', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { id: 'invoices', label: 'Invoices', icon: FiDollarSign, section: 'Subscription', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { id: 'sync-logs', label: 'Sync Logs', icon: FiRefreshCw, section: 'Subscription', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'supplier-sync-logs', label: 'Supplier Sync Logs', icon: FiRefreshCw, section: 'Subscription', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    
    // Admin Section
    { id: 'monthly-bills', label: 'Monthly Bills', icon: FiFileText, section: 'Admin', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { id: 'deleted-orders', label: 'Deleted Orders', icon: FiXCircle, section: 'Admin', color: 'text-red-600', bgColor: 'bg-red-50' },
    { id: 'customers-management', label: 'Customer Management', icon: FiUsers, section: 'Admin', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { id: 'users', label: 'User Management', icon: FiUsers, section: 'Admin', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'settings', label: 'Settings', icon: FiSettings, locked: false, section: 'Admin', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  ];

  // Group items by section
  const groupedItems = availableSidebarItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

  useEffect(() => {
    if (isAdmin) {
      fetchCustomers();
    }
  }, [isAdmin]);

  // NEW: Fetch payment requests when tab changes
  useEffect(() => {
    if (isAdmin && activeTab === 'payment-requests') {
      fetchPaymentRequests(requestsFilter);
    }
  }, [isAdmin, activeTab, requestsFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/admin/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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

  // NEW: Fetch payment requests
  const fetchPaymentRequests = async (status = 'pending') => {
    try {
      setLoadingRequests(true);
      const response = await fetch(`${API_URL}/payment/admin/payment-requests?status=${status}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
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

  // NEW: Approve payment
  const handleApprovePayment = async (requestId) => {
    if (!confirm('Are you sure you want to approve this payment and activate the subscription?')) return;

    try {
      const response = await fetch(`${API_URL}/payment/admin/payment-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();

      if (data.success) {
        toast.success('✅ Payment approved! Subscription activated.');
        fetchPaymentRequests(requestsFilter);
        fetchCustomers(); // Refresh customer list
      } else {
        toast.error(data.message || 'Failed to approve payment');
      }
    } catch (error) {
      toast.error('Failed to approve payment');
      console.error(error);
    }
  };

  // NEW: Reject payment
  const handleRejectPayment = async (requestId) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

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

  const closePermissionsModal = () => {
    setShowPermissionsModal(false);
    setSelectedCustomer(null);
    setTempPermissions([]);
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
        setCustomers(prev =>
          prev.map(c =>
            c._id === selectedCustomer._id ? { ...c, allowedSidebarItems: tempPermissions } : c
          )
        );
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
        setCustomers(prev =>
          prev.map(c => (c._id === customerId ? { ...c, syncPreference: newPreference } : c))
        );
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
        if (filterStatus === 'active') {
          return customer.subscription?.status === 'active';
        } else if (filterStatus === 'trial') {
          return customer.subscription?.status === 'trial';
        } else if (filterStatus === 'expired') {
          return customer.subscription?.status === 'expired' || !customer.subscription;
        }
        return true;
      });
    }

    return filtered;
  };

  const filteredCustomers = getFilteredCustomers();

  // Count pending payment requests
  const pendingCount = paymentRequests.filter(r => r.status === 'pending').length;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <div className="p-8 text-center">
            <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only admins can access this page</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600">Manage all your customers and their feature access</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Customers</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiUsers className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active</p>
                  <p className="text-3xl font-bold text-green-600">{stats.active || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Trial</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.trial || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiClock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Expired</p>
                  <p className="text-3xl font-bold text-red-600">{stats.expired || 0}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <FiXCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* NEW: Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiUsers className="inline-block mr-2 mb-1" />
              Customers
            </button>
            <button
              onClick={() => setActiveTab('payment-requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors relative ${
                activeTab === 'payment-requests'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiDollarSign className="inline-block mr-2 mb-1" />
              Payment Requests
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-3 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <>
          {/* Search and Filter */}
          <Card className="mb-6">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email, company, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Customer List */}
          {loading ? (
            <Card>
              <div className="p-12 text-center">
                <FiRefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading customers...</p>
              </div>
            </Card>
          ) : filteredCustomers.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <FiUsers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-600">Try adjusting your search or filters</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => (
                <Card key={customer._id}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                          {customer.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{customer.name}</h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="flex items-center text-sm text-gray-600">
                              <FiMail className="mr-1" size={14} />
                              {customer.email}
                            </span>
                            {customer.phone && (
                              <span className="flex items-center text-sm text-gray-600">
                                <FiPhone className="mr-1" size={14} />
                                {customer.phone}
                              </span>
                            )}
                          </div>
                          {(customer.companyName || customer.businessName) && (
                            <p className="text-sm text-gray-500 mt-1">
                              {customer.companyName || customer.businessName}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => openPermissionsModal(customer)}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <FiSettings className="mr-2" size={16} />
                        Edit Permissions
                      </button>
                    </div>

                    {/* Customer Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Subscription Plan</p>
                        <p className="font-semibold text-gray-900 capitalize">
                          {customer.subscription?.planType || 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Status</p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            customer.subscription?.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : customer.subscription?.status === 'trial'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {customer.subscription?.status || 'Expired'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Sync Preference</p>
                        <button
                          onClick={() =>
                            handleSyncPreferenceChange(
                              customer._id,
                              customer.syncPreference === 'direct' ? 'manual' : 'direct'
                            )
                          }
                          disabled={updatingSyncFor === customer._id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            customer.syncPreference === 'direct' || !customer.syncPreference
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          }`}
                        >
                          {updatingSyncFor === customer._id ? (
                            <FiRefreshCw className="animate-spin mr-1" size={12} />
                          ) : customer.syncPreference === 'direct' || !customer.syncPreference ? (
                            <FiZap className="mr-1" size={12} />
                          ) : (
                            <FiClock className="mr-1" size={12} />
                          )}
                          {customer.syncPreference === 'direct' || !customer.syncPreference
                            ? 'Direct'
                            : 'Manual'}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Orders This Month</p>
                        <div className="flex items-baseline space-x-2">
                          <p className="text-lg font-bold text-indigo-600">
                            {customer.billing?.currentMonth?.total || 0}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          M: {customer.billing?.currentMonth?.marketplace || 0} | D:{' '}
                          {customer.billing?.currentMonth?.direct || 0} | W:{' '}
                          {customer.billing?.currentMonth?.wholesale || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Allowed Pages</p>
                        <p className="text-lg font-bold text-gray-900">
                          {customer.allowedSidebarItems?.length || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">navigation items</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* NEW: Payment Requests Tab */}
      {activeTab === 'payment-requests' && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manual Payment Verifications</h2>
                <p className="text-sm text-gray-600 mt-1">Review and approve customer payment requests</p>
              </div>
              <select
                value={requestsFilter}
                onChange={(e) => setRequestsFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {loadingRequests ? (
              <div className="text-center py-12">
                <FiRefreshCw className="animate-spin mx-auto mb-4 w-8 h-8 text-indigo-600" />
                <p className="text-gray-600">Loading payment requests...</p>
              </div>
            ) : paymentRequests.length === 0 ? (
              <div className="text-center py-12">
                <FiCheckCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No {requestsFilter} payment requests
                </h3>
                <p className="text-gray-600">All caught up! 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentRequests.map((request) => (
                  <div
                    key={request._id}
                    className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* User Info */}
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {request.userDetails?.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {request.userDetails?.name || 'Unknown User'}
                            </h3>
                            <p className="text-sm text-gray-600">{request.userDetails?.email}</p>
                            {request.userDetails?.businessName && (
                              <p className="text-xs text-gray-500">{request.userDetails?.businessName}</p>
                            )}
                          </div>
                        </div>

                        {/* Payment Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Plan Type</p>
                            <p className="font-semibold text-gray-900 capitalize">{request.planType}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Amount</p>
                            <p className="text-xl font-bold text-green-600">
                              ₹{request.amount?.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Payment Method</p>
                            <p className="font-semibold text-gray-900 capitalize flex items-center">
                              {request.paymentMethod === 'upi' ? (
                                <>
                                  <FiCreditCard className="mr-1" size={14} />
                                  UPI
                                </>
                              ) : (
                                <>
                                  <FiDollarSign className="mr-1" size={14} />
                                  Cash
                                </>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Requested On</p>
                            <p className="font-semibold text-gray-900 text-sm">
                              {new Date(request.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : request.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {request.status === 'pending' && <FiClock className="mr-1" size={12} />}
                            {request.status === 'approved' && <FiCheckCircle className="mr-1" size={12} />}
                            {request.status === 'rejected' && <FiXCircle className="mr-1" size={12} />}
                            {request.status.toUpperCase()}
                          </span>

                          {request.status === 'rejected' && request.rejectionReason && (
                            <span className="text-xs text-gray-600">
                              Reason: {request.rejectionReason}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {request.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleApprovePayment(request._id)}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                          >
                            <FiCheckCircle className="mr-2" size={16} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectPayment(request._id)}
                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                          >
                            <FiXCircle className="mr-2" size={16} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Permissions Modal (Original UI) */}
      {showPermissionsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Edit Sidebar Permissions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedCustomer.name} - {selectedCustomer.companyName || selectedCustomer.businessName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tempPermissions.length} navigation items will be visible
                  </p>
                </div>
                <button
                  onClick={closePermissionsModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {Object.entries(groupedItems).map(([section, items]) => (
                <div key={section} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                    {section}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isSelected = tempPermissions.includes(item.id);
                      const isLocked = item.locked;

                      return (
                        <button
                          key={item.id}
                          onClick={() => !isLocked && togglePermission(item.id)}
                          disabled={isLocked}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isLocked
                              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                              : isSelected
                              ? `border-indigo-500 ${item.bgColor}`
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className={item.color} size={20} />
                              <span className="font-semibold text-gray-800">{item.label}</span>
                            </div>
                            {isLocked ? (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                Required
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-3">
                <button
                  onClick={closePermissionsModal}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center ${
                    saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {saving ? (
                    <>
                      <FiRefreshCw className="animate-spin mr-2" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2" size={18} />
                      Save Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
