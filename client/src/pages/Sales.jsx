import { useState, useEffect } from 'react';
import {salesService} from '../services/salesService';
import {settlementService} from '../services/settlementService';
import {settingsService} from '../services/settingsService';
import {inventoryService} from '../services/inventoryService';
import {useEnabledSizes} from '../hooks/useEnabledSizes';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { format } from 'date-fns';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import SkeletonCard from '../components/common/SkeletonCard';
import toast from 'react-hot-toast';
import {
  FiShoppingBag,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiCheckCircle,
  FiTruck,
  FiClock,
  FiRotateCcw,
  FiDollarSign,
  FiXCircle,
  FiAlertTriangle,
  FiFilter,
  FiCalendar,
  FiChevronDown
} from 'react-icons/fi';
import { formatCurrency } from '../utils/dateUtils';
import { useEditSession } from '../hooks/useEditSession'; // ✅ ADD THIS
import EditSessionManager from '../components/EditSessionManager'; // ✅ ADD THIS
import RefillLockStockModal from '../components/RefillLockStockModal';

const Sales = () => {
  const { user } = useAuth();
  const {enabledSizes} = useEnabledSizes();
  const { canEditSales } = usePermissions();
  const { hasActiveSession, refreshSession } = useEditSession(); // ✅ ADD THIS

    // ============ DATA STATES ============
  const [sales, setSales] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [products, setProducts] = useState([]);
  const [marketplaceAccounts, setMarketplaceAccounts] = useState([]);
  const [stockLockSettings, setStockLockSettings] = useState({ enabled: false, lockValue: 0, maxThreshold: 0 });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============ VIEW STATES ============
  const [activeTab, setActiveTab] = useState('dispatched');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // ============ DATE FILTERS ============
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // ============ BULK SELECTION ============
  const [selectedSales, setSelectedSales] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkComments, setBulkComments] = useState('');

  // ============ MODALS ============
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillData, setRefillData] = useState(null);
  const [pendingSettlement, setPendingSettlement] = useState(null);

  // ============ TIMELINE VIEW ============
  const [expandedDate, setExpandedDate] = useState(null);
  const [highlightedAccount, setHighlightedAccount] = useState(null);

  // ============ FORM DATA ============
  const [saleFormData, setSaleFormData] = useState({
    accountName: '',
    marketplaceOrderId: '',
    design: '',
    color: '',
    size: '',
    quantity: 1,
    saleDate: new Date().toISOString().split('T')[0],
    status: 'dispatched',
    notes: '',
    comments: '',
    statusDate: new Date().toISOString().split('T')[0]
  });

  // ============ STOCK LOCK REFILL MODAL ============
  const [showLockRefillModal, setShowLockRefillModal] = useState(false);
  const [lockRefillData, setLockRefillData] = useState({
    currentLock: 0,
    orderNeeds: 0,
    availableStock: 0,
    maxLockThreshold: 0,
    minToAdd: 0,
    maxCanAdd: 0,
    userInput: ''
  });

  const [settlementFormData, setSettlementFormData] = useState({
    accountName: '',
    settlementAmount: '',
    settlementDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // ============ COMPUTED ============
  const isAdmin = user?.role === 'admin';
  const showSettlementsTab = isAdmin || canEditSales;

    // ============ HELPER FUNCTIONS ============
  
  const formatDateCustom = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      dispatched: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      returned: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      wrong_return: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${styles[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getEffectiveDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = null;
    let end = null;

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (dateFilterType) {
      case 'today':
        start = formatDate(today);
        end = formatDate(today);
        break;
      case 'yesterday':
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        start = formatDate(yest);
        end = formatDate(yest);
        break;
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        start = formatDate(last7);
        end = formatDate(today);
        break;
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        start = formatDate(last30);
        end = formatDate(today);
        break;
      case 'thismonth':
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        start = formatDate(thisMonth);
        end = formatDate(today);
        break;
      case 'custom':
        start = customDateRange.startDate;
        end = customDateRange.endDate;
        break;
      default: // 'all'
        break;
    }

    return { start, end };
  };

    // ============ DATA FETCHING ============

const fetchInitialData = async () => {
  try {
    const [productsData, settingsData] = await Promise.all([
      inventoryService.getAllProducts(),
      settingsService.getSettings()
    ]);
    
    setProducts(Array.isArray(productsData) ? productsData : (productsData?.products || []));
    
    // ✅ NEW: Capture stock lock settings
    if (settingsData.stockLockSettings) {
      setStockLockSettings({
        enabled: !!settingsData.stockLockSettings.enabled,
        lockValue: Number(settingsData.stockLockSettings.lockValue || 0),
        maxThreshold: Number(settingsData.stockLockSettings.maxStockLockThreshold || 0)
      });
    }
    
    const accounts = settingsData.marketplaceAccounts;
    const activeAccounts = accounts.filter(acc => acc.isActive);
    setMarketplaceAccounts(activeAccounts);
    
    const defaultAccount = activeAccounts.find(acc => acc.isDefault);
    setSaleFormData(prev => ({
      ...prev,
      accountName: defaultAccount?.accountName || activeAccounts[0]?.accountName || ''
    }));
    setSettlementFormData(prev => ({
      ...prev,
      accountName: defaultAccount?.accountName || activeAccounts[0]?.accountName || ''
    }));
    
    await fetchSales();
    if (isAdmin || user?.role === 'sales') {
      await fetchSettlements();
    }
  } catch (error) {
    console.error(error);
    toast.error('Failed to load initial data');
  } finally {
    setLoading(false);
  }
};

  const fetchSales = async () => {
    try {
      const { start, end } = getEffectiveDateRange();
      const data = await salesService.getAllSales(selectedAccount, 'all', start, end);
      setSales(data);
    } catch (error) {
      toast.error('Failed to fetch sales');
    }
  };

const fetchSettlements = async () => {
  try {
    const result = await settlementService.getAllSettlements(selectedAccount);
    console.log('✅ Settlements fetched:', result);
    setSettlements(Array.isArray(result) ? result : []);
  } catch (error) {
    console.error('❌ Settlements fetch error:', error);
    setSettlements([]);
  }
};

  // ============ EFFECTS ============

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchSales();
      if (showSettlementsTab) {
        fetchSettlements();
      }
    }
  }, [selectedAccount, dateFilterType, customDateRange]);

    // ============ STATS COMPUTATION ============

  const stats = {
    dispatched: sales.filter(s => s.status === 'dispatched').length,
    delivered: sales.filter(s => s.status === 'delivered').length,
    returned: sales.filter(s => s.status === 'returned').length,
    cancelled: sales.filter(s => s.status === 'cancelled').length,
    wrong_return: sales.filter(s => s.status === 'wrong_return').length
  };

  const handleStatClick = (status) => {
    setStatusFilter(status);
    
    if (status === 'all') {
      setActiveTab('dispatched');
    } else if (status === 'dispatched') {
      setActiveTab('dispatched');
    } else if (status === 'delivered') {
      setActiveTab('delivered');
    } else if (['returned', 'cancelled', 'wrong_return'].includes(status)) {
      setActiveTab('returned');
    }
  };

  // ============ FILTERING ============

  const filteredSales = sales.filter(sale => {
    // 1. Tab Filter
    let matchesTab = false;
    if (activeTab === 'dispatched') {
      matchesTab = sale.status === 'dispatched';
    } else if (activeTab === 'delivered') {
      matchesTab = sale.status === 'delivered';
    } else if (activeTab === 'returned') {
      matchesTab = ['returned', 'wrong_return', 'cancelled'].includes(sale.status);
    }

    // 2. Specific Status Filter from Stats Card
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = sale.status === statusFilter;
    }

    return matchesTab && matchesStatus;
  });

    // ============ SELECTION HANDLERS ============

  const handleSelectSale = (id) => {
    setSelectedSales(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedSales.length === filteredSales.length) {
      setSelectedSales([]);
    } else {
      setSelectedSales(filteredSales.map(s => s._id));
    }
  };

