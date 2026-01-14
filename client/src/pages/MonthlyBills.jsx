import { useState, useEffect } from 'react';
import {monthlyBillService} from '../services/monthlyBillService';
import {wholesaleService} from '../services/wholesaleService';
import {settingsService} from '../services/settingsService';
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
  FiMessageCircle,
  FiX,
  FiChevronRight,
  FiUser,
  FiFileText as FiInvoice,
  FiPackage,
  FiCreditCard,
  FiArrowRight,
  FiZap,
  FiEdit2
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
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedBillForHistory, setSelectedBillForHistory] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // NEW: Customization modal states
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizingBill, setCustomizingBill] = useState(null);
  const [customizeForm, setCustomizeForm] = useState({
    paymentTermDays: 30,
    hsnCode: '6203',
    notes: '',
    removeChallans: []
  });
  const [customSequence, setCustomSequence] = useState('');

  // NEW: Preview modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewingBill, setPreviewingBill] = useState(null);

  // NEW: Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [billsPerPage] = useState(20);

  // Form states - Multi-step generation
  const [generateStep, setGenerateStep] = useState(1);
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

  // NEW: Multi-select and bulk generation states
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [selectedBuyerIds, setSelectedBuyerIds] = useState([]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [billsData, statsData, buyersData, settingsData] = await Promise.all([
        monthlyBillService.getAllBills(),
        monthlyBillService.getBillsStats(),
        wholesaleService.getAllBuyers(),
        settingsService.getSettings()
      ]);

      setBills(billsData);
      setStats(statsData);
      setBuyers(buyersData);

      const companiesList = settingsData?.editPermissions?.companies || settingsData?.companies;
      setCompanies(companiesList);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchInitialData();
    toast.success('Data refreshed');
  };

  // Filter and sort bills
  const getFilteredBills = () => {
    let filtered = [...bills];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((bill) =>
        bill.billNumber.toLowerCase().includes(query) ||
        bill.buyer.name.toLowerCase().includes(query) ||
        bill.buyer.mobile.includes(query) ||
        bill.buyer.businessName?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter(bill => bill.billingPeriod.month === monthFilter);
    }

    if (yearFilter !== 'all') {
      filtered = filtered.filter(bill => bill.billingPeriod.year === parseInt(yearFilter));
    }

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

  // NEW: Get paginated bills
  const getPaginatedBills = () => {
    const filtered = getFilteredBills();
    const indexOfLastBill = currentPage * billsPerPage;
    const indexOfFirstBill = indexOfLastBill - billsPerPage;
    return filtered.slice(indexOfFirstBill, indexOfLastBill);
  };

  // NEW: Get total pages
  const getTotalPages = () => {
    const filtered = getFilteredBills();
    return Math.ceil(filtered.length / billsPerPage);
  };

  // NEW: Change page
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // NEW: Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, monthFilter, yearFilter, sortBy]);

  // NEW: Filter buyers based on search
  const getFilteredBuyers = () => {
    if (!buyerSearchQuery.trim()) return buyers;

    const query = buyerSearchQuery.toLowerCase();
    return buyers.filter(buyer =>
      buyer.name.toLowerCase().includes(query) ||
      buyer.mobile.includes(query) ||
      buyer.businessName?.toLowerCase().includes(query) ||
      buyer.gstNumber?.toLowerCase().includes(query)
    );
  };

  // Get status configuration
  const getStatusConfig = (status) => {
    const configs = {
      draft: {
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: FiEdit,
        text: 'Draft',
        dotColor: 'bg-slate-400'
      },
      generated: {
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: FiFileText,
        text: 'Generated',
        dotColor: 'bg-blue-500'
      },
      sent: {
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: FiMail,
        text: 'Sent',
        dotColor: 'bg-purple-500'
      },
      partial: {
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: FiClock,
        text: 'Partial Payment',
        dotColor: 'bg-amber-500'
      },
      paid: {
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: FiCheckCircle,
        text: 'Paid',
        dotColor: 'bg-emerald-500'
      },
      overdue: {
        color: 'bg-rose-100 text-rose-700 border-rose-200',
        icon: FiAlertCircle,
        text: 'Overdue',
        dotColor: 'bg-rose-500'
      }
    };
    return configs[status] || configs.draft;
  };

  // Open generate modal
  const openGenerateModal = () => {
    setGenerateStep(1);
    setGenerateForm({
      buyerId: '',
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear()
    });
    setBuyerSearchQuery('');
    setSelectedBuyerIds([]);
    setShowGenerateModal(true);
  };

    // NEW: Handle generate bill - Always create as draft first
  const handleGenerateBill = async () => {
    if (isSubmitting) return;

    if (!generateForm.buyerId) {
      toast.error('Please select a buyer');
      return;
    }

    setIsSubmitting(true);

    try {
      let companyIdToUse = generateForm.companyId;

      // Get default company
      if (!companyIdToUse && companies && companies.length > 0) {
        const activeCompanies = companies.filter(c => c.isActive !== false);
        if (activeCompanies.length > 0) {
          const defaultCompany = activeCompanies.find(c => c.isDefault);
          companyIdToUse = defaultCompany ? defaultCompany.id : activeCompanies[0].id;
        }
      }

      const result = await monthlyBillService.generateBill({
        ...generateForm,
        companyId: companyIdToUse
      });

      // Close generate modal
      setShowGenerateModal(false);

      // Check if draft was created
      if (result.data.status === 'draft') {
        toast.success(
          `Draft bill ${result.data.billNumber} created! You can now customize or finalize it.`,
          { duration: 5000 }
        );

        // Refresh data
        await fetchInitialData();

        // Auto-open customize modal
        setTimeout(() => {
          const createdBill = bills.find(b => b._id === result.data._id) || result.data;
          openCustomizeModal(createdBill);
        }, 500);

      } else {
        toast.success('Bill generated successfully!');
        await fetchInitialData();
      }

    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to generate bill';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NEW: Handle bill number update
const handleUpdateBillNumber = async () => {
  if (!customSequence || customSequence < 1) {
    toast.error('Please enter a valid sequence number (minimum 1)');
    return;
  }

  try {
    setIsSubmitting(true);
    
    const result = await monthlyBillService.updateBillNumber(
      customizingBill._id,
      parseInt(customSequence, 10)
    );
    
    toast.success(`✅ Bill number updated: ${result.data.oldBillNumber} → ${result.data.newBillNumber}`, {
      duration: 5000
    });
    
    // Refresh bills list
    await fetchInitialData();
    
    // Update the customizing bill with new data
    setCustomizingBill(result.data.bill);
    setCustomSequence(''); // Clear input
    
  } catch (error) {
    console.error('Failed to update bill number:', error);
    const errorMsg = error.response?.data?.message || 'Failed to update bill number';
    toast.error(errorMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  // NEW: Generate bills for all buyers
  const handleGenerateAllBills = async () => {
    if (isGeneratingAll) return;

    if (!window.confirm(`Generate DRAFT bills for ALL ${buyers.length} buyers for ${generateForm.month} ${generateForm.year}? You can customize and finalize them later.`)) {
      return;
    }

    setIsGeneratingAll(true);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    try {
      // Get default company
      let companyIdToUse;
      if (companies && companies.length > 0) {
        const activeCompanies = companies.filter(c => c.isActive !== false);
        if (activeCompanies.length > 0) {
          const defaultCompany = activeCompanies.find(c => c.isDefault);
          companyIdToUse = defaultCompany ? defaultCompany.id : activeCompanies[0].id;
        }
      }

      // Generate bills for all buyers
      for (const buyer of buyers) {
        try {
          await monthlyBillService.generateBill({
            buyerId: buyer._id,
            month: generateForm.month,
            year: generateForm.year,
            companyId: companyIdToUse
          });
          successCount++;
        } catch (error) {
          failCount++;
          errors.push({
            buyer: buyer.name,
            error: error.response?.data?.message || 'Failed to generate'
          });
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(
          `Successfully created ${successCount} draft bills! Go to "Draft" filter to customize and finalize them.`,
          { duration: 8000 }
        );
      }

      if (failCount > 0) {
        console.error('Failed bills:', errors);
        toast.error(`${failCount} bills failed to generate. Check console for details.`, { duration: 7000 });
      }

      setShowGenerateModal(false);
      await fetchInitialData();

      // Auto-switch to draft filter to show created bills
      setStatusFilter('draft');

    } catch (error) {
      toast.error('Bulk generation failed');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // NEW: Generate bills for selected buyers
  const handleGenerateSelectedBills = async () => {
    if (selectedBuyerIds.length === 0) {
      toast.error('Please select at least one buyer');
      return;
    }

    if (!window.confirm(`Generate DRAFT bills for ${selectedBuyerIds.length} selected buyers? You can customize and finalize them later.`)) {
      return;
    }

    setIsGeneratingAll(true);

    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const createdDrafts = [];

    try {
      // Get default company
      let companyIdToUse;
      if (companies && companies.length > 0) {
        const activeCompanies = companies.filter(c => c.isActive !== false);
        if (activeCompanies.length > 0) {
          const defaultCompany = activeCompanies.find(c => c.isDefault);
          companyIdToUse = defaultCompany ? defaultCompany.id : activeCompanies[0].id;
        }
      }

      // Generate bills for selected buyers
      for (const buyerId of selectedBuyerIds) {
        try {
          const result = await monthlyBillService.generateBill({
            buyerId: buyerId,
            month: generateForm.month,
            year: generateForm.year,
            companyId: companyIdToUse
          });
          successCount++;
          createdDrafts.push(result.data);
        } catch (error) {
          failCount++;
          const buyer = buyers.find(b => b._id === buyerId);
          errors.push({
            buyer: buyer?.name || buyerId,
            error: error.response?.data?.message || 'Failed to generate'
          });
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(
          `Successfully created ${successCount} draft bills! You can now customize and finalize them.`,
          { duration: 7000 }
        );
      }

      if (failCount > 0) {
        console.error('Failed bills:', errors);
        toast.error(`${failCount} bills failed to generate. Check console for details.`, { duration: 7000 });
      }

      setShowGenerateModal(false);
      setSelectedBuyerIds([]);
      await fetchInitialData();

    } catch (error) {
      toast.error('Bulk generation failed');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // NEW: Toggle buyer selection
  const toggleBuyerSelection = (buyerId) => {
    setSelectedBuyerIds(prev => {
      if (prev.includes(buyerId)) {
        return prev.filter(id => id !== buyerId);
      } else {
        return [...prev, buyerId];
      }
    });
  };

  // NEW: Select all buyers
  const selectAllBuyers = () => {
    const filteredBuyers = getFilteredBuyers();
    setSelectedBuyerIds(filteredBuyers.map(b => b._id));
  };

  // NEW: Clear all selections
  const clearAllSelections = () => {
    setSelectedBuyerIds([]);
  };

  // NEW: Open customize modal
  const openCustomizeModal = (bill) => {
    setCustomizingBill(bill);
    setCustomizeForm({
      paymentTermDays: bill.paymentDueDate
        ? Math.ceil((new Date(bill.paymentDueDate) - new Date(bill.billingPeriod.endDate)) / (1000 * 60 * 60 * 24))
        : 30,
      hsnCode: bill.hsnCode || '6203',
      notes: bill.notes || '',
      removeChallans: []
    });
    setCustomSequence('');
    setShowCustomizeModal(true);
  };

  // NEW: Handle customize bill
  const handleCustomizeBill = async () => {
    if (!customizingBill) return;

    setIsSubmitting(true);

    try {
      const payload = {};

      // Only send changed values
      if (customizeForm.paymentTermDays !== 30) {
        payload.paymentTermDays = customizeForm.paymentTermDays;
      }

      if (customizeForm.hsnCode !== '6203') {
        payload.hsnCode = customizeForm.hsnCode;
      }

      if (customizeForm.notes.trim()) {
        payload.notes = customizeForm.notes.trim();
      }

      if (customizeForm.removeChallans.length > 0) {
        payload.removeChallans = customizeForm.removeChallans;
      }

      await monthlyBillService.customizeBill(customizingBill._id, payload);

      toast.success('Bill customized successfully!');
      setShowCustomizeModal(false);
      await fetchInitialData();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to customize bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: Toggle challan for removal
  const toggleChallanRemoval = (challanId) => {
    setCustomizeForm(prev => ({
      ...prev,
      removeChallans: prev.removeChallans.includes(challanId)
        ? prev.removeChallans.filter(id => id !== challanId)
        : [...prev.removeChallans, challanId]
    }));
  };

  // NEW: Open preview modal
  const openPreviewModal = (bill) => {
    setPreviewingBill(bill);
    setShowPreviewModal(true);
  };

  // NEW: Handle download from preview
  const handleDownloadFromPreview = async () => {
    if (!previewingBill) return;

    try {
      await handleDownloadPDF(previewingBill);
    } catch (error) {
      console.error(error);
    }
  };

  // NEW: Handle WhatsApp from preview
  const handleWhatsAppFromPreview = async () => {
    if (!previewingBill) return;

    try {
      await handleSendWhatsApp(previewingBill);
      setShowPreviewModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  // Delete payment from bill
  const handleDeletePaymentFromBill = async (paymentIndex) => {
    if (!window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await monthlyBillService.deletePayment(selectedBillForHistory._id, paymentIndex);

      if (result.success) {
        toast.success(result.message);

        // Refresh payment history
        const historyResponse = await monthlyBillService.getBillPaymentHistory(selectedBillForHistory._id);
        setPaymentHistory(historyResponse.data?.payments);

        // Refresh bills list
        await fetchInitialData();
      } else {
        toast.error(result.message || 'Failed to delete payment');
      }
    } catch (error) {
      console.error('Delete payment error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete payment';
      toast.error(errorMsg);
    }
  };

  // Open details modal
  const openDetailsModal = (bill) => {
    setSelectedBill(bill);
    setShowDetailsModal(true);
  };

  // Open payment history modal
  const openPaymentHistoryModal = async (bill) => {
    setSelectedBillForHistory(bill);
    setShowPaymentHistoryModal(true);
    setLoadingHistory(true);

    try {
      const result = await monthlyBillService.getBillPaymentHistory(bill._id);
      setPaymentHistory(result.data.payments);
    } catch (error) {
      toast.error('Failed to load payment history');
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open payment modal
  const openPaymentModal = (bill) => {
    setSelectedBill(bill);
    setPaymentForm({
      amount: (bill.financials?.balanceDue || 0).toString(),
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  // Handle payment
  const handlePaymentSubmit = async (e) => {
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
  const handleFinalizeBill = async (billId) => {
    if (!window.confirm('Finalize this bill? You cannot change company after this.')) {
      return;
    }

    try {
      await monthlyBillService.finalizeBill(billId);
      toast.success('Bill finalized successfully!');
      await fetchInitialData();
    } catch (error) {
      toast.error('Failed to finalize bill');
    }
  };

  // Handle delete
  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Delete this draft bill? This action cannot be undone.')) {
      return;
    }

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
      toast.loading('Generating PDF...', { id: 'pdf' });
      await generateMonthlyBillPDF(bill);
      toast.success('PDF downloaded successfully!', { id: 'pdf' });
    } catch (error) {
      toast.error('Failed to generate PDF', { id: 'pdf' });
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

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const selectedBuyer = buyers.find(b => b._id === generateForm.buyerId);

    if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading monthly bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Modern Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            {/* Title Section */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <FiInvoice className="w-5 h-5 text-white" />
                  </div>
                  Monthly Bills
                </h1>
                <p className="text-slate-600 mt-1 ml-13">Manage invoices and track payments</p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={refreshData}
                  className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  <span className="font-medium">Refresh</span>
                </button>

                <button
                  onClick={openGenerateModal}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                >
                  <FiPlus className="w-5 h-5" />
                  <span className="font-semibold">Generate Bill</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            {!stats ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg mb-2"></div>
                    <div className="h-8 bg-slate-200 rounded w-20 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Bills */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <FiFileText className="w-5 h-5 text-white" />
                    </div>
                    {stats.draftBills > 0 && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                        {stats.draftBills} draft
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalBills || 0}</p>
                  <p className="text-sm text-blue-700 font-medium">Total Bills</p>
                </div>

                {/* Pending Bills */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                      <FiClock className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{stats.pendingBills || 0}</p>
                  <p className="text-sm text-amber-700 font-medium">Pending Bills</p>
                </div>

                {/* This Month Revenue */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <FiTrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    ₹{((stats.thisMonthRevenue || 0)).toFixed(2)}
                  </p>
                  <p className="text-sm text-emerald-700 font-medium">This Month</p>
                </div>

                {/* Outstanding */}
                <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center">
                      <FiDollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-rose-900">
                    ₹{((stats.totalOutstanding || 0)).toFixed(2)}
                  </p>
                  <p className="text-sm text-rose-700 font-medium">Outstanding</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

            {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by buyer name, mobile, business, or bill number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 font-medium">Quick Filters:</span>
              {['all', 'draft', 'generated', 'partial', 'paid', 'overdue'].map((status) => {
                const config = getStatusConfig(status);
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                      isActive
                        ? status === 'all'
                          ? 'bg-slate-900 text-white shadow-lg'
                          : `${config.color} border shadow-sm`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status !== 'all' && config.icon && <config.icon className="w-4 h-4" />}
                    <span className="capitalize">{status === 'all' ? 'All' : config.text}</span>
                  </button>
                );
              })}

              {/* More Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showFilters
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiFilter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Month Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Months</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Years</option>
                    {[2024, 2025, 2026].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dateDesc">Newest First</option>
                    <option value="dateAsc">Oldest First</option>
                    <option value="amountDesc">Highest Amount</option>
                    <option value="amountAsc">Lowest Amount</option>
                    <option value="dueDesc">Highest Due</option>
                    <option value="dueAsc">Lowest Due</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

                {/* Bills Grid */}
        {getFilteredBills().length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiFileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No bills found</h3>
            <p className="text-slate-600 mb-6">
              {searchQuery || statusFilter !== 'all' || monthFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Generate your first monthly bill to get started'}
            </p>
            {!searchQuery && statusFilter === 'all' && monthFilter === 'all' && (
              <button
                onClick={openGenerateModal}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 mx-auto shadow-lg shadow-blue-500/30"
              >
                <FiPlus className="w-5 h-5" />
                <span className="font-semibold">Generate First Bill</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">
                Showing {((currentPage - 1) * billsPerPage) + 1} to{' '}
                {Math.min(currentPage * billsPerPage, getFilteredBills().length)} of{' '}
                {getFilteredBills().length} bills
              </p>
              <p className="text-sm text-slate-600">
                Page {currentPage} of {getTotalPages()}
              </p>
            </div>

            {/* Bills Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {getPaginatedBills().map((bill) => {
                const statusConfig = getStatusConfig(bill.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={bill._id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden group"
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                            {bill.buyer.name}
                          </h3>
                          {bill.buyer.businessName && (
                            <p className="text-sm text-slate-600">{bill.buyer.businessName}</p>
                          )}
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${statusConfig.color}`}>
                          <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor} animate-pulse`}></div>
                          <span className="text-xs font-semibold">{statusConfig.text}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FiCalendar className="w-4 h-4" />
                        <span className="font-medium">
                          {bill.billingPeriod.month} {bill.billingPeriod.year}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs font-mono text-slate-500">{bill.billNumber}</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-4">
                      {/* Company Info */}
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">
                            {bill.company.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {bill.company.name}
                          </p>
                          {bill.company.gstin && (
                            <p className="text-xs text-slate-600 font-mono">{bill.company.gstin}</p>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <FiPackage className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">Challans</span>
                          </div>
                          <p className="text-lg font-bold text-blue-900">{bill.challans.length}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <FiPackage className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Items</span>
                          </div>
                          <p className="text-lg font-bold text-emerald-900">
                            {bill.challans.reduce((sum, c) => sum + c.itemsQty, 0)}
                          </p>
                        </div>
                      </div>

                      {/* Financial Info */}
                      <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-600">Grand Total</span>
                          <span className="text-lg font-bold text-slate-900">
                            ₹{(bill.financials?.grandTotal || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {bill.financials?.balanceDue > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-sm font-medium text-rose-600">Balance Due</span>
                            <span className="text-lg font-bold text-rose-600">
                              ₹{(bill.financials?.balanceDue || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        {bill.financials?.totalPaid > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2">
                            <span className="text-sm font-medium text-emerald-600">Paid</span>
                            <span className="text-sm font-semibold text-emerald-600">
                              ₹{(bill.financials?.totalPaid || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer - Actions */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* View Details */}
                        <button
                          onClick={() => openDetailsModal(bill)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                        >
                          <FiEye className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </button>

                        {/* Draft Bills - Show Customize & Finalize */}
                        {bill.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openCustomizeModal(bill)}
                              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                              title="Customize Bill"
                            >
                              <FiEdit2 className="w-4 h-4" />
                              <span className="text-sm">Customize</span>
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleFinalizeBill(bill._id)}
                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 flex items-center justify-center"
                                title="Finalize Bill"
                              >
                                <FiCheck className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Delete draft bill ${bill.billNumber}? This bill number will be reused.`
                                  )
                                ) {
                                  try {
                                    await monthlyBillService.deleteBill(bill._id);
                                    toast.success('Draft deleted');
                                    refreshData();
                                  } catch (error) {
                                    toast.error(error.response?.data?.message || 'Failed to delete');
                                  }
                                }
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* Finalized Bills - Show Preview, Download, WhatsApp, Payment */}
                        {bill.status !== 'draft' && (
                          <>
                            <button
                              onClick={() => openPreviewModal(bill)}
                              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 flex items-center justify-center"
                              title="Preview Bill"
                            >
                              <FiEye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDownloadPDF(bill)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center"
                              title="Download PDF"
                            >
                              <FiDownload className="w-4 h-4" />
                            </button>

                            {bill.buyer.mobile && (
                              <button
                                onClick={() => handleSendWhatsApp(bill)}
                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 flex items-center justify-center"
                                title="Send via WhatsApp"
                              >
                                <FiMessageCircle className="w-4 h-4" />
                              </button>
                            )}

                            {bill.financials?.balanceDue > 0 && (
                              <button
                                onClick={() => openPaymentModal(bill)}
                                className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all duration-200 flex items-center justify-center"
                                title="Record Payment"
                              >
                                <FiCreditCard className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => openPaymentHistoryModal(bill)}
                              className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all duration-200 flex items-center justify-center"
                              title="Payment History"
                            >
                              <FiClock className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {getTotalPages() > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: getTotalPages() }, (_, i) => i + 1)
                    .filter((page) => {
                      return (
                        page === 1 ||
                        page === getTotalPages() ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      );
                    })
                    .map((page, index, array) => (
                      <React.Fragment key={page}>
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-slate-400">...</span>
                        )}

                        <button
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === getTotalPages()}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

            {/* Generate Bill Modal - Multi-Step */}
      {showGenerateModal && (
        <Modal
          isOpen={showGenerateModal}
          onClose={() => {
            setShowGenerateModal(false);
            setBuyerSearchQuery('');
            setSelectedBuyerIds([]);
          }}
          title="Generate Monthly Bill"
          maxWidth="2xl"
        >
          <div className="p-6">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-center">
                {[1, 2, 3].map((step, idx) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                        generateStep >= step
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {generateStep > step ? <FiCheck className="w-5 h-5" /> : step}
                    </div>
                    {idx < 2 && (
                      <div
                        className={`w-24 h-1 mx-2 transition-all duration-300 ${
                          generateStep > step ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center mt-3 gap-8">
                <span
                  className={`text-sm font-medium ${
                    generateStep >= 1 ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  Select Buyer
                </span>
                <span
                  className={`text-sm font-medium ${
                    generateStep >= 2 ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  Billing Period
                </span>
                <span
                  className={`text-sm font-medium ${
                    generateStep >= 3 ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  Review
                </span>
              </div>
            </div>

            {/* Step 1: Select Buyer */}
            {generateStep === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Select Buyer(s)</h3>
                  <p className="text-slate-600">Choose buyers for this monthly bill</p>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center justify-between gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAllBuyers}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
                    >
                      Select All ({getFilteredBuyers().length})
                    </button>
                    {selectedBuyerIds.length > 0 && (
                      <button
                        onClick={clearAllSelections}
                        className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
                      >
                        Clear ({selectedBuyerIds.length})
                      </button>
                    )}
                  </div>
                  {selectedBuyerIds.length > 0 && (
                    <span className="text-sm font-semibold text-blue-700">
                      {selectedBuyerIds.length} selected
                    </span>
                  )}
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search buyers by name, mobile, business, GST..."
                    value={buyerSearchQuery}
                    onChange={(e) => setBuyerSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {buyerSearchQuery && (
                    <button
                      onClick={() => setBuyerSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Buyer List */}
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {getFilteredBuyers().length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No buyers found matching "{buyerSearchQuery}"</p>
                    </div>
                  ) : (
                    getFilteredBuyers().map((buyer) => (
                      <button
                        key={buyer._id}
                        onClick={() => {
                          if (selectedBuyerIds.includes(buyer._id)) {
                            toggleBuyerSelection(buyer._id);
                          } else {
                            setGenerateForm({ ...generateForm, buyerId: buyer._id });
                            setGenerateStep(2);
                          }
                        }}
                        className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left relative ${
                          generateForm.buyerId === buyer._id
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : selectedBuyerIds.includes(buyer._id)
                            ? 'border-green-600 bg-green-50 shadow-md'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        {/* Multi-select checkbox */}
                        <div
                          className="absolute top-4 right-4 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBuyerSelection(buyer._id);
                          }}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                              selectedBuyerIds.includes(buyer._id)
                                ? 'bg-green-600 border-green-600'
                                : 'bg-white border-slate-300 hover:border-green-500'
                            }`}
                          >
                            {selectedBuyerIds.includes(buyer._id) && (
                              <FiCheck className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 pr-8">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                            <FiUser className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 mb-1">{buyer.name}</h4>
                            {buyer.businessName && (
                              <p className="text-sm text-slate-600 mb-1">{buyer.businessName}</p>
                            )}
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              <span className="font-mono">{buyer.mobile}</span>
                              {buyer.gstNumber && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-xs">{buyer.gstNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <FiChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Next Button for Multi-Select */}
                {selectedBuyerIds.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setGenerateStep(2)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                    >
                      <span>Continue with {selectedBuyerIds.length} Buyer(s)</span>
                      <FiArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select Period */}
            {generateStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Billing Period</h3>
                  <p className="text-slate-600">Select the month and year for this bill</p>
                </div>

                {/* Selected Buyer(s) Preview */}
                {selectedBuyerIds.length > 0 ? (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="font-semibold text-green-900 mb-2">
                      Generating for {selectedBuyerIds.length} buyers
                    </p>
                    <div className="text-sm text-green-700 space-y-1">
                      {selectedBuyerIds.slice(0, 3).map((id) => {
                        const buyer = buyers.find((b) => b._id === id);
                        return buyer ? <div key={id}>• {buyer.name}</div> : null;
                      })}
                      {selectedBuyerIds.length > 3 && (
                        <div className="text-green-600 italic">
                          ...and {selectedBuyerIds.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  selectedBuyer && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <FiUser className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-blue-900">{selectedBuyer.name}</p>
                          <p className="text-sm text-blue-700">{selectedBuyer.businessName}</p>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Month Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    📅 Select Month
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {months.map((month) => (
                      <button
                        key={month}
                        onClick={() => setGenerateForm({ ...generateForm, month })}
                        className={`p-3 rounded-lg font-medium transition-all duration-200 ${
                          generateForm.month === month
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {month.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Year Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    📆 Select Year
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[2024, 2025, 2026].map((year) => (
                      <button
                        key={year}
                        onClick={() => setGenerateForm({ ...generateForm, year })}
                        className={`p-3 rounded-lg font-medium transition-all duration-200 ${
                          generateForm.year === year
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => setGenerateStep(1)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setGenerateStep(3)}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
                  >
                    <span>Continue</span>
                    <FiArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Generate */}
            {generateStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Review & Generate</h3>
                  <p className="text-slate-600">Verify the details before generating</p>
                </div>

                {/* Summary Card */}
                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200">
                  <div className="space-y-4">
                    {/* Buyer Info */}
                    {selectedBuyerIds.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-slate-600 mb-2">Buyers</p>
                        <p className="text-lg font-bold text-slate-900 mb-2">
                          {selectedBuyerIds.length} Buyer(s) Selected
                        </p>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                          {selectedBuyerIds.map((id) => {
                            const buyer = buyers.find((b) => b._id === id);
                            return buyer ? (
                              <div key={id} className="text-sm text-slate-700 py-1">
                                • {buyer.name} ({buyer.mobile})
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                          <FiUser className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-600 mb-1">Buyer</p>
                          <p className="text-lg font-bold text-slate-900">{selectedBuyer?.name}</p>
                          {selectedBuyer?.businessName && (
                            <p className="text-sm text-slate-600">{selectedBuyer.businessName}</p>
                          )}
                          <p className="text-sm text-slate-500 mt-1 font-mono">
                            {selectedBuyer?.mobile}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="h-px bg-slate-300"></div>

                    {/* Period Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                        <FiCalendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600 mb-1">Billing Period</p>
                        <p className="text-lg font-bold text-slate-900">
                          {generateForm.month} {generateForm.year}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warning Box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <FiAlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">📋 Draft Bill Creation</p>
                    <p className="text-sm text-blue-800">
                      Bill will be created as a <strong>DRAFT</strong>. You can then:
                    </p>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                      <li>Customize payment terms, HSN code, and notes</li>
                      <li>Remove specific challans if needed</li>
                      <li>Review all details before finalizing</li>
                      <li>Finalize when ready to send to buyer</li>
                    </ul>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => setGenerateStep(2)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
                  >
                    Back
                  </button>

                  {selectedBuyerIds.length > 0 ? (
                    <button
                      onClick={handleGenerateSelectedBills}
                      disabled={isGeneratingAll}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingAll ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating {selectedBuyerIds.length} Drafts...</span>
                        </>
                      ) : (
                        <>
                          <FiZap className="w-5 h-5" />
                          <span>Create {selectedBuyerIds.length} Draft Bills</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateBill}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating Draft...</span>
                        </>
                      ) : (
                        <>
                          <FiFileText className="w-5 h-5" />
                          <span>Create Draft Bill</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

            {/* Customize Bill Modal */}
      {showCustomizeModal && customizingBill && (
        <Modal
          isOpen={showCustomizeModal}
          onClose={() => {
            setShowCustomizeModal(false);
            setCustomizingBill(null);
          }}
          title="Customize Bill"
          maxWidth="3xl"
        >
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Bill Info Header */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">Bill Number</p>
                  <p className="text-lg font-bold text-blue-900">{customizingBill.billNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Buyer</p>
                  <p className="text-lg font-bold text-blue-900">{customizingBill.buyer.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Grand Total</p>
                  <p className="text-lg font-bold text-blue-900">
                    ₹{customizingBill.financials.grandTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* ✅ NEW: Edit Bill Number - Only for DRAFT bills */}
              {customizingBill.status === 'draft' && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    📝 Edit Bill Number (Sequence Only)
                  </label>
                  
                  <div className="flex items-center gap-3">
                    {/* Display format parts */}
                    <span className="text-lg font-mono text-slate-600">
                      {customizingBill.billNumber.split('/').slice(0, 2).join('/')} /
                    </span>
                    
                    {/* Editable sequence number */}
                    <input
                      type="number"
                      min="1"
                      className="w-32 px-4 py-2.5 bg-white border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg font-bold text-blue-900"
                      placeholder="01"
                      value={customSequence}
                      onChange={(e) => setCustomSequence(e.target.value)}
                    />
                    
                    <button
                      onClick={handleUpdateBillNumber}
                      disabled={!customSequence || customSequence < 1 || isSubmitting}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <FiEdit2 className="w-4 h-4" />
                          <span>Update</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <p className="text-xs text-blue-700 mt-2 flex items-start gap-2">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      💡 <strong>First bill only:</strong> Change sequence number to continue from your Old bills. 
                      System will auto-increment from this number for future bills.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                📅 Payment Terms (Days)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={customizeForm.paymentTermDays}
                  onChange={(e) =>
                    setCustomizeForm({
                      ...customizeForm,
                      paymentTermDays: parseInt(e.target.value) || 0
                    })
                  }
                  className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  min="0"
                  max="365"
                />
                <span className="text-sm text-slate-600">
                  Due Date:{' '}
                  {new Date(
                    new Date(customizingBill.billingPeriod.endDate).getTime() +
                      customizeForm.paymentTermDays * 24 * 60 * 60 * 1000
                  ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {[7, 15, 30, 45, 60].map((days) => (
                  <button
                    key={days}
                    onClick={() => setCustomizeForm({ ...customizeForm, paymentTermDays: days })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      customizeForm.paymentTermDays === days
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            {/* HSN Code */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                🏷️ HSN Code
              </label>
              <input
                type="text"
                value={customizeForm.hsnCode}
                onChange={(e) => setCustomizeForm({ ...customizeForm, hsnCode: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 6203"
              />
              <p className="text-xs text-slate-500 mt-1">
                HSN code for cargo pants (default: 6203)
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                📝 Additional Notes
              </label>
              <textarea
                value={customizeForm.notes}
                onChange={(e) => setCustomizeForm({ ...customizeForm, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                placeholder="Add any special instructions or notes for this bill..."
              />
            </div>

            {/* Remove Challans */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                🗑️ Remove Challans (Optional)
              </label>
              <p className="text-sm text-slate-600 mb-3">
                Select challans to exclude from this bill. Bill will be recalculated automatically.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customizingBill.challans.map((challan) => (
                  <div
                    key={challan.challanId}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      customizeForm.removeChallans.includes(challan.challanId.toString())
                        ? 'bg-red-50 border-red-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => toggleChallanRemoval(challan.challanId.toString())}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            customizeForm.removeChallans.includes(challan.challanId.toString())
                              ? 'bg-red-600 border-red-600'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {customizeForm.removeChallans.includes(challan.challanId.toString()) && (
                            <FiX className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{challan.challanNumber}</p>
                          <p className="text-xs text-slate-600">
                            {format(new Date(challan.challanDate), 'dd MMM yyyy')} • {challan.itemsQty}{' '}
                            pcs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          ₹{challan.totalAmount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-600">GST: ₹{challan.gstAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {customizeForm.removeChallans.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    ⚠️ {customizeForm.removeChallans.length} challan(s) will be removed. Bill amount
                    will be recalculated.
                  </p>
                </div>
              )}
            </div>

            {/* Preview Changes */}
            {customizeForm.removeChallans.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2">📊 Updated Bill Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-600">Original Total</p>
                    <p className="text-lg font-bold text-slate-900">
                      ₹{customizingBill.financials.grandTotal.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Removed Amount</p>
                    <p className="text-lg font-bold text-red-600">
                      -₹
                      {customizingBill.challans
                        .filter((c) => customizeForm.removeChallans.includes(c.challanId.toString()))
                        .reduce((sum, c) => sum + c.totalAmount, 0)
                        .toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowCustomizeModal(false);
                  setCustomizingBill(null);
                }}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
              >
                Cancel
              </button>

              {/* Save Customizations (Stay as Draft) */}
              <button
                onClick={handleCustomizeBill}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>

              {/* Save & Finalize */}
              <button
                onClick={async () => {
                  await handleCustomizeBill();
                  // After saving customizations, finalize the bill
                  setTimeout(async () => {
                    try {
                      await monthlyBillService.finalizeBill(customizingBill._id);
                      toast.success('Bill customized and finalized successfully!');
                      setShowCustomizeModal(false);
                      setCustomizingBill(null);
                      await fetchInitialData();
                    } catch (error) {
                      toast.error('Failed to finalize bill');
                    }
                  }, 500);
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Finalizing...</span>
                  </>
                ) : (
                  <>
                    <FiZap className="w-5 h-5" />
                    <span>Save & Finalize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

            {/* Preview Bill Modal */}
      {showPreviewModal && previewingBill && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewingBill(null);
          }}
          title="Bill Preview"
          maxWidth="4xl"
        >
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Preview Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{previewingBill.billNumber}</h2>
                <p className="text-sm text-slate-600">
                  {previewingBill.billingPeriod.month} {previewingBill.billingPeriod.year}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                  getStatusConfig(previewingBill.status).color
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    getStatusConfig(previewingBill.status).dotColor
                  }`}
                ></div>
                <span className="text-sm font-semibold">
                  {getStatusConfig(previewingBill.status).text}
                </span>
              </div>
            </div>

            {/* Preview Content - Mimics actual bill */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-8">
              {/* Company & Buyer Details */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Company (From) */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">From</p>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {previewingBill.company.name}
                  </h3>
                  {previewingBill.company.legalName && (
                    <p className="text-sm text-slate-700">{previewingBill.company.legalName}</p>
                  )}
                  {previewingBill.company.address && (
                    <p className="text-sm text-slate-600 mt-2">
                      {previewingBill.company.address.line1}
                      {previewingBill.company.address.line2 &&
                        `, ${previewingBill.company.address.line2}`}
                      <br />
                      {previewingBill.company.address.city &&
                        `${previewingBill.company.address.city}, `}
                      {previewingBill.company.address.state} - {previewingBill.company.address.pincode}
                    </p>
                  )}
                  {previewingBill.company.gstin && (
                    <p className="text-sm text-slate-700 mt-2 font-mono">
                      <span className="font-semibold">GSTIN:</span> {previewingBill.company.gstin}
                    </p>
                  )}
                  {previewingBill.company.contact?.phone && (
                    <p className="text-sm text-slate-600 mt-1">
                      📞 {previewingBill.company.contact.phone}
                    </p>
                  )}
                </div>

                {/* Buyer (To) */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Bill To</p>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {previewingBill.buyer.name}
                  </h3>
                  {previewingBill.buyer.businessName && (
                    <p className="text-sm text-slate-700">{previewingBill.buyer.businessName}</p>
                  )}
                  {previewingBill.buyer.address && (
                    <p className="text-sm text-slate-600 mt-2">
                      {previewingBill.buyer.address.line1}
                      {previewingBill.buyer.address.line2 &&
                        `, ${previewingBill.buyer.address.line2}`}
                      <br />
                      {previewingBill.buyer.address.city &&
                        `${previewingBill.buyer.address.city}, `}
                      {previewingBill.buyer.address.state} - {previewingBill.buyer.address.pincode}
                    </p>
                  )}
                  {previewingBill.buyer.gstin && (
                    <p className="text-sm text-slate-700 mt-2 font-mono">
                      <span className="font-semibold">GSTIN:</span> {previewingBill.buyer.gstin}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 mt-1">📱 {previewingBill.buyer.mobile}</p>
                </div>
              </div>

              {/* Bill Details */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Bill Date</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {format(new Date(previewingBill.generatedAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Due Date</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {format(new Date(previewingBill.paymentDueDate), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Financial Year</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {previewingBill.financialYear}
                  </p>
                </div>
              </div>

              {/* Challans Table */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase">
                  Included Challans
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Challan No.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                          Taxable Amt
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                          GST
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewingBill.challans.map((challan, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-mono text-slate-900">
                            {challan.challanNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {format(new Date(challan.challanDate), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                            {challan.itemsQty}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-900">
                            ₹{challan.taxableAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">
                            ₹{challan.gstAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                            ₹{challan.totalAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

                            {/* Financial Summary */}
              <div className="border-t-2 border-slate-300 pt-4">
                <div className="max-w-md ml-auto space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Invoice Total:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{previewingBill.financials.invoiceTotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Taxable Amount:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{previewingBill.financials.totalTaxableAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {previewingBill.financials.cgst > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          CGST ({previewingBill.financials.gstRate / 2}%):
                        </span>
                        <span className="text-slate-900">
                          ₹{previewingBill.financials.cgst.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          SGST ({previewingBill.financials.gstRate / 2}%):
                        </span>
                        <span className="text-slate-900">
                          ₹{previewingBill.financials.sgst.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}

                  {previewingBill.financials.igst > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        IGST ({previewingBill.financials.gstRate}%):
                      </span>
                      <span className="text-slate-900">
                        ₹{previewingBill.financials.igst.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {previewingBill.financials.previousOutstanding > 0 && (
                    <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-2">
                      <span className="text-slate-600">Previous Outstanding:</span>
                      <span className="font-semibold text-amber-600">
                        ₹{previewingBill.financials.previousOutstanding.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-lg font-bold border-t-2 border-slate-300 pt-3">
                    <span className="text-slate-900">Grand Total:</span>
                    <span className="text-blue-600">
                      ₹{previewingBill.financials.grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {previewingBill.financials.amountPaid > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Amount Paid:</span>
                        <span className="font-semibold text-green-600">
                          ₹{previewingBill.financials.amountPaid.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-lg font-bold">
                        <span className="text-slate-900">Balance Due:</span>
                        <span className="text-red-600">
                          ₹{previewingBill.financials.balanceDue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              {previewingBill.notes && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-900 uppercase mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{previewingBill.notes}</p>
                </div>
              )}

              {/* Terms */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold">Payment Terms:</span> Due within{' '}
                  {Math.ceil(
                    (new Date(previewingBill.paymentDueDate) -
                      new Date(previewingBill.billingPeriod.endDate)) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  days • <span className="font-semibold">HSN Code:</span> {previewingBill.hsnCode}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewingBill(null);
                }}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
              >
                Close Preview
              </button>

              <button
                onClick={handleDownloadFromPreview}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                <FiDownload className="w-5 h-5" />
                <span>Download PDF</span>
              </button>

              {previewingBill.buyer.mobile && (
                <button
                  onClick={handleWhatsAppFromPreview}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
                >
                  <FiMessageCircle className="w-5 h-5" />
                  <span>Send WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Record Payment"
          maxWidth="md"
        >
          <form onSubmit={handlePaymentSubmit} className="p-6 space-y-6">
            {/* Bill Info */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Bill Number</span>
                <span className="text-sm font-mono font-semibold text-blue-900">
                  {selectedBill.billNumber}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Buyer</span>
                <span className="text-sm font-semibold text-blue-900">{selectedBill.buyer.name}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                <span className="text-sm font-medium text-blue-700">Balance Due</span>
                <span className="text-lg font-bold text-blue-900">
                  ₹{(selectedBill.financials?.balanceDue || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Payment Amount <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>
              {/* Quick Amount Buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: ((selectedBill.financials?.balanceDue || 0) / 2).toFixed(2)
                    })
                  }
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: (selectedBill.financials?.balanceDue || 0).toString()
                    })
                  }
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-medium"
                >
                  Full Amount
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Payment Method <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, paymentMethod: method })}
                    className={`p-3 rounded-lg font-medium transition-all duration-200 ${
                      paymentForm.paymentMethod === method
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Payment Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                placeholder="Add any payment notes or reference..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>Record Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

            {/* Payment History Modal */}
      {showPaymentHistoryModal && selectedBillForHistory && (
        <Modal
          isOpen={showPaymentHistoryModal}
          onClose={() => {
            setShowPaymentHistoryModal(false);
            setSelectedBillForHistory(null);
            setPaymentHistory([]);
          }}
          title="Payment History"
          maxWidth="3xl"
        >
          <div className="p-6">
            {/* Bill Info */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-blue-700 mb-1">Bill Number</p>
                  <p className="text-sm font-mono font-semibold text-blue-900">
                    {selectedBillForHistory.billNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">Buyer</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {selectedBillForHistory.buyer.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">Balance Due</p>
                  <p className="text-sm font-bold text-blue-900">
                    ₹{(selectedBillForHistory.financials?.balanceDue || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-12">
                <FiClock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                            {payment.paymentMethod}
                          </span>
                          <span className="text-sm text-slate-600">
                            {format(new Date(payment.paymentDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 mb-1">
                          ₹{payment.amount.toLocaleString('en-IN')}
                        </p>
                        {payment.notes && (
                          <p className="text-sm text-slate-600 mt-2">{payment.notes}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                          Recorded by: {payment.recordedBy || 'System'}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeletePaymentFromBill(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Payment"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedBill && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedBill(null);
          }}
          title="Bill Details"
          maxWidth="3xl"
        >
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Bill Header */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Bill Number</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedBill.billNumber}</p>
                </div>
                <div
                  className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                    getStatusConfig(selectedBill.status).color
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${getStatusConfig(selectedBill.status).dotColor}`}
                  ></div>
                  <span className="text-sm font-semibold">
                    {getStatusConfig(selectedBill.status).text}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Billing Period</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {selectedBill.billingPeriod.month} {selectedBill.billingPeriod.year}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Generated On</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {format(new Date(selectedBill.generatedAt), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>

            {/* Company & Buyer Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">Company Details</p>
                <p className="font-semibold text-slate-900 mb-1">{selectedBill.company.name}</p>
                {selectedBill.company.gstin && (
                  <p className="text-sm text-slate-600 font-mono">
                    GSTIN: {selectedBill.company.gstin}
                  </p>
                )}
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">Buyer Details</p>
                <p className="font-semibold text-slate-900 mb-1">{selectedBill.buyer.name}</p>
                <p className="text-sm text-slate-600 font-mono">{selectedBill.buyer.mobile}</p>
                {selectedBill.buyer.businessName && (
                  <p className="text-sm text-slate-600 mt-1">{selectedBill.buyer.businessName}</p>
                )}
              </div>
            </div>

            {/* Challans */}
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-4">Included Challans</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Challan No.
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.challans.map((challan, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-sm font-mono text-slate-900">
                          {challan.challanNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {format(new Date(challan.challanDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                          {challan.itemsQty}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                          ₹{challan.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
              <h4 className="text-lg font-bold text-slate-900 mb-4">Financial Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Invoice Total:</span>
                  <span className="font-semibold text-slate-900">
                    ₹{(selectedBill.financials?.invoiceTotal || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedBill.financials?.previousOutstanding > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Previous Outstanding:</span>
                    <span className="font-semibold text-amber-600">
                      ₹{(selectedBill.financials?.previousOutstanding || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold pt-3 border-t border-slate-300">
                  <span className="text-slate-900">Grand Total:</span>
                  <span className="text-blue-600">
                    ₹{(selectedBill.financials?.grandTotal || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedBill.financials?.amountPaid > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Amount Paid:</span>
                      <span className="font-semibold text-green-600">
                        ₹{(selectedBill.financials?.amountPaid || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span className="text-slate-900">Balance Due:</span>
                      <span className="text-red-600">
                        ₹{(selectedBill.financials?.balanceDue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MonthlyBills;
