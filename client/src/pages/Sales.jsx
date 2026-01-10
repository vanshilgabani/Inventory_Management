import { useState, useEffect } from 'react';
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
import { FiShoppingBag, FiPlus, FiTrash2, FiEdit2, FiCheckCircle, FiTruck, FiClock, FiRotateCcw, FiDollarSign, FiXCircle, FiAlertTriangle, FiFilter, FiCalendar, FiChevronDown, FiPackage, FiUpload, FiSearch, FiX, FiArrowLeft, FiAlertCircle, FiFileText, FiInfo } from 'react-icons/fi';
import { formatCurrency } from '../utils/dateUtils';
import Papa from 'papaparse';
import RefillLockStockModal from '../components/RefillLockStockModal';
import SettlementsView from '../components/SettlementsView';

const Sales = () => {
  const { user } = useAuth();
  const {enabledSizes} = useEnabledSizes();
  const { canEditSales } = usePermissions();
  const navigate = useNavigate();
  

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
  const [showInsufficientReservedModal, setShowInsufficientReservedModal] = useState(false);
  const [insufficientReservedData, setInsufficientReservedData] = useState(null);
  const [pendingSaleData, setPendingSaleData] = useState(null);

    // CSV Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedCsvData, setParsedCsvData] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importAccount, setImportAccount] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [importType, setImportType] = useState(null); // 'pending' or 'dispatched'
  const [importFilterDate, setImportFilterDate] = useState(''); // DD/MM/YYYY format  

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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
      const data = await salesService.getAllSales(selectedAccount, 'all', start, end, { limit: 0 });
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
    } else if (['returned', 'cancelled', 'wrongreturn'].includes(status)) {
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
      matchesTab = ['returned', 'wrongreturn', 'cancelled'].includes(sale.status);
    }

    // 2. Specific Status Filter from Stats Card
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = sale.status === statusFilter;
    }

      // ✅ ADD SEARCH FILTER
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = 
        sale.marketplaceOrderId?.toLowerCase().includes(query) ||
        sale.design?.toLowerCase().includes(query) ||
        sale.color?.toLowerCase().includes(query) ||
        sale.size?.toLowerCase().includes(query);
    }

    return matchesTab && matchesStatus && matchesSearch;
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

  // ✅ SKU PARSER
const parseFlipkartSKU = (sku) => {
  if (!sku) return { design: null, color: null, size: null };
  const cleaned = sku.replace('#', '').trim();
  const parts = cleaned.split('-');
  if (parts.length < 3) return { design: null, color: null, size: null };
  
  let design, color, size;
  if (parts[0] === 'D' && !isNaN(parts[1])) {
    design = 'D' + parts[1];
    color = parts.slice(2, -1).join('-');
    size = parts[parts.length - 1];
  } else if (parts[0].startsWith('D') && !isNaN(parts[0].substring(1))) {
    design = parts[0];
    color = parts.slice(1, -1).join('-');
    size = parts[parts.length - 1];
  } else {
    return { design: null, color: null, size: null };
  }
  
  if (color) color = color.replace(/\./g, ' ').trim();
  return { design, color, size };
};

const handleCSVUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!importAccount) {
    toast.error('Please select an account first');
    return;
  }

  if (importType === 'dispatched' && !importFilterDate) {
    toast.error('Please select an invoice date first');
    return;
  }

  // Validate date format for dispatched orders
  if (importType === 'dispatched') {
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(importFilterDate)) {
      toast.error('Invalid date format. Please use DD/MM/YYYY');
      return;
    }
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      console.log('📋 CSV Parsed - Total rows:', results.data.length);
      
      let filteredData = results.data;
      let filterInfo = { total: results.data.length, filtered: 0, reason: '' };

      // FILTER FOR DISPATCHED ORDERS
      if (importType === 'dispatched' && importFilterDate) {
        // Convert DD/MM/YYYY to multiple formats for CSV matching
        const [day, month, year] = importFilterDate.split('/');
        const format1 = `${month}${day}${year.slice(-2)}`; // "010326"
        const format2 = `${month}-${day}-${year}`; // "01-03-2026"
        const format3 = `${month}/${day}/${year.slice(-2)}`; // "01/03/26"

        console.log('🔍 Looking for dates:', { format1, format2, format3 });

        filteredData = results.data.filter(row => {
          const invoiceDate = row['Invoice Date (mm/dd/yy)'];
          
          // Remove any spaces and normalize
          const cleaned = invoiceDate?.replace(/\s/g, '') || '';
          
          // Check all possible formats
          return cleaned === format1 || cleaned === format2 || cleaned === format3;
        });

        filterInfo.filtered = filteredData.length;
        filterInfo.reason = `Invoice Date: ${importFilterDate}`;

        console.log(`📅 Found ${filteredData.length} orders for ${importFilterDate}`);

        if (filteredData.length === 0) {
          toast.error(`No orders found with Invoice Date ${importFilterDate}`);
          e.target.value = ''; // Reset file input
          return;
        }
      }

      setParsedCsvData(filteredData);
      
      // ✅ GENERATE ENHANCED PREVIEW
      const preview = {
        success: [],
        failed: []
      };
      
      const validStatuses = ['Shipped', 'Ready to dispatch', 'Dispatched'];
      
      filteredData.forEach((row, idx) => {
        const rowNumber = idx + 2; // +2 because CSV has header and arrays are 0-indexed
        
        // Check if status is valid (for dispatched orders)
        if (importType === 'dispatched') {
          const status = row['Order State'];
          if (!validStatuses.includes(status)) {
            preview.failed.push({
              row: rowNumber,
              reason: `Invalid status: ${status} (Only Shipped, Ready to dispatch, Dispatched allowed)`,
              sku: row['SKU'],
              orderId: row['Order Id']
            });
            return;
          }
        }
        
        // Parse SKU using the existing CORRECT parser
        const sku = row['SKU'];
        const { design, color, size } = parseFlipkartSKU(sku);

        if (!design || !color || !size) {
          preview.failed.push({
            row: rowNumber,
            reason: 'Unable to parse SKU - invalid format',
            sku: sku || 'N/A',
            orderId: row['Order Id']
          });
          return;
        }

        const quantity = parseInt(row['Quantity']) || 1;

        // Now push with correctly parsed values
        preview.success.push({
          design,   // ✅ 'D11' or 'D1'
          color,    // ✅ 'KHAKHI' or 'BLACK'
          size,     // ✅ 'L' or 'M'
          quantity,
          orderId: row['Order Id'],
          orderItemId: (row['ORDER ITEM ID'] || '').replace(/'/g, '').trim(), 
          sku
        });
      });
      
      setImportPreview(preview);
      
      // Show summary toast
      if (importType === 'dispatched') {
        toast.success(
          `Found ${preview.success.length} valid orders for ${importFilterDate}`,
          { duration: 4000 }
        );
      } else {
        toast.success(
          `Parsed ${preview.success.length} orders from CSV`,
          { duration: 4000 }
        );
      }
    },
    error: (error) => {
      console.error('CSV Parse Error:', error);
      toast.error('Failed to parse CSV file');
    }
  });
};