const executeBulkAction = async () => {
  try {
    if (bulkAction === 'delivered') {
      // Get all the sales being marked as delivered
      const salesToDeliver = sales.filter(s => selectedSales.includes(s._id));
      
      // Ask if user wants to refill locked stock
      const shouldRefill = window.confirm(
        `Mark ${selectedSales.length} orders as delivered.\n\n` +
        `Do you want to refill locked stock from these delivered orders?\n` +
        `This will add stock back to the locked reserve for future marketplace orders.`
      );

      if (shouldRefill) {
        // Prepare refill data from delivered sales
        const refillItemsMap = new Map();
        
        salesToDeliver.forEach(sale => {
          const key = `${sale.design}-${sale.color}-${sale.size}`;
          if (refillItemsMap.has(key)) {
            const existing = refillItemsMap.get(key);
            existing.refillAmount += sale.quantity;
            existing.newLocked += sale.quantity;
          } else {
            refillItemsMap.set(key, {
              design: sale.design,
              color: sale.color,
              size: sale.size,
              currentLocked: 0, // Will be updated from backend
              refillAmount: sale.quantity,
              newLocked: sale.quantity,
            });
          }
        });

        const refillItems = Array.from(refillItemsMap.values());
        const totalRefill = refillItems.reduce((sum, item) => sum + item.refillAmount, 0);

        setRefillData({
          items: refillItems,
          totalRefillAmount: totalRefill,
          currentTotalLock: 0,
          newTotalLock: totalRefill,
        });

        setPendingSettlement({
          saleIds: selectedSales,
          bulkComments: bulkComments,
        });

        setShowRefillModal(true);
        setShowBulkModal(false);
        return; // Don't execute yet, wait for modal confirmation
      }

      // If not refilling, proceed directly
      await salesService.bulkMarkDelivered(selectedSales, bulkComments);
      toast.success(`Marked ${selectedSales.length} orders as delivered`);
      setShowBulkModal(false);
      setSelectedSales([]);
      setBulkComments('');
      fetchSales();
    }
  } catch (error) {
    console.error('Bulk action error:', error);
    toast.error('Bulk action failed');
  }
};

// ✅ FIXED: Create sale with variant lock check
const createSaleWithLockCheck = async (saleData) => {
  try {
    console.log('🔍 Attempting to create sale:', saleData);
    return await salesService.createSale(saleData);
    
  } catch (error) {
    const errorCode = error.response?.data?.code;
    
    if (errorCode === 'LOCK_EMPTY_REFILL_NEEDED' || errorCode === 'INSUFFICIENT_LOCKED_STOCK') {
      const errorData = error.response?.data;
      const variant = errorData?.variant || {};
      
      console.log('⚠️ Backend says: Need to refill lock!', errorData);
      
      const orderQty = Number(saleData.quantity);
      const currentLocked = errorData?.lockedStock || 0;
      const deficit = orderQty - currentLocked;
      const availableStock = errorData?.availableForLock || 0;
      
      if (availableStock < deficit) {
        throw new Error(
          `Cannot fulfill order. Need ${deficit} more units in locked stock, ` +
          `but only ${availableStock} units are available. ` +
          `Please receive more stock first.`
        );
      }
      
      const refillItems = [{
        design: variant.design || saleData.design,
        color: variant.color || saleData.color,
        size: variant.size || saleData.size,
        currentLocked: currentLocked,
        refillAmount: deficit,
        newLocked: currentLocked + deficit,
      }];

      console.log('📦 Setting refill data:', refillItems); // ✅ ADD THIS
      
      setRefillData({
        items: refillItems,
        totalRefillAmount: deficit,
        currentTotalLock: currentLocked,
        newTotalLock: currentLocked + deficit,
      });

      setPendingSettlement({
        saleData: saleData,
      });

      console.log('🔓 Opening refill modal...'); // ✅ ADD THIS
      
      // ✅ FORCE modal to open
      setTimeout(() => {
        setShowRefillModal(true);
        console.log('✅ Modal should be visible now'); // ✅ ADD THIS
      }, 100);

      return new Promise((resolve, reject) => {
        window.pendingSaleResolve = resolve;
        window.pendingSaleReject = reject;
      });
    }
    
    throw error;
  }
};

