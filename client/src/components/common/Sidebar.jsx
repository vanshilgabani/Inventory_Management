import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  FiHome, FiPackage, FiShoppingCart, FiUsers, FiShoppingBag, 
  FiTruck, FiBarChart2, FiUserCheck, FiSettings, FiFileText, 
  FiArchive, FiCreditCard, FiDollarSign, FiRefreshCw, 
  FiChevronDown, FiChevronRight, FiActivity 
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSettings } from '../../context/SettingsContext';
import axios from 'axios';


const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { isAdmin, user } = useAuth();
  const { subscription, isTrial } = useSubscription();
  const { settings } = useSettings();
  
  // ✅ Permission state
  const [allowedSidebarItems, setAllowedSidebarItems] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  
  const [expandedSections, setExpandedSections] = useState({
    main: true,
    subscription: true,
    admin: true
  });


  // ✅ Fetch sidebar permissions on mount
  useEffect(() => {
    fetchSidebarPermissions();
  }, [user]);


  // ✅ Fetch permissions function
  const fetchSidebarPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/tenant-settings/my-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('🔍 Full API Response:', response.data);
      
      if (response.data.success) {
        const allowed = response.data.data.allowedSidebarItems || ['dashboard', 'inventory', 'marketplace-sales', 'settings'];
        
        console.log('🔍 allowedSidebarItems:', allowed);
        console.log('🔍 Is array empty?', allowed.length === 0);
        console.log('🔍 Array length:', allowed.length);
        
        setAllowedSidebarItems(allowed);
      }
    } catch (error) {
      console.error('Failed to fetch sidebar permissions:', error);
      setAllowedSidebarItems(['dashboard', 'inventory', 'marketplace-sales', 'settings']);
    } finally {
      setLoadingPermissions(false);
    }
  };


  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

