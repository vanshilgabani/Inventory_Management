import { NavLink, Link } from 'react-router-dom';
import {
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiUsers,
  FiShoppingBag,
  FiTruck,
  FiBarChart2,
  FiUserCheck,
  FiSettings,
  FiFileText,
  FiLock, 
  FiRepeat
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { isAdmin, user } = useAuth();

  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/inventory', icon: FiPackage, label: 'Inventory' },
    { path: '/factory-receiving', icon: FiTruck, label: 'Factory Receiving' },
    { path: '/wholesale', icon: FiShoppingCart, label: 'Wholesale Orders' },
    { path: '/direct-sales', icon: FiShoppingBag, label: 'Direct Sales' },
    { path: '/marketplace-sales', icon: FiBarChart2, label: 'Marketplace Sales' },
    { path: '/wholesale-buyers', icon: FiUsers, label: 'Wholesale Buyers' },
    { path: '/customers', icon: FiUserCheck, label: 'Customers' },
    { path: '/analytics', icon: FiBarChart2, label: 'Analytics' },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-0`}
    >
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Cargo Stock</h1>
              <p className="text-xs text-gray-500">Inventory System</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {user?.role === 'admin' ? (
                  <>
                    <span>👑</span>
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <span>💼</span>
                    <span>Sales Person</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              </li>
            ))}

            {isAdmin() && (
              <li>
                <NavLink
                  to="/monthly-bills"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-purple-50'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiFileText size={20} />
                  <span className="font-medium text-sm">Bills</span>
                  <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full font-semibold">
                    Admin
                  </span>
                </NavLink>
              </li>
            )}
            {/* Admin Only - User Management */}
            {isAdmin() && (
              <li>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-purple-50'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiSettings size={20} />
                  <span className="font-medium text-sm">User Management</span>
                  <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full font-semibold">
                    Admin
                  </span>
                </NavLink>
              </li>
            )}
            {isAdmin() && (
              <li>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-purple-50'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiSettings size={20} />
                  <span className="font-medium text-sm">Settings</span>
                  <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full font-semibold">
                    Admin
                  </span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            © 2025 Cargo Stock System
          </p>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </aside>
  );
};

export default Sidebar;