// ✅ Handle confirming refill of locked stock
const handleConfirmRefill = async () => {
  if (!refillData || !pendingSettlement) return;

  try {
    const token = localStorage.getItem('token');
    
    // Prepare items array for refilling variant locks
    const itemsToRefill = refillData.items.map(item => ({
      design: item.design,
      color: item.color,
      size: item.size,
      refillBy: item.refillAmount,
    }));

    console.log('🔓 Refilling variant locks (Sales):', itemsToRefill);

    // Call refill API
    const response = await fetch('/api/inventory/refill-variant-lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ items: itemsToRefill }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to refill locked stock');
    }

    const refillResult = await response.json();
    console.log('✅ Locks refilled (Sales):', refillResult);

    // ✅ CASE 1: Creating a new sale (after refilling lock)
    if (pendingSettlement.saleData) {
      try {
        console.log('📤 Creating sale after refill:', pendingSettlement.saleData);
        
        const result = await salesService.createSale(pendingSettlement.saleData);
        
        console.log('✅ Sale created successfully:', result);
        
        toast.success(
          `✅ Locked stock refilled (+${refillData.totalRefillAmount} units)\n` +
          `✅ Order created successfully!`,
          { duration: 5000 }
        );
        
        setShowRefillModal(false);
        setShowSaleModal(false);
        setRefillData(null);
        setPendingSettlement(null);
        setIsSubmitting(false);
        
        if (window.pendingSaleResolve) {
          window.pendingSaleResolve(result);
          delete window.pendingSaleResolve;
          delete window.pendingSaleReject;
        }
        
        fetchSales();
        
        // ✅ Refresh products to get updated lock values
        const productsData = await inventoryService.getAllProducts();
        setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
        
      } catch (saleError) {
        console.error('❌ Sale creation error after refill:', saleError);
        console.error('❌ Error response:', saleError.response?.data);
        
        toast.error(saleError.response?.data?.message || 'Failed to create order after refill');
        
        setIsSubmitting(false);
        
        if (window.pendingSaleReject) {
          window.pendingSaleReject(saleError);
          delete window.pendingSaleResolve;
          delete window.pendingSaleReject;
        }
      }
      return;
    }

    // ✅ CASE 2: Bulk marking as delivered
    if (pendingSettlement.saleIds) {
      await salesService.bulkMarkDelivered(
        pendingSettlement.saleIds,
        pendingSettlement.bulkComments || ''
      );
      toast.success(
        `✅ Locked stock refilled (+${refillData.totalRefillAmount} units)\n` +
        `✅ ${pendingSettlement.saleIds.length} orders marked as delivered!`,
        { duration: 5000 }
      );
      setSelectedSales([]);
      setBulkComments('');
    }
    
    // ✅ CASE 3: Single sale status update
    else if (pendingSettlement.saleId) {
      await salesService.updateSale(
        pendingSettlement.saleId,
        pendingSettlement.settlementData
      );
      toast.success('Order updated and locked stock refilled!');
    }
    
    setShowRefillModal(false);
    setRefillData(null);
    setPendingSettlement(null);
    fetchSales();

  } catch (error) {
    console.error('❌ Refill locked stock error (Sales):', error);
    toast.error(error.message || 'Failed to refill locked stock');
    
    setIsSubmitting(false);
    
    if (window.pendingSaleReject) {
      window.pendingSaleReject(error);
      delete window.pendingSaleResolve;
      delete window.pendingSaleReject;
    }
  }
};

const handleSaleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    if (editingSale) {
      console.log('Updating sale:', editingSale._id);
      const response = await salesService.updateSale(editingSale._id, {
        status: saleFormData.status,
        comments: saleFormData.comments,
        changedAt: saleFormData.statusDate,
      });

      if (response.stockRestored > 0) {
        toast.success(`Stock restored: ${response.stockRestored}`);
      } else if (response.stockDeducted > 0) {
        toast.success(`Stock deducted: ${response.stockDeducted}`);
      } else {
        toast.success('Order updated');
      }
      
      setShowSaleModal(false);
      setIsSubmitting(false);
      fetchSales();
      
    } else {
      console.log('Creating new sale:', saleFormData);
      
      // This might show modal and return pending promise
      await createSaleWithLockCheck(saleFormData);
      
      // ✅ Only close modal and reset if refill modal is NOT showing
      if (!showRefillModal) {
        toast.success('Order created successfully!');
        setShowSaleModal(false);
        setIsSubmitting(false);
        fetchSales();
      }
      // If refill modal is showing, handleConfirmRefill will handle cleanup
    }
  } catch (error) {
    if (error.response?.data?.code !== 'LOCK_EMPTY_REFILL_NEEDED' && 
        error.response?.data?.code !== 'INSUFFICIENT_LOCKED_STOCK') {
      console.error('Sale submit error:', error);
      toast.error(error.response?.data?.message || error.message || 'Operation failed');
      setIsSubmitting(false); // ✅ Only reset on real errors
    }
    // Don't reset isSubmitting for refill modal cases - modal will handle it
  }
  // ✅ REMOVE the finally block - we're handling it manually now
};