const handleImportSubmit = async () => {
  if (!importAccount) {
    toast.error('Please select an account');
    return;
  }

  if (!parsedCsvData.length) {
    toast.error('No data to import');
    return;
  }

  try {
    setIsImporting(true);
    
    // ✅ ADD: Prepare import payload
    const importPayload = {
      csvData: parsedCsvData,
      account: importAccount,
      importType: importType,  // 'pending' or 'dispatched'
    };
    
    // ✅ ADD: Include filterDate for dispatched orders
    if (importType === 'dispatched' && importFilterDate) {
      const [day, month, year] = importFilterDate.split('/');
      const csvDateFormat = `${month}/${day}/${year.slice(-2)}`;
      importPayload.filterDate = csvDateFormat;
    }
    
    const result = await salesService.importFromCSV(
      importPayload.csvData,
      importPayload.account,
      importPayload.importType,  // ✅ ADD THIS
      importPayload.filterDate   // ✅ ADD THIS
    );

    const { success, failed, duplicates = [], invalidStatus = [] } = result.data;

    const totalSkipped = failed.length + duplicates.length + invalidStatus.length;

    if (totalSkipped > 0) {
      console.log('⚠️ Import Summary:');
      console.log(`  ✅ Imported: ${success.length}`);
      console.log(`  ❌ Failed: ${failed.length}`);
      console.log(`  🔄 Duplicates: ${duplicates.length}`);
      console.log(`  ⚠️ Invalid Status: ${invalidStatus.length}`);
      
      // Show detailed logs
      if (duplicates.length > 0) {
        console.log('\n📋 Duplicate Orders (Already in Database):');
        duplicates.forEach((dup, idx) => {
          console.log(`  ${idx + 1}. Order Item ID: ${dup.orderItemId} - ${dup.sku}`);
        });
      }
      
      if (invalidStatus.length > 0) {
        console.log('\n❌ Invalid Status Orders:');
        invalidStatus.forEach((inv, idx) => {
          console.log(`  ${idx + 1}. Order ID: ${inv.orderId} - Status: ${inv.status}`);
        });
      }
      
      if (failed.length > 0) {
        console.log('\n⚠️ Validation Errors:');
        failed.forEach((fail, idx) => {
          console.log(`  ${idx + 1}. Row ${fail.row} - ${fail.reason}`);
          console.log(`     Order ID: ${fail.orderId}, SKU: ${fail.sku}`);
        });
      }
      
      // Build user-friendly message
      let message = '';
      if (success.length > 0) {
        message = `✅ ${success.length} orders imported!\n`;
      } else {
        message = 'No orders imported:\n';
      }
      
      if (duplicates.length > 0) {
        message += `🔄 ${duplicates.length} duplicates skipped\n`;
      }
      if (invalidStatus.length > 0) {
        message += `⚠️ ${invalidStatus.length} invalid status\n`;
      }
      if (failed.length > 0) {
        message += `❌ ${failed.length} validation errors\n`;
      }
      
      message += '\nCheck console for details';
      
      toast[success.length > 0 ? 'success' : 'error'](message, { duration: 8000 });
    } else {
      toast.success(`✅ All ${success.length} orders imported successfully!`, { duration: 5000 });
    }

    // Close modal and refresh
    setShowImportModal(false);
    setParsedCsvData([]);
    setImportPreview(null);
    setImportType(null);
    setImportFilterDate('');
    setImportAccount('');
    fetchSales();
    
    } catch (error) {
    console.error('❌ Import error:', error);
    console.error('📦 Full error response:', error.response?.data);  // ✅ ADD THIS

    const errorData = error.response?.data;

    // ✅ Show detailed errors from backend
    if (errorData?.data?.failed) {
      console.log('❌ Failed orders:', errorData.data.failed);
      
      // Show first few errors
      const firstErrors = errorData.data.failed.slice(0, 3);
      firstErrors.forEach((fail, idx) => {
        console.log(`  ${idx + 1}. Row ${fail.row}: ${fail.reason}`);
        console.log(`     Order ID: ${fail.orderId}, SKU: ${fail.sku}`);
      });
      
      toast.error(`Import failed: ${errorData.data.failed.length} errors. Check console for details.`, {
        duration: 8000
      });
    } else {
      toast.error(errorData?.message || 'Import failed');
    }
    } finally {
    setIsImporting(false);
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
    fetchSales();
    
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
      fetchSales();
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
        fetchSales();
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

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 animate-fade-in">
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

            {/* SEARCH BAR */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Order ID, Design, Color..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/reserved-inventory')}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <FiPackage className="w-4 h-4" />
              <span className="hidden sm:inline">Reserved Inventory</span>
              <span className="sm:hidden">Reserved</span>
            </button>

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
                  onClick={() => setShowImportModal(true)}
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
            { id: 'all', label: 'Total Orders', icon: FiShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', count: sales.length },
            { id: 'dispatched', label: 'Dispatched', icon: FiTruck, color: 'text-yellow-600', bg: 'bg-yellow-50', count: stats.dispatched },
            { id: 'returned', label: 'Returns', icon: FiRotateCcw, color: 'text-red-600', bg: 'bg-red-50', count: stats.returned },
            { id: 'cancelled', label: 'Cancelled', icon: FiXCircle, color: 'text-gray-600', bg: 'bg-gray-100', count: stats.cancelled },
            { id: 'wrongreturn', label: 'Wrong Return', icon: FiAlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', count: stats.wrongreturn }
          ].map((card) => (
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
      {/* IMPORT CSV MODAL - ENHANCED VERSION */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Import Orders from CSV</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedCsvData([]);
                  setImportPreview(null);
                  setImportType(null);
                  setImportFilterDate('');
                  setImportAccount('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="text-2xl" />
              </button>
            </div>

            <div className="p-6">
              {/* STEP 1: CHOOSE IMPORT TYPE */}
              {!importType && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <p className="text-gray-600 text-lg">
                      Select the type of orders you want to import:
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pending Handover Card */}
                    <button
                      onClick={() => setImportType('pending')}
                      className="group p-8 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all duration-200 text-left"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                          <FiPackage className="text-3xl text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2 text-gray-800">Pending Handover</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Import new orders waiting for dispatch from Flipkart
                          </p>
                          <ul className="text-xs text-gray-500 space-y-1">
                            <li>• Imports all orders from CSV</li>
                            <li>• Deducts from reserved stock</li>
                            <li>• Creates new dispatch records</li>
                          </ul>
                        </div>
                      </div>
                    </button>
                    
                    {/* Dispatched Orders Card */}
                    <button
                      onClick={() => setImportType('dispatched')}
                      className="group p-8 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all duration-200 text-left"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                          <FiTruck className="text-3xl text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2 text-gray-800">Dispatched Orders</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Import already dispatched orders by specific date
                          </p>
                          <ul className="text-xs text-gray-500 space-y-1">
                            <li>• Filter by invoice date (DD/MM/YYYY)</li>
                            <li>• Skip duplicate Order IDs</li>
                            <li>• Skip invalid status orders</li>
                          </ul>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PENDING HANDOVER - FILE UPLOAD */}
              {importType === 'pending' && !parsedCsvData.length && (
                <div className="space-y-6">
                  <button
                    onClick={() => {
                      setImportType(null);
                      setImportAccount('');
                    }}
                    className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <FiArrowLeft className="mr-2" />
                    Back to selection
                  </button>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <FiInfo className="text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-indigo-800">
                        <p className="font-medium mb-1">Pending Handover Import</p>
                        <p>Download CSV from: Flipkart Seller Portal → Orders → Pending Handover</p>
                      </div>
                    </div>
                  </div>

                  {/* Account Selection */}
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
                        <option key={acc._id} value={acc.accountName}>
                          {acc.accountName} ({acc.platform})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* File Upload */}
                  {importAccount && (
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
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: DISPATCHED ORDERS - DATE & FILE UPLOAD */}
              {importType === 'dispatched' && !parsedCsvData.length && (
                <div className="space-y-6">
                  <button
                    onClick={() => {
                      setImportType(null);
                      setImportFilterDate('');
                      setImportAccount('');
                    }}
                    className="flex items-center text-sm text-green-600 hover:text-green-800 transition-colors"
                  >
                    <FiArrowLeft className="mr-2" />
                    Back to selection
                  </button>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <FiAlertCircle className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">Important Notes:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Only orders matching the selected invoice date will be imported</li>
                          <li>Orders with duplicate Order IDs will be skipped</li>
                          <li>Orders with invalid status (Returned/Cancelled) will be skipped</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Marketplace Account *
                    </label>
                    <select
                      value={importAccount}
                      onChange={(e) => setImportAccount(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">-- Select Account --</option>
                      {marketplaceAccounts.map((acc) => (
                        <option key={acc._id} value={acc.accountName}>
                          {acc.accountName} ({acc.platform})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Selection */}
                  {importAccount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Invoice Date * (DD/MM/YYYY)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY (e.g., 03/01/2026)"
                          value={importFilterDate}
                          onChange={(e) => {
                            let value = e.target.value.replace(/[^\d]/g, '');
                            if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                            if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                            setImportFilterDate(value);
                          }}
                          maxLength="10"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <FiCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Format: Day/Month/Year (e.g., 03/01/2026 for 3rd January 2026)
                      </p>
                    </div>
                  )}

                  {/* File Upload */}
                  {importAccount && importFilterDate.length === 10 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Dispatched Orders CSV *
                      </label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="block w-full text-sm text-gray-500 
                          file:mr-4 file:py-3 file:px-6 
                          file:rounded-lg file:border-0 
                          file:text-sm file:font-semibold 
                          file:bg-green-50 file:text-green-700 
                          hover:file:bg-green-100 
                          file:cursor-pointer cursor-pointer
                          border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Download from: Flipkart Seller Portal → Orders → Dispatched
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: ENHANCED PREVIEW */}
              {importPreview && parsedCsvData.length > 0 && (
                <div className="space-y-6">
                  {/* Header with back button */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setParsedCsvData([]);
                        setImportPreview(null);
                      }}
                      className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <FiArrowLeft className="mr-2" />
                      Upload different file
                    </button>
                    
                    <span className="text-sm text-gray-500">
                      {importType === 'dispatched' && `Filter: ${importFilterDate}`}
                    </span>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-medium">Ready to Import</p>
                          <p className="text-3xl font-bold text-green-800 mt-1">
                            {importPreview.success.length}
                          </p>
                        </div>
                        <FiCheckCircle className="text-4xl text-green-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-700 font-medium">Validation Issues</p>
                          <p className="text-3xl font-bold text-red-800 mt-1">
                            {importPreview.failed.length}
                          </p>
                        </div>
                        <FiAlertCircle className="text-4xl text-red-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-700 font-medium">Total Parsed</p>
                          <p className="text-3xl font-bold text-blue-800 mt-1">
                            {parsedCsvData.length}
                          </p>
                        </div>
                        <FiFileText className="text-4xl text-blue-600" />
                      </div>
                    </div>
                  </div>

                  {/* Orders Breakdown - Success */}
                  {importPreview.success.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                        <h3 className="font-semibold text-green-800 flex items-center">
                          <FiCheckCircle className="mr-2" />
                          {importPreview.success.length} Orders Ready to Import
                        </h3>
                      </div>
                      <div className="p-4 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {Object.entries(
                            importPreview.success.reduce((acc, item) => {
                              const key = `${item.design}-${item.color}-${item.size}`;
                              acc[key] = (acc[key] || 0) + item.quantity;
                              return acc;
                            }, {})
                          ).map(([sku, qty]) => (
                            <div key={sku} className="flex items-center justify-between bg-green-50 rounded px-3 py-2 border border-green-200">
                              <span className="text-sm font-medium text-gray-700">{sku}</span>
                              <span className="text-sm font-bold text-green-700">× {qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Orders Breakdown - Failed */}
                  {importPreview.failed.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                        <h3 className="font-semibold text-red-800 flex items-center">
                          <FiAlertCircle className="mr-2" />
                          {importPreview.failed.length} Orders Have Issues
                        </h3>
                      </div>
                      <div className="p-4 max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          {importPreview.failed.map((item, idx) => (
                            <div key={idx} className="flex items-start space-x-3 p-3 bg-red-50 rounded border border-red-200">
                              <FiXCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 text-sm">
                                <p className="font-medium text-gray-800">Row {item.row}</p>
                                <p className="text-red-700">{item.reason}</p>
                                {item.sku && <p className="text-gray-600 text-xs mt-1">SKU: {item.sku}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      {importPreview.success.length > 0 ? (
                        <span>Stock will be deducted from <strong>{importAccount}</strong> reserved inventory</span>
                      ) : (
                        <span className="text-red-600">Cannot import - all orders have validation issues</span>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowImportModal(false);
                          setParsedCsvData([]);
                          setImportPreview(null);
                          setImportType(null);
                          setImportFilterDate('');
                          setImportAccount('');
                        }}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      
                      {importPreview.success.length > 0 && (
                        <button
                          onClick={handleImportSubmit}
                          disabled={isImporting}
                          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isImporting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Importing...</span>
                            </>
                          ) : (
                            <>
                              <FiUpload />
                              <span>Import {importPreview.success.length} Orders</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;