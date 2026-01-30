import { useState, useEffect } from 'react';
import { wholesaleService } from '../services/wholesaleService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiUsers, FiDollarSign, FiTrendingUp, FiRefreshCw, FiDownload } from 'react-icons/fi';
import BuyerListPanel from '../components/buyers/BuyerListPanel';
import BuyerDetailPanel from '../components/buyers/BuyerDetailPanel';
import PaymentModal from '../components/modals/PaymentModal';
import PaymentHistoryModal from '../components/modals/PaymentHistoryModal';
import MonthlyHistoryModal from '../components/modals/MonthlyHistoryModal';
import ScrollToTop from '../components/common/ScrollToTop';

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDesc');

  // Selected buyer
  const [selectedBuyer, setSelectedBuyer] = useState(null);

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMonthlyHistoryModal, setShowMonthlyHistoryModal] = useState(false);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Monthly history data
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  const [tenants, setTenants] = useState([]);
  const [linkingBuyerId, setLinkingBuyerId] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
  fetchTenants();
}, []);

const fetchTenants = async () => {
  try {
    const tenantsData = await wholesaleService.getTenantUsers();
    console.log('✅ Fetched tenants for linking:', tenantsData);
    setTenants(tenantsData || []);
  } catch (error) {
    console.error('❌ Failed to fetch tenants:', error);
    toast.error('Failed to load customers for linking');
  }
};

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

    // Status filter
    if (statusFilter === 'due') {
      filtered = filtered.filter(buyer => buyer.totalDue > 0);
    } else if (statusFilter === 'clear') {
      filtered = filtered.filter(buyer => buyer.totalDue === 0);
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let daysAgo = 0;
      if (timeFilter === 'today') daysAgo = 0;
      else if (timeFilter === '7days') daysAgo = 7;
      else if (timeFilter === '30days') daysAgo = 30;

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
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'dateDesc':
          return new Date(b.lastOrderDate || 0) - new Date(a.lastOrderDate || 0);
        default:
          return 0;
      }
    });

    return filtered;
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
      paymentMethod: 'Bank Transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setPaymentPreview(null);
    setShowPaymentModal(true);
  };

  // Handle payment submit
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await wholesaleService.recordSmartPayment(selectedBuyer._id, {
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes
      });

      if (result.data.billsAffected) {
        toast.success(
          `₹${result.data.amountAllocated.toLocaleString('en-IN')} allocated to ${result.data.billsAffected.length} bill(s)`
        );
      } else {
        toast.success(
          `₹${result.data.amountAllocated.toLocaleString('en-IN')} allocated to ${result.data.ordersAffected.length} order(s)`
        );
      }

      setShowPaymentModal(false);
      await fetchInitialData();
      
      // Update selected buyer
      const updatedBuyers = await wholesaleService.getAllBuyers();
      const updatedBuyer = updatedBuyers.find(b => b._id === selectedBuyer._id);
      if (updatedBuyer) {
        setSelectedBuyer(updatedBuyer);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to record payment';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

const handleLinkToTenant = async (buyerId, tenantId) => {
  try {
    const result = await wholesaleService.linkBuyerToTenant(buyerId, tenantId || null);
    if (result.success) {
      toast.success(result.message || (tenantId ? '✅ Buyer linked successfully!' : 'Buyer unlinked'));
      await fetchInitialData(); // Refresh buyers
      setShowLinkModal(false);
      setLinkingBuyerId(null);
      setSelectedTenantId('');
    } else {
      toast.error(result.message || 'Failed to link buyer');
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to link buyer';
    toast.error(errorMsg);
    console.error('Link error:', error);
  }
};

const openLinkModal = (buyer) => {
  setLinkingBuyerId(buyer._id);
  setSelectedTenantId(buyer.customerTenantId || '');
  setShowLinkModal(true);
};

  // Open payment history modal
  const openHistoryModal = async (buyer) => {
    setShowHistoryModal(true);
    try {
      const history = await wholesaleService.getBulkPaymentHistory(buyer._id);
      setPaymentHistory(history.payments || []);
    } catch (error) {
      toast.error('Failed to load payment history');
      setPaymentHistory([]);
    }
  };

  // Open monthly history modal
  const openMonthlyHistoryModal = async (buyer) => {
    setShowMonthlyHistoryModal(true);
    try {
      const history = await wholesaleService.getBuyerMonthlyHistory(buyer._id);
      setMonthlyHistory(history.monthlyData || []);
    } catch (error) {
      toast.error('Failed to load monthly history');
      setMonthlyHistory([]);
    }
  };

  // Send reminder
  const handleSendReminder = async (buyer) => {
    if (!buyer.email || buyer.email.trim() === '') {
      toast.error('Cannot send reminder. Buyer has no email address.', {
        duration: 4000,
        icon: '📧'
      });
      return;
    }

    try {
      await wholesaleService.sendCreditWarning(buyer._id);
      toast.success(`Reminder sent to ${buyer.email}`, {
        duration: 3000,
        icon: '✅'
      });
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to send reminder';
      toast.error(errorMsg);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const filtered = getFilteredBuyers();
    const headers = ['Name', 'Mobile', 'Business', 'Total Due', 'Total Spent', 'Total Orders'];
    const rows = filtered.map(buyer => [
      buyer.name,
      buyer.mobile,
      buyer.businessName || '-',
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
    a.download = `wholesale-buyers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported successfully');
  };

  const filteredBuyers = getFilteredBuyers();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-12 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Wholesale Buyers</h1>
              <p className="text-gray-600">Manage your B2B customers and track payments</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshData}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <FiRefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FiDownload className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-[1440px] mx-auto px-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-2">Total Buyers</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">
                  {stats?.totalBuyers || 0}
                </p>
                <p className="text-sm text-gray-600">
                  {stats?.buyersWithDue || 0} with pending dues
                </p>
              </div>
              <div className="p-4 bg-blue-500 rounded-xl">
                <FiUsers className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 uppercase tracking-wide mb-2">Outstanding</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">
                  ₹{(stats?.totalOutstanding || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-gray-600">
                  {stats?.buyersWithDue || 0} buyers
                </p>
              </div>
              <div className="p-4 bg-red-500 rounded-xl">
                <FiDollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 uppercase tracking-wide mb-2">Revenue</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">
                  ₹{(stats?.totalRevenue || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-gray-600">All time sales</p>
              </div>
              <div className="p-4 bg-green-500 rounded-xl">
                <FiTrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel - Buyer List */}
          <div className="lg:col-span-7">
            <BuyerListPanel
              buyers={filteredBuyers}
              selectedBuyer={selectedBuyer}
              onSelectBuyer={setSelectedBuyer}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          </div>

          {/* Right Panel - Buyer Details */}
          <div className="lg:col-span-5">
            <BuyerDetailPanel
              buyer={selectedBuyer}
              onRecordPayment={openPaymentModal}
              onViewHistory={openHistoryModal}
              onViewMonthlyHistory={openMonthlyHistoryModal}
              onSendReminder={handleSendReminder}
              onLinkToTenant={openLinkModal}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        selectedBuyer={selectedBuyer}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        paymentPreview={paymentPreview}
        handlePaymentAmountChange={handlePaymentAmountChange}
        handlePaymentSubmit={handlePaymentSubmit}
        isSubmitting={isSubmitting}
      />

      <PaymentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        selectedBuyer={selectedBuyer}
        paymentHistory={paymentHistory}
        fetchInitialData={fetchInitialData}
        setPaymentHistory={setPaymentHistory}
      />

      <MonthlyHistoryModal
        isOpen={showMonthlyHistoryModal}
        onClose={() => setShowMonthlyHistoryModal(false)}
        selectedBuyer={selectedBuyer}
        monthlyHistory={monthlyHistory}
      />

      {/* ✅ UPDATED: Link to Tenant Modal with Phone Matching */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">🔗 Link Buyer to Customer Account</h3>
            
            {/* Buyer Info Display */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-1">
                <strong>Buyer:</strong> {buyers.find(b => b._id === linkingBuyerId)?.name || 'Unknown'}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Mobile:</strong> {buyers.find(b => b._id === linkingBuyerId)?.mobile || 'N/A'}
              </p>
            </div>

            {/* Customer Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer Account (Phone must match)
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Customer --</option>
                {(() => {
                  const currentBuyer = buyers.find(b => b._id === linkingBuyerId);
                  const buyerPhone = currentBuyer?.mobile?.replace(/\D/g, '') || '';
                  
                  // ✅ Filter tenants by matching phone number
                  const matchingTenants = tenants.filter(tenant => {
                    const tenantPhone = (tenant.phone || '').replace(/\D/g, '');
                    return tenantPhone === buyerPhone;
                  });

                  if (matchingTenants.length === 0) {
                    return (
                      <option value="" disabled>
                        No customers found with phone {currentBuyer?.mobile}
                      </option>
                    );
                  }

                  return matchingTenants.map(tenant => (
                    <option key={tenant._id} value={tenant._id}>
                      {tenant.name} ({tenant.phone}) {tenant.companyName ? `- ${tenant.companyName}` : ''}
                    </option>
                  ));
                })()}
              </select>
              
              {/* ✅ Helper Text */}
              {(() => {
                const currentBuyer = buyers.find(b => b._id === linkingBuyerId);
                const buyerPhone = currentBuyer?.mobile?.replace(/\D/g, '') || '';
                const matchingCount = tenants.filter(t => 
                  (t.phone || '').replace(/\D/g, '') === buyerPhone
                ).length;

                if (matchingCount === 0) {
                  return (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        ⚠️ <strong>No customer accounts found</strong> with phone <strong>{currentBuyer?.mobile}</strong>.
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        Customer must register with this exact mobile number first.
                      </p>
                    </div>
                  );
                }

                return (
                  <p className="mt-2 text-sm text-green-600">
                    ✅ {matchingCount} customer account{matchingCount > 1 ? 's' : ''} found with matching phone
                  </p>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleLinkToTenant(linkingBuyerId, selectedTenantId)}
                disabled={!selectedTenantId}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {selectedTenantId ? '✅ Link Customer' : 'Select Customer'}
              </button>
              
              {/* Unlink Button (if already linked) */}
              {buyers.find(b => b._id === linkingBuyerId)?.customerTenantId && (
                <button
                  onClick={() => handleLinkToTenant(linkingBuyerId, null)}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
                >
                  🔓 Unlink
                </button>
              )}
              
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkingBuyerId(null);
                  setSelectedTenantId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ScrollToTop />
      
    </div>
  );
};

export default WholesaleBuyers;