const handleConfirmLockRefill = async () => {
  const addAmount = Number(lockRefillData.userInput);
  
  // Validation
  if (!addAmount || addAmount < lockRefillData.minToAdd) {
    toast.error(`Minimum transfer required: ${lockRefillData.minToAdd}`);
    return;
  }
  
  if (addAmount > lockRefillData.maxCanAdd) {
    toast.error(`Maximum you can transfer: ${lockRefillData.maxCanAdd}`);
    return;
  }
  
  try {
    // Call backend to increase lock
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    
    const response = await fetch(`${apiUrl}/settings/increase-stock-lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ increaseBy: addAmount })
    });
    
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.message || 'Failed to transfer stock to lock');
    }
    
    const result = await response.json();
    
    // Update local state
    setStockLockSettings(prev => ({
      ...prev,
      lockValue: result.newLockValue
    }));
    
    toast.success(`Transferred ${addAmount} to locked stock`);
    
    // Now create the sale
    try {
      await salesService.createSale(saleFormData);
      toast.success('Order created successfully');
      
      setShowLockRefillModal(false);
      setShowSaleModal(false);
      
      if (window.__pendingSaleResolve) {
        window.__pendingSaleResolve();
        delete window.__pendingSaleResolve;
        delete window.__pendingSaleReject;
      }
      
      fetchSales();
      
      // Refresh products to get updated lock value
      const productsData = await inventoryService.getAllProducts();
      setProducts(Array.isArray(productsData) ? productsData : (productsData?.products || []));
      
    } catch (saleError) {
      toast.error(saleError.response?.data?.message || 'Failed to create order');
      if (window.__pendingSaleReject) {
        window.__pendingSaleReject(saleError);
      }
    }
    
  } catch (error) {
    toast.error(error.message || 'Failed to transfer stock');
    if (window.__pendingSaleReject) {
      window.__pendingSaleReject(error);
    }
  }
};

const handleCancelLockRefill = () => {
  setShowLockRefillModal(false);
  if (window.__pendingSaleReject) {
    window.__pendingSaleReject(new Error('User cancelled lock refill'));
    delete window.__pendingSaleResolve;
    delete window.__pendingSaleReject;
  }
};

  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await settlementService.createSettlement(settlementFormData);
      toast.success('Settlement recorded');
      setShowSettlementModal(false);
      setSettlementFormData(prev => ({
        ...prev,
        settlementAmount: '',
        notes: ''
      }));
      fetchSettlements();
    } catch (error) {
      toast.error('Failed to record settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

    // ============ DELETE HANDLERS ============

  const handleDelete = async (id) => {
  if (!window.confirm('Delete this order? Stock will be restored.')) return;
  
  try {
    await salesService.deleteSale(id);
    await refreshSession(); // ✅ Refresh session after delete
    toast.success('Order deleted');
    fetchSales();
  } catch (error) {
    // ✅ HANDLE SESSION ERRORS
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.code;
      
      if (errorCode === 'NO_ACTIVE_SESSION') {
        toast.error('⚠️ No active edit session. Please start a session first.');
      } else if (errorCode === 'LIMIT_EXHAUSTED') {
        toast.error('❌ Edit limit exhausted. Your session has ended.');
        await refreshSession();
      } else {
        toast.error(error.response?.data?.message || 'Access denied');
      }
    } else {
      toast.error('Failed to delete');
    }
  }
};

  const handleDeleteSettlement = async (id) => {
    if (!window.confirm('Delete this settlement record?')) return;

    try {
      await settlementService.deleteSettlement(id);
      toast.success('Settlement deleted');
      fetchSettlements();
    } catch (error) {
      toast.error('Failed to delete settlement');
    }
  };

    // ============ EDIT HANDLER ============

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setSaleFormData({
      accountName: sale.accountName,
      marketplaceOrderId: sale.marketplaceOrderId || '',
      design: sale.design,
      color: sale.color,
      size: sale.size,
      quantity: sale.quantity,
      saleDate: sale.saleDate.split('T')[0],
      status: sale.status,
      notes: sale.notes || '',
      comments: '',
      statusDate: new Date().toISOString().split('T')[0]
    });
    setShowSaleModal(true);
  };

  // ============ FORM CHANGE HANDLERS ============

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setSaleFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-fill color and size when design changes
      if (name === 'design') {
        const product = products.find(p => p.design === value);
        if (product && product.colors.length > 0) {
          updated.color = product.colors[0].color;
          const firstSize = product.colors[0].sizes.find(s => enabledSizes.includes(s.size));
          updated.size = firstSize?.size || '';
        }
      }

      return updated;
    });
  };

  const handleSettlementFormChange = (e) => {
    const { name, value } = e.target;
    setSettlementFormData(prev => ({ ...prev, [name]: value }));
  };

    // ============ COPY ORDER ID HANDLER ============

  const handleCopyOrderId = (orderId) => {
    navigator.clipboard.writeText(orderId);
    toast.success('Order ID copied to clipboard');
  };

    // ============ LOADING STATE ============
  
  if (loading) {
    return (
      <div className="p-6">
        <SkeletonCard />
      </div>
    );
  }

  // ============ MAIN RENDER ============
  
  return (
    <div className="p-6 space-y-6">
      
      {/* ============ HEADER CONTROLS ============ */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FiShoppingBag />
            Marketplace Sales
          </h1>
          <p className="text-gray-500">Manage orders, dispatching, and settlements</p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          
          {/* Account Filter */}
          <select
            className="border rounded-lg px-3 py-2 bg-white text-sm"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="all">All Accounts</option>
            {marketplaceAccounts.map(acc => (
              <option key={acc._id} value={acc.accountName}>
                {acc.accountName}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                className="border rounded-lg pl-9 pr-3 py-2 bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thismonth">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Inputs */}
            {dateFilterType === 'custom' && (
              <div className="flex items-center gap-1 bg-white border rounded-lg p-1 animate-fade-in">
                <input
                  type="date"
                  className="text-sm border-none focus:ring-0 text-gray-600 w-32"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  className="text-sm border-none focus:ring-0 text-gray-600 w-32"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {activeTab !== 'settlements' && (
            <button
              onClick={() => {
                setEditingSale(null);
                setSaleFormData(prev => ({
                  ...prev,
                  marketplaceOrderId: '',
                  status: 'dispatched',
                  comments: '',
                  statusDate: new Date().toISOString().split('T')[0]
                }));
                setShowSaleModal(true);
              }}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-indigo-700"
            >
              <FiPlus />
              New Order
            </button>
          )}

          {activeTab === 'settlements' && showSettlementsTab && (
            <button
              onClick={() => setShowSettlementModal(true)}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"
            >
              <FiPlus />
              Settlement
            </button>
          )}
        </div>
      </div>

      {user?.role === 'salesperson' && (
            <div className="mb-6">
              <EditSessionManager />
            </div>
          )}
      {/* ============ STATS CARDS ============ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: 'all', label: 'Total Orders', icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', count: sales.length },
          { id: 'dispatched', label: 'Dispatched', icon: FiTruck, color: 'text-yellow-600', bg: 'bg-yellow-50', count: stats.dispatched },
          { id: 'delivered', label: 'Delivered', icon: FiCheckCircle, color: 'text-green-600', bg: 'bg-green-50', count: stats.delivered },
          { id: 'returned', label: 'Returns', icon: FiRotateCcw, color: 'text-red-600', bg: 'bg-red-50', count: stats.returned },
          { id: 'cancelled', label: 'Cancelled', icon: FiXCircle, color: 'text-gray-600', bg: 'bg-gray-100', count: stats.cancelled },
          { id: 'wrong_return', label: 'Wrong Return', icon: FiAlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', count: stats.wrong_return }
        ].map(card => (
          <div
            key={card.id}
            onClick={() => handleStatClick(card.id)}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
              statusFilter === card.id || (card.id === 'all' && statusFilter === 'all')
                ? 'ring-2 ring-indigo-500 border-transparent'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-md ${card.bg}`}>
                <card.icon className={`text-lg ${card.color}`} />
              </div>
              <span className="text-xl font-bold text-gray-800">{card.count}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ============ TABS ============ */}
      <div className="bg-white rounded-lg p-1 shadow-sm flex space-x-1 overflow-x-auto">
        {[
          { id: 'dispatched', label: 'Dispatched', icon: FiTruck },
          { id: 'delivered', label: 'Delivered', icon: FiCheckCircle },
          { id: 'returned', label: 'Returns & Cancelled', icon: FiRotateCcw },
          ...(showSettlementsTab ? [{ id: 'settlements', label: 'Settlements', icon: FiDollarSign }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setStatusFilter('all');
              setSelectedSales([]);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ FILTER ALERT ============ */}
      {statusFilter !== 'all' && (
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <FiFilter />
            Filtered by status: <b>{statusFilter.toUpperCase().replace('_', ' ')}</b>
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className="underline hover:text-indigo-900"
          >
            Clear Filter
          </button>
        </div>
      )}

            {/* ============ TIMELINE VIEW - ORDERS GROUPED BY DATE ============ */}
      <div className="space-y-3">
        
        {/* SETTLEMENTS VIEW */}
        {activeTab === 'settlements' ? (
          !settlements || settlements.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiDollarSign className="mx-auto text-4xl mb-3 opacity-30" />
              <p>No settlements recorded</p>
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Account</th>
                      <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                      <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map(settlement => (
                      <tr key={settlement._id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm">{formatDateCustom(settlement.settlementDate)}</td>
                        <td className="p-4 text-sm font-medium">{settlement.accountName}</td>
                        <td className="p-4 text-sm font-bold text-green-700">{formatCurrency(settlement.settlementAmount)}</td>
                        <td className="p-4 text-sm text-gray-600">{settlement.notes || '-'}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteSettlement(settlement._id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ) : (

                    // ORDERS VIEW - GROUP BY DATE
          (() => {
            const groupedByDate = filteredSales.reduce((acc, sale) => {
              const dateKey = new Date(sale.saleDate).toDateString();
              if (!acc[dateKey]) {
                acc[dateKey] = {
                  dateString: dateKey,
                  dateObj: new Date(sale.saleDate),
                  orders: []
                };
              }
              acc[dateKey].orders.push(sale);
              return acc;
            }, {});

            const sortedDates = Object.values(groupedByDate).sort((a, b) => b.dateObj - a.dateObj);

            if (sortedDates.length === 0) {
              return (
                <Card>
                  <div className="text-center py-12 text-gray-400">
                    <FiShoppingBag className="mx-auto text-4xl mb-3 opacity-30" />
                    <p>No orders found matching criteria</p>
                  </div>
                </Card>
              );
            }

            return sortedDates.map(dateGroup => {
              const isExpanded = expandedDate === dateGroup.dateString;
              const sortedOrders = [...dateGroup.orders].sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

              // Account breakdown
              const accountBreakdown = dateGroup.orders.reduce((acc, order) => {
                if (!acc[order.accountName]) acc[order.accountName] = 0;
                acc[order.accountName]++;
                return acc;
              }, {});

              // Date label
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              
              let dateLabel;
              if (dateGroup.dateString === today.toDateString()) {
                dateLabel = 'TODAY';
              } else if (dateGroup.dateString === yesterday.toDateString()) {
                dateLabel = 'YESTERDAY';
              } else {
                dateLabel = format(dateGroup.dateObj, 'dd MMM yyyy');
              }

              // Selection state
              const allOrdersSelected = sortedOrders.every(order => selectedSales.includes(order._id));
              const someOrdersSelected = sortedOrders.some(order => selectedSales.includes(order._id)) && !allOrdersSelected;

              return (
                <div key={dateGroup.dateString} className="space-y-0">

                                  {/* DATE HEADER CARD */}
                  <div
                    className={`rounded-xl shadow-md cursor-pointer transition-all duration-300 hover:shadow-xl border-2 ${
                      isExpanded
                        ? 'bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-indigo-400 shadow-indigo-200'
                        : 'bg-white border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => setExpandedDate(isExpanded ? null : dateGroup.dateString)}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        
                        {/* Left: Date and Order Count */}
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${isExpanded ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                            <FiCalendar className={`text-2xl ${isExpanded ? 'text-white' : 'text-gray-600'}`} />
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${isExpanded ? 'text-indigo-900' : 'text-gray-800'}`}>
                              {dateLabel}
                            </h3>
                            <p className={`text-sm font-medium ${isExpanded ? 'text-indigo-600' : 'text-gray-500'}`}>
                              {dateGroup.orders.length} {dateGroup.orders.length === 1 ? 'Order' : 'Orders'}
                              {someOrdersSelected && (
                                <span className="ml-2 text-blue-600">
                                  ({sortedOrders.filter(o => selectedSales.includes(o._id)).length} selected)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right: Account Breakdown */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            {Object.entries(accountBreakdown).map(([account, count]) => (
                              <div
                                key={account}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHighlightedAccount(highlightedAccount === account ? null : account);
                                }}
                                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                                  highlightedAccount === account
                                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {account.includes('Flipkart') ? '🛒' : account.includes('Amazon') ? '📦' : account.includes('Meesho') ? '🛍️' : '🏪'} {account} <span className="font-bold">({count})</span>
                              </div>
                            ))}
                          </div>
                          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                            <FiChevronDown className="text-2xl text-gray-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                                    {/* EXPANDED ORDERS */}
                  {isExpanded && (
                    <div className="animate-slideDown origin-top">
                      <div className="rounded-b-xl shadow-lg border-t-0 rounded-t-none border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/30 to-white">
                        
                        {/* Sticky Header with Select All / Close */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-indigo-200 px-6 py-3 flex items-center justify-between rounded-t-xl">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const orderIds = sortedOrders.map(o => o._id);
                                if (allOrdersSelected) {
                                  setSelectedSales(prev => prev.filter(id => !orderIds.includes(id)));
                                } else {
                                  setSelectedSales(prev => [...new Set([...prev, ...orderIds])]);
                                }
                              }}
                              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                                allOrdersSelected
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  : someOrdersSelected
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={allOrdersSelected}
                                readOnly
                                className="pointer-events-none"
                              />
                              {allOrdersSelected ? 'Deselect All' : someOrdersSelected ? 'Select All' : 'Select All'}
                            </button>
                            {(someOrdersSelected || allOrdersSelected) && (
                              <span className="text-sm font-medium text-gray-600">
                                {sortedOrders.filter(o => selectedSales.includes(o._id)).length}/{sortedOrders.length} selected
                              </span>
                            )}
                          </div>
                          
                          {/* Close Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDate(null);
                            }}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium text-sm hover:bg-red-200 transition-all flex items-center gap-2"
                          >
                            <FiXCircle />
                            Close
                          </button>
                        </div>

                                                    {/* ORDERS LIST */}
                        <div className="p-6 space-y-3">
                          {sortedOrders.map((sale, idx) => {
                            const isHighlighted = highlightedAccount === sale.accountName || highlightedAccount;
                            const isSelected = selectedSales.includes(sale._id);

                            return (
                              <div
                                key={sale._id}
                                onClick={(e) => {
                                  if (e.target.closest('button')) return;
                                  handleSelectSale(sale._id);
                                }}
                                className={`border-2 rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                                  isHighlighted
                                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300 scale-1.01'
                                    : isSelected
                                    ? 'bg-blue-50 border-blue-400 shadow-md'
                                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  
                                  {/* Left: Checkbox + Order Details */}
                                  <div className="flex items-start gap-4 flex-1">
                                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleSelectSale(sale._id)}
                                        className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                                      />
                                    </div>

                                    <div className="flex-1">
                                      {/* Account & Order ID */}
                                      <div className="flex items-center gap-3 mb-2">
                                        <span className="text-3xl">
                                          {sale.accountName.includes('Flipkart') ? '🛒' : sale.accountName.includes('Amazon') ? '📦' : sale.accountName.includes('Meesho') ? '🛍️' : '🏪'}
                                        </span>
                                        <div>
                                          <h4 className="font-bold text-gray-900 text-lg">{sale.accountName}</h4>
                                          
                                          {sale.marketplaceOrderId && (
                                            <div className="flex items-center gap-2 mt-1">
                                              <span
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCopyOrderId(sale.marketplaceOrderId);
                                                }}
                                                className="text-xs text-purple-700 font-mono bg-purple-100 px-2 py-1 rounded cursor-pointer hover:bg-purple-200 transition-colors"
                                                title="Click to copy"
                                              >
                                                🔖 {sale.marketplaceOrderId}
                                              </span>
                                            </div>
                                          )}
                                          
                                          <p className="text-xs text-gray-500">
                                            Order #{idx + 1} • {format(new Date(sale.createdAt), 'hh:mm a')}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Product Details */}
                                      <div className="bg-gray-50 rounded-lg p-3 mb-2">
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                          <div>
                                            <p className="text-xs text-gray-500 mb-1">Product</p>
                                            <p className="font-semibold text-gray-900">{sale.design}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 mb-1">Variant</p>
                                            <p className="font-medium text-gray-700">{sale.color} {sale.size}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 mb-1">Quantity</p>
                                            <p className="font-bold text-gray-900">{sale.quantity}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Notes */}
                                      {sale.notes && (
                                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-sm text-gray-700 italic rounded">
                                          {sale.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Status & Actions */}
                                  <div className="flex flex-col items-end gap-3">
                                    {getStatusBadge(sale.status)}
                                    
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => setViewingHistory(sale)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="View History"
                                      >
                                        <FiClock className="text-gray-600" />
                                      </button>
                                      <button
                                        onClick={() => handleEdit(sale)}
                                        className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                                        title="Edit Status"
                                      >
                                        <FiEdit2 className="text-indigo-600" />
                                      </button>
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleDelete(sale._id)}
                                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <FiTrash2 className="text-red-600" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()
        )}
      </div>

              {/* ============ FLOATING BULK ACTION BAR ============ */}
      {selectedSales.length > 0 && activeTab !== 'settlements' && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-6 z-50 animate-bounce-in">
          <span className="font-semibold">{selectedSales.length} selected</span>
          
          {activeTab === 'dispatched' && (
            <button
              onClick={() => {
                setBulkAction('delivered');
                setShowBulkModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <FiCheckCircle />
              Mark Delivered
            </button>
          )}
          
          <button
            onClick={() => setSelectedSales([])}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ============ SALE MODAL (Create/Edit Order) ============ */}
      <Modal
        isOpen={showSaleModal}
        onClose={() => setShowSaleModal(false)}
        title={editingSale ? 'Update Order Status' : 'Create New Order'}
      >
        <form onSubmit={handleSaleSubmit} className="space-y-4">
          
          {!editingSale && (
            <>
              {/* Account & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                  <select
                    name="accountName"
                    value={saleFormData.accountName}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    {marketplaceAccounts.map(acc => (
                      <option key={acc._id} value={acc.accountName}>
                        {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                  <input
                    type="date"
                    name="saleDate"
                    value={saleFormData.saleDate}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2"
                    required
                  />
                </div>
              </div>

              {/* Marketplace Order ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marketplace Order ID
                  <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="marketplaceOrderId"
                  value={saleFormData.marketplaceOrderId}
                  onChange={handleFormChange}
                  className="w-full border rounded p-2 font-mono text-sm"
                  placeholder="e.g., OD123456789, FKO987654321"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For tracking with {saleFormData.accountName}
                </p>
              </div>

              {/* Product Selection */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Design</label>
                  <select
                    name="design"
                    value={saleFormData.design}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    <option value="">Select</option>
                    {products.map(p => (
                      <option key={p._id} value={p.design}>
                        {p.design}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <select
                    name="color"
                    value={saleFormData.color}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    {products.find(p => p.design === saleFormData.design)?.colors.map(c => (
                      <option key={c.color} value={c.color}>
                        {c.color}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select
                    name="size"
                    value={saleFormData.size}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    {products.find(p => p.design === saleFormData.design)
                      ?.colors.find(c => c.color === saleFormData.color)
                      ?.sizes.filter(s => enabledSizes.includes(s.size))
                      .map(s => (
                        <option key={s.size} value={s.size}>
                          {s.size}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  value={saleFormData.quantity}
                  onChange={handleFormChange}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
            </>
          )}

          {/* Status Change Section (for both create and edit) */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <label className="block text-sm font-bold text-gray-700 mb-2">Order Status</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Status</label>
                <select
                  name="status"
                  value={saleFormData.status}
                  onChange={handleFormChange}
                  className="w-full border rounded p-2 bg-white"
                  required
                >
                  <option value="dispatched">Dispatched / In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="returned">Returned</option>
                  <option value="wrong_return">Wrong Return</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {editingSale && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date of Change</label>
                  <input
                    type="date"
                    name="statusDate"
                    value={saleFormData.statusDate}
                    onChange={handleFormChange}
                    className="w-full border rounded p-2 bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          {editingSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comments <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                name="comments"
                value={saleFormData.comments}
                onChange={handleFormChange}
                className="w-full border rounded p-2"
                rows="2"
                placeholder="Reason for status change..."
              />
            </div>
          )}

          {/* Notes */}
          {!editingSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                name="notes"
                value={saleFormData.notes}
                onChange={handleFormChange}
                className="w-full border rounded p-2"
                rows="2"
                placeholder="Any additional notes..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowSaleModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============ SETTLEMENT MODAL ============ */}
      <Modal
        isOpen={showSettlementModal}
        onClose={() => setShowSettlementModal(false)}
        title="Record Settlement"
      >
        <form onSubmit={handleSettlementSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              name="accountName"
              value={settlementFormData.accountName}
              onChange={handleSettlementFormChange}
              className="w-full border rounded p-2"
              required
            >
              {marketplaceAccounts.map(acc => (
                <option key={acc._id} value={acc.accountName}>
                  {acc.accountName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              name="settlementDate"
              value={settlementFormData.settlementDate}
              onChange={handleSettlementFormChange}
              className="w-full border rounded p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ₹</label>
            <input
              type="number"
              name="settlementAmount"
              value={settlementFormData.settlementAmount}
              onChange={handleSettlementFormChange}
              className="w-full border rounded p-2"
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              name="notes"
              value={settlementFormData.notes}
              onChange={handleSettlementFormChange}
              className="w-full border rounded p-2"
              rows="3"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowSettlementModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Settlement'}
            </button>
          </div>
        </form>
      </Modal>

            {/* ============ ALL MODALS ============ */}
      
      {/* ============ BULK ACTION MODAL ============ */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Mark Delivered"
      >
        <div className="space-y-4">
          <p>
            You are about to update <b>{selectedSales.length}</b> orders.
          </p>
          <textarea
            className="w-full border rounded p-2"
            placeholder="Add a comment (Optional)"
            value={bulkComments}
            onChange={(e) => setBulkComments(e.target.value)}
            rows="3"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowBulkModal(false)}
              className="px-4 py-2 text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={executeBulkAction}
              className="px-4 py-2 bg-indigo-600 text-white rounded"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* ============ HISTORY TIMELINE MODAL ============ */}
      <Modal
        isOpen={!!viewingHistory}
        onClose={() => setViewingHistory(null)}
        title="Order Timeline"
      >
        {viewingHistory && (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p>
                <b>Order:</b> {viewingHistory.design} - {viewingHistory.color} {viewingHistory.size}
              </p>
              <p>
                <b>Account:</b> {viewingHistory.accountName}
              </p>
              {viewingHistory.marketplaceOrderId && (
                <p>
                  <b>Order ID:</b> <span className="font-mono text-purple-600">{viewingHistory.marketplaceOrderId}</span>
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="border-l-2 border-indigo-200 pl-4 space-y-6">
              {viewingHistory.statusHistory?.slice().reverse().map((h, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                  <p className="font-semibold text-gray-800 capitalize">
                    {h.newStatus.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(h.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' • '}
                    {new Date(h.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    by {h.changedBy?.userName || 'System'}
                  </p>
                  {h.comments && (
                    <p className="text-sm bg-yellow-50 p-2 mt-1 rounded text-gray-700 italic">
                      {h.comments}
                    </p>
                  )}
                </div>
              ))}

              {/* Order Created */}
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300"></div>
                <p className="font-semibold text-gray-600">Order Created</p>
                <p className="text-xs text-gray-500">
                  {new Date(viewingHistory.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' • '}
                  {new Date(viewingHistory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Lock Refill Modal */}
{showLockRefillModal && (
  <Modal
    isOpen={showLockRefillModal}
    onClose={handleCancelLockRefill}
    title="⚠️ Insufficient Locked Stock"
  >
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-gray-700 mb-3">
          Your marketplace order needs more stock than currently locked. Transfer stock from available inventory to locked reserve.
        </p>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Current Lock:</span>
            <span className="ml-2 font-semibold">{lockRefillData.currentLock}</span>
          </div>
          <div>
            <span className="text-gray-600">Order Needs:</span>
            <span className="ml-2 font-semibold text-red-600">{lockRefillData.orderNeeds}</span>
          </div>
          <div>
            <span className="text-gray-600">Available Stock:</span>
            <span className="ml-2 font-semibold text-green-600">{lockRefillData.availableStock}</span>
          </div>
          <div>
            <span className="text-gray-600">Max Lock Threshold:</span>
            <span className="ml-2 font-semibold">{lockRefillData.maxLockThreshold}</span>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transfer Amount (Minimum: {lockRefillData.minToAdd}, Maximum: {lockRefillData.maxCanAdd})
        </label>
        <input
          type="number"
          min={lockRefillData.minToAdd}
          max={lockRefillData.maxCanAdd}
          value={lockRefillData.userInput}
          onChange={(e) => setLockRefillData(prev => ({ ...prev, userInput: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder={`Enter amount (${lockRefillData.minToAdd} - ${lockRefillData.maxCanAdd})`}
        />
        <p className="mt-1 text-xs text-gray-500">
          New lock will be: {lockRefillData.currentLock + Number(lockRefillData.userInput || 0)}
        </p>
      </div>
      
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleCancelLockRefill}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirmLockRefill}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Transfer & Create Order
        </button>
      </div>
    </div>
  </Modal>
)}

{/* Refill Lock Stock Modal */}
{console.log('🎨 Rendering modal check:', { showRefillModal, hasRefillData: !!refillData })}
<RefillLockStockModal
  isOpen={showRefillModal}
  onClose={() => {
    console.log('❌ Modal closed by user');
    setShowRefillModal(false);
    setRefillData(null);
    setPendingSettlement(null);
    setIsSubmitting(false); // ✅ ADD THIS
    
    if (window.pendingSaleReject) {
      window.pendingSaleReject(new Error('User cancelled'));
      delete window.pendingSaleResolve;
      delete window.pendingSaleReject;
    }
  }}
  onConfirm={handleConfirmRefill}
  items={refillData?.items || []}
  totalRefillAmount={refillData?.totalRefillAmount || 0}
  currentTotalLock={refillData?.currentTotalLock || 0}
  newTotalLock={refillData?.newTotalLock || 0}
/>
    </div>
  );
};

export default Sales;
