import { useState, useEffect } from 'react';
import { wholesaleService } from '../services/wholesaleService';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import {
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiDownload,
  FiCreditCard,
  FiCalendar,
  FiPhone,
  FiMail,
  FiBriefcase,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiSend
} from 'react-icons/fi';
import { format } from 'date-fns';

const WholesaleBuyers = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Data states
  const [buyers, setBuyers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDesc');
  
  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  
  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  
  // Credit form
  const [creditForm, setCreditForm] = useState({
    creditLimit: 0,
    reason: ''
  });
  
  // Fetch data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);
  
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [buyersData, statsData] = await Promise.all([
        wholesaleService.getAllBuyers(),
        wholesaleService.getBuyerStats()
      ]);
      
      setBuyers(buyersData);
      setStats(statsData);
    } catch (error) {
      toast.error('Failed to load buyers data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const refreshData = async () => {
    await fetchInitialData();
    toast.success('Data refreshed');
  };
  
  // Filter and sort buyers
  const getFilteredBuyers = () => {
    let filtered = [...buyers];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(buyer =>
        buyer.name.toLowerCase().includes(query) ||
        buyer.mobile.includes(query) ||
        buyer.businessName?.toLowerCase().includes(query) ||
        buyer.email?.toLowerCase().includes(query)
      );
    }
    
    // Payment status filter
    if (paymentStatusFilter === 'pending') {
      filtered = filtered.filter(buyer => buyer.totalDue > 0);
    } else if (paymentStatusFilter === 'paid') {
      filtered = filtered.filter(buyer => buyer.totalDue === 0);
    } else if (paymentStatusFilter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = filtered.filter(buyer => 
        buyer.lastOrderDate && new Date(buyer.lastOrderDate) >= sevenDaysAgo
      );
    }
    
    // Date range filter
    if (dateRangeFilter !== 'all' && dateRangeFilter !== 'custom') {
      const now = new Date();
      let daysAgo = 0;
      
      if (dateRangeFilter === 'today') daysAgo = 0;
      else if (dateRangeFilter === '7days') daysAgo = 7;
      else if (dateRangeFilter === '30days') daysAgo = 30;
      else if (dateRangeFilter === '90days') daysAgo = 90;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      
      filtered = filtered.filter(buyer =>
        buyer.lastOrderDate && new Date(buyer.lastOrderDate) >= cutoffDate
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDesc':
          return b.totalDue - a.totalDue;
        case 'dueAsc':
          return a.totalDue - b.totalDue;
        case 'spentDesc':
          return b.totalSpent - a.totalSpent;
        case 'spentAsc':
          return a.totalSpent - b.totalSpent;
        case 'dateDesc':
          return new Date(b.lastOrderDate || 0) - new Date(a.lastOrderDate || 0);
        case 'dateAsc':
          return new Date(a.lastOrderDate || 0) - new Date(b.lastOrderDate || 0);
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'nameDesc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
    
    return filtered;
  };
  
  // Get credit usage percentage
  const getCreditUsage = (buyer) => {
    if (!buyer.creditLimit || buyer.creditLimit === 0) return 0;
    return Math.min((buyer.totalDue / buyer.creditLimit) * 100, 100);
  };
  
  // Get credit status color
  const getCreditStatusColor = (percentage) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  // Get credit status text
  const getCreditStatusText = (percentage) => {
    if (percentage >= 100) return 'Limit Exceeded!';
    if (percentage >= 80) return 'Credit Alert!';
    return 'Healthy';
  };
  
  // Get card border color based on credit usage
  const getCardBorderColor = (percentage) => {
    if (percentage >= 100) return 'border-l-4 border-red-500';
    if (percentage >= 80) return 'border-l-4 border-orange-500';
    if (percentage >= 60) return 'border-l-4 border-yellow-500';
    return 'border-l-4 border-green-500';
  };
  
  // Format time ago
  const getTimeAgo = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const orderDate = new Date(date);
    const diffMs = now - orderDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return format(orderDate, 'dd MMM yyyy');
  };
  
  // Handle payment preview
  const handlePaymentAmountChange = async (amount) => {
    setPaymentForm({ ...paymentForm, amount });
    
    if (!amount || amount <= 0) {
      setPaymentPreview(null);
      return;
    }
    
    try {
      const preview = await wholesaleService.previewPaymentAllocation(
        selectedBuyer._id,
        parseFloat(amount)
      );
      setPaymentPreview(preview);
    } catch (error) {
      console.error('Preview failed:', error);
      setPaymentPreview(null);
    }
  };
  
  // Open payment modal
  const openPaymentModal = (buyer) => {
    setSelectedBuyer(buyer);
    setPaymentForm({
      amount: '',
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setPaymentPreview(null);
    setShowPaymentModal(true);
  };
  
  // Submit payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await wholesaleService.recordBulkPayment(selectedBuyer._id, {
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes
      });
      
      toast.success(
        `Payment recorded! ₹${result.data.amountAllocated.toLocaleString('en-IN')} allocated to ${result.data.ordersAffected.length} order(s)`
      );
      
      setShowPaymentModal(false);
      await fetchInitialData();
      
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to record payment';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Open payment history modal
  const openHistoryModal = async (buyer) => {
    setSelectedBuyer(buyer);
    setShowHistoryModal(true);
    
    try {
      const history = await wholesaleService.getBulkPaymentHistory(buyer._id);
      setPaymentHistory(history.payments || []);
    } catch (error) {
      toast.error('Failed to load payment history');
      setPaymentHistory([]);
    }
  };
  
  // Delete payment (Admin only)
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure? This will reverse the payment allocation.')) return;
    
    try {
      await wholesaleService.deleteBulkPayment(selectedBuyer._id, paymentId);
      toast.success('Payment deleted successfully');
      
      // Refresh history
      const history = await wholesaleService.getBulkPaymentHistory(selectedBuyer._id);
      setPaymentHistory(history.payments || []);
      
      // Refresh buyer data
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };
  
  // Open credit modal
  const openCreditModal = (buyer) => {
    setSelectedBuyer(buyer);
    setCreditForm({
      creditLimit: buyer.creditLimit || 0,
      reason: ''
    });
    setShowCreditModal(true);
  };
  
  // Update credit limit
  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await wholesaleService.updateBuyerCredit(selectedBuyer._id, creditForm);
      toast.success('Credit limit updated successfully');
      setShowCreditModal(false);
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to update credit limit');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Send credit warning
const handleSendWarning = async (buyer) => {
  // Check if buyer has email
  if (!buyer.email || buyer.email.trim() === '') {
    toast.error('Cannot send reminder. Buyer has no email address.', {
      duration: 4000,
      icon: '📧'
    });
    return;
  }
  
  try {
    await wholesaleService.sendCreditWarning(buyer._id);
    toast.success(`Credit reminder sent to ${buyer.email}`, {
      duration: 3000,
      icon: '✅'
    });
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to send reminder';
    toast.error(errorMsg);
  }
};
  
// Open email update modal
const openEmailUpdateModal = (buyer) => {
  setSelectedBuyer(buyer);
  setEmailForm({
    email: buyer.email || ''
  });
  setShowEmailModal(true);
};

// Update buyer email
const handleEmailSubmit = async (e) => {
  e.preventDefault();
  
  if (isSubmitting) return;
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailForm.email)) {
    toast.error('Please enter a valid email address');
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    await wholesaleService.updateBuyerEmail(selectedBuyer._id, {
      email: emailForm.email
    });
    
    toast.success('Email updated successfully!', {
      icon: '✅'
    });
    
    setShowEmailModal(false);
    await fetchInitialData();
    
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to update email';
    toast.error(errorMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  // Export to CSV
  const handleExportCSV = () => {
    const filtered = getFilteredBuyers();
    
    const headers = ['Name', 'Mobile', 'Business', 'Credit Limit', 'Total Due', 'Total Spent', 'Total Orders'];
    const rows = filtered.map(buyer => [
      buyer.name,
      buyer.mobile,
      buyer.businessName || '-',
      buyer.creditLimit || 0,
      buyer.totalDue || 0,
      buyer.totalSpent || 0,
      buyer.totalOrders || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wholesale-buyers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast.success('CSV exported successfully');
  };
  
  const filteredBuyers = getFilteredBuyers();
  
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiUsers className="text-purple-600" size={32} />
          Wholesale Buyers
        </h1>
        <p className="text-gray-600 mt-1">
          Manage your B2B customers and track payments
        </p>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Buyers */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">Total Buyers</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {stats.totalBuyers.toLocaleString('en-IN')}
                  </p>
                  {stats.totalBuyers > 0 && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <FiTrendingUp size={14} />
                      {stats.buyersWithDue} with pending dues
                    </p>
                  )}
                </div>
                <div className="bg-purple-100 p-4 rounded-2xl group-hover:bg-purple-200 transition-colors duration-300">
                  <FiUsers className="text-purple-600" size={32} />
                </div>
              </div>
            </div>
          </Card>
          
          {/* Total Outstanding */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">Total Outstanding</p>
                  <p className="text-4xl font-bold text-orange-600 mt-2">
                    ₹{(stats.totalOutstanding || 0).toLocaleString('en-IN')}
                  </p>
                  {stats.buyersWithDue > 0 && (
                    <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                      <FiAlertCircle size={14} />
                      {stats.buyersWithDue} buyers
                    </p>
                  )}
                </div>
                <div className="bg-orange-100 p-4 rounded-2xl group-hover:bg-orange-200 transition-colors duration-300">
                  <FiDollarSign className="text-orange-600" size={32} />
                </div>
              </div>
            </div>
          </Card>
          
          {/* Total Revenue */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">Total Revenue</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">
                    ₹{(stats.totalRevenue || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <FiTrendingUp size={14} />
                    All time sales
                  </p>
                </div>
                <div className="bg-green-100 p-4 rounded-2xl group-hover:bg-green-200 transition-colors duration-300">
                  <FiTrendingUp className="text-green-600" size={32} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Filters */}
      <Card className="sticky top-0 z-10 shadow-md">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search buyers by name, mobile, business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 3 Months</option>
              </select>
            </div>
            
            {/* Payment Status */}
            <div className="flex items-center gap-2">
              <FiFilter className="text-gray-400" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              >
                <option value="all">All Buyers</option>
                <option value="pending">Has Pending Dues</option>
                <option value="paid">Fully Paid</option>
                <option value="recent">Recent Activity</option>
              </select>
            </div>
            
            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
            >
              <option value="dueDesc">Total Due (High to Low)</option>
              <option value="dueAsc">Total Due (Low to High)</option>
              <option value="spentDesc">Total Spent (High to Low)</option>
              <option value="spentAsc">Total Spent (Low to High)</option>
              <option value="dateDesc">Last Order (Recent)</option>
              <option value="dateAsc">Last Order (Oldest)</option>
              <option value="nameAsc">Name (A-Z)</option>
              <option value="nameDesc">Name (Z-A)</option>
            </select>
            
            {/* Action Buttons */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
              >
                <FiRefreshCw size={16} />
                Refresh
              </button>
              
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm"
              >
                <FiDownload size={16} />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-900">{filteredBuyers.length}</span> of <span className="font-semibold text-gray-900">{buyers.length}</span> buyers
      </div>
      
      {/* Buyer Cards Grid */}
      {filteredBuyers.length === 0 ? (
        <Card className="text-center py-12">
          <FiUsers className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Buyers Found</h3>
          <p className="text-gray-600">
            {searchQuery || paymentStatusFilter !== 'all' || dateRangeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Buyers will appear here after creating wholesale orders'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBuyers.map((buyer, index) => {
            const creditUsage = getCreditUsage(buyer);
            
            return (
              <Card
                key={buyer._id}
                className={`${getCardBorderColor(creditUsage)} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fadeIn`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Buyer Info */}
                <div className="space-y-3">
                  {/* Name & Contact */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FiUsers className="text-purple-600" />
                      {buyer.name}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <FiPhone size={14} />
                        {buyer.mobile}
                      </div>
                      {buyer.email && (
                        <div className="flex items-center gap-2">
                          <FiMail size={14} />
                          {buyer.email}
                        </div>
                      )}
                      {buyer.businessName && (
                        <div className="flex items-center gap-2">
                          <FiBriefcase size={14} />
                          {buyer.businessName}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Credit Limit Section */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FiCreditCard size={14} />
                        Credit Limit
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{(buyer.creditLimit || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getCreditStatusColor(creditUsage)} transition-all duration-500 ease-out rounded-full`}
                          style={{ width: `${Math.min(creditUsage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-600">
                          Used: ₹{buyer.totalDue.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-semibold ${
                          creditUsage >= 80 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {creditUsage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Credit Status Badge */}
                    {creditUsage >= 80 && (
                      <div className="mt-2">
                        {creditUsage >= 100 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <FiAlertCircle size={12} />
                            Limit Exceeded!
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            <FiAlertCircle size={12} />
                            Credit Alert!
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Total Orders</p>
                      <p className="font-bold text-gray-900">{buyer.totalOrders || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Spent</p>
                      <p className="font-bold text-gray-900">₹{((buyer.totalSpent || 0)).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount Paid</p>
                      <p className="font-bold text-green-600">₹{((buyer.totalPaid || 0)).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Pending</p>
                      <p className="font-bold text-orange-600">₹{((buyer.totalDue || 0)).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {/* Last Order */}
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <FiCalendar size={12} />
                    Last order: {getTimeAgo(buyer.lastOrderDate)}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    {/* Record Payment */}
                    <button
                      onClick={() => openPaymentModal(buyer)}
                      disabled={buyer.totalDue === 0}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      <FiDollarSign size={18} />
                      Record Payment
                    </button>
                    
                    {/* View History */}
                    <button
                      onClick={() => openHistoryModal(buyer)}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <FiEye size={16} />
                      View History
                    </button>
                    
                    {/* Bottom Row: Edit Credit + Send Reminder */}
                    <div className="grid grid-cols-2 gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => openCreditModal(buyer)}
                          className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 text-sm"
                        >
                          <FiEdit2 size={14} />
                          Edit Credit
                        </button>
                      )}
                      {buyer.totalDue > 0 && (
                        <button
                          onClick={() => handleSendWarning(buyer)}
                          className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 text-sm"
                        >
                          <FiSend size={14} />
                          Reminder
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
            {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentPreview(null);
        }}
        title={
          <div className="flex items-center gap-2">
            <FiDollarSign className="text-purple-600" size={24} />
            Record Payment
          </div>
        }
      >
        {selectedBuyer && (
          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            {/* Buyer Info */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-2">{selectedBuyer.name}</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center gap-2">
                  <FiPhone size={14} />
                  {selectedBuyer.mobile}
                </div>
                {selectedBuyer.businessName && (
                  <div className="flex items-center gap-2">
                    <FiBriefcase size={14} />
                    {selectedBuyer.businessName}
                  </div>
                )}
              </div>
            </div>
            
            {/* Total Outstanding */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Outstanding</span>
                <span className="text-2xl font-bold text-orange-600">
                  ₹{selectedBuyer.totalDue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            
            {/* Amount Received */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Received *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => handlePaymentAmountChange(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-semibold"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            
            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
            
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows="2"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Add any additional notes..."
              />
            </div>
            
            {/* Payment Allocation Preview */}
            {paymentPreview && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FiCheckCircle className="text-blue-600" />
                  Payment Allocation Preview
                </h4>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {paymentPreview.allocation.map((alloc, index) => (
                    <div
                      key={alloc.orderId}
                      className={`p-3 rounded-lg ${
                        alloc.status === 'FULLY_PAID'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {alloc.status === 'FULLY_PAID' ? (
                              <FiCheckCircle className="text-green-600" size={16} />
                            ) : (
                              <FiAlertCircle className="text-yellow-600" size={16} />
                            )}
                            Order #{alloc.challanNumber}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {format(new Date(alloc.orderDate), 'dd MMM yyyy')} • {alloc.itemsCount} items
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">Due: ₹{alloc.currentDue.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Allocated: ₹{alloc.amountToAllocate.toLocaleString('en-IN')}
                        </span>
                        {alloc.status === 'FULLY_PAID' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            FULLY PAID
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            Remaining: ₹{alloc.newDue.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="pt-3 border-t border-blue-300 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Orders Affected:</span>
                    <span className="font-semibold text-gray-900">{paymentPreview.allocation.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Amount Received:</span>
                    <span className="font-semibold text-gray-900">₹{paymentPreview.amountReceived.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900">Remaining Due:</span>
                    <span className={paymentPreview.remainingDue > 0 ? 'text-orange-600' : 'text-green-600'}>
                      ₹{paymentPreview.remainingDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  
                  {paymentPreview.excessAmount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 p-2 rounded mt-2">
                      <FiAlertCircle />
                      Excess amount: ₹{paymentPreview.excessAmount.toLocaleString('en-IN')} (All dues cleared!)
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentPreview(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Recording...
                  </>
                ) : (
                  <>
                    <FiCheckCircle size={20} />
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
      
      {/* PAYMENT HISTORY MODAL */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FiEye className="text-blue-600" size={24} />
            Payment History
          </div>
        }
      >
        {selectedBuyer && (
          <div className="space-y-4">
            {/* Buyer Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-900">{selectedBuyer.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Total Payments: ₹{selectedBuyer.totalPaid.toLocaleString('en-IN')} ({paymentHistory.length} transactions)
              </p>
            </div>
            
            {/* Payment List */}
            {paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <FiDollarSign className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-600">No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment._id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Payment Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-600">
                            ₹{payment.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {payment.paymentMethod}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <FiCalendar size={14} />
                          {format(new Date(payment.paymentDate), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      </div>
                      
                      {/* Admin Actions */}
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeletePayment(payment._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Payment"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Recorded By */}
                    <div className="text-xs text-gray-500 mb-3">
                      Recorded by: {payment.recordedBy} ({payment.recordedByRole})
                    </div>
                    
                    {/* Notes */}
                    {payment.notes && (
                      <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-3">
                        {payment.notes}
                      </div>
                    )}
                    
                    {/* Orders Affected */}
                    <div className="border-t border-gray-200 pt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Orders Affected ({payment.ordersAffected.length}):
                      </div>
                      <div className="space-y-1">
                        {payment.ordersAffected.map((order, index) => (
                          <div
                            key={index}
                            className="text-xs bg-gray-50 p-2 rounded flex items-center justify-between"
                          >
                            <span className="font-medium text-gray-900">
                              #{order.challanNumber}
                            </span>
                            <span className="text-gray-600">
                              ₹{order.amountAllocated.toLocaleString('en-IN')}
                              {order.newDue > 0 && (
                                <span className="text-orange-600 ml-2">
                                  (₹{order.newDue.toLocaleString('en-IN')} due)
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Close Button */}
            <div className="pt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* EDIT CREDIT LIMIT MODAL */}
      <Modal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FiCreditCard className="text-purple-600" size={24} />
            Edit Credit Limit
          </div>
        }
      >
        {selectedBuyer && (
          <form onSubmit={handleCreditSubmit} className="space-y-5">
            {/* Buyer Info */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-gray-900">{selectedBuyer.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Current Limit: ₹{(selectedBuyer.creditLimit || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-gray-600">
                Current Due: ₹{selectedBuyer.totalDue.toLocaleString('en-IN')}
              </p>
            </div>
            
            {/* New Credit Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Credit Limit *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  value={creditForm.creditLimit}
                  onChange={(e) => setCreditForm({ ...creditForm, creditLimit: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1000"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-semibold"
                  required
                />
              </div>
            </div>
            
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Change *
              </label>
              <textarea
                value={creditForm.reason}
                onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Enter reason for credit limit change..."
                required
              />
            </div>
            
            {/* Warning if new limit is less than current due */}
            {creditForm.creditLimit < selectedBuyer.totalDue && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <FiAlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Warning:</strong> New credit limit (₹{creditForm.creditLimit.toLocaleString('en-IN')}) is less than current due (₹{selectedBuyer.totalDue.toLocaleString('en-IN')})
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <FiCheckCircle size={20} />
                    Update Limit
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default WholesaleBuyers;
