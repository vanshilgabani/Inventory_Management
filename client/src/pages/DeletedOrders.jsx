import { useState, useEffect } from 'react';
import deletedOrdersService from '../services/deletedOrdersService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiTrash2,
  FiShoppingCart,
  FiShoppingBag,
  FiTruck,
  FiCalendar,
  FiUser,
  FiClock,
  FiDollarSign,
  FiX,
  FiSearch,
  FiAlertCircle,
  FiPackage
} from 'react-icons/fi';
import { format } from 'date-fns';
import ScrollToTop from '../components/common/ScrollToTop';

const DeletedOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [deletedOrders, setDeletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    wholesale: 0,
    directSales: 0,
    marketplaceSales: 0
  });
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error('Access denied. Admin only.');
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch deleted orders
  useEffect(() => {
    fetchDeletedOrders();
  }, [activeTab, dateRange]);

  const fetchDeletedOrders = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (activeTab !== 'all') {
        filters.type = activeTab;
      }
      if (dateRange.startDate) {
        filters.startDate = dateRange.startDate;
      }
      if (dateRange.endDate) {
        filters.endDate = dateRange.endDate;
      }

      const response = await deletedOrdersService.getAllDeletedOrders(filters);
      setDeletedOrders(response.data);
      setSummary(response.summary);
    } catch (error) {
      console.error('Failed to fetch deleted orders', error);
      toast.error('Failed to load deleted orders');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders by search query
  const filteredOrders = deletedOrders.filter(order => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      order.displayId?.toLowerCase().includes(query) ||
      order.buyerName?.toLowerCase().includes(query) ||
      order.customerName?.toLowerCase().includes(query) ||
      order.businessName?.toLowerCase().includes(query) ||
      order.deletedBy?.userName?.toLowerCase().includes(query)
    );
  });

  // Get order type config
  const getOrderTypeConfig = (type) => {
    const configs = {
      'wholesale': {
        icon: FiShoppingCart,
        label: 'Wholesale',
        color: 'blue',
        gradient: 'from-blue-500 to-cyan-500',
        bgLight: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200'
      },
      'direct-sales': {
        icon: FiShoppingBag,
        label: 'Direct Sale',
        color: 'green',
        gradient: 'from-green-500 to-emerald-500',
        bgLight: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200'
      },
      'marketplace-sales': {
        icon: FiTruck,
        label: 'Marketplace',
        color: 'purple',
        gradient: 'from-purple-500 to-pink-500',
        bgLight: 'bg-purple-50',
        textColor: 'text-purple-600',
        borderColor: 'border-purple-200'
      }
    };
    return configs[type] || configs['wholesale'];
  };

  // Order detail modal
  const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;

    const config = getOrderTypeConfig(order.orderType);
    const Icon = config.icon;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
          {/* Header */}
          <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white relative`}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
            >
              <FiX className="text-xl" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                <Icon className="text-3xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{order.displayId}</h2>
                <p className="text-white text-opacity-90">{config.label}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Customer Information</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FiUser className="text-gray-400" />
                  <span className="font-medium">
                    {order.buyerName || order.customerName || 'N/A'}
                  </span>
                </div>
                {order.businessName && (
                  <div className="flex items-center gap-2">
                    <FiPackage className="text-gray-400" />
                    <span className="text-gray-600">{order.businessName}</span>
                  </div>
                )}
                {(order.buyerContact || order.customerMobile) && (
                  <div className="text-sm text-gray-600">
                    📞 {order.buyerContact || order.customerMobile}
                  </div>
                )}
              </div>
            </div>

            {/* Deletion Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Deletion Details</h3>
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-red-600" />
                      <span className="text-sm text-gray-600">Deleted by:</span>
                      <span className="font-semibold text-red-900">
                        {order.deletedBy?.userName || 'Unknown User'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FiClock className="text-red-600" />
                      <span className="text-sm text-gray-600">Deleted on:</span>
                      <span className="font-semibold text-red-900">
                        {format(new Date(order.deletedAt), 'dd MMM yyyy, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <FiCalendar className="text-sm" />
                    <span className="text-xs">Created Date</span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(order.createdAt || order.saleDate), 'dd MMM yyyy')}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <FiDollarSign className="text-sm" />
                    <span className="text-xs">Total Amount</span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{order.totalAmount?.toLocaleString('en-IN') || '0'}
                  </p>
                </div>

                {order.gstAmount && order.gstAmount > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-gray-500 text-xs mb-1">GST Amount</div>
                    <p className="font-semibold text-gray-900">
                      ₹{order.gstAmount?.toFixed(2)}
                    </p>
                  </div>
                )}

                {order.amountPaid > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-gray-500 text-xs mb-1">Amount Paid</div>
                    <p className="font-semibold text-green-600">
                      ₹{order.amountPaid?.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items (if available) */}
            {order.items && order.items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Items</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 max-h-40 overflow-y-auto">
                  {order.items.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {item.design || item.productName} - {item.color} - {item.size}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {item.quantity} pcs
                      </span>
                    </div>
                  ))}
                  {order.items.length > 5 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      +{order.items.length - 5} more items
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-2xl"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center animate-fadeIn">
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <div className="p-2 bg-red-100 rounded-full">
              <FiTrash2 className="text-2xl text-red-600" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              Deleted Orders Archive
            </h1>
          </div>
          <p className="text-gray-600">View all deleted orders across all platforms</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slideUp">
          {[
            { label: 'Total Deleted', count: summary.total, icon: FiTrash2, gradient: 'from-red-500 to-pink-500', delay: '0ms' },
            { label: 'Wholesale', count: summary.wholesale, icon: FiShoppingCart, gradient: 'from-blue-500 to-cyan-500', delay: '100ms' },
            { label: 'Direct Sales', count: summary.directSales, icon: FiShoppingBag, gradient: 'from-green-500 to-emerald-500', delay: '200ms' },
            { label: 'Marketplace', count: summary.marketplaceSales, icon: FiTruck, gradient: 'from-purple-500 to-pink-500', delay: '300ms' }
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105"
                style={{ animationDelay: stat.delay }}
              >
                <div className={`h-2 bg-gradient-to-r ${stat.gradient}`}></div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">{stat.label}</p>
                      <p className="text-4xl font-bold text-gray-900">{stat.count}</p>
                    </div>
                    <div className={`p-4 bg-gradient-to-br ${stat.gradient} rounded-xl`}>
                      <Icon className="text-2xl text-white" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs & Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4 animate-fadeIn">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Orders', icon: FiPackage },
              { id: 'wholesale', label: 'Wholesale', icon: FiShoppingCart },
              { id: 'direct-sales', label: 'Direct Sales', icon: FiShoppingBag },
              { id: 'marketplace-sales', label: 'Marketplace', icon: FiTruck }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="text-lg" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Date Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
              <input
                type="text"
                placeholder="Search orders, customers, deleted by..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              {(dateRange.startDate || dateRange.endDate) && (
                <button
                  onClick={() => setDateRange({ startDate: '', endDate: '' })}
                  className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <FiX className="text-xl" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center animate-fadeIn">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-4">
              <FiTrash2 className="text-4xl text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Deleted Orders Found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search criteria' : 'All orders are active'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order, idx) => {
              const config = getOrderTypeConfig(order.orderType);
              const Icon = config.icon;
              
              return (
                <div
                  key={`${order.orderType}-${order._id}`}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105 animate-slideUp"
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => setSelectedOrder(order)}
                >
                  {/* Gradient Header */}
                  <div className={`h-3 bg-gradient-to-r ${config.gradient}`}></div>
                  
                  <div className="p-6 space-y-4">
                    {/* Order Type Badge & ID */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 ${config.bgLight} rounded-xl`}>
                          <Icon className={`text-xl ${config.textColor}`} />
                        </div>
                        <div>
                          <p className="font-bold text-lg text-gray-900">{order.displayId}</p>
                          <span className={`text-xs font-semibold ${config.textColor}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Customer</p>
                      <p className="font-semibold text-gray-900 truncate">
                        {order.buyerName || order.customerName || 'N/A'}
                      </p>
                      {order.businessName && (
                        <p className="text-xs text-gray-600 truncate">{order.businessName}</p>
                      )}
                    </div>

                    {/* Deletion Info */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-red-600 text-sm" />
                        <span className="text-xs text-gray-600">Deleted by:</span>
                        <span className="text-xs font-semibold text-red-900">
                          {order.deletedBy?.userName || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiClock className="text-red-600 text-sm" />
                        <span className="text-xs text-gray-600">
                          {format(new Date(order.deletedAt), 'dd MMM yyyy, h:mm a')}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-sm text-gray-500">Total Amount</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{order.totalAmount?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Add custom animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
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
          animation: fadeIn 0.5s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }
      `}</style>
      <ScrollToTop />
    </div>
  );
};

export default DeletedOrders;
