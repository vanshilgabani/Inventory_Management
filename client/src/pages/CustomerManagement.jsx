import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDollarSign, 
  FiToggleRight, FiToggleLeft, FiMail, FiPhone, FiPackage, FiTrendingUp, FiSearch, 
  FiFilter, FiShoppingCart, FiShoppingBag, FiBarChart2, FiSettings, 
  FiSave, FiX, FiFileText, FiCreditCard, FiActivity, FiClock, FiZap
} from 'react-icons/fi';
import Card from '../components/common/Card';

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

  // Enhanced sidebar items with sections
  const availableSidebarItems = [
    // Main Menu Section
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: FiActivity, 
      locked: true, 
      section: 'Main Menu',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: FiPackage, 
      section: 'Main Menu',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50'
    },
    { 
      id: 'factory-receiving', 
      label: 'Factory Receiving', 
      icon: FiTrendingUp, 
      section: 'Main Menu',
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    { 
      id: 'received-from-supplier', 
      label: 'Received from Supplier', 
      icon: FiRefreshCw, 
      section: 'Main Menu',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50'
    },
    { 
      id: 'wholesale', 
      label: 'Wholesale Orders', 
      icon: FiShoppingCart, 
      section: 'Main Menu',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    { 
      id: 'direct-sales', 
      label: 'Direct Sales', 
      icon: FiShoppingBag, 
      section: 'Main Menu',
      color: 'text-pink-500',
      bgColor: 'bg-pink-50'
    },
    { 
      id: 'marketplace-sales', 
      label: 'Marketplace Sales', 
      icon: FiBarChart2, 
      section: 'Main Menu',
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50'
    },
    { 
      id: 'wholesale-buyers', 
      label: 'Wholesale Buyers', 
      icon: FiUsers, 
      section: 'Main Menu',
      color: 'text-teal-500',
      bgColor: 'bg-teal-50'
    },
    { 
      id: 'customers', 
      label: 'Customers', 
      icon: FiUsers, 
      section: 'Main Menu',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-50'
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: FiBarChart2, 
      section: 'Main Menu',
      color: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    
    // Subscription Section
    { 
      id: 'subscription', 
      label: 'Subscription', 
      icon: FiCreditCard, 
      section: 'Subscription',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    { 
      id: 'invoices', 
      label: 'Invoices', 
      icon: FiDollarSign, 
      section: 'Subscription',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    { 
      id: 'sync-logs', 
      label: 'Sync Logs', 
      icon: FiRefreshCw, 
      section: 'Subscription',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      id: 'supplier-sync-logs', 
      label: 'Supplier Sync Logs', 
      icon: FiRefreshCw, 
      section: 'Subscription',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    
    // Admin Section
    { 
      id: 'monthly-bills', 
      label: 'Monthly Bills', 
      icon: FiFileText, 
      section: 'Admin',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    { 
      id: 'deleted-orders', 
      label: 'Deleted Orders', 
      icon: FiXCircle, 
      section: 'Admin',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    { 
      id: 'customers-management', 
      label: 'Customer Management', 
      icon: FiUsers, 
      section: 'Admin',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    { 
      id: 'users', 
      label: 'User Management', 
      icon: FiUsers, 
      section: 'Admin',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: FiSettings, 
      locked: false, 
      section: 'Admin',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    }
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

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/customers', {
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
      const response = await fetch(`/api/admin/customers/${selectedCustomer._id}/sidebar-permissions`, {
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
        setCustomers(prev => prev.map(c => 
          c._id === selectedCustomer._id ? { ...c, allowedSidebarItems: tempPermissions } : c
        ));
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

  // 🆕 NEW: Handle sync preference change
const handleSyncPreferenceChange = async (customerId, newPreference) => {
  try {
    setUpdatingSyncFor(customerId);
    
    const response = await fetch(`/api/admin/customers/${customerId}/sync-preference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        syncPreference: newPreference
      })
    });

    const data = await response.json();

    if (data.success) {
      toast.success(`Sync mode updated to ${newPreference === 'direct' ? 'Direct' : 'Manual'}!`);
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c._id === customerId 
          ? { ...c, syncPreference: newPreference }
          : c
      ));
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only admins can access this page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Customer Management
          </h1>
          <p className="text-gray-600">Manage all your customers and their feature access</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard 
              icon={FiUsers}
              label="Total Customers"
              value={stats?.totalCustomers || 0}
              color="blue"
              delay="0ms"
            />
            <StatCard 
              icon={FiCheckCircle}
              label="Active Plans"
              value={stats?.activeSubscriptions || 0}
              color="green"
              delay="50ms"
            />
            <StatCard 
              icon={FiClock}
              label="Trial Users"
              value={stats?.trialUsers || 0}
              color="yellow"
              delay="100ms"
            />
            <StatCard 
              icon={FiShoppingCart}
              label="Orders This Month"
              value={stats?.totalOrdersThisMonth || 0}
              color="purple"
              delay="150ms"
            />
            <StatCard 
              icon={FiDollarSign}
              label="Est. Revenue"
              value={`₹${(stats?.estimatedRevenue || 0).toFixed(2)}`}
              color="indigo"
              delay="200ms"
            />
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slideUp">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
              <input
                type="text"
                placeholder="Search by name, email, company, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none"
              />
            </div>
            <div className="relative">
              <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-11 pr-8 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customers List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading customers...</p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FiUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No customers found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredCustomers.map((customer, index) => (
              <CustomerCard
                key={customer._id}
                customer={customer}
                onManagePermissions={openPermissionsModal}
                onSyncPreferenceChange={handleSyncPreferenceChange}
                updatingSyncFor={updatingSyncFor}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && (
          <PermissionsModal
            customer={selectedCustomer}
            groupedItems={groupedItems}
            tempPermissions={tempPermissions}
            togglePermission={togglePermission}
            savePermissions={savePermissions}
            closeModal={closePermissionsModal}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};

// StatCard Component
const StatCard = ({ icon: Icon, label, value, color, delay }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-200',
    green: 'from-green-500 to-green-600 shadow-green-200',
    yellow: 'from-yellow-500 to-yellow-600 shadow-yellow-200',
    purple: 'from-purple-500 to-purple-600 shadow-purple-200',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200',
  };

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 transform hover:scale-105 animate-fadeIn"
      style={{ animationDelay: delay }}
    >
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-gray-600 text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

// 🆕 NEW: Sync Preference Toggle Component
const SyncPreferenceToggle = ({ customer }) => {
  const [syncPreference, setSyncPreference] = useState(customer.syncPreference || 'direct');
  const [updating, setUpdating] = useState(false);

  const handleSyncPreferenceChange = async (newPreference) => {
    if (updating) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer._id}/sync-preference`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ syncPreference: newPreference })
      });

      const data = await response.json();

      if (data.success) {
        setSyncPreference(newPreference);
        toast.success(`Sync preference updated to ${newPreference === 'direct' ? 'Direct Sync' : 'Manual Approval'}`);
      } else {
        toast.error(data.message || 'Failed to update sync preference');
      }
    } catch (error) {
      console.error('Error updating sync preference:', error);
      toast.error('Failed to update sync preference');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Sync Preference</p>
          <p className="text-xs text-gray-500">
            {customer.syncPreference === 'direct' 
              ? 'Orders sync automatically to inventory' 
              : 'Orders require manual approval before sync'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSyncPreferenceChange(customer._id, 'direct')}
            disabled={updatingSyncFor === customer._id}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              customer.syncPreference === 'direct'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center gap-1.5">
              <FiToggleRight className="w-4 h-4" />
              Direct
            </div>
          </button>
          <button
            onClick={() => handleSyncPreferenceChange(customer._id, 'manual')}
            disabled={updatingSyncFor === customer._id}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              customer.syncPreference === 'manual'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center gap-1.5">
              <FiToggleLeft className="w-4 h-4" />
              Manual
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// CustomerCard Component
const CustomerCard = ({ customer, onManagePermissions, index, onSyncPreferenceChange, updatingSyncFor }) => {
  const getStatusBadge = () => {
    const subscription = customer.subscription;
    const status = subscription?.status;
    const planType = subscription?.planType;

    if (status === 'active') {
      // Show correct label based on planType
      if (planType === 'order-based') {
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Order-Based</span>;
      } else if (planType === 'yearly') {
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Yearly Active</span>;
      } else if (planType === 'monthly') {
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Monthly Active</span>;
      } else {
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Active</span>;
      }
    } else if (status === 'trial') {
      return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Trial</span>;
    } else if (status === 'expired') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Expired</span>;
    } else {
      return <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">No Plan</span>;
    }
  };

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 transform hover:scale-1.01 animate-slideUp"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Customer Info */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {customer.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                {customer.businessName || customer.companyName || 'No business name'}
              </h3>
              <p className="text-sm text-gray-500">{customer.name}</p>
            </div>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <FiMail className="text-blue-500" />
              <span>{customer.email}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <FiPhone className="text-green-500" />
              <span>{customer.phone || 'N/A'}</span>
            </div>
          </div>

          {/* NEW: Sync Preference Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Sync Preference</p>
                <p className="text-xs text-gray-500">
                  {(customer.syncPreference === 'direct' || !customer.syncPreference)
                    ? 'Orders sync automatically to inventory' 
                    : 'Orders require manual approval before sync'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Direct Button */}
                <button
                  onClick={() => onSyncPreferenceChange(customer._id, 'direct')}
                  disabled={updatingSyncFor === customer._id}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    (customer.syncPreference === 'direct' || !customer.syncPreference)
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-1.5">
                    <FiToggleRight className="w-4 h-4" />
                    Direct
                  </div>
                </button>
                
                {/* Manual Button */}
                <button
                  onClick={() => onSyncPreferenceChange(customer._id, 'manual')}
                  disabled={updatingSyncFor === customer._id}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    customer.syncPreference === 'manual'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-1.5">
                    <FiToggleLeft className="w-4 h-4" />
                    Manual
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Stats */}
        <div className="flex-shrink-0">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <FiShoppingCart className="text-blue-500" />
              Orders This Month
            </p>
            
            {/* Order Type Breakdown */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Marketplace</p>
                <p className="text-lg font-bold text-blue-600">{customer.billing?.currentMonth?.marketplace || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Direct</p>
                <p className="text-lg font-bold text-pink-600">{customer.billing?.currentMonth?.direct || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Wholesale</p>
                <p className="text-lg font-bold text-orange-600">{customer.billing?.currentMonth?.wholesale || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="text-lg font-bold text-purple-600">{customer.billing?.currentMonth?.total || 0}</p>
              </div>
            </div>

            {/* Rest of the stats remain the same... */}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => onManagePermissions(customer)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
        >
          <FiSettings />
          Manage Features
        </button>
      </div>
    </div>
  );
};

// PermissionsModal Component
const PermissionsModal = ({ customer, groupedItems, tempPermissions, togglePermission, savePermissions, closeModal, saving }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scaleIn">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Feature Access Control</h2>
              <p className="text-blue-100">{customer.name} - {customer.companyName || customer.businessName}</p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm bg-white/20 rounded-lg p-3">
            <FiZap className="w-5 h-5" />
            <span>Control which navigation items appear in {customer.name}'s sidebar. Changes affect all users in this organization.</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)] scrollbar-thin">
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section} className="mb-6 last:mb-0">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="h-1 w-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
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
                      onClick={() => togglePermission(item.id)}
                      disabled={isLocked}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                        ${isSelected 
                          ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                        }
                        ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg transform hover:scale-[1.02]'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${item.bgColor}`}>
                            <Icon className={`w-5 h-5 ${item.color}`} />
                          </div>
                          <span className="font-medium text-gray-800">{item.label}</span>
                        </div>
                        <div className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200
                          ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                        `}>
                          {isSelected && <FiCheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      {isLocked && (
                        <span className="absolute top-2 right-2 text-xs font-semibold text-gray-500">Locked</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-blue-600">{tempPermissions.length}</span> navigation items will be visible
            </p>
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out forwards;
        }
        
        .animate-slideUp {
          animation: slideUp 0.4s ease-out forwards;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 10px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  );
};

export default CustomerManagement;
