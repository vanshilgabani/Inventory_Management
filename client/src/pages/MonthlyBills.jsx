import { useState, useEffect } from 'react';
import { monthlyBillService } from '../services/monthlyBillService';
import { wholesaleService } from '../services/wholesaleService';
import { settingsService } from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { generateMonthlyBillPDF, sendMonthlyBillViaWhatsApp } from '../components/MonthlyBillPDFGenerator';
import {
  FiFileText,
  FiDollarSign,
  FiTrendingUp,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiDownload,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiMail,
  FiEye,
  FiEdit,
  FiTrash2,
  FiCheck,
  FiPlus,
  FiMessageCircle
} from 'react-icons/fi';
import { format } from 'date-fns';

const MonthlyBills = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Data states
  const [bills, setBills] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateDesc');

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [companies, setCompanies] = useState([]);

  // Form states
  const [generateForm, setGenerateForm] = useState({
    buyerId: '',
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear()
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

// Update fetchInitialData to also get settings
const fetchInitialData = async () => {
  try {
    setLoading(true);
    const [billsData, statsData, buyersData, settingsData] = await Promise.all([
      monthlyBillService.getAllBills(),
      monthlyBillService.getBillsStats(),
      wholesaleService.getAllBuyers(),
      settingsService.getSettings() // Add this import if needed
    ]);
    setBills(billsData);
    setStats(statsData);
    setBuyers(buyersData);
    
    // ✅ Extract companies from settings
    const companiesList = settingsData?.editPermissions?.companies || 
                           settingsData?.companies || 
                           [];
    setCompanies(companiesList);
    
  } catch (error) {
    toast.error('Failed to load data');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

  const refreshData = async () => {
    await fetchInitialData();
    toast.success('Data refreshed');
  };

  // Filter and sort bills
  const getFilteredBills = () => {
    let filtered = [...bills];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        bill =>
          bill.billNumber.toLowerCase().includes(query) ||
          bill.buyer.name.toLowerCase().includes(query) ||
          bill.buyer.mobile.includes(query) ||
          bill.buyer.businessName?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    // Month filter
    if (monthFilter !== 'all') {
      filtered = filtered.filter(bill => bill.billingPeriod.month === monthFilter);
    }

    // Year filter
    if (yearFilter !== 'all') {
      filtered = filtered.filter(bill => bill.billingPeriod.year === parseInt(yearFilter));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dateDesc':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'dateAsc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'amountDesc':
          return b.financials.grandTotal - a.financials.grandTotal;
        case 'amountAsc':
          return a.financials.grandTotal - b.financials.grandTotal;
        case 'dueDesc':
          return b.financials.balanceDue - a.financials.balanceDue;
        case 'dueAsc':
          return a.financials.balanceDue - b.financials.balanceDue;
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Get status badge
  const getStatusBadge = status => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-700', icon: FiEdit, text: 'Draft' },
      generated: { color: 'bg-blue-100 text-blue-700', icon: FiFileText, text: 'Generated' },
      sent: { color: 'bg-purple-100 text-purple-700', icon: FiMail, text: 'Sent' },
      partial: { color: 'bg-yellow-100 text-yellow-700', icon: FiClock, text: 'Partial' },
      paid: { color: 'bg-green-100 text-green-700', icon: FiCheckCircle, text: 'Paid' },
      overdue: { color: 'bg-red-100 text-red-700', icon: FiAlertCircle, text: 'Overdue' }
    };
    return badges[status] || badges.draft;
  };

  // Open generate modal
  const openGenerateModal = () => {
    setGenerateForm({
      buyerId: '',
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear()
    });
    setShowGenerateModal(true);
  };

// Handle generate bill
const handleGenerateBill = async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  if (!generateForm.buyerId) {
    toast.error('Please select a buyer');
    return;
  }

  setIsSubmitting(true);
  try {
    // ✅ FIX: Auto-select company if only one active company exists
    let companyIdToUse = generateForm.companyId;
    
    if (!companyIdToUse && companies && companies.length > 0) {
      // Filter active companies
      const activeCompanies = companies.filter(c => c.isActive !== false);
      
      if (activeCompanies.length === 1) {
        // Auto-select the only active company
        companyIdToUse = activeCompanies[0].id;
      } else {
        // Get default company
        const defaultCompany = activeCompanies.find(c => c.isDefault);
        if (defaultCompany) {
          companyIdToUse = defaultCompany.id;
        }
      }
    }

    const result = await monthlyBillService.generateBill({
      ...generateForm,
      companyId: companyIdToUse
    });

    toast.success('Bill generated successfully!');
    setShowGenerateModal(false);

    // ✅ Only show company switcher if multiple active companies exist
    const activeCompanies = companies.filter(c => c.isActive !== false);
    if (result.data.status === 'draft' && activeCompanies.length > 1) {
      setSelectedBill(result.data);
      setShowCompanySwitcher(true);
    }

    await fetchInitialData();
  } catch (error) {
    const errorMsg = error.response?.data?.message || 'Failed to generate bill';
    toast.error(errorMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  // Open details modal
  const openDetailsModal = bill => {
    setSelectedBill(bill);
    setShowDetailsModal(true);
  };

  // Open payment modal
  const openPaymentModal = bill => {
    setSelectedBill(bill);
    setPaymentForm({
      amount: '',
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  // Handle payment
  const handlePaymentSubmit = async e => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(paymentForm.amount) > selectedBill.financials.balanceDue) {
      toast.error('Payment amount exceeds balance due');
      return;
    }

    setIsSubmitting(true);
    try {
      await monthlyBillService.recordPayment(selectedBill._id, {
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes
      });

      toast.success('Payment recorded successfully!');
      setShowPaymentModal(false);
      await fetchInitialData();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to record payment';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle company switch
  const handleCompanySwitch = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company');
      return;
    }

    setIsSubmitting(true);
    try {
      await monthlyBillService.switchCompany(selectedBill._id, selectedCompanyId);
      toast.success('Company updated successfully!');
      setShowCompanySwitcher(false);
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to switch company');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip company switch and finalize
  const handleSkipCompanySwitch = async () => {
    setIsSubmitting(true);
    try {
      await monthlyBillService.finalizeBill(selectedBill._id);
      toast.success('Bill finalized successfully!');
      setShowCompanySwitcher(false);
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to finalize bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle finalize
  const handleFinalizeBill = async billId => {
    if (!window.confirm('Finalize this bill? You cannot change company after this.')) return;

    try {
      await monthlyBillService.finalizeBill(billId);
      toast.success('Bill finalized successfully!');
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to finalize bill');
    }
  };

  // Handle delete
  const handleDeleteBill = async billId => {
    if (!window.confirm('Delete this draft bill? This action cannot be undone.')) return;

    try {
      await monthlyBillService.deleteBill(billId);
      toast.success('Bill deleted successfully');
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to delete bill');
    }
  };

    // Handle PDF Download
const handleDownloadPDF = async (bill) => {
  try {
    toast.loading('Generating PDF...');
    await generateMonthlyBillPDF(bill);
    toast.dismiss();
    toast.success('PDF downloaded successfully!');
  } catch (error) {
    toast.dismiss();
    toast.error('Failed to generate PDF');
    console.error(error);
  }
};

// Handle WhatsApp Send
const handleSendWhatsApp = async (bill) => {
  try {
    if (!bill.buyer.mobile) {
      toast.error('No mobile number available');
      return;
    }
    await sendMonthlyBillViaWhatsApp(bill);
    toast.success('Opening WhatsApp...');
  } catch (error) {
    toast.error('Failed to send via WhatsApp');
    console.error(error);
  }
};

  const filteredBills = getFilteredBills();

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
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
          <FiFileText className="text-blue-600" size={32} />
          Monthly Bills
        </h1>
        <p className="text-gray-600 mt-1">Manage monthly invoices and billing</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Bills */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                    Total Bills
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">
                    {stats.totalBills || 0}
                  </p>
                  {stats.draftBills > 0 && (
                    <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                      <FiEdit size={14} />
                      {stats.draftBills} drafts
                    </p>
                  )}
                </div>
                <div className="bg-blue-100 p-4 rounded-2xl group-hover:bg-blue-200 transition-colors duration-300">
                  <FiFileText className="text-blue-600" size={32} />
                </div>
              </div>
            </div>
          </Card>

          {/* Pending Bills */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                    Pending Bills
                  </p>
                  <p className="text-4xl font-bold text-orange-600 mt-2">
                    {stats.pendingBills || 0}
                  </p>
                  <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                    <FiAlertCircle size={14} />
                    Awaiting payment
                  </p>
                </div>
                <div className="bg-orange-100 p-4 rounded-2xl group-hover:bg-orange-200 transition-colors duration-300">
                  <FiClock className="text-orange-600" size={32} />
                </div>
              </div>
            </div>
          </Card>

          {/* This Month Revenue */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                    This Month
                  </p>
                  <p className="text-4xl font-bold text-green-600 mt-2">
                    ₹{((stats.thisMonthRevenue || 0) / 100000).toFixed(1)}L
                  </p>
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <FiTrendingUp size={14} />
                    {stats.thisMonthBills || 0} bills
                  </p>
                </div>
                <div className="bg-green-100 p-4 rounded-2xl group-hover:bg-green-200 transition-colors duration-300">
                  <FiTrendingUp className="text-green-600" size={32} />
                </div>
              </div>
            </div>
          </Card>

          {/* Total Outstanding */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                    Outstanding
                  </p>
                  <p className="text-4xl font-bold text-red-600 mt-2">
                    ₹{((stats.totalOutstanding || 0) / 100000).toFixed(1)}L
                  </p>
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <FiDollarSign size={14} />
                    To be collected
                  </p>
                </div>
                <div className="bg-red-100 p-4 rounded-2xl group-hover:bg-red-200 transition-colors duration-300">
                  <FiDollarSign className="text-red-600" size={32} />
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
              placeholder="Search by bill number, buyer name, mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FiFilter className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="generated">Generated</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-400" />
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Months</option>
                {months.map(month => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Years</option>
              {[2026, 2025, 2024].map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="dateDesc">Latest First</option>
              <option value="dateAsc">Oldest First</option>
              <option value="amountDesc">Amount: High to Low</option>
              <option value="amountAsc">Amount: Low to High</option>
              <option value="dueDesc">Due: High to Low</option>
              <option value="dueAsc">Due: Low to High</option>
            </select>

          </div>
        </div>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-900">{filteredBills.length}</span> of{' '}
        <span className="font-semibold text-gray-900">{bills.length}</span> bills
      </div>

      {/* Bills Grid */}
      {filteredBills.length === 0 ? (
        <Card className="text-center py-12">
          <FiFileText className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bills Found</h3>
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all' || monthFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Generate your first monthly bill'}
          </p>
          {!searchQuery && statusFilter === 'all' && monthFilter === 'all' && (
            <button
              onClick={openGenerateModal}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <FiPlus size={20} />
              Generate Bill
            </button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBills.map((bill, index) => {
            const statusBadge = getStatusBadge(bill.status);
            const StatusIcon = statusBadge.icon;

            return (
              <Card
                key={bill._id}
                className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{bill.billNumber}</h3>
                      <p className="text-sm text-gray-600 mt-1">{bill.buyer.name}</p>
                      {bill.buyer.businessName && (
                        <p className="text-xs text-gray-500">{bill.buyer.businessName}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusBadge.color}`}>
                      <StatusIcon size={12} />
                      {statusBadge.text}
                    </span>
                  </div>

                  {/* Period & Company */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Period</p>
                        <p className="font-semibold text-gray-900">
                          {bill.billingPeriod.month} {bill.billingPeriod.year}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Company</p>
                        <p className="font-semibold text-gray-900">{bill.company.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Challans Info */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-600">Challans</p>
                        <p className="font-bold text-blue-600">{bill.challans.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Items</p>
                        <p className="font-bold text-blue-600">
                          {bill.challans.reduce((sum, c) => sum + c.itemsQty, 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bill Amount</span>
                        <span className="font-semibold text-gray-900">
                          ₹{bill.financials.invoiceTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {bill.financials.previousOutstanding > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Previous Due</span>
                          <span className="font-semibold text-orange-600">
                            +₹{bill.financials.previousOutstanding.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-900">Grand Total</span>
                        <span className="font-bold text-lg text-gray-900">
                          ₹{bill.financials.grandTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {bill.financials.amountPaid > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Paid</span>
                            <span className="font-semibold text-green-600">
                              -₹{bill.financials.amountPaid.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="font-medium text-orange-600">Balance Due</span>
                            <span className="font-bold text-lg text-orange-600">
                              ₹{bill.financials.balanceDue.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    <FiCalendar size={12} />
                    Due: {format(new Date(bill.paymentDueDate), 'dd MMM yyyy')}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    {bill.status === 'draft' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedBill(bill);
                            setShowCompanySwitcher(true);
                          }}
                          className="w-full px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <FiEdit size={16} />
                          Review & Finalize
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill._id)}
                          className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <FiTrash2 size={16} />
                          Delete Draft
                        </button>
                      </>
                    )}


                    {bill.status !== 'draft' && (
                      <>
                        {/* PDF & WhatsApp Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleDownloadPDF(bill)}
                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <FiDownload size={16} />
                            PDF
                          </button>
                          <button
                            onClick={() => handleSendWhatsApp(bill)}
                            className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <FiMessageCircle size={16} />
                            WhatsApp
                          </button>
                        </div>

                        {/* Record Payment Button */}
                        {bill.status !== 'paid' && (
                          <button
                            onClick={() => openPaymentModal(bill)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                          >
                            <FiDollarSign size={18} />
                            Record Payment
                          </button>
                        )}

                        {/* View Details Button */}
                        <button
                          onClick={() => openDetailsModal(bill)}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <FiEye size={16} />
                          View Details
                        </button>
                      </>
                    )}
                </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* GENERATE BILL MODAL */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FiPlus className="text-blue-600" size={24} />
            Generate Monthly Bill
          </div>
        }
      >
        <form onSubmit={handleGenerateBill} className="space-y-5">
          {/* Select Buyer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Buyer <span className="text-red-500">*</span>
            </label>
            <select
              value={generateForm.buyerId}
              onChange={e =>
                setGenerateForm({ ...generateForm, buyerId: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Choose Buyer --</option>
              {buyers.map(buyer => (
                <option key={buyer._id} value={buyer._id}>
                  {buyer.name} - {buyer.mobile}
                  {buyer.businessName && ` (${buyer.businessName})`}
                </option>
              ))}
            </select>
          </div>

          {/* Select Month */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Month <span className="text-red-500">*</span>
            </label>
            <select
              value={generateForm.month}
              onChange={e => setGenerateForm({ ...generateForm, month: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {months.map(month => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Select Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Year <span className="text-red-500">*</span>
            </label>
            <select
              value={generateForm.year}
              onChange={e =>
                setGenerateForm({ ...generateForm, year: parseInt(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {[2026, 2025, 2024].map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Note:</strong> Bill will be generated with default company settings.
                You can change the company after generation.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowGenerateModal(false)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <FiCheck size={20} />
                  Generate Bill
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* COMPANY SWITCHER MODAL */}
      <Modal
        isOpen={showCompanySwitcher}
        onClose={() => setShowCompanySwitcher(false)}
        title={
        <div className="flex items-center gap-2">
            <FiEdit className="text-orange-600" size={24} />
            {companies.filter(c => c.isActive !== false).length > 1 
            ? 'Review Bill - Change Company?' 
            : 'Review Bill - Confirm Company'}
        </div>
        }
      >
        {selectedBill && (
          <div className="space-y-5">
            {/* Bill Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Bill Generated</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <p>
                  <strong>Bill No:</strong> {selectedBill.billNumber}
                </p>
                <p>
                  <strong>Buyer:</strong> {selectedBill.buyer.name}
                </p>
                <p>
                  <strong>Period:</strong> {selectedBill.billingPeriod.month}{' '}
                  {selectedBill.billingPeriod.year}
                </p>
                <p>
                  <strong>Amount:</strong> ₹
                  {selectedBill.financials.grandTotal.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Current Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Company
              </label>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-gray-900">{selectedBill.company.name}</p>
                {selectedBill.company.gstin && (
                  <p className="text-sm text-gray-600 mt-1">
                    GSTIN: {selectedBill.company.gstin}
                  </p>
                )}
              </div>
            </div>

            {/* Change Company Option */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Change to Different Company (Optional)
            </label>
            <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                <option value="">-- Keep Current Company --</option>
                {companies
                    .filter(c => c.isActive !== false) // ✅ Show only active companies
                    .map((company) => (
                    <option key={company.id} value={company.id}>
                        {company.name} {company.gstin ? `(${company.gstin})` : ''}
                    </option>
                    ))}
            </select>
            </div>

            {/* Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <FiAlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Important:</strong> Only company details will be changed. All
                  financial data and buyer information will remain the same.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCompanySwitcher(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              {selectedCompanyId ? (
                <button
                  onClick={handleCompanySwitch}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Switching...
                    </>
                  ) : (
                    <>
                      <FiEdit size={20} />
                      Switch & Finalize
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSkipCompanySwitch}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <FiCheck size={20} />
                      Keep & Finalize
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FiDollarSign className="text-green-600" size={24} />
            Record Payment
          </div>
        }
      >
        {selectedBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            {/* Bill Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2">{selectedBill.billNumber}</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p>
                  <strong>Buyer:</strong> {selectedBill.buyer.name}
                </p>
                <p>
                  <strong>Balance Due:</strong> ₹
                  {selectedBill.financials.balanceDue.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  min="0"
                  step="0.01"
                  max={selectedBill.financials.balanceDue}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Maximum: ₹{selectedBill.financials.balanceDue.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentForm.paymentMethod}
                onChange={e =>
                  setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                Payment Date
              </label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={e =>
                  setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !paymentForm.amount ||
                  parseFloat(paymentForm.amount) <= 0
                }
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
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

      {/* BILL DETAILS MODAL */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FiFileText className="text-blue-600" size={24} />
            Bill Details
          </div>
        }
      >
        {selectedBill && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Header Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedBill.billNumber}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedBill.billingPeriod.month} {selectedBill.billingPeriod.year}
                  </p>
                </div>
                {(() => {
                  const badge = getStatusBadge(selectedBill.status);
                  const Icon = badge.icon;
                  return (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.color}`}
                    >
                      <Icon size={12} />
                      {badge.text}
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Generated</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(selectedBill.generatedAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Due Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(selectedBill.paymentDueDate), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>

            {/* Company & Buyer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">Company</h4>
                <p className="text-sm text-gray-700">{selectedBill.company.name}</p>
                {selectedBill.company.gstin && (
                  <p className="text-xs text-gray-600 mt-1">
                    GSTIN: {selectedBill.company.gstin}
                  </p>
                )}
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">Buyer</h4>
                <p className="text-sm text-gray-700">{selectedBill.buyer.name}</p>
                <p className="text-xs text-gray-600 mt-1">{selectedBill.buyer.mobile}</p>
                {selectedBill.buyer.businessName && (
                  <p className="text-xs text-gray-600">{selectedBill.buyer.businessName}</p>
                )}
              </div>
            </div>

            {/* Challans Table */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Included Challans</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">
                        Challan No.
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedBill.challans.map((challan, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {challan.challanNumber}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {format(new Date(challan.challanDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {challan.itemsQty}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          ₹{challan.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-gray-900 mb-3">Financial Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxable Amount</span>
                  <span className="font-semibold text-gray-900">
                    ₹{selectedBill.financials.totalTaxableAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    CGST ({selectedBill.financials.gstRate / 2}%)
                  </span>
                  <span className="font-semibold text-gray-900">
                    ₹{selectedBill.financials.cgst.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    SGST ({selectedBill.financials.gstRate / 2}%)
                  </span>
                  <span className="font-semibold text-gray-900">
                    ₹{selectedBill.financials.sgst.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-900">Invoice Total</span>
                  <span className="font-bold text-gray-900">
                    ₹{selectedBill.financials.invoiceTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedBill.financials.previousOutstanding > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Previous Outstanding</span>
                    <span className="font-semibold text-orange-600">
                      +₹{selectedBill.financials.previousOutstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t-2 border-gray-300">
                  <span className="font-bold text-lg text-gray-900">Grand Total</span>
                  <span className="font-bold text-xl text-gray-900">
                    ₹{selectedBill.financials.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedBill.financials.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Amount Paid</span>
                      <span className="font-semibold text-green-600">
                        -₹{selectedBill.financials.amountPaid.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-orange-300">
                      <span className="font-bold text-lg text-orange-600">Balance Due</span>
                      <span className="font-bold text-xl text-orange-600">
                        ₹{selectedBill.financials.balanceDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment History */}
            {selectedBill.paymentHistory && selectedBill.paymentHistory.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Payment History</h4>
                <div className="space-y-2">
                  {selectedBill.paymentHistory.map((payment, index) => (
                    <div
                      key={index}
                      className="p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-green-700">
                            ₹{payment.amount.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {format(new Date(payment.paymentDate), 'dd MMM yyyy, hh:mm a')} •{' '}
                            {payment.paymentMethod}
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-gray-600 mt-1">{payment.notes}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-600">
                          By: {payment.recordedBy}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-4">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MonthlyBills;