const isItemAllowed = (itemKey) => {
  // RULE 1: Admin-only items → Check admin role first
  const item = [...menuItems, ...subscriptionItems, ...adminItems].find(i => i.key === itemKey);
  if (item?.adminOnly && !isAdmin) {
    return false; // ❌ Sales can't see admin items
  }

  // RULE 2: Supplier → Always show everything
  if (user?.isSupplier) {
    return true; // ✅ Supplier sees all
  }

  // RULE 3: Customer with restrictions applied → Follow strictly
  if (user?.linkedSupplier && allowedSidebarItems && allowedSidebarItems.length > 0) {
    return allowedSidebarItems.includes(itemKey); // ✅ Restricted
  }

  // RULE 4: Everyone else (independent users, no restrictions) → Show all
  return true; // ✅ Show everything by default
};

  // ✅ Menu items with key field
  const menuItems = [
    { key: 'dashboard', path: '/dashboard', icon: FiHome, label: 'Dashboard', color: 'text-blue-500' },
    { key: 'inventory', path: '/inventory', icon: FiPackage, label: 'Inventory', color: 'text-purple-500' },
    { key: 'factory-receiving', path: '/factory-receiving', icon: FiTruck, label: 'Factory Receiving', color: 'text-green-500' },
    { 
      key: 'received-from-supplier',
      path: '/received-from-supplier', 
      icon: FiTruck, 
      label: 'Received from Supplier', 
      color: 'text-green-600',
      tenantOnly: true,
      badge: 'Auto-Sync',
      badgeColor: 'from-green-500 to-emerald-500'
    },
    { key: 'wholesale', path: '/wholesale', icon: FiShoppingCart, label: 'Wholesale Orders', color: 'text-orange-500' },
    { key: 'direct-sales', path: '/direct-sales', icon: FiShoppingBag, label: 'Direct Sales', color: 'text-pink-500' },
    { key: 'marketplace-sales', path: '/marketplace-sales', icon: FiBarChart2, label: 'Marketplace Sales', color: 'text-indigo-500' },
    { key: 'wholesale-buyers', path: '/wholesale-buyers', icon: FiUsers, label: 'Wholesale Buyers', color: 'text-teal-500' },
    { key: 'customers', path: '/customers', icon: FiUserCheck, label: 'Customers', color: 'text-cyan-500' },
    { key: 'analytics', path: '/analytics', icon: FiActivity, label: 'Analytics', color: 'text-red-500' },
  ];


  const subscriptionItems = [
    { 
      key: 'subscription',
      path: '/subscription', 
      icon: FiCreditCard, 
      label: 'Subscription',
      badge: isTrial() ? 'Trial' : subscription?.planType === 'yearly' ? 'Pro' : null,
      badgeColor: isTrial() ? 'from-blue-500 to-cyan-500' : 'from-green-500 to-emerald-500',
      color: 'text-indigo-500' 
    },
    { key: 'invoices', path: '/subscription/invoices', icon: FiDollarSign, label: 'Invoices', color: 'text-yellow-500' },
    { key: 'sync-logs', path: '/sync/logs', icon: FiRefreshCw, label: 'Sync Logs', color: 'text-blue-500' },
    { 
      key: 'supplier-sync-logs',
      path: '/sync/supplier-logs', 
      icon: FiRefreshCw, 
      label: 'Supplier Sync Logs', 
      color: 'text-purple-500',
      adminOnly: true 
    },
  ];


  const adminItems = [
    { key: 'monthly-bills', path: '/monthly-bills', icon: FiFileText, label: 'Monthly Bills', color: 'text-orange-500' },
    { key: 'deleted-orders', path: '/deleted-orders', icon: FiArchive, label: 'Deleted Orders', color: 'text-red-500' },
    { key: 'customers-management', path: '/customers-management', icon: FiUsers, label: 'Customer Management', color: 'text-indigo-500' },
    { key: 'users', path: '/users', icon: FiUsers, label: 'User Management', color: 'text-purple-500' },
    { key: 'settings', path: '/settings', icon: FiSettings, label: 'Settings', color: 'text-gray-500' },
  ];


    // ✅ FIXED: Filter sections (organization-wide restrictions)
    const visibleMenuItems = menuItems.filter(item => isItemAllowed(item.key));

    const visibleSubscriptionItems = subscriptionItems.filter(item => {
      // Admin-only items still need admin role
      if (item.adminOnly && !isAdmin) return false;
      // Check permissions
      return isItemAllowed(item.key);
    });

    const visibleAdminItems = adminItems.filter(item => isItemAllowed(item.key));

  // ✅ Loading state with smooth animation
  if (loadingPermissions) {
    return (
      <div className="fixed top-0 left-0 z-50 h-screen w-72 bg-white shadow-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* Mobile Overlay with Blur Effect */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}


      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-72
        bg-white shadow-2xl
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-0
        flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <Link to="/dashboard" className="flex items-center space-x-3 transition-transform hover:scale-105">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <FiPackage className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{settings.companyName}</h1>
              <p className="text-xs text-gray-500">Inventory System</p>
            </div>
          </Link>
        </div>


        {/* User Info */}
        {user && (
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}


        {/* Scrollable Navigation Container */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          
          {/* Main Navigation */}
          {visibleMenuItems.length > 0 && (
            <nav className="px-3 py-4 space-y-1">
              {visibleMenuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center justify-between px-4 py-3 rounded-lg
                      transition-all duration-200 transform hover:scale-[1.02]
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: 'slideIn 0.3s ease-out forwards'
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`text-lg ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    
                    {item.badge && (
                      <span className={`
                        px-2 py-0.5 text-xs font-semibold rounded-full
                        bg-gradient-to-r ${item.badgeColor}
                        text-white shadow-sm
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          )}


          {/* Subscription Section */}
          {visibleSubscriptionItems.length > 0 && (
            <div className="px-3 mt-4">
              <button
                onClick={() => toggleSection('subscription')}
                className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-all duration-200 hover:translate-x-1"
              >
                <span>Subscription</span>
                <div className="transition-transform duration-200">
                  {expandedSections.subscription ? (
                    <FiChevronDown className="text-sm" />
                  ) : (
                    <FiChevronRight className="text-sm" />
                  )}
                </div>
              </button>
              
              {expandedSections.subscription && (
                <nav className="mt-2 space-y-1 animate-fadeIn">
                  {visibleSubscriptionItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => `
                          flex items-center justify-between px-4 py-2.5 rounded-lg
                          transition-all duration-200 transform hover:scale-[1.02]
                          ${isActive 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: 'slideIn 0.3s ease-out forwards'
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`text-base ${item.color}`} />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        
                        {item.badge && (
                          <span className={`
                            px-2 py-0.5 text-xs font-semibold rounded-full
                            bg-gradient-to-r ${item.badgeColor}
                            text-white shadow-sm
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              )}
            </div>
          )}


          {/* Admin Section */}
          {visibleAdminItems.length > 0 && (
            <div className="px-3 mt-4 mb-4">
              <button
                onClick={() => toggleSection('admin')}
                className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-all duration-200 hover:translate-x-1"
              >
                <span>Admin</span>
                <div className="transition-transform duration-200">
                  {expandedSections.admin ? (
                    <FiChevronDown className="text-sm" />
                  ) : (
                    <FiChevronRight className="text-sm" />
                  )}
                </div>
              </button>
              
              {expandedSections.admin && (
                <nav className="mt-2 space-y-1 animate-fadeIn">
                  {visibleAdminItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => `
                          flex items-center space-x-3 px-4 py-2.5 rounded-lg
                          transition-all duration-200 transform hover:scale-[1.02]
                          ${isActive 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: 'slideIn 0.3s ease-out forwards'
                        }}
                      >
                        <Icon className={`text-base ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              )}
            </div>
          )}
        </div>


        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </p>
          </div>
        </div>
      </aside>


      {/* ✅ ADD ANIMATIONS */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        /* Custom scrollbar */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
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
    </>
  );
};


export default Sidebar;
