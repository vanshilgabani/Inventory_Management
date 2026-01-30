import { useState, useEffect, useCallback, useRef } from 'react';
import {salesService} from '../services/salesService';
import {settlementService} from '../services/settlementService';
import {settingsService} from '../services/settingsService';
import {inventoryService} from '../services/inventoryService';
import {useEnabledSizes} from '../hooks/useEnabledSizes';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { format } from 'date-fns';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import InsufficientReservedStockModal from '../components/InsufficientReservedStockModal';
import SkeletonCard from '../components/common/SkeletonCard';
import toast from 'react-hot-toast';
import { FiShoppingBag, FiPlus, FiTrash2, FiEdit2, FiCheckCircle, FiTruck, FiClock, FiRotateCcw, FiDollarSign, FiXCircle, FiAlertTriangle, FiFilter, FiCalendar, FiChevronDown, FiPackage, FiUpload, FiSearch, FiX, FiArrowRight, FiAlertCircle, FiFileText, FiInfo } from 'react-icons/fi';
import { formatCurrency } from '../utils/dateUtils';
import Papa from 'papaparse';
import RefillLockStockModal from '../components/RefillLockStockModal';
import SettlementsView from '../components/SettlementsView';
import ScrollToTop from '../components/common/ScrollToTop';
import SKUMappingModal from '../components/modals/SKUMappingModal';
import ImportPreviewModal from '../components/modals/ImportPreviewModal';
import PatternDetectionModal from '../components/modals/PatternDetectionModal';
import BulkSKUMappingModal from '../components/modals/BulkSKUMappingModal';
import FinalImportPreviewModal from '../components/modals/FinalImportPreviewModal';
import ImportResultModal from '../components/modals/ImportResultModal';
import { skuMappingService } from '../services/skuMappingService';

