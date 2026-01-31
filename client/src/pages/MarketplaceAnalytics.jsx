import { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import TimeRangeSelector from '../components/Analytics/TimeRangeSelector';
import ExportButton from '../components/Analytics/ExportButton';
import toast from 'react-hot-toast';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiPackage,
  FiDollarSign,
  FiBarChart2,
  FiPieChart
} from 'react-icons/fi';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const MarketplaceAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  // Data States
  const [accountStats, setAccountStats] = useState([]);
  const [returnRateData, setReturnRateData] = useState([]);
  const [bestSelling, setBestSelling] = useState([]);
  const [stockRecommendations, setStockRecommendations] = useState([]);
  const [colorDistribution, setColorDistribution] = useState([]);
  const [sizeDistribution, setSizeDistribution] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [turnoverRate, setTurnoverRate] = useState([]);
  const [stockValue, setStockValue] = useState({ main: {}, reserved: {}, total: {} });
  const [reorderPoints, setReorderPoints] = useState([]);
  const [growthMetrics, setGrowthMetrics] = useState(null);

  // Filters
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };

      const [
        accountData,
        returnData,
        bestSellingData,
        recommendationsData,
        colorSizeData,
        stockLevelsData,
        turnoverData,
        stockValueData,
        reorderData,
        growthData
      ] = await Promise.all([
        analyticsService.getMarketplaceAccountStats(params),
        analyticsService.getReturnRateByProduct(),
        analyticsService.getBestSellingMarketplaceProducts({ ...params, limit: 20 }),
        analyticsService.getStockRecommendations(30),
        analyticsService.getColorSizeDistribution(90),
        analyticsService.getCurrentStockLevels({ lowStockOnly: false }),
        analyticsService.getStockTurnoverRate(90),
        analyticsService.getStockValueByType(),
        analyticsService.getOptimalReorderPoints({ days: 60, leadTime: 7 }),
        analyticsService.getGrowthMetrics()
      ]);

      setAccountStats(accountData.data || []);
      setReturnRateData(returnData.data || []);
      setBestSelling(bestSellingData.data || []);
      setStockRecommendations(recommendationsData.data || []);
      setColorDistribution(colorSizeData.data?.colorDistribution || []);
      setSizeDistribution(colorSizeData.data?.sizeDistribution || []);
      setStockLevels(stockLevelsData.data || []);
      setTurnoverRate(turnoverData.data || []);
      setStockValue(stockValueData.data || { main: {}, reserved: {}, total: {} });
      setReorderPoints(reorderData.data || []);
      setGrowthMetrics(growthData.data || null);
    } catch (error) {
      console.error('Error fetching marketplace analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6', '#f97316'];

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketplace Sales Analytics</h1>
        <p className="text-gray-600">Insights from your marketplace channels and inventory intelligence</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <TimeRangeSelector onRangeChange={setDateRange} />
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Channel Performance
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Product Performance
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Inventory Intelligence
        </button>
        <button
          onClick={() => setActiveTab('growth')}
          className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'growth'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Growth Metrics
        </button>
      </div>

      {/* Channel Performance Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Account Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accountStats.map((account, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{account.accountName}</h3>
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <FiPackage className="text-indigo-600 text-xl" />
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Order Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Orders</span>
                    <span className="text-xl font-bold text-gray-900">{account.orderCount}</span>
                  </div>

                  {/* Settlement */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Total Settlement</span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(account.totalSettlement)}</span>
                  </div>

                  {/* Status Distribution */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-600 mb-2">Status Distribution</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <FiCheckCircle className="text-green-500" />
                        <span className="text-sm text-gray-700">
                          Dispatched: <span className="font-semibold">{account.dispatchedCount}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiXCircle className="text-red-500" />
                        <span className="text-sm text-gray-700">
                          Returned: <span className="font-semibold">{account.returnedCount}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiAlertTriangle className="text-orange-500" />
                        <span className="text-sm text-gray-700">
                          Wrong Return: <span className="font-semibold">{account.wrongReturnCount}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiXCircle className="text-gray-500" />
                        <span className="text-sm text-gray-700">
                          Cancelled: <span className="font-semibold">{account.cancelledCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Return Rate Indicator */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Issue Rate</span>
                      <span className="text-sm font-semibold text-gray-700">
                        {(((account.returnedCount + account.wrongReturnCount + account.cancelledCount) / account.orderCount) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          (((account.returnedCount + account.wrongReturnCount + account.cancelledCount) / account.orderCount) * 100) < 10 
                            ? 'bg-green-500' 
                            : (((account.returnedCount + account.wrongReturnCount + account.cancelledCount) / account.orderCount) * 100) < 20
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${(((account.returnedCount + account.wrongReturnCount + account.cancelledCount) / account.orderCount) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Return Rate by Product */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Return Rate by Product & Account</h2>
                <p className="text-sm text-gray-600">Includes returns, wrong returns, and cancellations</p>
              </div>
              <ExportButton data={returnRateData} filename="return_rates" title="Return Rate Analysis" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Account</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Orders</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Successful</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Returned</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Wrong Return</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Cancelled</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Issue Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {returnRateData.slice(0, 20).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-gray-900">{item.design}</td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {item.color}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{item.accountName}</td>
                      <td className="py-4 px-4 text-center font-semibold text-gray-900">{item.totalOrders}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-green-600 font-medium">{item.successfulCount}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-red-600 font-medium">{item.returnedCount}</span>
                          <span className="text-xs text-gray-500">({item.returnRate}%)</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-orange-600 font-medium">{item.wrongReturnCount}</span>
                          <span className="text-xs text-gray-500">({item.wrongReturnRate}%)</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-600 font-medium">{item.cancelledCount}</span>
                          <span className="text-xs text-gray-500">({item.cancellationRate}%)</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-lg font-bold ${
                            item.totalIssueRate < 10 ? 'text-green-600' :
                            item.totalIssueRate < 20 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.totalIssueRate}%
                          </span>
                          {item.totalIssueRate >= 20 && <FiAlertTriangle className="text-red-500" />}
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

      {/* Product Performance Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Best Selling Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Best Selling Products (Top 20)</h2>
                <p className="text-sm text-gray-600">Ranked by total quantity sold</p>
              </div>
              <ExportButton data={bestSelling} filename="best_selling_marketplace" title="Best Selling Products" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {bestSelling.slice(0, 8).map((product, index) => (
                <div key={index} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-indigo-600">#{index + 1}</span>
                    <FiTrendingUp className="text-green-500" />
                  </div>
                  <div className="font-bold text-gray-900 mb-1">{product.design}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-white text-xs rounded-full text-gray-700">{product.color}</span>
                    <span className="px-2 py-1 bg-white text-xs rounded-full text-gray-700">{product.size}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600">Quantity</div>
                      <div className="text-xl font-bold text-indigo-600">{product.totalQuantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">Orders</div>
                      <div className="text-xl font-bold text-purple-600">{product.orderCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Full Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Design</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Quantity</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Order Count</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg per Order</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSelling.map((product, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">{product.design}</td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {product.color}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {product.size}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-lg font-bold text-indigo-600">{product.totalQuantity}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-700">
                        {product.orderCount}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {(product.totalQuantity / product.orderCount).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Recommendations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Recommendations</h2>
                <p className="text-sm text-gray-600">Suggested reorder quantities based on sales velocity</p>
              </div>
              <ExportButton 
                data={stockRecommendations.filter(r => r.shouldReorder)} 
                filename="stock_recommendations" 
                title="Stock Recommendations" 
              />
            </div>

            {/* Priority Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiAlertTriangle className="text-red-500 text-xl" />
                  <span className="font-semibold text-red-700">High Priority</span>
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {stockRecommendations.filter(r => r.priority === 'High').length}
                </div>
                <div className="text-sm text-red-600">Stock out in &lt; 7 days</div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiAlertTriangle className="text-yellow-500 text-xl" />
                  <span className="font-semibold text-yellow-700">Medium Priority</span>
                </div>
                <div className="text-3xl font-bold text-yellow-600">
                  {stockRecommendations.filter(r => r.priority === 'Medium').length}
                </div>
                <div className="text-sm text-yellow-600">Stock out in 7-15 days</div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiCheckCircle className="text-green-500 text-xl" />
                  <span className="font-semibold text-green-700">Low Priority</span>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {stockRecommendations.filter(r => r.priority === 'Low').length}
                </div>
                <div className="text-sm text-green-600">Stock out in &gt; 15 days</div>
              </div>
            </div>

            {/* Recommendations Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Priority</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Current Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Daily Velocity</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Days Until Stockout</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Recommended Order</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRecommendations.filter(r => r.shouldReorder).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.priority === 'High' ? 'bg-red-100 text-red-700' :
                          item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.priority}
                        </span>
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
                      <td className="py-4 px-4 text-right">
                        <div className="text-sm text-gray-600">Main: {item.currentMainStock}</div>
                        <div className="text-sm text-gray-600">Reserved: {item.currentReservedStock}</div>
                        <div className="font-semibold text-gray-900">Total: {item.totalCurrentStock}</div>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-indigo-600">
                        {item.dailyVelocity}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-bold ${
                          item.daysUntilStockout < 7 ? 'text-red-600' :
                          item.daysUntilStockout < 15 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {item.daysUntilStockout} days
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-lg font-bold text-green-600">
                          {item.recommendedOrderQty}
                        </span>
                        <div className="text-xs text-gray-500">(45 days stock)</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Intelligence Tab - Continue in next message */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Stock Value Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiPackage className="text-2xl" />
                </div>
                <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Main</span>
              </div>
              <div className="text-3xl font-bold mb-2">{formatCurrency(stockValue.main.value)}</div>
              <div className="text-blue-100">{stockValue.main.quantity} units</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiPackage className="text-2xl" />
                </div>
                <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Reserved</span>
              </div>
              <div className="text-3xl font-bold mb-2">{formatCurrency(stockValue.reserved.value)}</div>
              <div className="text-purple-100">{stockValue.reserved.quantity} units</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiDollarSign className="text-2xl" />
                </div>
                <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Total</span>
              </div>
              <div className="text-3xl font-bold mb-2">{formatCurrency(stockValue.total.value)}</div>
              <div className="text-green-100">{stockValue.total.quantity} units</div>
            </div>
          </div>

          {/* Color & Size Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Color Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Color Distribution (Last 90 days)</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={colorDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ color, percentage }) => `${color} (${percentage}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="quantity"
                    >
                      {colorDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} units`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {colorDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm text-gray-700">
                      {item.color}: <span className="font-semibold">{item.quantity}</span> ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Size Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Size Distribution (Last 90 days)</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sizeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="size" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => `${value} units`}
                    />
                    <Bar dataKey="quantity" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {sizeDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">{item.size}</span>
                    <span className="text-sm text-gray-600">
                      {item.quantity} <span className="text-xs">({item.percentage}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stock Turnover Rate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Turnover Rate</h2>
                <p className="text-sm text-gray-600">How quickly products are selling (Last 90 days)</p>
              </div>
              <ExportButton data={turnoverRate} filename="stock_turnover" title="Stock Turnover Rate" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Sold</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Current Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Turnover Rate</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Days to Sell</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {turnoverRate.slice(0, 20).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
                      <td className="py-4 px-4 text-right font-medium text-gray-700">{item.quantitySold}</td>
                      <td className="py-4 px-4 text-right font-medium text-gray-700">{item.currentStock}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-lg font-bold text-indigo-600">{item.turnoverRate}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-700">
                        {item.daysToSell || 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'Fast Moving' ? 'bg-green-100 text-green-700' :
                          item.status === 'Average' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optimal Reorder Points */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Optimal Reorder Points</h2>
                <p className="text-sm text-gray-600">Recommended reorder thresholds based on historical data</p>
              </div>
              <ExportButton data={reorderPoints} filename="optimal_reorder_points" title="Optimal Reorder Points" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Color</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Current Point</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Optimal Point</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Daily Sales</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Difference</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderPoints.slice(0, 15).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
                      <td className="py-4 px-4 text-right font-medium text-gray-700">
                        {item.currentReorderPoint}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-lg font-bold text-green-600">
                          {item.optimalReorderPoint}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        {item.avgDailySales}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-semibold ${
                          item.difference > 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {item.difference !== 0 && (
                          <span className="text-sm text-indigo-600 font-medium">
                            Update needed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Low Stock Alerts</h2>
                <p className="text-sm text-gray-600">Products below reorder point</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockLevels.filter(s => s.isLowStock).slice(0, 12).map((item, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-gray-900">{item.design}</div>
                    <FiAlertTriangle className="text-red-500" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-white text-xs rounded-full text-gray-700">{item.color}</span>
                    <span className="px-2 py-1 bg-white text-xs rounded-full text-gray-700">{item.size}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Main:</span>
                      <span className="font-semibold text-gray-900">{item.mainStock}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Reserved:</span>
                      <span className="font-semibold text-gray-900">{item.reservedStock}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-red-200">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-red-600">{item.totalStock}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Reorder at:</span>
                      <span className="font-semibold text-gray-700">{item.reorderPoint}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Growth Metrics Tab */}
      {activeTab === 'growth' && growthMetrics && (
        <div className="space-y-6 animate-fadeIn">
          {/* MoM & YoY Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Month over Month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Month-over-Month Growth</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Current Month</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(growthMetrics.monthOverMonth.current)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Previous Month</span>
                  <span className="text-xl font-semibold text-gray-700">
                    {formatCurrency(growthMetrics.monthOverMonth.previous)}
                  </span>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Growth Rate</span>
                    <div className="flex items-center gap-2">
                      {growthMetrics.monthOverMonth.isPositive ? (
                        <FiTrendingUp className="text-green-500 text-xl" />
                      ) : (
                        <FiTrendingDown className="text-red-500 text-xl" />
                      )}
                      <span className={`text-3xl font-bold ${
                        growthMetrics.monthOverMonth.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {growthMetrics.monthOverMonth.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Year over Year */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Year-over-Year Growth</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">This Year (MTD)</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(growthMetrics.yearOverYear.current)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Year (Same Period)</span>
                  <span className="text-xl font-semibold text-gray-700">
                    {formatCurrency(growthMetrics.yearOverYear.lastYear)}
                  </span>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Growth Rate</span>
                    <div className="flex items-center gap-2">
                      {growthMetrics.yearOverYear.isPositive ? (
                        <FiTrendingUp className="text-green-500 text-xl" />
                      ) : (
                        <FiTrendingDown className="text-red-500 text-xl" />
                      )}
                      <span className={`text-3xl font-bold ${
                        growthMetrics.yearOverYear.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {growthMetrics.yearOverYear.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quarterly Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Quarterly Revenue Trends</h2>
                <p className="text-sm text-gray-600">Last 4 quarters performance</p>
              </div>
              <ExportButton data={growthMetrics.quarterlyTrends} filename="quarterly_trends" title="Quarterly Trends" />
            </div>

            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthMetrics.quarterlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="quarter" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quarterly Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {growthMetrics.quarterlyTrends.map((quarter, index) => (
                <div key={index} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                  <div className="text-sm font-semibold text-indigo-600 mb-2">{quarter.quarter}</div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(quarter.revenue)}
                  </div>
                  {index > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      {quarter.revenue >= growthMetrics.quarterlyTrends[index - 1].revenue ? (
                        <>
                          <FiTrendingUp className="text-green-500" />
                          <span className="text-green-600 font-medium">
                            +{(((quarter.revenue - growthMetrics.quarterlyTrends[index - 1].revenue) / 
                            growthMetrics.quarterlyTrends[index - 1].revenue) * 100).toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <FiTrendingDown className="text-red-500" />
                          <span className="text-red-600 font-medium">
                            {(((quarter.revenue - growthMetrics.quarterlyTrends[index - 1].revenue) / 
                            growthMetrics.quarterlyTrends[index - 1].revenue) * 100).toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Forecast */}
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold mb-2">Next Quarter Forecast</h3>
                <p className="text-purple-100">Based on historical trends</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <FiBarChart2 className="text-3xl" />
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">{formatCurrency(growthMetrics.forecast.nextQuarter)}</div>
            <div className="flex items-center gap-2">
              <span className="text-purple-100">Confidence Level:</span>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold">
                {growthMetrics.forecast.confidence}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceAnalytics;
