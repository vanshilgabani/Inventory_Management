import { useState, useEffect } from 'react';
import { directSalesService } from '../services/directSalesService';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import { 
  FiUsers, 
  FiPhone, 
  FiMail, 
  FiDollarSign, 
  FiShoppingBag,
  FiSearch,
  FiAward,
  FiCalendar,
  FiTrendingUp,
} from 'react-icons/fi';
import { format } from 'date-fns';
import ScrollToTop from '../components/common/ScrollToTop';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const salesData = await directSalesService.getAllDirectSales();
      setSales(salesData);
      
      // Extract and calculate customer data from sales
      const customersMap = new Map();
      
      salesData.forEach(sale => {
        const mobile = sale.customerMobile;
        
        if (!customersMap.has(mobile)) {
          customersMap.set(mobile, {
            _id: mobile, // Use mobile as unique ID
            name: sale.customerName,
            mobile: sale.customerMobile,
            email: sale.customerEmail || '',
            address: sale.customerAddress || '',
            totalPurchases: 0,
            totalSpent: 0,
            firstPurchaseDate: sale.saleDate,
            lastPurchaseDate: sale.saleDate,
          });
        }
        
        const customer = customersMap.get(mobile);
        customer.totalPurchases += 1;
        customer.totalSpent += sale.totalAmount || 0;
        
        const saleDate = new Date(sale.saleDate);
        const firstDate = new Date(customer.firstPurchaseDate);
        const lastDate = new Date(customer.lastPurchaseDate);
        
        if (saleDate < firstDate) customer.firstPurchaseDate = sale.saleDate;
        if (saleDate > lastDate) customer.lastPurchaseDate = sale.saleDate;
      });
      
      setCustomers(Array.from(customersMap.values()));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting
  const getFilteredCustomers = () => {
    let filtered = [...customers];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.mobile.includes(searchTerm)
      );
    }

    // Sort
    if (sortBy === 'spending') {
      filtered.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'orders') {
      filtered.sort((a, b) => b.totalPurchases - a.totalPurchases);
    } else {
      // Recent (by last purchase date)
      filtered.sort((a, b) => new Date(b.lastPurchaseDate) - new Date(a.lastPurchaseDate));
    }

    return filtered;
  };

  const filteredCustomers = getFilteredCustomers();

  // Calculate stats
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top 5 customers
  const topCustomers = [...customers]
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 5);

  const formatCurrency = (amount) => {
    return '₹' + (amount || 0).toLocaleString('en-IN');
  };

  const getCustomerTier = (totalSpent) => {
    if (totalSpent >= 50000) {
      return { name: 'Platinum', color: 'bg-purple-100 text-purple-700 border-purple-300' };
    } else if (totalSpent >= 20000) {
      return { name: 'Gold', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    } else if (totalSpent >= 10000) {
      return { name: 'Silver', color: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
    return { name: 'Bronze', color: 'bg-orange-100 text-orange-700 border-orange-300' };
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiUsers className="text-blue-500" />
          Customer Management
        </h1>
        <p className="text-gray-500 mt-1">Track and manage your customer database</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiUsers className="text-2xl text-blue-500" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Customers</div>
                <div className="text-2xl font-bold text-gray-900">{customers.length}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FiDollarSign className="text-2xl text-green-500" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FiShoppingBag className="text-2xl text-purple-500" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Orders</div>
                <div className="text-2xl font-bold text-gray-900">{totalOrders}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="text-2xl text-orange-500" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg Order Value</div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(avgOrderValue)}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top 5 Customers */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FiAward className="text-yellow-500 text-2xl" />
            <h2 className="text-xl font-bold text-gray-900">Top 5 Customers</h2>
          </div>
          {topCustomers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No customers yet</div>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div key={customer._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-400' :
                      'bg-blue-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <FiPhone className="text-xs" />
                        {customer.mobile}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{formatCurrency(customer.totalSpent)}</div>
                    <div className="text-sm text-gray-500">{customer.totalPurchases} orders</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Search and Sort */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="recent">Most Recent</option>
              <option value="spending">Top Spending</option>
              <option value="orders">Most Orders</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Customers List */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            All Customers ({filteredCustomers.length})
          </h2>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FiUsers className="text-6xl mx-auto mb-4 text-gray-300" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((customer) => {
                const tier = getCustomerTier(customer.totalSpent || 0);

                return (
                  <div
                    key={customer._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white"
                  >
                    {/* Customer Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-xl">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border mt-1 ${tier.color}`}>
                            {tier.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FiPhone className="text-gray-400" />
                        <span>{customer.mobile}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FiMail className="text-gray-400" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Total Orders</div>
                        <div className="text-lg font-bold text-purple-600">{customer.totalPurchases || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Total Spent</div>
                        <div className="text-lg font-bold text-green-600">{formatCurrency(customer.totalSpent)}</div>
                      </div>
                    </div>

                    {/* Last Purchase */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-500">
                          <FiCalendar className="text-gray-400" />
                          <span>Last Purchase</span>
                        </div>
                        <div className="font-medium text-gray-900">
                          {customer.lastPurchaseDate 
                            ? format(new Date(customer.lastPurchaseDate), 'dd MMM yyyy') 
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <ScrollToTop />
      
    </div>
  );
};

export default Customers;