const Sales = () => {
  const { user } = useAuth();
  const {enabledSizes} = useEnabledSizes();
  const { canEditSales } = usePermissions();
  const navigate = useNavigate();
  
  // SKU Mapping states (add after existing state declarations)
  const [showSKUMappingModal, setShowSKUMappingModal] = useState(false);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [showPatternDetectionModal, setShowPatternDetectionModal] = useState(false);
  const [currentUnmappedSKUs, setCurrentUnmappedSKUs] = useState([]);
  const [currentMappingIndex, setCurrentMappingIndex] = useState(0);
  const [completedMappings, setCompletedMappings] = useState([]);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [patternDetectionData, setPatternDetectionData] = useState(null);
  const [pendingImportData, setPendingImportData] = useState(null);
  const [showBulkSKUMappingModal, setShowBulkSKUMappingModal] = useState(false);
  const [showFinalImportPreviewModal, setShowFinalImportPreviewModal] = useState(false);
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResultData, setImportResultData] = useState(null);

  // ============ DATA STATES ============
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
  const [singleDateFilter, setSingleDateFilter] = useState('');

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
  const [showInsufficientReservedModal, setShowInsufficientReservedModal] = useState(false);
  const [insufficientReservedData, setInsufficientReservedData] = useState(null);
  const [pendingSaleData, setPendingSaleData] = useState(null);

    // CSV Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedCsvData, setParsedCsvData] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importAccount, setImportAccount] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFilterDate, setImportFilterDate] = useState(''); // DD/MM/YYYY format  

  const [showFailedOrdersModal, setShowFailedOrdersModal] = useState(false);
  const [failedOrdersData, setFailedOrdersData] = useState({
    failed: [],
    duplicates: [],
    totalSuccess: 0,
    totalFailed: 0,
    totalDuplicates: 0
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); 
  const searchTimeoutRef = useRef(null);
  const [filteredOrders, setFilteredOrders] = useState(null); // For date-filtered orders
  const [searchType, setSearchType] = useState(null); // 'date' | 'order' | null
  const [showSearchModal, setShowSearchModal] = useState(false); // For order ID search results
  const [modalOrders, setModalOrders] = useState([]); // Orders to show in modal
  const [searchResults, setSearchResults] = useState({
    found: false,
    orders: [],
    byStatus: {},
    showPanel: false
  });
  const [isSearching, setIsSearching] = useState(false);

  // ============ TIMELINE VIEW ============
  const [expandedDate, setExpandedDate] = useState(null);
  const [highlightedAccount, setHighlightedAccount] = useState(null);

  // ============ FORM DATA ============
  const [saleFormData, setSaleFormData] = useState({
    accountName: '',
    marketplaceOrderId: '',
    orderItemId: '',
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

  // DATA STATES
const [dateGroups, setDateGroups] = useState([]); // ✅ NEW: Array of {date, orders, count}
const [hasMoreDates, setHasMoreDates] = useState(true); // ✅ NEW
const [lastLoadedDate, setLastLoadedDate] = useState(null); // ✅ NEW
const [isLoadingMore, setIsLoadingMore] = useState(false);

// ✅ NEW: Stats (separate from loaded orders)
const [stats, setStats] = useState({
  total: 0,
  dispatched: 0,
  returned: 0,
  cancelled: 0,
  wrongreturn: 0
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

// ✅ NEW: Fetch stats for cards
const fetchStats = async () => {
  try {
    const { start, end } = getEffectiveDateRange();
    
    // ✅ ALWAYS fetch ALL stats (don't filter by activeTab)
    const data = await salesService.getStatsForCards(
      selectedAccount,
      'all',  // ✅ Always pass 'all' to get all stats
      start,
      end
    );

    setStats(data);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
};

// ✅ NEW: Fetch date groups (initial load)
const fetchDateGroups = async (reset = true) => {
  try {
    if (reset) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingMore(true);
    }

    const { start, end } = getEffectiveDateRange();
    
    const data = await salesService.getOrdersByDateGroups(
      selectedAccount,
      activeTab === 'dispatched' ? 'dispatched' :
      activeTab === 'delivered' ? 'delivered' :
      activeTab === 'returned' ? 'returned,cancelled,wrongreturn' :
      'all',
      start,
      end,
      5, // Load 5 dates at a time
      reset ? null : lastLoadedDate
    );

    // ✅ ADD THIS DEBUG CODE
    console.log('🔍 FRONTEND RECEIVED DATE GROUPS:', data.dateGroups);
    data.dateGroups.slice(0, 2).forEach((group, idx) => {
      console.log(`\n  Frontend Group ${idx + 1}:`);
      console.log(`    - date: ${group.date}`);
      console.log(`    - dateLabel: ${group.dateLabel}`);
      console.log(`    - First order displayDate: ${group.orders[0]?.displayDate}`);
      console.log(`    - First order saleDate: ${group.orders[0]?.saleDate}`);
    });

    if (reset) {
      setDateGroups(data.dateGroups);
    } else {
      setDateGroups(prev => [...prev, ...data.dateGroups]);
    }

    setHasMoreDates(data.pagination.hasMore);
    setLastLoadedDate(data.pagination.nextBeforeDate);

  } catch (error) {
    toast.error('Failed to fetch orders');
  } finally {
    setIsLoadingMore(false);
  }
};

// ✅ NEW: Load more dates (button click)
const loadMoreDates = async () => {
  if (!hasMoreDates || isLoadingMore) return;
  await fetchDateGroups(false);
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

  // ✅ ADD THIS: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

// ✅ ENHANCED: Re-apply search when tab changes
useEffect(() => {
  if (!loading) {
    if (activeTab === 'settlements' && showSettlementsTab) {
      fetchSettlements();
    } else if (activeTab !== 'settlements') {
      fetchStats();
      fetchDateGroups(true);
      
      // ✅ ADD THIS: Re-trigger date search if one was active
      if (searchQuery && searchType === 'date') {
        console.log('🔄 Re-applying date search to new tab:', searchQuery);
        handleSearch(searchQuery);
      }
    }
  }
}, [loading, selectedAccount, dateFilterType, customDateRange, activeTab, showSettlementsTab]);

const handleStatClick = (status) => {
  // Ignore Total Orders card
  if (status === 'all') {
    return;
  }
  
  setStatusFilter(status);
  
  // Force refresh by toggling activeTab
  if (status === 'dispatched') {
    if (activeTab === 'dispatched') {
      // Already on dispatched - force refresh
      setActiveTab('temp');
      setTimeout(() => setActiveTab('dispatched'), 0);
    } else {
      setActiveTab('dispatched');
    }
  } else if (status === 'delivered') {
    setActiveTab('delivered');
  } else if (['returned', 'cancelled', 'wrongreturn'].includes(status)) {
    setActiveTab('returned');
  }
};

    // ============ SELECTION HANDLERS ============

  const handleSelectSale = (id) => {
    setSelectedSales(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allOrders = dateGroups.flatMap(dg => dg.orders);
    if (selectedSales.length === allOrders.length) {
      setSelectedSales([]);
    } else {
      setSelectedSales(allOrders.map((s) => s._id));
    }
  };

// Helper: Group orders by date (used for search results)
const groupOrdersByDate = (orders) => {
  const grouped = new Map();
  
  orders.forEach(order => {
    // ✅ USE displayDate if available, fallback to saleDate
    const orderDate = order.displayDate || new Date(order.saleDate).toISOString().split('T')[0];
    
    if (!grouped.has(orderDate)) {
      grouped.set(orderDate, {
        date: orderDate,
        dateString: orderDate,
        dateObj: new Date(orderDate),
        dateLabel: formatDateLabel(orderDate),
        orders: [],
        orderCount: 0,
        accountBreakdown: {}
      });
    }

    const group = grouped.get(orderDate);
    group.orders.push(order);
    group.orderCount++;

    if (!group.accountBreakdown[order.accountName]) {
      group.accountBreakdown[order.accountName] = 0;
    }
    group.accountBreakdown[order.accountName]++;
  });

  return Array.from(grouped.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Helper: Format date labels
const formatDateLabel = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const orderDate = new Date(dateString);
  orderDate.setHours(0, 0, 0, 0);
  
  if (orderDate.getTime() === today.getTime()) {
    return 'TODAY';
  } else if (orderDate.getTime() === yesterday.getTime()) {
    return 'YESTERDAY';
  } else {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
};

// Enhanced search with date filtering
// Enhanced search with date filtering
const handleSearch = useCallback(async (searchValue) => {
  if (!searchValue || !searchValue.trim()) {
    setSearchQuery('');
    setFilteredOrders(null);
    setSearchType(null);
    setModalOrders([]);
    setShowSearchModal(false);
    return;
  }

  const query = searchValue.trim();
  setSearchQuery(query);

  // Check if input is a date (26/1/2026, 26/01/26, 26-1-2026, etc.)
  const datePatterns = [
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/, // 26/1/2026 or 26/01/26 or 26-1-2026
  ];

  let isDateSearch = false;
  let searchDate = null;

  for (const pattern of datePatterns) {
    const match = query.match(pattern);
    if (match) {
      isDateSearch = true;
      let [, day, month, year] = match;
      
      // Pad single digits
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      // Handle 2-digit year
      if (year.length === 2) {
        year = '20' + year;
      }
      
      // Create date in YYYY-MM-DD format
      searchDate = `${year}-${month}-${day}`;
      console.log('📅 Date search detected:', searchDate);
      break;
    }
  }

  // STEP 1: Search locally in current loaded orders
  const allOrders = dateGroups.flatMap(dg => dg.orders);
  
  if (isDateSearch && searchDate) {
    // ============ DATE SEARCH ============
    setSearchType('date');
    
    // Filter by date (local)
    const localResults = allOrders.filter(sale => {
      const saleDate = new Date(sale.saleDate).toISOString().split('T')[0];
      return saleDate === searchDate;
    });

    if (localResults.length > 0) {
      console.log(`Found ${localResults.length} results for date ${searchDate} locally`);
      const grouped = groupOrdersByDate(localResults);
      setFilteredOrders(grouped);
      toast.success(`Found ${localResults.length} order(s) for ${query}`);
      return;
    }

    // Not found locally - search backend
    console.log('Date not found locally, searching backend...');
    setIsSearching(true);
    
    try {
      const result = await salesService.searchByDate(searchDate, selectedAccount, activeTab);
      
      if (result.found && result.orders.length > 0) {
        const grouped = groupOrdersByDate(result.orders);
        setFilteredOrders(grouped);
        toast.success(`Found ${result.orders.length} order(s) for ${query}`);
      } else {
        toast.error('No orders found for this date');
        setFilteredOrders([]);
      }
    } catch (error) {
      console.error('Date search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  } else {
    // ============ ORDER ID / ORDER ITEM ID SEARCH ============
    setSearchType('order');
    
    // Text search (local) - for Order ID or Order Item ID
    const localResults = allOrders.filter(sale => {
      const q = query.toLowerCase();
      return (
        sale.orderItemId?.toLowerCase().includes(q) ||
        sale.marketplaceOrderId?.toLowerCase().includes(q) ||
        sale.design?.toLowerCase().includes(q) ||
        sale.color?.toLowerCase().includes(q) ||
        sale.size?.toLowerCase().includes(q)
      );
    });

    if (localResults.length > 0) {
      console.log(`Found ${localResults.length} results locally`);
      setModalOrders(localResults);
      setShowSearchModal(true);
      toast.success(`Found ${localResults.length} order(s)`);
      return;
    }

    // Not found locally - search globally (backend)
    console.log('Not found locally, searching globally...');
    setIsSearching(true);
    
    try {
      const result = await salesService.searchGlobally(query);

      if (result.found && result.orders.length > 0) {
        setModalOrders(result.orders);
        setShowSearchModal(true);
        toast.success(`Found ${result.orders.length} order(s)`);
      } else {
        toast.error('No orders found');
      }
    } catch (error) {
      console.error('Global search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  }
}, [dateGroups, selectedAccount, activeTab]);

// ✅ ENHANCED: Clear search filter and refresh normal view
const clearSearchFilter = () => {
  setSearchInput('');
  setSearchQuery('');
  setFilteredOrders(null);
  setSearchType(null);
  setModalOrders([]);
  setShowSearchModal(false);

  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }

  // ✅ ADD THIS: Refresh the normal view after clearing
  fetchDateGroups(true);
  toast.success('Search cleared', { duration: 2000 });
};

// NEW: Input handler - NO auto-search, only on Enter or button click
const handleSearchInput = (value) => {
  setSearchInput(value);
  
  // Clear existing timeout
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }

  // Clear results if empty
  if (!value || !value.trim()) {
    setSearchQuery('');
    setSearchResults({ found: false, orders: [], byStatus: {}, showPanel: false });
    setFilteredOrders(null);
    setSearchType(null);
    return;
  }

  // ❌ REMOVED: No auto-search! User must press Enter or click Search button
};

// ✅ NEW: Handle Enter key press for instant search
const handleSearchKeyPress = (e) => {
  if (e.key === 'Enter') {
    // Clear timeout and search immediately
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    handleSearch(searchInput);
  }
};

// Navigate to specific order from search results
const navigateToOrder = (order) => {
  // Map status to correct tab
  const tab = (order.status === 'returned' || order.status === 'cancelled' || order.status === 'wrongreturn') 
    ? 'returned' 
    : order.status;
  
  setActiveTab(tab);
  setSearchQuery(order.orderItemId); // Keep search term to highlight
  setSearchResults(prev => ({ ...prev, showPanel: false }));
  toast.success(`Viewing in ${order.status} tab`, { duration: 2000 });
};

// ✅ UPDATED SKU PARSER - Handles underscore format
const parseFlipkartSKU = (sku) => {
  if (!sku) return { design: null, color: null, size: null };

  // Remove # and commas, trim
  const cleaned = sku.replace(/#/g, '').replace(/,/g, '').trim();

  // ✅ CHECK FOR UNDERSCORE (Color_Size format)
  if (cleaned.includes('_')) {
    // Format: XXX-XXX-XXX-Color_Size
    const parts = cleaned.split('-');
    
    if (parts.length < 2) {
      return { design: null, color: null, size: null };
    }

    // Last part contains Color_Size
    const lastPart = parts[parts.length - 1];
    
    if (lastPart.includes('_')) {
      const [colorPart, sizePart] = lastPart.split('_');
      
      // Design is everything except the last part
      const design = parts.slice(0, -1).join('-');
      const color = colorPart.trim();
      let size = sizePart.trim();
      
      // Convert numeric size to letter (30 -> M, 32 -> L, 34 -> XL, 36 -> XXL)
      const sizeMap = {
        '28': 'S',
        '30': 'M',
        '32': 'L',
        '34': 'XL',
        '36': 'XXL',
        '38': 'XXXL'
      };
      
      size = sizeMap[size] || size;
      
      return {
        design: design || null,
        color: color || null,
        size: size || null
      };
    }
  }

  // ✅ STANDARD DASH FORMAT (existing logic)
  const parts = cleaned.split('-');

  if (parts.length < 3) return { design: null, color: null, size: null };

  let design, color, size;

  // Pattern 1: D-11-KHAKHI-XL (D and number separate)
  if (parts[0] === 'D' && !isNaN(parts[1])) {
    design = 'D' + parts[1];
    color = parts.slice(2, -1).join('-');
    size = parts[parts.length - 1];
  } 
  // Pattern 2: D9-L.GREY-L (D and number together)
  else if (parts[0].startsWith('D') && !isNaN(parts[0].substring(1))) {
    design = parts[0];
    color = parts.slice(1, -1).join('-');
    size = parts[parts.length - 1];
  } 
  // Pattern 3: Multi-part design
  else {
    const lastPart = parts[parts.length - 1];
    size = lastPart;
    color = parts[parts.length - 2];
    design = parts.slice(0, -2).join('-');
  }

  // Clean color (remove dots, spaces)
  if (color) {
    color = color.replace(/\./g, ' ').trim();
  }

  return { design, color, size };
};

const handleCSVUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!importAccount) {
    toast.error('Please select an account first');
    return;
  }

  if (!importFilterDate) {
    toast.error('Please enter dispatch date first');
    return;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(importFilterDate)) {
    toast.error('Invalid date format');
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      console.log('CSV Parsed - Total rows:', results.data.length);

      // ✅ STEP 1: AUTO-DETECT CSV TYPE
      const allStatuses = new Set();
      results.data.forEach(row => {
        const status = row['Order State'];
        if (status) allStatuses.add(status);
      });

      const hasPending = allStatuses.has('Ready to dispatch');
      const hasShipped = allStatuses.has('Shipped');
      const hasReturnRequested = allStatuses.has('Return Requested');
      const hasReturned = allStatuses.has('Returned');

      let detectedType = null;
      let validStatuses = [];
      let skipStatuses = [];

      // Detection logic
      if (hasPending && !hasShipped && !hasReturnRequested && !hasReturned) {
        detectedType = 'pending';
        validStatuses = ['Ready to dispatch'];
        skipStatuses = [];
      } else if (!hasPending && (hasShipped || hasReturnRequested || hasReturned)) {
        detectedType = 'dispatched';
        validStatuses = ['Shipped'];
        skipStatuses = ['Return Requested', 'Returned'];
      } else {
        toast.error('Mixed CSV detected! Please download separate CSVs for pending and dispatched orders.');
        return;
      }

      console.log(`🔍 Detected CSV Type: ${detectedType}`);
      console.log(`✅ Valid Statuses: ${validStatuses.join(', ')}`);
      console.log(`⚠️ Skip Statuses: ${skipStatuses.join(', ')}`);

      // ✅ STEP 2: GENERATE PREVIEW
      const preview = {
        success: [],
        failed: [],
        skipped: [],
        detectedType,
        productBreakdown: new Map()
      };

      results.data.forEach((row, idx) => {
        const rowNumber = idx + 2;
        const status = row['Order State'];

        // Skip orders
        if (skipStatuses.includes(status)) {
          preview.skipped.push({
            orderId: row['Order Id'],
            sku: row['SKU'],
            status: status
          });
          return;
        }

        // Check if status is valid
        if (!validStatuses.includes(status)) {
          preview.failed.push({
            row: rowNumber,
            reason: `Invalid status "${status}"`,
            sku: row['SKU'],
            orderId: row['Order Id']
          });
          return;
        }

        // Parse SKU
        const sku = row['SKU'];
        const { design, color, size } = parseFlipkartSKU(sku);

        if (!design || !color || !size) {
          preview.failed.push({
            row: rowNumber,
            reason: 'Unable to parse SKU',
            sku: sku || 'N/A',
            orderId: row['Order Id']
          });
          return;
        }

        const quantity = parseInt(row['Quantity']) || 1;

        // Add to success
        preview.success.push({
          design,
          color,
          size,
          quantity,
          orderId: row['Order Id'],
          orderItemId: row['ORDER ITEM ID']?.replace(/'/g, '').trim(),
          sku
        });

        // ✅ Product breakdown for preview
        const variantKey = `${design}-${color}-${size}`;
        if (preview.productBreakdown.has(variantKey)) {
          const existing = preview.productBreakdown.get(variantKey);
          existing.quantity += quantity;
          existing.orderCount += 1;
        } else {
          preview.productBreakdown.set(variantKey, {
            design,
            color,
            size,
            quantity,
            orderCount: 1
          });
        }
      });

      setImportPreview(preview);
      setParsedCsvData(preview.success);

      const typeLabel = detectedType === 'pending' ? 'PENDING HANDOVER' : 'DISPATCHED ORDERS';
      toast.success(
        `🔍 Detected: ${typeLabel}\n` +
        `✅ ${preview.success.length} orders to import\n` +
        `⚠️ ${preview.skipped.length} orders skipped (returns)`,
        { duration: 5000 }
      );
    },
    error: (error) => {
      console.error('CSV Parse Error:', error);
      toast.error('Failed to parse CSV file');
    }
  });
};

const handleImportSubmit = async () => {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 handleImportSubmit CALLED');
  console.log('═══════════════════════════════════════════');

  if (!importAccount) {
    toast.error('Please select an account');
    return;
  }

  if (!importFilterDate) {
    toast.error('Please enter dispatch date');
    return;
  }

  if (!parsedCsvData || parsedCsvData.length === 0) {
    toast.error('No data to import');
    return;
  }

  try {
    setIsImporting(true);

    // ✅ NEW STEP 0: Check existing SKU mappings FIRST
    console.log('🗺️ STEP 0: Checking existing SKU mappings...');
    const uniqueSKUs = [...new Set(parsedCsvData.map(row => row.sku).filter(Boolean))];
    
    let existingMappings = {};
    try {
      const mappingResponse = await skuMappingService.getBulkMappings(importAccount, uniqueSKUs);
      existingMappings = mappingResponse.mappings || {};
      console.log(`✅ Found ${Object.keys(existingMappings).length} existing mappings`);
    } catch (error) {
      console.warn('Failed to fetch existing mappings:', error);
    }

    // ✅ STEP 1: Check for unmapped SKUs (accounting for existing mappings)
    console.log('🔍 STEP 1: Checking SKUs against inventory + mappings...');
    const skuCounts = {};

    parsedCsvData.forEach((row, index) => {
      const sku = row.sku;
      let design, color, size;

      // Check if mapping exists for this SKU
      if (sku && existingMappings[sku]) {
        design = existingMappings[sku].design;
        color = existingMappings[sku].color;
        size = existingMappings[sku].size;
        console.log(`  ✅ Row ${index + 1}: ${sku} → Found in mappings: ${design}-${color}-${size}`);
      } else {
        // Use parsed data
        design = row.design;
        color = row.color;
        size = row.size;
      }

      // Check if this product variant exists in inventory
      const product = products.find(p => p.design === design);
      let exists = false;

      if (product) {
        const colorVariant = product.colors.find(c => c.color === color);
        if (colorVariant) {
          const sizeVariant = colorVariant.sizes.find(s => s.size === size);
          if (sizeVariant) {
            exists = true;
          }
        }
      }

      console.log(`  Row ${index + 1}: ${design}-${color}-${size} | Exists=${exists}`);

      // If product doesn't exist in inventory AND no mapping exists, mark as unmapped
      if (!exists && !(sku && existingMappings[sku])) {
        if (!skuCounts[sku]) {
          skuCounts[sku] = { sku, count: 0 };
        }
        skuCounts[sku].count++;
      }
    });

    const unmappedList = Object.values(skuCounts);
    console.log('');
    console.log('📋 Unmapped SKUs Summary:');
    console.log('  - Total unmapped SKUs:', unmappedList.length);
    console.log('  - Unmapped list:', unmappedList);

    // If there are unmapped SKUs, show preview modal
    if (unmappedList.length > 0) {
      console.log('🗺️ UNMAPPED SKUs FOUND - SHOWING MODAL');

      const previewData = {
        totalOrders: parsedCsvData.length,
        validOrders: parsedCsvData.length - unmappedList.reduce((sum, u) => sum + u.count, 0),
        unmappedSKUs: unmappedList,
        skippedOrders: importPreview?.skipped?.length || 0,
        accountName: importAccount
      };

      console.log('📦 Preview Data:', previewData);

      setImportPreviewData(previewData);
      setCurrentUnmappedSKUs(unmappedList);
      setPendingImportData({ parsedCsvData, importAccount, importFilterDate });
      setShowImportModal(false);
      setShowImportPreviewModal(true);
      setIsImporting(false);

      toast.success(`Found ${unmappedList.length} SKU formats that need mapping`);
      console.log('Modal should now be visible!');
      return;
    }

    // No unmapped SKUs - proceed with backend import
    console.log('✅ All SKUs mapped or exist in inventory, calling backend...');
    
    const result = await salesService.importFromCSV(
      parsedCsvData,
      importAccount,
      importFilterDate
    );

    handleImportSuccess(result);
  } catch (error) {
    console.error('❌ Import error:', error);
    toast.error(error.response?.data?.message || 'Import failed');
    setIsImporting(false);
  }
};

const handleFinalImportConfirm = async () => {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 FINAL IMPORT CONFIRM - Executing Import');
  console.log('═══════════════════════════════════════════');

  if (!pendingImportData) {
    toast.error('No import data found');
    return;
  }

  try {
    setIsImporting(true);

    const { parsedCsvData, importAccount, importFilterDate } = pendingImportData;

    console.log('📤 Sending to backend:', {
      orders: parsedCsvData.length,
      account: importAccount,
      date: importFilterDate
    });

    const result = await salesService.importFromCSV(
      parsedCsvData,
      importAccount,
      importFilterDate
    );

    console.log('✅ Import response:', result);

    const { success, failed, duplicates } = result.data;

    // Close final preview modal
    setShowFinalImportPreviewModal(false);

    // Show success modal with results
    setImportResultData({
      success: success || [],
      failed: failed || [],
      duplicates: duplicates || [],
      totalSuccess: success?.length || 0,
      totalFailed: failed?.length || 0,
      totalDuplicates: duplicates?.length || 0,
      mappedSKUs: completedMappings.length
    });
    setShowImportResultModal(true);

    // Reset states
    setPendingImportData(null);
    setParsedCsvData([]);
    setImportPreview(null);
    setImportFilterDate('');
    setImportAccount('');
    setCompletedMappings([]);
    setCurrentUnmappedSKUs([]);

    // Refresh sales data
    fetchStats(); // Refresh stats
    fetchDateGroups(true); // Refresh orders

  } catch (error) {
    console.error('❌ Import error:', error);
    toast.error(error.response?.data?.message || 'Import failed');
  } finally {
    setIsImporting(false);
  }
};

const handleImportSuccess = (result) => {
  const { success, failed, duplicates } = result.data;

  // Show summary
  let message = '';
  if (success.length > 0) message += `${success.length} orders imported successfully! `;
  if (duplicates.length > 0) message += `${duplicates.length} duplicates. `;
  if (failed.length > 0) message += `${failed.length} failed.`;

  toast.success(message || 'Import completed');

  // Check if we should show pattern detection
  if (completedMappings.length >= 3) {
    detectPattern();
  }

  // Reset and close
  setShowImportModal(false);
  setParsedCsvData([]);
  setImportPreview(null);
  setImportFilterDate('');
  setImportAccount('');
  setIsImporting(false);
  setCompletedMappings([]);
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders

  // Show failed orders modal if needed
  if (failed.length > 0 || duplicates.length > 0) {
    setFailedOrdersData({
      failed,
      duplicates,
      totalSuccess: success.length,
      totalFailed: failed.length,
      totalDuplicates: duplicates.length
    });
    setShowFailedOrdersModal(true);
  }
};

const handleStartMapping = () => {
  setShowImportPreviewModal(false);
  setCurrentMappingIndex(0);
  setCompletedMappings([]);
  setShowSKUMappingModal(true);
};

const handleMappingComplete = (mapping) => {
  const newMappings = [...completedMappings, mapping];
  setCompletedMappings(newMappings);

  // Move to next unmapped SKU
  const nextIndex = currentMappingIndex + 1;
  if (nextIndex < currentUnmappedSKUs.length) {
    setCurrentMappingIndex(nextIndex);
  } else {
    // All SKUs mapped - retry import
    setShowSKUMappingModal(false);
    retryImportAfterMapping();
  }
};

const retryImportAfterMapping = async () => {
  if (!pendingImportData) return;

  try {
    setIsImporting(true);
    const { parsedCsvData, importAccount, importFilterDate } = pendingImportData;

    const result = await salesService.importFromCSV(
      parsedCsvData,
      importAccount,
      importFilterDate
    );

    handleImportSuccess(result);
  } catch (error) {
    console.error('Retry import error:', error);
    toast.error('Import failed after mapping');
    setIsImporting(false);
  }
};

const detectPattern = () => {
  if (completedMappings.length < 3) return;

  // Analyze mappings to detect pattern
  const firstMapping = completedMappings[0];
  const sku = firstMapping.sku;

  // Simple pattern detection (you can enhance this)
  let pattern = sku;
  const sizeMappings = {};

  completedMappings.forEach(m => {
    // Extract numeric size from SKU if present
    const sizeMatch = m.sku.match(/(\d{2})$/);
    if (sizeMatch) {
      sizeMappings[sizeMatch[1]] = m.size;
    }

    // Replace specific parts with placeholders
    pattern = pattern.replace(m.design, '{XX}');
    pattern = pattern.replace(m.color, '{COLOR}');
    if (sizeMatch) {
      pattern = pattern.replace(sizeMatch[1], '{SIZE}');
    }
  });

  setPatternDetectionData({
    pattern,
    mappings: completedMappings,
    sizeMappings
  });

  setShowPatternDetectionModal(true);
};

const handleEnablePattern = () => {
  toast.success('Pattern enabled! Future imports will be faster.');
  setShowPatternDetectionModal(false);
  setPatternDetectionData(null);
  // You can save pattern to backend here if needed
};

const handleSkipPattern = () => {
  toast.info('Pattern not saved. You can enable it later in settings.');
  setShowPatternDetectionModal(false);
  setPatternDetectionData(null);
};

const executeBulkAction = async () => {
  try {
    if (bulkAction === 'delivered') {
      // Get all the sales being marked as delivered
      const allOrders = dateGroups.flatMap(dg => dg.orders);
      const salesToDeliver = allOrders.filter((s) => selectedSales.includes(s._id));
      
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
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
    }
  } catch (error) {
    console.error('Bulk action error:', error);
    toast.error('Bulk action failed');
  }
};

// NEW: Create sale with reserved stock validation
const createSaleWithReservedCheck = async (saleData) => {
  try {
    console.log('Attempting to create sale:', saleData);
    const result = await salesService.createSale(saleData);
    return result; // ✅ Successfully created without modal
  } catch (error) {
    const errorCode = error.response?.data?.code;

    // Handle insufficient reserved stock - need main stock
    if (errorCode === 'RESERVED_INSUFFICIENT_USE_MAIN') {
      const errorData = error.response?.data;
      const variant = errorData?.variant;
      console.log('Reserved stock insufficient, need main stock:', errorData);

      // Store data for modal
      setInsufficientReservedData({
        variant: variant,
        reservedStock: errorData?.reservedStock || 0,
        mainStock: errorData?.mainStock || 0,
        required: errorData?.required || 0,
        deficit: errorData?.deficit || 0,
      });
      setPendingSaleData(saleData);
      setShowInsufficientReservedModal(true);

      // ✅ Return a NEW promise that will be resolved by modal
      return new Promise((resolve, reject) => {
        window.pendingSaleResolve = resolve;
        window.pendingSaleReject = reject;
      });
    }

    // Other errors - throw normally
    throw error;
  }
};

// ✅ NEW: Handle confirmation to use main stock
const handleConfirmUseMainStock = async () => {
  if (!insufficientReservedData || !pendingSaleData) return;
  
  try {
    console.log('User confirmed using main stock, creating sale...');
    console.log('📦 Sending data:', pendingSaleData);
    
    // Call new endpoint with flag to use main stock
    const result = await salesService.createSaleWithMainStock({
      ...pendingSaleData,
      useMainStock: true
    });
    
    console.log('Sale created successfully with main stock:', result);
    
    toast.success('Order created using main inventory!', { duration: 5000 });
    
    // Close modals and reset
    setShowInsufficientReservedModal(false);
    setInsufficientReservedData(null);
    setPendingSaleData(null);
    setShowSaleModal(false);
    setIsSubmitting(false);
    
    // Resolve pending promise
    if (window.pendingSaleResolve) {
      window.pendingSaleResolve(result);
      delete window.pendingSaleResolve;
      delete window.pendingSaleReject;
    }
    
    // Refresh data
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
    
    // Refresh products to get updated stock
    const productsData = await inventoryService.getAllProducts();
    setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
    
  } catch (error) {
    console.error('Failed to create sale with main stock:', error);
    console.error('❌ Full error response:', error.response?.data);
    toast.error(error.response?.data?.message || 'Failed to create order');
    setIsSubmitting(false);
    
    if (window.pendingSaleReject) {
      window.pendingSaleReject(error);
      delete window.pendingSaleResolve;
      delete window.pendingSaleReject;
    }
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
        
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
        
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
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders

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
      // Update existing sale logic (keep as is)
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
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
    } else {
      // NEW: Create new sale with reserved stock check
      console.log('Creating new sale:', saleFormData);
      
      // ✅ This will either succeed OR show modal (and return pending promise)
      const result = await createSaleWithReservedCheck(saleFormData);
      
      // ✅ If we got here with a result, order was created successfully
      if (result && !showInsufficientReservedModal) {
        toast.success('Order created successfully!');
        setShowSaleModal(false);
        setIsSubmitting(false);
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
      }
      // ✅ If modal is showing, handleConfirmUseMainStock will handle everything
    }
  } catch (error) {
    // Only handle real errors (not modal triggers)
    if (error.response?.data?.code !== 'RESERVED_INSUFFICIENT_USE_MAIN') {
      console.error('Sale submit error:', error);
      toast.error(error.response?.data?.message || error.message || 'Operation failed');
      setIsSubmitting(false);
    }
    // Don't reset isSubmitting if modal is showing
  }
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
      
fetchStats(); // Refresh stats
fetchDateGroups(true); // Refresh orders
      
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
    // ✅ Call delete API
    const response = await salesService.deleteSale(id);
    
    // ✅ Check if backend returned success
    if (response?.success || response?.message) {
      // Remove from dateGroups
      setDateGroups(prevGroups => 
        prevGroups.map(group => ({
          ...group,
          orders: group.orders.filter(sale => sale._id !== id && sale.id !== id),
          orderCount: group.orders.filter(sale => sale._id !== id && sale.id !== id).length
        })).filter(group => group.orders.length > 0) // Remove empty date groups
      );
            
      // ✅ Show detailed success message with stock restoration info
      const stockInfo = response?.stockRestored 
        ? ` (${response.stockRestored} units restored to reserved stock)` 
        : '';
      
      toast.success(`Order deleted successfully${stockInfo}`, {
        icon: '✅',
        duration: 4000
      });
    } else {
      throw new Error('Delete response invalid');
    }
  } catch (error) {
    console.error('Delete error:', error);
    
    // HANDLE SESSION ERRORS
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.code;
      if (errorCode === 'NO_ACTIVE_SESSION') {
        toast.error('No active edit session. Please start a session first.');
      } else if (errorCode === 'LIMIT_EXHAUSTED') {
        toast.error('Edit limit exhausted. Your session has ended.');
        await refreshSession();
      } else {
        toast.error(error.response?.data?.message || 'Access denied');
      }
    } else {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete order');
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
      orderItemId: sale.orderItemId || '',
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

  const allOrders = dateGroups.flatMap(dg => dg.orders || []);

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
        <div className="flex flex-col lg:flex-row gap-3 w-full">
          {/* Left Side - Filters */}
          <div className="flex flex-wrap gap-2 items-center flex-1">
            {/* Account Filter */}
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="all">All Accounts</option>
              {marketplaceAccounts.map((acc) => (
                <option key={acc._id} value={acc.accountName}>
                  {acc.accountName}
                </option>
              ))}
            </select>

            {/* SEARCH BAR WITH COMPACT BUTTON */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Date(26/01/2026), ID"
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchInput && (
                  <button
                    onClick={clearSearchFilter}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <FiX />
                  </button>
                )}
              </div>
              
              {/* COMPACT SEARCH BUTTON */}
              <button
                onClick={() => {
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                  if (searchInput.trim()) {
                    handleSearch(searchInput);
                  }
                }}
                disabled={!searchInput.trim() || isSearching}
                className={`
                  p-3 rounded-lg transition-all
                  ${searchInput.trim() && !isSearching
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
                title="Search (or press Enter)"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <FiSearch className="text-xl" />
                )}
              </button>
            </div>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeTab !== 'settlements' && (
              <>
                <button
                  onClick={() => {
                    setEditingSale(null);
                    setSaleFormData((prev) => ({
                      ...prev,
                      marketplaceOrderId: '',
                      orderItemId: '',
                      status: 'dispatched',
                      comments: '',
                      statusDate: new Date().toISOString().split('T')[0]
                    }));
                    setShowSaleModal(true);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>New Order</span>
                </button>

                <button
                  onClick={() => {
                    // Auto-fill today's date in YYYY-MM-DD format (for date input)
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    const formattedDate = `${year}-${month}-${day}`;
                    
                    setImportFilterDate(formattedDate);
                    setShowImportModal(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <FiUpload className="w-4 h-4" />
                  <span>Import CSV</span>
                </button>
              </>
            )}

            {activeTab === 'settlements' && showSettlementsTab && (
              <button
                onClick={() => setShowSettlementModal(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <FiPlus className="w-4 h-4" />
                <span>Settlement</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {user?.role === 'salesperson' && (
            <div className="mb-6">
              <EditSessionManager />
            </div>
          )}
      {/* STATS CARDS - CONDITIONAL BASED ON TAB */}
      {activeTab === 'settlements' ? (
        /* SETTLEMENTS STATS */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Total Settlements Card */}
          <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <FiDollarSign className="text-3xl text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 font-medium">Total Settlements</p>
                <h3 className="text-3xl font-bold text-gray-800">{settlements.length}</h3>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(settlements.reduce((sum, s) => sum + (s.settlementAmount || 0), 0))}
              </p>
            </div>
          </div>

          {/* Per Account Breakdown Card */}
          <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FiShoppingBag className="text-2xl text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Account Breakdown</h3>
                <p className="text-sm text-gray-500">Settlements per account</p>
              </div>
            </div>
            <div className="space-y-3 max-h-32 overflow-y-auto">
              {(() => {
                const byAccount = {};
                settlements.forEach(settlement => {
                  const account = settlement.accountName;
                  if (!byAccount[account]) {
                    byAccount[account] = { count: 0, amount: 0 };
                  }
                  byAccount[account].count += 1;
                  byAccount[account].amount += settlement.settlementAmount || 0;
                });
                return Object.entries(byAccount).map(([account, data]) => (
                  <div
                    key={account}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{account}</p>
                      <p className="text-xs text-gray-500">{data.count} settlements</p>
                    </div>
                    <p className="font-bold text-green-600">
                      {formatCurrency(data.amount)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ) : (
        /* ORDERS STATS */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { id: 'all', label: 'Total Orders', icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', count: stats.dispatched + stats.returned + stats.cancelled + stats.wrongreturn, disabled: true },
            { id: 'dispatched', label: 'Dispatched', icon: FiTruck, color: 'text-yellow-600', bg: 'bg-yellow-50', count: stats.dispatched },
            { id: 'returned', label: 'Returns', icon: FiRotateCcw, color: 'text-red-600', bg: 'bg-red-50', count: stats.returned },
            { id: 'cancelled', label: 'Cancelled', icon: FiXCircle, color: 'text-gray-600', bg: 'bg-gray-100', count: stats.cancelled },
            { id: 'wrongreturn', label: 'Wrong Return', icon: FiAlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', count: stats.wrongreturn }
          ].map(card => (
            <div
              key={card.id}
              onClick={() => !card.disabled && handleStatClick(card.id)}
              className={`p-3 rounded-lg border transition-all ${
                card.disabled 
                  ? 'bg-gray-50 border-gray-300 opacity-75' 
                  : `cursor-pointer hover:shadow-md ${
                      statusFilter === card.id || (card.id === 'all' && statusFilter === 'all') 
                        ? 'ring-2 ring-indigo-500 border-transparent bg-white' 
                        : 'border-gray-200'
                    }`
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
      )}

      {/* ============ TABS ============ */}
      <div className="bg-white rounded-lg p-1 shadow-sm flex space-x-1 overflow-x-auto">
        {[
          { id: 'dispatched', label: 'Dispatched', icon: FiTruck },
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
          <SettlementsView
            settlements={settlements}
            marketplaceAccounts={marketplaceAccounts}
            onDeleteSettlement={handleDeleteSettlement}
            isAdmin={isAdmin}
          />
        ) : (

          // ORDERS VIEW - GROUP BY DATE
          (() => {
            const groupedByDate = allOrders.reduce((acc, sale) => {
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

            // Filter date search results by active tab
            let displayOrders = sortedDates;

            {/* ✅ ADD THIS: Date filter indicator BEFORE the map */}
            {searchQuery && searchType === 'date' && filteredOrders && (
              <div className="mx-6 mt-4 mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <FiSearch className="text-blue-600 text-xl" />
                  <div>
                    <p className="font-semibold text-blue-900">Date Filter Active</p>
                    <p className="text-sm text-blue-700">
                      Showing {filteredOrders.reduce((sum, dg) => sum + dg.orderCount, 0)} orders for {searchQuery}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearSearchFilter}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FiX className="text-lg" />
                  Clear Filter
                </button>
              </div>
            )}

            if (searchQuery && searchType === 'date' && filteredOrders) {
              // Apply tab filter to date search results
              displayOrders = filteredOrders.map(dateGroup => {
                let filteredGroupOrders = dateGroup.orders;
                
                // Filter by active tab
                if (activeTab === 'dispatched') {
                  filteredGroupOrders = dateGroup.orders.filter(order => order.status === 'dispatched');
                } else if (activeTab === 'delivered') {
                  filteredGroupOrders = dateGroup.orders.filter(order => order.status === 'delivered');
                } else if (activeTab === 'returned') {
                  filteredGroupOrders = dateGroup.orders.filter(order => 
                    ['returned', 'cancelled', 'wrongreturn'].includes(order.status)
                  );
                }
                
                // Only return date groups that have orders after filtering
                if (filteredGroupOrders.length === 0) {
                  return null;
                }
                
                return {
                  ...dateGroup,
                  orders: filteredGroupOrders,
                  orderCount: filteredGroupOrders.length,
                };
              }).filter(Boolean); // Remove null groups
            }

            return (searchType === 'date' && filteredOrders ? filteredOrders : dateGroups).map((dateGroup, idx) => {
              const isExpanded = expandedDate === dateGroup.dateString;
              const sortedOrders = [...dateGroup.orders].sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

              // Account breakdown
              const accountBreakdown = dateGroup.orders.reduce((acc, order) => {
                if (!acc[order.accountName]) acc[order.accountName] = 0;
                acc[order.accountName]++;
                return acc;
              }, {});

              // Selection state
              const allOrdersSelected = sortedOrders.every(order => selectedSales.includes(order._id));
              const someOrdersSelected = sortedOrders.some(order => selectedSales.includes(order._id)) && !allOrdersSelected;

              return (
                <div key={dateGroup.dateString} className="space-y-0">

                  {/* 🔥 NEW: Date Search Filter Indicator - ADD THIS ENTIRE BLOCK */}
                  {searchQuery && searchType === 'date' && idx === 0 && (
                    <div className="mx-6 mt-4 mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiSearch className="text-blue-600 text-xl" />
                        <div>
                          <p className="font-semibold text-blue-900">Filtered by Date: {searchQuery}</p>
                          <p className="text-sm text-blue-700">
                            Showing {filteredOrders?.reduce((sum, dg) => sum + dg.orderCount, 0) || 0} orders
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={clearSearchFilter}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FiX /> Clear Filter
                      </button>
                    </div>
                  )}
                  
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
                            {/* ✅ CHANGE THIS: Dynamic icon based on tab */}
                            {activeTab === 'returned' ? (
                              <FiRotateCcw className={`text-2xl ${isExpanded ? 'text-white' : 'text-red-600'}`} />
                            ) : (
                              <FiCalendar className={`text-2xl ${isExpanded ? 'text-white' : 'text-gray-600'}`} />
                            )}
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${isExpanded ? 'text-indigo-900' : 'text-gray-800'}`}>
                              {/* ✅ ADD THIS: Label before date */}
                              <span className="text-sm font-medium text-gray-500 mr-2">
                                {activeTab === 'returned' ? 'Returned:' : 'Dispatched:'}
                              </span>
                              {dateGroup.dateLabel}
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

                        {searchQuery && searchType === 'date' && (
                        <div className="mx-6 mt-4 mb-2 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FiSearch className="text-blue-600 text-xl" />
                            <div>
                              <p className="font-semibold text-blue-900">
                                Filtered by Date: {searchQuery}
                              </p>
                              <p className="text-sm text-blue-700">
                                Showing {filteredOrders?.reduce((sum, dg) => sum + dg.orderCount, 0) || 0} orders
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={clearSearchFilter}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <FiX />
                            Clear Filter
                          </button>
                        </div>
                      )}

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
                                          {/* Order Item ID Display */}
                                          {sale.orderItemId && (
                                            <div className="flex items-center gap-2 mt-1">
                                              <span
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCopyOrderId(sale.orderItemId);
                                                }}
                                                className="text-xs text-blue-700 font-mono bg-blue-100 px-2 py-1 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                                                title="Click to copy Order Item ID"
                                              >
                                                {sale.orderItemId}
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

                                        {/* ✅ NEW: Show dispatch date for returned/cancelled/wrongreturn orders */}
                                        {['returned', 'cancelled', 'wrongreturn'].includes(sale.status) && (
                                          <div className="mt-3 pt-3 border-t border-gray-200">
                                            <div className="flex items-center justify-between text-xs">
                                              <div className="flex items-center gap-2 text-gray-600">
                                                <FiPackage className="text-blue-600" />
                                                <span>Dispatched:</span>
                                                <span className="font-semibold text-gray-800">
                                                  {formatDateCustom(sale.saleDate)}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-red-600">
                                                <FiRotateCcw />
                                                <span>
                                                  {sale.status === 'returned' ? 'Returned' : sale.status === 'cancelled' ? 'Cancelled' : 'Wrong Return'}:
                                                </span>
                                                <span className="font-semibold">
                                                  {formatDateCustom(sale.displayDate || sale.saleDate)}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
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

              {/* Marketplace Order ID and Order Item ID - Side by Side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Marketplace Order ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marketplace Order ID
                  </label>
                  <input
                    type="text"
                    name="marketplaceOrderId"
                    value={saleFormData.marketplaceOrderId}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., OD123456789"
                  />
                </div>

                {/* Order Item ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Item ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="orderItemId"
                    value={saleFormData.orderItemId}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., 336486744619210100"
                  />
                </div>
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
                    {products
                      .find((p) => p.design === saleFormData.design)
                      ?.colors.find((c) => c.color === saleFormData.color)
                      ?.sizes?.filter((s) => enabledSizes.includes(s.size))
                      ?.map((s) => (
                        <option key={s.size} value={s.size}>
                          {s.size}
                        </option>
                      )) || []}
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
                  <option value="returned">Returned</option>
                  <option value="wrongreturn">Wrong Return</option>
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
                    {viewingHistory.orderItemId && (
                      <p>
                        <b>Order Item ID:</b> <span className="font-mono text-purple-600">{viewingHistory.orderItemId}</span>
                      </p>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="border-l-2 border-indigo-200 pl-4 space-y-6">
                    {viewingHistory.statusHistory?.slice().reverse().map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                        <p className="font-semibold text-gray-800 capitalize">
                          {h.newStatus.replace('_', ' ')} <span className="font-normal text-xs text-gray-500"> by <span className="font-medium text-xs text-red-700">{h.changedBy?.userName || 'System'}</span></span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(h.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' • '}
                          {new Date(h.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      <p className="font-semibold text-gray-600">
                        Order Created
                        {viewingHistory.createdByUser?.userName && (
                          <span className="font-normal text-gray-500"> by <span className="font-medium text-gray-700">{viewingHistory.createdByUser.userName}</span></span>
                        )}
                      </p>
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

            {/* ============ FAILED ORDERS REPORT MODAL ============ */}
            {showFailedOrdersModal && (
              <Modal
                isOpen={showFailedOrdersModal}
                onClose={() => setShowFailedOrdersModal(false)}
                title="Import Report"
                size="large"
              >
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <FiCheckCircle className="text-green-600" />
                        <span className="text-sm font-medium text-green-800">Success</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{failedOrdersData.totalSuccess}</p>
                    </div>

                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-1">
                        <FiXCircle className="text-red-600" />
                        <span className="text-sm font-medium text-red-800">Failed</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700">{failedOrdersData.totalFailed}</p>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-1">
                        <FiAlertTriangle className="text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">Duplicates</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-700">{failedOrdersData.totalDuplicates}</p>
                    </div>
                  </div>

                  {/* Failed Orders Table */}
                  {failedOrdersData.failed.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FiXCircle className="text-red-600" />
                        Failed Orders ({failedOrdersData.failed.length})
                      </h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Order Item ID
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                SKU
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Product Details
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Reason
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {failedOrdersData.failed.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {item.orderItemId || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                                  {item.sku || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {item.design && (
                                    <span className="font-medium">{item.design}</span>
                                  )}
                                  {item.color && (
                                    <span className="text-gray-500"> • {item.color}</span>
                                  )}
                                  {item.size && (
                                    <span className="text-gray-500"> • {item.size}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-red-600">
                                  {item.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Duplicate Orders Table */}
                  {failedOrdersData.duplicates.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FiAlertTriangle className="text-orange-600" />
                        Duplicate Orders ({failedOrdersData.duplicates.length})
                      </h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Order Item ID
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                SKU
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Reason
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {failedOrdersData.duplicates.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {item.orderItemId || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                                  {item.sku || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-orange-600">
                                  {item.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Export & Close Buttons */}
                  {(failedOrdersData.failed.length > 0 || failedOrdersData.duplicates.length > 0) && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const csvContent = [
                            ['Type', 'Order Item ID', 'SKU', 'Design', 'Color', 'Size', 'Reason'].join(','),
                            ...failedOrdersData.failed.map(item => 
                              ['Failed', item.orderItemId || '', item.sku || '', item.design || '', item.color || '', item.size || '', `"${item.reason}"`].join(',')
                            ),
                            ...failedOrdersData.duplicates.map(item => 
                              ['Duplicate', item.orderItemId || '', item.sku || '', '', '', '', `"${item.reason}"`].join(',')
                            )
                          ].join('\n');

                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `failed-orders-${new Date().getTime()}.csv`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          toast.success('Failed orders exported to CSV');
                        }}

                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FiFileText />
                        Export Failed Orders
                      </button>

                      <button
                        onClick={() => setShowFailedOrdersModal(false)}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
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
            {/* ✅ NEW: Insufficient Reserved Stock Modal */}
            {showInsufficientReservedModal && insufficientReservedData && (
              <InsufficientReservedStockModal
                isOpen={showInsufficientReservedModal}
                onClose={() => {
                  setShowInsufficientReservedModal(false);
                  setInsufficientReservedData(null);
                  setPendingSaleData(null);
                  setIsSubmitting(false);
                  if (window.pendingSaleReject) {
                    window.pendingSaleReject(new Error('User cancelled'));
                    delete window.pendingSaleResolve;
                    delete window.pendingSaleReject;
                  }
                }}
                onConfirm={handleConfirmUseMainStock}
                variant={insufficientReservedData.variant}
                reservedStock={insufficientReservedData.reservedStock}
                mainStock={insufficientReservedData.mainStock}
                required={insufficientReservedData.required}
              />
            )}
            {/* ============ SKU MAPPING MODALS ============ */}

            {/* Step 2: Import Preview - Shows unmapped SKUs summary */}
            <ImportPreviewModal
              isOpen={showImportPreviewModal}
              onClose={() => {
                setShowImportPreviewModal(false);
                setImportPreviewData(null);
              }}
              previewData={importPreviewData}
              onMapSKUs={() => {
                setShowImportPreviewModal(false);
                setShowBulkSKUMappingModal(true);
              }}
            />

            {/* Step 3: Bulk SKU Mapping - Map all unmapped SKUs at once */}
            <BulkSKUMappingModal
              isOpen={showBulkSKUMappingModal}
              onClose={() => {
                setShowBulkSKUMappingModal(false);
              }}
              unmappedSKUs={currentUnmappedSKUs}
              products={products}
              accountName={importAccount}
              onMappingsComplete={(mappings) => {
                setCompletedMappings(mappings);
                setShowBulkSKUMappingModal(false);
                // Show final preview
                setShowFinalImportPreviewModal(true);
              }}
              onBack={() => {
                setShowBulkSKUMappingModal(false);
                setShowImportPreviewModal(true);
              }}
            />

            {/* Step 5: Final Import Preview - Confirm before import */}
            <FinalImportPreviewModal
              isOpen={showFinalImportPreviewModal}
              onClose={() => {
                setShowFinalImportPreviewModal(false);
              }}
              previewData={{
                totalOrders: parsedCsvData?.length || 0,
                accountName: importAccount,
                dispatchDate: importFilterDate,
                productBreakdown: importPreview?.productBreakdown || new Map(),
                skippedOrders: importPreview?.skipped?.length || 0
              }}
              onConfirm={handleFinalImportConfirm}
              onBack={() => {
                setShowFinalImportPreviewModal(false);
                setShowBulkSKUMappingModal(true);
              }}
              isImporting={isImporting}
            />

            {/* Step 7: Import Result - Success/Failure details */}
            <ImportResultModal
              isOpen={showImportResultModal}
              onClose={() => {
                setShowImportResultModal(false);
                setImportResultData(null);
              }}
              resultData={importResultData}
            />

            {/* ============ SEARCH RESULTS MODAL (for Order ID search) ============ */}
            <Modal
              isOpen={showSearchModal}
              onClose={() => {
                setShowSearchModal(false);
                setModalOrders([]);
              }}
              title={`Search Results: "${searchQuery}"`}
              maxWidth="max-w-6xl"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiSearch className="text-blue-600 text-2xl" />
                    <div>
                      <p className="font-semibold text-blue-900">
                        Found {modalOrders.length} {modalOrders.length === 1 ? 'Order' : 'Orders'}
                      </p>
                      <p className="text-sm text-blue-700">
                        Searching for: "{searchQuery}"
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowSearchModal(false);
                      setModalOrders([]);
                      clearSearchFilter();
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                  >
                    <FiX /> Close
                  </button>
                </div>

                {/* Orders List in Modal */}
                <div className="max-h-[600px] overflow-y-auto space-y-3">
                  {modalOrders.map((sale) => (
                    <div
                      key={sale._id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white"
                    >
                      <div className="flex justify-between items-start">
                        {/* Left Side - Order Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(sale.status)}
                            <span className="text-xs text-gray-500">
                              {formatDateCustom(sale.saleDate)}
                            </span>
                            <span className="text-xs font-medium text-gray-600">
                              {sale.accountName}
                            </span>
                          </div>

                          {/* Highlight matching text */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <span className="text-gray-500">Order Item ID:</span>
                              <p className="font-semibold">
                                {sale.orderItemId?.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                  <span className="bg-yellow-200 px-1 rounded">{sale.orderItemId}</span>
                                ) : (
                                  sale.orderItemId || '-'
                                )}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Marketplace Order ID:</span>
                              <p className="font-semibold">
                                {sale.marketplaceOrderId?.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                  <span className="bg-yellow-200 px-1 rounded">{sale.marketplaceOrderId}</span>
                                ) : (
                                  sale.marketplaceOrderId || '-'
                                )}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Product:</span>
                              <p className="font-semibold">
                                {sale.design} - {sale.color} - {sale.size}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Quantity:</span>
                              <p className="font-semibold">{sale.quantity}</p>
                            </div>
                          </div>
                        </div>

                        {/* Right Side - Actions */}
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              handleEdit(sale);
                              setShowSearchModal(false);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Order"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={async () => {
                              await handleDelete(sale._id);
                              // Remove from modal list
                              setModalOrders(prev => prev.filter(o => o._id !== sale._id));
                              if (modalOrders.length === 1) {
                                setShowSearchModal(false);
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Order"
                          >
                            <FiTrash2 />
                          </button>
                          <button
                            onClick={() => handleCopyOrderId(sale.orderItemId)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Copy Order Item ID"
                          >
                            <FiFileText />
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      {sale.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">Notes:</p>
                          <p className="text-sm text-gray-700">{sale.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Modal>

            {/* GLOBAL SEARCH RESULTS PANEL */}
            {searchResults.showPanel && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">Search Results</h2>
                        <p className="text-blue-100 mt-1">
                          Found {searchResults.orders.length} order(s) matching "{searchQuery}"
                        </p>
                      </div>
                      <button
                        onClick={() => setSearchResults(prev => ({ ...prev, showPanel: false }))}
                        className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                      >
                        <FiX size={24} />
                      </button>
                    </div>

                    {/* Tab Counts */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {Object.entries(searchResults.byStatus).map(([status, count]) => (
                        <span
                          key={status}
                          className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium"
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Results List */}
                  <div className="p-6 overflow-y-auto max-h-96">
                    <div className="space-y-3">
                      {searchResults.orders.map((order) => (
                        <div
                          key={order._id}
                          className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
                          onClick={() => navigateToOrder(order)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Order Header */}
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  order.status === 'dispatched' ? 'bg-yellow-500' :
                                  order.status === 'delivered' ? 'bg-green-500' :
                                  order.status === 'returned' ? 'bg-red-500' :
                                  order.status === 'cancelled' ? 'bg-gray-500' :
                                  'bg-orange-500'
                                }`} />
                                <h3 className="font-bold text-lg text-gray-900">
                                  {order.orderItemId}
                                </h3>
                                {getStatusBadge(order.status)}
                              </div>

                              {/* Order Details */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500">Design:</span>
                                  <span className="ml-2 font-semibold">{order.design}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Color:</span>
                                  <span className="ml-2 font-semibold">{order.color}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Size:</span>
                                  <span className="ml-2 font-semibold">{order.size}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Quantity:</span>
                                  <span className="ml-2 font-semibold">{order.quantity}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Date:</span>
                                  <span className="ml-2 font-semibold">
                                    {new Date(order.saleDate).toLocaleDateString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Account:</span>
                                  <span className="ml-2 font-semibold">{order.accountName}</span>
                                </div>
                              </div>
                            </div>

                            {/* Navigate Button */}
                            <button
                              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                              View in {order.status} tab
                              <FiArrowRight />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* IMPORT CSV MODAL - MANUAL DISPATCH DATE */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">Import Orders from CSV</h2>
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setParsedCsvData([]);
                        setImportPreview(null);
                        setImportAccount('');
                        setImportFilterDate(''); // Dispatch date
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <FiX className="text-2xl" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6">
                    {/* NO PREVIEW YET - Show Form */}
                    {!parsedCsvData.length && (
                      <div className="space-y-6">
                        {/* STEP 1: Select Account */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Marketplace Account *
                          </label>
                          <select
                            value={importAccount}
                            onChange={(e) => setImportAccount(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            <option value="">-- Select Account --</option>
                            {marketplaceAccounts.map((acc) => (
                              <option key={acc.id} value={acc.accountName}>
                                {acc.accountName} ({acc.platform})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ✅ STEP 2: Dispatch Date (MANUAL INPUT) */}
                        {importAccount && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Dispatch Date *{' '}
                              <span className="text-xs text-gray-500 font-normal">
                                (When you dispatched these orders)
                              </span>
                            </label>
                            <div className="relative">
                              <input
                                type="date"
                                value={importFilterDate}
                                onChange={(e) => setImportFilterDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]} // Can't be future date
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              />
                              <FiCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              All orders in this CSV will be marked as dispatched on this date
                            </p>
                          </div>
                        )}

                        {/* ✅ STEP 3: Upload CSV */}
                        {importAccount && importFilterDate && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Upload CSV File *
                            </label>
                            <input
                              type="file"
                              accept=".csv"
                              onChange={handleCSVUpload}
                              className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-3 file:px-6
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100
                                file:cursor-pointer cursor-pointer
                                border border-gray-300 rounded-lg"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              Download CSV from Flipkart Seller Portal → Orders → Dispatched
                            </p>
                          </div>
                        )}

                        {/* Instructions */}
                        {!importAccount && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <FiInfo className="text-indigo-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-indigo-800">
                                <p className="font-medium mb-1">Import Instructions</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  <li>Select your marketplace account</li>
                                  <li>Enter the date you dispatched these orders</li>
                                  <li>Upload the CSV file from Flipkart</li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ✅ PREVIEW - Show After Upload */}
                    {importPreview && (
                    <div className="space-y-4">
                      {/* Detection Summary */}
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FiInfo className="text-blue-600 text-xl" />
                          <h3 className="font-semibold text-blue-900">
                            🔍 Detected: {importPreview.detectedType === 'pending' ? 'PENDING HANDOVER' : 'DISPATCHED ORDERS'}
                          </h3>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Orders in CSV:</span>
                            <span className="font-semibold">{parsedCsvData.length}</span>
                          </div>
                          
                          <div className="flex justify-between text-green-700">
                            <span>✅ Will Import:</span>
                            <span className="font-semibold">{importPreview.success.length} orders</span>
                          </div>
                          
                          {importPreview.skipped.length > 0 && (
                            <div className="flex justify-between text-yellow-700">
                              <span>⚠️ Will Skip (Returns):</span>
                              <span className="font-semibold">{importPreview.skipped.length} orders</span>
                            </div>
                          )}
                          
                          {importPreview.failed.length > 0 && (
                            <div className="flex justify-between text-red-700">
                              <span>❌ Validation Errors:</span>
                              <span className="font-semibold">{importPreview.failed.length} orders</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Breakdown */}
                      {importPreview.success.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b">
                            <h4 className="font-semibold text-gray-700">📦 Products Breakdown ({importPreview.success.length} orders)</h4>
                          </div>
                          
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left">Design</th>
                                  <th className="px-3 py-2 text-left">Color</th>
                                  <th className="px-3 py-2 text-left">Size</th>
                                  <th className="px-3 py-2 text-right">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from(importPreview.productBreakdown.values()).map((variant, idx) => (
                                  <tr key={`${variant.design}-${variant.color}-${variant.size}`}>
                                    <td className="border px-3 py-2">{variant.design}</td>
                                    <td className="border px-3 py-2">{variant.color}</td>
                                    <td className="border px-3 py-2">{variant.size}</td>
                                    <td className="border px-3 py-2 text-center">{variant.quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="bg-gray-50 px-4 py-2 border-t text-sm text-gray-600">
                            Total: {importPreview.productBreakdown.size} unique variants
                          </div>
                        </div>
                      )}

                      {/* Skipped Orders (Collapsible) */}
                      {importPreview.skipped.length > 0 && (
                        <details className="border rounded-lg overflow-hidden">
                          <summary className="bg-yellow-50 px-4 py-3 cursor-pointer hover:bg-yellow-100 flex items-center gap-2">
                            <FiAlertTriangle className="text-yellow-600" />
                            <span className="font-medium text-yellow-800">
                              ⚠️ Skipped Orders ({importPreview.skipped.length} returns - not imported)
                            </span>
                          </summary>
                          
                          <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left">Order ID</th>
                                  <th className="px-3 py-2 text-left">SKU</th>
                                  <th className="px-3 py-2 text-left">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importPreview.skipped.map((item, idx) => (
                                  <tr key={idx} className="border-b">
                                    <td className="px-3 py-2 text-xs">{item.orderId}</td>
                                    <td className="px-3 py-2">{item.sku}</td>
                                    <td className="px-3 py-2">
                                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                        {item.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {/* Failed Validation */}
                      {importPreview.failed.length > 0 && (
                        <details className="border border-red-200 rounded-lg overflow-hidden">
                          <summary className="bg-red-50 px-4 py-3 cursor-pointer hover:bg-red-100 flex items-center gap-2">
                            <FiAlertCircle className="text-red-600" />
                            <span className="font-medium text-red-800">
                              ❌ Validation Issues ({importPreview.failed.length})
                            </span>
                          </summary>
                          
                          <div className="max-h-48 overflow-y-auto p-3 space-y-2">
                            {importPreview.failed.map((item, idx) => (
                              <div key={idx} className="text-sm bg-red-50 p-2 rounded border border-red-200">
                                <div className="font-medium text-red-900">Row {item.row}</div>
                                <div className="text-red-700">{item.reason}</div>
                                {item.sku && <div className="text-xs text-red-600">SKU: {item.sku}</div>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
            {/* Modal Footer - Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setParsedCsvData([]);
                  setImportPreview(null);
                  setImportFilterDate('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={isImporting}
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!importPreview || importPreview.success.length === 0 || isImporting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <FiClock className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FiUpload />
                    Import {importPreview?.success.length || 0} Orders
                  </>
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ✅ ADD: Infinite Scroll Loading Indicators */}
      {activeTab !== 'settlements' && (
        <>
          {isLoadingMore && (
            <div className="text-center py-8 mt-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-indigo-500 mx-auto"></div>
              <p className="text-gray-500 mt-3 text-sm font-medium">Loading more orders...</p>
            </div>
          )}

          {!hasMoreDates && dateGroups.flatMap(dg => dg.orders).length > 0 && !isLoadingMore && (
            <div className="text-center py-6 mt-4">
              <div className="inline-block px-6 py-2 bg-gray-100 text-gray-500 rounded-full text-sm font-medium">
                ✓ End of list — All {dateGroups.flatMap(dg => dg.orders).length} orders loaded
              </div>
            </div>
          )}
        </>
      )}

      {/* ✅ ADD THE BUTTON RIGHT HERE - After dateGroups.map() closes */}
      {activeTab !== 'settlements' && dateGroups.length > 0 && (
        <div className="mt-6 text-center">
          {hasMoreDates ? (
            <button
              onClick={loadMoreDates}
              disabled={isLoadingMore}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {isLoadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <FiArrowRight className="w-5 h-5" />
                  <span>Load More Dates</span>
                </>
              )}
            </button>
          ) : (
            <div className="inline-block px-6 py-3 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
              ✓ End of list — All dates loaded
            </div>
          )}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default Sales;