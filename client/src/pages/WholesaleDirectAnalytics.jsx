import { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import TimeRangeSelector from '../components/Analytics/TimeRangeSelector';
import ExportButton from '../components/Analytics/ExportButton';
import toast from 'react-hot-toast';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiShoppingCart,
  FiUsers,
  FiPackage,
  FiAlertCircle,
  FiBarChart2,
  FiRefreshCw
} from 'react-icons/fi';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const WholesaleDirectAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
    compareEnabled: false,
    compareWith: 'Previous Period',
    rangeName: 'This Month'
    });

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('wholesale');

  // Wholesale Data
  const [topBuyers, setTopBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [buyerProducts, setBuyerProducts] = useState([]);
  const [wholesaleTrends, setWholesaleTrends] = useState([]);
  
  // Direct Sales Data
  const [directSales, setDirectSales] = useState({ totalAmount: 0, totalTransactions: 0, avgTransaction: 0 });
  
  // Combined Metrics
  const [salesVelocity, setSalesVelocity] = useState([]);

useEffect(() => {
  if (isInitialLoad) {
    fetchAllData();
    setIsInitialLoad(false);
  }
}, []);

useEffect(() => {
  if (!isInitialLoad && dateRange.startDate && dateRange.endDate) {
    console.log('📅 Fetching with new date range:', dateRange);
    fetchAllData();
  }
}, [dateRange.startDate, dateRange.endDate, dateRange.compareEnabled, dateRange.compareWith]);

const handleDateRangeChange = (newRange) => {
  console.log('📅 Date Range Changed:', newRange);
  setDateRange(newRange);
};

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 10
      };

      const [
        buyersData,
        directData,
        velocityData,
        trendsData
      ] = await Promise.all([
        analyticsService.getTopWholesaleBuyers(params),
        analyticsService.getDirectSalesAmount(params),
        analyticsService.getSalesVelocityByProduct(30),
        analyticsService.getWholesaleRevenueTrends('month')
      ]);

      setTopBuyers(buyersData.data || []);
      setDirectSales(directData.data);
      setSalesVelocity(velocityData.data || []);
      setWholesaleTrends(trendsData.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyerProducts = async (buyerId) => {
    try {
      const response = await analyticsService.getTopProductsPerBuyer(buyerId);
      setBuyerProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching buyer products:', error);
      toast.error('Failed to load buyer products');
    }
  };

  const handleBuyerClick = (buyer) => {
    setSelectedBuyer(buyer);
    fetchBuyerProducts(buyer.buyerId);
  };

  const formatCurrency = (value) => {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Wholesale & Direct Sales Analytics</h1>
        <p className="text-gray-600">Comprehensive insights into your business performance</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <TimeRangeSelector onRangeChange={handleDateRangeChange} showComparison={true} />
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FiRefreshCw className="text-gray-500" />
            <span className="font-medium text-gray-700">Refresh</span>
          </button>
        </div>
      </div>

    {/* Date Range Display */}
{dateRange.startDate && dateRange.endDate && (
  <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-indigo-900">
          Showing: {dateRange.rangeName || 'Custom Range'}
        </span>
        <span className="text-sm text-indigo-700">
          {new Date(dateRange.startDate).toLocaleDateString('en-IN')} - {new Date(dateRange.endDate).toLocaleDateString('en-IN')}
        </span>
      </div>
      {dateRange.compareEnabled && (
        <span className="text-sm text-indigo-700">
          📊 Comparing with: {dateRange.compareWith}
        </span>
      )}
    </div>
  </div>
)}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('wholesale')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'wholesale'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Wholesale Performance
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'direct'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Direct Sales
        </button>
        <button
          onClick={() => setActiveTab('combined')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'combined'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Combined Metrics
        </button>
      </div>

      {/* Wholesale Performance Tab */}
      {activeTab === 'wholesale' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Wholesale Revenue Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Revenue Trends</h2>
                <p className="text-sm text-gray-600">Monthly wholesale revenue overview</p>
              </div>
              <ExportButton data={wholesaleTrends} filename="wholesale_trends" title="Wholesale Revenue Trends" />
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wholesaleTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Revenue"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="paid" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                    name="Paid"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="due" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', r: 3 }}
                    name="Due"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Wholesale Buyers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Top Performing Buyers</h2>
                <p className="text-sm text-gray-600">Ranked by revenue, order frequency & payment reliability</p>
              </div>
              <ExportButton data={topBuyers} filename="top_buyers" title="Top Wholesale Buyers" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Buyer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Business</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Revenue</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Orders</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Order Value</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Payment Reliability</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Outstanding</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topBuyers.map((buyer, index) => (
                    <tr 
                      key={buyer.buyerId} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{buyer.buyerName}</div>
                        <div className="text-sm text-gray-500">{buyer.mobile}</div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{buyer.businessName}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(buyer.totalRevenue)}</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                          {buyer.orderCount}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {formatCurrency(buyer.avgOrderValue)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                buyer.paymentReliability >= 90 ? 'bg-green-500' :
                                buyer.paymentReliability >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${buyer.paymentReliability}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {buyer.paymentReliability}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-semibold ${
                          buyer.totalDue > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(buyer.totalDue)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleBuyerClick(buyer)}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          View Products
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Buyer's Top Products Modal/Section */}
          {selectedBuyer && buyerProducts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Top 5 Products for {selectedBuyer.buyerName}
                  </h2>
                  <p className="text-sm text-gray-600">Most purchased items by this buyer</p>
                </div>
                <button
                  onClick={() => setSelectedBuyer(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="text-xl">×</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {buyerProducts.map((product, index) => (
                  <div key={index} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                    <div className="text-sm text-gray-600 mb-1">#{index + 1}</div>
                    <div className="font-bold text-gray-900 mb-1">
                      {product.design} - {product.color}
                    </div>
                    <div className="text-sm text-gray-700 mb-2">Size: {product.size}</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-600">Quantity</div>
                        <div className="font-bold text-indigo-600">{product.totalQuantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">Revenue</div>
                        <div className="font-bold text-green-600">{formatCurrency(product.totalRevenue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Sales Tab */}
      {activeTab === 'direct' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Direct Sales Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiDollarSign className="text-2xl" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{formatCurrency(directSales.totalAmount)}</div>
              <div className="text-blue-100">Total Direct Sales</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiShoppingCart className="text-2xl" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{directSales.totalTransactions}</div>
              <div className="text-purple-100">Total Transactions</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiTrendingUp className="text-2xl" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-2">{formatCurrency(directSales.avgTransaction)}</div>
              <div className="text-green-100">Average Transaction</div>
            </div>
          </div>
        </div>
      )}

      {/* Combined Metrics Tab */}
      {activeTab === 'combined' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Sales Velocity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sales Velocity by Product</h2>
                <p className="text-sm text-gray-600">Units sold per day across all channels (Last 30 days)</p>
              </div>
              <ExportButton data={salesVelocity} filename="sales_velocity" title="Sales Velocity" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Sold (30d)</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Velocity/Day</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {salesVelocity.slice(0, 20).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-bold text-gray-700">#{index + 1}</span>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">{item.design}</td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {item.color}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {item.size}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {item.totalQuantity}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-lg font-bold text-indigo-600">{item.velocityPerDay}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {parseFloat(item.velocityPerDay) >= 5 ? (
                            <>
                              <FiTrendingUp className="text-green-500" />
                              <span className="text-sm font-medium text-green-600">Fast</span>
                            </>
                          ) : parseFloat(item.velocityPerDay) >= 2 ? (
                            <>
                              <FiBarChart2 className="text-blue-500" />
                              <span className="text-sm font-medium text-blue-600">Good</span>
                            </>
                          ) : (
                            <>
                              <FiTrendingDown className="text-orange-500" />
                              <span className="text-sm font-medium text-orange-600">Slow</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WholesaleDirectAnalytics;
