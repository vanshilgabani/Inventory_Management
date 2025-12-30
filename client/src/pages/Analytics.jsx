import { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import {
  FiTrendingUp,
  FiAward,
  FiBarChart2,
  FiPieChart,
  FiShoppingCart,
  FiShoppingBag,
  FiUsers,
} from 'react-icons/fi';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Analytics = () => {
  const [salesByChannel, setSalesByChannel] = useState(null);
  const [bestSelling, setBestSelling] = useState([]);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [channelData, bestSellingData, trendsData] = await Promise.all([
        analyticsService.getSalesByChannel(),
        analyticsService.getBestSellingDesigns(),
        analyticsService.getRevenueTrends()
      ]);
      setSalesByChannel(channelData);
      setBestSelling(bestSellingData);
      setRevenueTrends(trendsData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₹0';
    return `₹${Number(value).toLocaleString('en-IN')}`;
  };

  // Safe access to data
  const marketplaceRevenue = salesByChannel?.marketplace?.revenue || 0;
  const marketplaceCount = salesByChannel?.marketplace?.count || 0;
  
  const wholesaleRevenue = salesByChannel?.wholesale?.revenue || 0;
  const wholesaleCount = salesByChannel?.wholesale?.count || 0;
  
  const directRevenue = salesByChannel?.direct?.revenue || 0;
  const directCount = salesByChannel?.direct?.count || 0;

  // Prepare pie chart data
  const pieData = [
    { name: 'Marketplace', value: marketplaceRevenue },
    { name: 'Wholesale', value: wholesaleRevenue },
    { name: 'Direct Sales', value: directRevenue },
  ].filter(item => item.value > 0);

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];

  // ✅ CUSTOM PERCENTAGE LABEL
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) return <div className="p-6"><Loader /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FiBarChart2 /> Analytics Dashboard
          </h1>
          <p className="text-gray-500">View your sales performance and trends</p>
        </div>
      </div>

      {/* 3 Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-blue-500">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                    <FiShoppingBag className="text-2xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Marketplace Sales</p>
                    <h3 className="text-2xl font-bold text-gray-800">{marketplaceCount}</h3>
                    <p className="text-sm font-semibold text-green-600">
                        {formatCurrency(marketplaceRevenue)}
                    </p>
                </div>
            </div>
        </Card>

        <Card className="border-l-4 border-purple-500">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <FiUsers className="text-2xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Wholesale Orders</p>
                    <h3 className="text-2xl font-bold text-gray-800">{wholesaleCount}</h3>
                    <p className="text-sm font-semibold text-green-600">
                        {formatCurrency(wholesaleRevenue)}
                    </p>
                </div>
            </div>
        </Card>

        <Card className="border-l-4 border-green-500">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <FiShoppingCart className="text-2xl" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Direct Sales</p>
                    <h3 className="text-2xl font-bold text-gray-800">{directCount}</h3>
                    <p className="text-sm font-semibold text-green-600">
                        {formatCurrency(directRevenue)}
                    </p>
                </div>
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 rounded text-blue-600"><FiPieChart /></div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Revenue by Channel</h3>
                    <p className="text-xs text-gray-500">Distribution across sales channels</p>
                </div>
            </div>
            {/* ✅ FIXED HEIGHT CONTAINER */}
            <div className="w-full h-[300px]"> 
                {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel} // ✅ Using custom label
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        No revenue data available
                    </div>
                )}
            </div>
        </Card>

        {/* Bar Chart */}
        <Card>
             <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-green-50 rounded text-green-600"><FiTrendingUp /></div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Revenue Trends</h3>
                    <p className="text-xs text-gray-500">Monthly overview (Last 12 months)</p>
                </div>
            </div>
            {/* ✅ FIXED HEIGHT CONTAINER */}
            <div className="w-full h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#9ca3af'}}
                            tickFormatter={(val) => `₹${val/1000}k`} 
                        />
                        <Tooltip 
                            cursor={{fill: '#f3f4f6'}}
                            formatter={(value) => [formatCurrency(value), 'Revenue']}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
      </div>

      {/* Best Selling Table */}
      <Card>
        <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-orange-50 rounded text-orange-600"><FiAward /></div>
            <div>
                <h3 className="text-lg font-bold text-gray-800">Best Selling Products</h3>
                <p className="text-xs text-gray-500">Ranked by total units sold</p>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b bg-gray-50">
                        <th className="p-3 text-xs font-semibold text-gray-500 uppercase">Rank</th>
                        <th className="p-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                        <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-right">Units Sold</th>
                        <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-right">Est. Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    {bestSelling.length > 0 ? bestSelling.map((item, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="p-3">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                    index === 1 ? 'bg-gray-100 text-gray-700' : 
                                    index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'
                                }`}>
                                    {index + 1}
                                </span>
                            </td>
                            <td className="p-3">
                                <div className="font-medium text-gray-800">{item.design}</div>
                                <div className="text-xs text-gray-500">{item.color}</div>
                            </td>
                            <td className="p-3 text-right font-bold text-gray-700">{item.quantity}</td>
                            <td className="p-3 text-right text-gray-600">{formatCurrency(item.revenue)}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-400">No sales data available yet</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
