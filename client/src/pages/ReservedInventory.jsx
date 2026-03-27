import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiLock, 
  FiSearch, 
  FiDownload, 
  FiPackage, 
  FiAlertTriangle, 
  FiRefreshCw,
  FiArrowDown,
  FiArrowUp,
  FiArrowRight,
  FiLayers,
  FiX,
  FiZap,
  FiChevronDown 
} from 'react-icons/fi';
import Card from '../components/common/Card';
import SkeletonCard from '../components/common/SkeletonCard';
import TransferModal from '../components/TransferModal';
import AllocationModal from '../components/modals/AllocationModal'; // ✅ NEW
import { settingsService } from '../services/settingsService'; // ✅ NEW
import { inventoryService } from '../services/inventoryService';
import transferService from '../services/transferService';
import toast from 'react-hot-toast';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import { useColorPalette } from '../hooks/useColorPalette';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ScrollToTop from '../components/common/ScrollToTop';
import FlipkartSyncButton from '../components/sync/FlipkartSyncButton';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ReservedInventory = () => {
  const { enabledSizes, getSizesForDesign } = useEnabledSizes();
  const { colors: activeColors, getColorCode } = useColorPalette();
  const navigate = useNavigate();

  // State
  const [products, setProducts] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDesign, setFilterDesign] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterStock, setFilterStock] = useState('all');

  const [filterAccount, setFilterAccount] = useState('all');
  const [marketplaceAccounts, setMarketplaceAccounts] = useState([]);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [globalThreshold, setGlobalThreshold] = useState(10);

  // Transfer Modal (single)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDirection, setTransferDirection] = useState('to-reserved');
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Bulk Transfer Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState('refill'); // 'refill' or 'return'
  const [bulkQuantities, setBulkQuantities] = useState({}); // { productId-color-size: quantity }
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [internalTransfers, setInternalTransfers] = useState({});

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [autoAllocRunning, setAutoAllocRunning] = useState(false);
  const [showAutoAllocMenu, setShowAutoAllocMenu] = useState(false);
  const [selectedDesigns, setSelectedDesigns] = useState([]); // [] = all
  const autoAllocMenuRef = useRef(null);

  // Fetch data
  useEffect(() => {
    fetchData();
    fetchMarketplaceAccounts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autoAllocMenuRef.current && !autoAllocMenuRef.current.contains(e.target)) {
        setShowAutoAllocMenu(false);
      }
    };
    if (showAutoAllocMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutoAllocMenu]);

const fetchData = async () => {
  setLoading(true);
  try {
    const [productsData, settingsData, transfersData] = await Promise.all([
      inventoryService.getAllProducts(),
      settingsService.getSettings(),
      transferService.getRecentTransfers()
    ]);
    
    // ⭐ Handle response correctly
    const productsArray = Array.isArray(productsData) ? productsData : (productsData?.products || []);
    
    console.log('📦 Loaded products:', productsArray.length);
    console.log('📦 Sample product:', productsArray[0]);
    console.log('📦 Sample allocations:', productsArray[0]?.colors?.[0]?.sizes?.[0]?.reservedAllocations);
    
    setProducts(productsArray);
    
    // Load marketplace accounts
    const accounts = settingsData.marketplaceAccounts || [];
    const activeAccounts = accounts.filter(acc => acc.isActive);
    setMarketplaceAccounts(activeAccounts);
    
    setRecentTransfers(transfersData);
  } catch (error) {
    console.error('Failed to fetch data:', error);
    toast.error('Failed to load inventory');
  } finally {
    setLoading(false);
  }
};

  // ✅ NEW: Fetch marketplace accounts
  const fetchMarketplaceAccounts = async () => {
    try {
      const settings = await settingsService.getSettings();
      const activeAccounts = settings.marketplaceAccounts?.filter(acc => acc.isActive) || [];
      setMarketplaceAccounts(activeAccounts);
    } catch (error) {
      console.error('Failed to fetch marketplace accounts:', error);
    }
  };

  const handleManualAutoAllocation = async (designs = []) => {
    if (autoAllocRunning) return;
    setAutoAllocRunning(true);
    setShowAutoAllocMenu(false);

    try {
      // designs = [] means run ALL, otherwise run only selected designs
      if (designs.length === 0) {
        // Full run — all variants
        const res = await fetch(`${API}/auto-allocation/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to run');

        const { ran, skipped, errors } = data.summary;
        if (ran === 0 && skipped > 0) {
          toast(`All variants skipped (rate limit or not eligible)`, { icon: '⏳' });
        } else {
          toast.success(`Auto allocation complete — ${ran} ran, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`);
        }

      } else {
        // Per-design run — fire one request per design, all variants inside it
        let totalRan = 0, totalSkipped = 0, totalErrors = 0;

        for (const design of designs) {
          const product = products.find(p => p.design === design);
          if (!product) continue;

          for (const cv of (product.colors || [])) {
            for (const sv of (cv.sizes || [])) {
              if ((sv.reservedStock || 0) <= 0) continue;
              try {
                const res = await fetch(`${API}/auto-allocation/run`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ design, color: cv.color, size: sv.size })
                });
                const data = await res.json();
                if (data.skipped) totalSkipped++;
                else totalRan++;
              } catch {
                totalErrors++;
              }
            }
          }
        }

        toast.success(`Auto allocation complete — ${totalRan} ran, ${totalSkipped} skipped${totalErrors > 0 ? `, ${totalErrors} errors` : ''}`);
      }

      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Auto allocation failed');
    } finally {
      setAutoAllocRunning(false);
      setSelectedDesigns([]);
    }
  };

  // Helper: Time ago
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Helper: Check if color is active
  const isColorActive = (colorName) => {
    return activeColors.some(c => c.colorName === colorName);
  };

// Get allocated stock for a specific account
const getAllocatedStockForAccount = (sizeData, accountName) => {
  if (accountName === 'all') {
    return sizeData.reservedStock || 0;
  }
  
  if (!sizeData.reservedAllocations || !Array.isArray(sizeData.reservedAllocations)) {
    console.log('⚠️ No allocations found for size:', sizeData.size);
    return 0;
  }
  
  const allocation = sizeData.reservedAllocations.find(a => a.accountName === accountName);
  console.log('🔍 Looking for account:', accountName, '| Found:', allocation);
  
  return allocation?.quantity || 0;
};

// ✅ NEW: Get pool stock
const getPoolStock = (sizeData) => {
  const totalReserved = sizeData.reservedStock || 0;
  const totalAllocated = sizeData.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
  return totalReserved - totalAllocated;
};

// ✅ NEW: Open allocation modal
const handleOpenAllocationModal = (productId, design) => {
  const product = products.find(p => p._id === productId);
  if (product) {
    setSelectedProduct(product);
    setShowAllocationModal(true);
  }
};

// NEW: Create flat variant list (each variant is separate)
const allVariants = useMemo(() => {
  const variants = [];
  
  products.forEach(product => {
    if (product.colors && Array.isArray(product.colors)) {
      // FILTER: Only process active colors
      product.colors
        .filter(color => isColorActive(color.color)) // ADD THIS LINE
        .forEach(color => {
          if (color.sizes && Array.isArray(color.sizes)) {
            color.sizes
              .filter(s => getSizesForDesign(product.design).includes(s.size))
              .forEach(size => {
                const currentStock = size.currentStock || 0;
                const lockedStock = size.lockedStock || 0;
                const reservedStock = size.reservedStock || 0;
                const availableStock = size.availableStock !== undefined 
                  ? size.availableStock 
                  : currentStock - lockedStock;

                // ⭐ FIX: Calculate display stock based on account filter
                let displayStock;
                if (filterAccount === 'all') {
                  // Show total reserved stock
                  displayStock = reservedStock;
                } else {
                  // Show allocated stock for specific account
                  displayStock = getAllocatedStockForAccount(size, filterAccount);
                }

                // Calculate pool stock
                const totalAllocated = size.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
                const poolStock = reservedStock - totalAllocated;

                // Determine status based on displayStock (not reservedStock)
                let status = 'instock';
                if (displayStock === 0) {
                  status = 'outofstock';
                } else if (displayStock <= globalThreshold) {
                  status = 'lowstock';
                }

                variants.push({
                  productId: product._id,
                  design: product.design,
                  color: color.color,
                  size: size.size,
                  stock: displayStock, // ⭐ Use displayStock here
                  wholesalePrice: color.wholesalePrice || 0,
                  retailPrice: color.retailPrice || 0,
                  value: displayStock * (color.wholesalePrice || 0),
                  status: status,
                  // Keep raw data for display
                  mainStock: currentStock,
                  reservedStock: reservedStock,
                  displayStock: displayStock, // ⭐ NEW
                  poolStock: poolStock,
                  allocations: size.reservedAllocations || []
                });
              });
          }
        });
    }
  });
  
  return variants;
}, [products, enabledSizes, globalThreshold, filterAccount, activeColors]); // ⭐ ADD filterAccount to deps

  // Get unique designs and colors for filters
  const uniqueDesigns = useMemo(() => {
    return [...new Set(allVariants.map(v => v.design))].sort();
  }, [allVariants]);

  const uniqueColors = useMemo(() => {
    return [...new Set(allVariants.map(v => v.color))].sort();
  }, [allVariants]);

  // Filter variants
  const filteredVariants = useMemo(() => {
    let filtered = allVariants;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.design.toLowerCase().includes(term) ||
        v.color.toLowerCase().includes(term) ||
        v.size.toLowerCase().includes(term)
      );
    }

    if (filterDesign !== 'all') {
      filtered = filtered.filter(v => v.design === filterDesign);
    }

    if (filterColor !== 'all') {
      filtered = filtered.filter(v => v.color === filterColor);
    }

    if (filterStock === 'low') {
      filtered = filtered.filter(v => v.displayStock > 0 && v.displayStock <= 10); // ✅ CHANGE
    } else if (filterStock === 'out') {
      filtered = filtered.filter(v => v.displayStock === 0); // ✅ CHANGE
    }

    return filtered;
  }, [allVariants, searchTerm, filterDesign, filterColor, filterStock]);

// Group filtered variants by design and color
const groupedVariants = useMemo(() => {
  const grouped = {};
  
  filteredVariants.forEach(variant => {
    const key = `${variant.productId}-${variant.design}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        productId: variant.productId,
        design: variant.design,
        colors: {}
      };
    }
    
    if (!grouped[key].colors[variant.color]) {
      grouped[key].colors[variant.color] = {
        color: variant.color,
        wholesalePrice: variant.wholesalePrice,
        retailPrice: variant.retailPrice,
        sizes: []
      };
    }
    
    // ⭐ FIX: Include reservedAllocations
    grouped[key].colors[variant.color].sizes.push({
      size: variant.size,
      mainStock: variant.mainStock,
      reservedStock: variant.reservedStock,
      currentStock: variant.mainStock, // ⭐ ADD THIS
      reservedAllocations: variant.allocations // ⭐ ADD THIS - Critical!
    });
  });
  
  return Object.values(grouped);
}, [filteredVariants]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalReserved = allVariants.reduce((sum, v) => sum + v.displayStock, 0); // ✅ CHANGE
    const lowStock = allVariants.filter(v => v.displayStock > 0 && v.displayStock <= 10).length; // ✅ CHANGE
    const outOfStock = allVariants.filter(v => v.displayStock === 0).length; // ✅ CHANGE
    const lastTransfer = recentTransfers.length > 0 ? recentTransfers[0] : null;
    const lastTransferTime = lastTransfer ? getTimeAgo(new Date(lastTransfer.createdAt)) : 'No transfers yet';
    const totalPool = allVariants.reduce((sum, v) => sum + v.poolStock, 0); // ✅ NEW
    return { totalReserved, lowStock, outOfStock, lastTransferTime, totalPool }; // ✅ ADD totalPool
  }, [allVariants, recentTransfers]);

  // Handle single transfer modal
  const openTransferModal = (variant, direction) => {
    setSelectedVariant(variant);
    setTransferDirection(direction);
    setShowTransferModal(true);
  };

  const handleTransferConfirm = async (data) => {
    try {
      if (transferDirection === 'to-reserved') {
        await transferService.transferToReserved(data);
      } else {
        await transferService.transferToMain(data);
      }
      await fetchData();
    } catch (error) {
      throw error;
    }
  };

  // Bulk transfer functions
  const openBulkModal = (mode) => {
    setBulkMode(mode);
    setBulkQuantities({});
    setShowBulkModal(true);
  };

  const handleBulkQuantityChange = (productId, color, size, value) => {
    const key = `${productId}-${color}-${size}`;
    const numValue = parseInt(value) || 0;
    setBulkQuantities(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  const handleQuickFillColor = (productId, colorData) => {
    const value = prompt('Enter quantity to fill for all sizes:', '10');
    if (value) {
      const numValue = parseInt(value) || 0;
      colorData.sizes.forEach(sizeData => {
        const key = `${productId}-${colorData.color}-${sizeData.size}`;
        setBulkQuantities(prev => ({
          ...prev,
          [key]: numValue
        }));
      });
    }
  };

// ✅ NEW: Handle account-specific return input
const handleAccountReturnChange = (productId, color, size, accountName, value, maxQuantity) => {
  const numValue = parseInt(value) || 0;
  
  // Validate: can't exceed allocated quantity
  if (numValue > maxQuantity) {
    toast.error(`Cannot return more than ${maxQuantity} units from ${accountName}`);
    return;
  }

  const key = `${productId}-${color}-${size}-${accountName}`;
  setBulkQuantities(prev => ({
    ...prev,
    [key]: numValue > 0 ? numValue : ''
  }));
};

// ✅ UPDATED: Calculate total bulk quantity (handle both modes)
const getTotalBulkQuantity = () => {
  return Object.entries(bulkQuantities).reduce((total, [key, qty]) => {
    return total + (parseInt(qty) || 0);
  }, 0);
};

// ✅ UPDATED: Handle bulk transfer submit (support per-account returns)
const handleBulkTransferSubmit = async () => {
  try {
    const transfersMap = {};

    // Build transfers array
    Object.entries(bulkQuantities).forEach(([key, qty]) => {
      const quantity = parseInt(qty) || 0;
      if (quantity <= 0) return;

      if (bulkMode === 'refill') {
        // REFILL MODE: key = productId-color-size
        const [productId, color, size] = key.split('-');
        const product = products.find(p => p._id === productId);
        if (!product) return;

        const transferKey = `${product.design}-${color}-${size}`;
        if (!transfersMap[transferKey]) {
          transfersMap[transferKey] = {
            design: product.design,
            color,
            size,
            quantity: 0
          };
        }
        transfersMap[transferKey].quantity += quantity;
      } else {
        // RETURN MODE: key = productId-color-size-accountName
        const parts = key.split('-');
        const accountName = parts[parts.length - 1]; // Last part is account name
        const size = parts[parts.length - 2]; // Second last is size
        const color = parts.slice(1, parts.length - 2).join('-'); // Middle parts are color
        const productId = parts[0]; // First part is product ID

        const product = products.find(p => p._id === productId);
        if (!product) return;

        const transferKey = `${product.design}-${color}-${size}`;
        if (!transfersMap[transferKey]) {
          transfersMap[transferKey] = {
            design: product.design,
            color,
            size,
            accountReturns: []
          };
        }
        transfersMap[transferKey].accountReturns.push({
          accountName,
          quantity
        });
      }
    });

    const transfers = Object.values(transfersMap);

    if (transfers.length === 0) {
      toast.error('Please enter at least one quantity');
      return;
    }

    if (bulkMode === 'refill') {
      await transferService.bulkTransferToReserved({ transfers });
      toast.success(`Successfully refilled ${transfers.length} variants to reserved inventory`);
    } else {
      await transferService.bulkTransferToMain({ transfers });
      toast.success(`Successfully returned ${transfers.length} variants to main inventory`);
    }

    setBulkQuantities({});
    setShowBulkModal(false);
    fetchProducts();
  } catch (error) {
    console.error('Bulk transfer error:', error);
    toast.error(error.response?.data?.message || 'Failed to complete bulk transfer');
  }
};

// ✅ ADD: Internal transfer handlers
const openInternalModal = () => {
  setInternalTransfers({});
  setShowInternalModal(true);
};

// ✅ UPDATED: Auto-fill toAccount when only 2 accounts and fromAccount is selected
const handleInternalTransferChange = (productId, color, size, field, value) => {
  const key = `${productId}-${color}-${size}`;
  
  setInternalTransfers(prev => {
    const updated = {
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    };

    // ✅ AUTO-FILL LOGIC: If selecting fromAccount and only 2 accounts exist, auto-fill toAccount
    if (field === 'fromAccount' && value && marketplaceAccounts.length === 2) {
      const otherAccount = marketplaceAccounts.find(acc => acc.accountName !== value);
      if (otherAccount) {
        updated[key].toAccount = otherAccount.accountName;
      }
    }

    return updated;
  });
};

const getTotalInternalQuantity = () => {
  return Object.values(internalTransfers).reduce((total, transfer) => {
    return total + (parseInt(transfer?.quantity) || 0);
  }, 0);
};

const handleInternalTransferSubmit = async () => {
  try {
    const transfers = [];

    Object.entries(internalTransfers).forEach(([key, data]) => {
      const { fromAccount, toAccount, quantity } = data;
      if (!fromAccount || !toAccount || !quantity || quantity <= 0) return;

      const [productId, ...rest] = key.split('-');
      const size = rest[rest.length - 1];
      const color = rest.slice(0, rest.length - 1).join('-');

      const product = products.find(p => p._id === productId);
      if (!product) return;

      transfers.push({
        design: product.design,
        color,
        size,
        fromAccount,
        toAccount,
        quantity: parseInt(quantity)
      });
    });

    if (transfers.length === 0) {
      toast.error('Please enter at least one transfer');
      return;
    }

    await transferService.bulkInternalTransfer({ transfers });
    toast.success(`Successfully transferred ${transfers.length} variants between accounts`);
    
    setInternalTransfers({});
    setShowInternalModal(false);
    fetchData();
  } catch (error) {
    console.error('Internal transfer error:', error);
    toast.error(error.response?.data?.message || 'Failed to complete internal transfer');
  }
};

  // Export to CSV
  const handleExport = (type) => {
    let dataToExport = [];
    if (type === 'all') {
      dataToExport = allVariants;
    } else if (type === 'lowstock') {
      dataToExport = allVariants.filter(v => v.reservedStock > 0 && v.reservedStock <= 10);
    } else if (type === 'outofstock') {
      dataToExport = allVariants.filter(v => v.reservedStock === 0);
    }

    if (dataToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Design', 'Color', 'Size', 'Reserved Stock', 'Pool', 'Main Stock', 'Wholesale Price', 'Retail Price']; // ✅ ADD Pool
    const rows = dataToExport.map(v => [
      v.design,
      v.color,
      v.size,
      v.displayStock, // ✅ CHANGE to displayStock
      v.poolStock, // ✅ ADD Pool
      v.mainStock,
      v.wholesalePrice,
      v.retailPrice
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reserved-inventory-${type}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} variants`);
    setShowExportModal(false);
  };

  // Helper: Get stock status color
  const getStockStatusColor = (reservedStock) => {
    if (reservedStock === 0) return 'bg-red-50 text-red-700 border-red-200';
    if (reservedStock <= 10) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  // Helper: Get transfer type info
  const getTransferTypeInfo = (type) => {
    const types = {
      'manual_refill': { icon: '🟢', label: 'Refill', color: 'text-green-600' },
      'manual_return': { icon: '🔵', label: 'Return', color: 'text-blue-600' },
      'marketplace_order': { icon: '🟣', label: 'Sale', color: 'text-purple-600' },
      'emergency_use': { icon: '🟠', label: 'Emergency', color: 'text-orange-600' }
    };
    return types[type] || { icon: '📦', label: 'Transfer', color: 'text-gray-600' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FiLock className="text-3xl text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Reserved Inventory</h1>
          </div>
          <p className="text-gray-600 mt-1">Dedicated stock for marketplace sales only</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {/* Auto Allocate with design picker */}
          <div className="relative" ref={autoAllocMenuRef}>

            {/* Main button */}
            <button
              onClick={() => setShowAutoAllocMenu(prev => !prev)}
              disabled={autoAllocRunning}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all
                ${autoAllocRunning
                  ? 'bg-amber-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600'
                }`}
            >
              <FiZap className={`w-4 h-4 ${autoAllocRunning ? 'animate-pulse' : ''}`} />
              {autoAllocRunning ? 'Allocating...' : 'Auto Allocate'}
              <FiChevronDown className="w-3.5 h-3.5 ml-1" />
            </button>

            {/* Dropdown */}
            {showAutoAllocMenu && !autoAllocRunning && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl
                              border border-gray-200 z-50 overflow-hidden">

                {/* Header */}
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <p className="text-sm font-bold text-amber-900">Select Designs to Allocate</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Pick specific designs or run for all
                  </p>
                </div>

                {/* Design list */}
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {uniqueDesigns.map(design => (
                    <label
                      key={design}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50
                                cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDesigns.includes(design)}
                        onChange={() =>
                          setSelectedDesigns(prev =>
                            prev.includes(design)
                              ? prev.filter(d => d !== design)
                              : [...prev, design]
                          )
                        }
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span className="text-sm font-medium text-gray-800">{design}</span>
                      {/* Show reserved units for this design */}
                      <span className="ml-auto text-xs text-gray-400">
                        {allVariants
                          .filter(v => v.design === design)
                          .reduce((sum, v) => sum + v.reservedStock, 0)} R
                      </span>
                    </label>
                  ))}
                </div>

                {/* Footer actions */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => handleManualAutoAllocation(selectedDesigns)}
                    disabled={autoAllocRunning}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white
                              rounded-lg text-sm font-semibold transition-colors"
                  >
                    {selectedDesigns.length === 0
                      ? `Run All (${uniqueDesigns.length} designs)`
                      : `Run ${selectedDesigns.length} design${selectedDesigns.length > 1 ? 's' : ''}`
                    }
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDesigns([]);
                      setShowAutoAllocMenu(false);
                    }}
                    className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg
                              text-sm hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

              </div>
            )}
          </div>
          {/*<FlipkartSyncButton />*/}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reserved</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalReserved}</p>
              <p className="text-xs text-gray-500">units</p>
            </div>
            <FiPackage className="text-4xl text-blue-600 opacity-20" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.lowStock}</p>
              <p className="text-xs text-gray-500">variants</p>
            </div>
            <FiAlertTriangle className="text-4xl text-yellow-600 opacity-20" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-3xl font-bold text-red-600">{stats.outOfStock}</p>
              <p className="text-xs text-gray-500">variants</p>
            </div>
            <FiAlertTriangle className="text-4xl text-red-600 opacity-20" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <div>
            <p className="text-sm text-gray-600">Last Transfer</p>
            <p className="text-2xl font-bold text-gray-700">{stats.lastTransferTime}</p>
            <p className="text-xs text-gray-500">most recent</p>
          </div>
        </Card>
      </div>

      {/* Filters & Actions Bar */}
      <Card>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search design, color, or size..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          {/* ✅ NEW: Account Filter */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Accounts</option>
            {marketplaceAccounts.map(account => (
              <option key={account._id} value={account.accountName}>
                {account.accountName}
              </option>
            ))}
          </select>

          <select
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Colors</option>
            {uniqueColors.map(color => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>

          <select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openBulkModal('refill')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FiArrowDown className="w-4 h-4" />
              Bulk Refill
            </button>
            <button
              onClick={() => openBulkModal('return')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiArrowUp className="w-4 h-4" />
              Bulk Return
            </button>
            <button
              onClick={openInternalModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <FiArrowRight className="w-4 h-4" />
              Internal Transfer
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content: 80-20 Split */}
      <div className="flex gap-6">
        {/* Left: Inventory Display (80%) */}
        <div className="flex-1" style={{ width: '80%' }}>
          {groupedVariants.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FiPackage className="mx-auto text-6xl text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">No variants found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedVariants.map((group) => {
                const totalReserved = Object.values(group.colors).reduce((sum, colorData) =>
                  sum + colorData.sizes.reduce((s, size) => s + size.reservedStock, 0), 0
                );
                const totalMain = Object.values(group.colors).reduce((sum, colorData) =>
                  sum + colorData.sizes.reduce((s, size) => s + size.mainStock, 0), 0
                );

                return (
                  <Card key={`${group.productId}-${group.design}`}>
                  {/* Design Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b">
                    <div className="flex items-center gap-3">
                      <FiLayers className="text-2xl text-gray-600" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{group.design}</h3>
                        <p className="text-sm text-gray-500">
                          Reserved: {totalReserved}, Main: {totalMain}
                        </p>
                      </div>
                    </div>
                    {/* ✅ NEW: Allocate Button */}
                    <button
                      onClick={() => handleOpenAllocationModal(group.productId, group.design)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <FiLayers />
                      Allocate
                    </button>
                  </div>

                    {/* Colors */}
                    <div className="space-y-6">
                      {Object.values(group.colors).map((colorData) => (
                        <div key={colorData.color} className="border-l-4 pl-4" style={{ borderColor: getColorCode(colorData.color) || '#ccc' }}>
                          {/* Color Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-6 h-6 rounded-full border-2 border-gray-300"
                                  style={{ backgroundColor: getColorCode(colorData.color) || '#9CA3AF' }}
                                />
                                <span className="font-semibold text-gray-900">{colorData.color}</span>
                                <span className="text-xs text-gray-500 font-medium">
                                  ({colorData.sizes.reduce((sum, size) => sum + size.reservedStock, 0)} units)
                                </span>
                              </div>
                              <span className="text-sm text-gray-500">
                                W: ₹{colorData.wholesalePrice} | R: ₹{colorData.retailPrice}
                              </span>
                            </div>

                          {/* Size Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {colorData.sizes.map((sizeData) => {
                              // ⭐ Calculate display stock based on account filter
                              const displayStock = filterAccount === 'all' 
                                ? (sizeData.reservedStock || 0)
                                : getAllocatedStockForAccount(sizeData, filterAccount);
                              
                              const poolStock = getPoolStock(sizeData);
                              const mainStock = sizeData.currentStock || 0;

                              return (
                                <div
                                  key={sizeData.size}
                                  className={`relative border-2 rounded-lg p-3 transition-all ${getStockStatusColor(displayStock)}`}
                                >
                                  {/* Stock Display */}
                                  <div className="text-center">
                                    {/* ⭐ CONDITIONAL DISPLAY */}
                                    {filterAccount === 'all' ? (
                                      // Show Reserved/Main format for "All Accounts"
                                      <div className="text-sm font-bold">
                                        {sizeData.size}:{displayStock}/{mainStock}
                                      </div>
                                    ) : (
                                      // Show ONLY allocated stock for specific account
                                      <div className="text-sm font-bold">
                                        {sizeData.size}:{displayStock}
                                      </div>
                                    )}

                                    {/* Show account name when filtered */}
                                    {filterAccount !== 'all' && displayStock > 0 && (
                                      <div className="text-xs text-blue-600 mt-1 font-medium">
                                        {filterAccount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Transfers Sidebar (20%) */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigate('/transfer-history')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  View Full History
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {recentTransfers.length === 0 ? (
                  <div className="text-center py-8">
                    <FiPackage className="mx-auto text-4xl text-gray-300 mb-2" />
                    <p className="text-gray-400 text-sm">No transfers yet</p>
                  </div>
                ) : (
                  recentTransfers.slice(0, 20).map((transfer, index) => {
                    const typeInfo = getTransferTypeInfo(transfer.type);
                    return (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo.icon}</span>
                            <span className={`text-xs font-semibold ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(new Date(transfer.createdAt))}
                          </span>
                        </div>

                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{transfer.design}</div>
                          <div className="text-gray-600 text-xs">
                            {transfer.color} - Size {transfer.size}
                          </div>
                          <div className={`font-bold mt-1 ${
                            transfer.from === 'main' || transfer.from === 'reserved' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {transfer.from === 'main' || transfer.from === 'reserved' ? '+' : '-'}
                            {transfer.quantity} units
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Single Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          direction={transferDirection}
          variant={selectedVariant}
          onConfirm={handleTransferConfirm}
        />
      )}

      {/* Bulk Transfer Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Bulk {bulkMode === 'refill' ? 'Refill to Reserved' : 'Return to Main'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {bulkMode === 'refill' 
                    ? 'Enter quantities to transfer from Main → Reserved'
                    : 'Enter quantities per account to return from Reserved → Main'}
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-6 pt-4 pb-2 bg-gray-50 border-b">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search design... (e.g., D1, D10)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {products
                  .filter(product => {
                    if (!searchTerm) return true;
                    return product.design.toLowerCase().includes(searchTerm.toLowerCase());
                  })
                  .map((product) => {
                    const productColors = product.colors?.filter(c => isColorActive(c.color)) || [];
                    if (productColors.length === 0) return null;

                    return (
                      <Card key={product._id}>
                        {/* Design Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                          <h3 className="text-lg font-bold text-gray-900">{product.design}</h3>
                        </div>

                        {/* Colors */}
                        <div className="space-y-6">
                          {productColors.map((colorData) => (
                            <div key={colorData.color} className="border-l-4 pl-4" style={{ borderColor: getColorCode(colorData.color) || '#ccc' }}>
                              {/* Color Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-5 h-5 rounded-full border"
                                    style={{ backgroundColor: getColorCode(colorData.color) || '#9CA3AF' }}
                                  />
                                  <span className="font-semibold">{colorData.color}</span>
                                </div>
                                {bulkMode === 'refill' && (
                                  <button
                                    onClick={() => handleQuickFillColor(product._id, { ...colorData, sizes: colorData.sizes.filter(s => enabledSizes.includes(s.size)) })}
                                    className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >
                                    Quick Fill All
                                  </button>
                                )}
                              </div>

                              {/* Size Input Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {colorData.sizes?.filter(s => getSizesForDesign(product.design).includes(s.size))
                                  .map((sizeData) => {
                                    const key = `${product._id}-${colorData.color}-${sizeData.size}`;
                                    
                                    // ✅ Get accounts with allocated stock for RETURN mode
                                    const allocatedAccounts = bulkMode === 'return' 
                                      ? (sizeData.reservedAllocations || []).filter(a => a.quantity > 0)
                                      : [];

                                    return (
                                      <div key={sizeData.size} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                                        {/* Size Header */}
                                        <div className="text-center mb-3 pb-2 border-b">
                                          <div className="text-sm font-bold text-gray-900">Size {sizeData.size}</div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            {bulkMode === 'return' 
                                              ? `Total Reserved: ${sizeData.reservedStock || 0}`
                                              : `Main Stock: ${sizeData.currentStock || 0}`}
                                          </div>
                                        </div>

                                        {/* ✅ REFILL MODE: Single input */}
                                        {bulkMode === 'refill' && (
                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={bulkQuantities[key] || ''}
                                            onChange={(e) => handleBulkQuantityChange(product._id, colorData.color, sizeData.size, e.target.value)}
                                            className="w-full px-3 py-2 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                          />
                                        )}

                                        {/* ✅ RETURN MODE: Per-account inputs */}
                                        {bulkMode === 'return' && (
                                          <div className="space-y-2">
                                            {allocatedAccounts.length > 0 ? (
                                              <>
                                                {allocatedAccounts.map((allocation) => {
                                                  const accountKey = `${key}-${allocation.accountName}`;
                                                  return (
                                                    <div key={allocation.accountName} className="bg-white rounded p-2 border border-gray-200">
                                                      <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-gray-700">{allocation.accountName}</span>
                                                        <span className="text-xs text-gray-500">Has: {allocation.quantity}</span>
                                                      </div>
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        max={allocation.quantity}
                                                        placeholder="0"
                                                        value={bulkQuantities[accountKey] || ''}
                                                        onChange={(e) => handleAccountReturnChange(product._id, colorData.color, sizeData.size, allocation.accountName, e.target.value, allocation.quantity)}
                                                        className="w-full px-2 py-1 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                                      />
                                                    </div>
                                                  );
                                                })}
                                                {/* Total for this size */}
                                                <div className="pt-2 border-t text-center">
                                                  <span className="text-xs font-semibold text-blue-600">
                                                    Total: {allocatedAccounts.reduce((sum, alloc) => {
                                                      const accountKey = `${key}-${alloc.accountName}`;
                                                      return sum + (parseInt(bulkQuantities[accountKey]) || 0);
                                                    }, 0)} units
                                                  </span>
                                                </div>
                                              </>
                                            ) : (
                                              <div className="text-center py-2">
                                                <p className="text-xs text-gray-400">No allocated stock</p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                
                {/* No Results Message */}
                {products.filter(p => p.design.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && searchTerm && (
                  <div className="text-center py-12">
                    <FiSearch className="mx-auto text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">No designs found for "{searchTerm}"</p>
                    <p className="text-gray-400 text-sm">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 sticky bottom-0">
              <div className="text-lg font-bold text-gray-900">
                Total units to transfer: <span className="text-blue-600">{getTotalBulkQuantity()}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setBulkQuantities({})}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkTransferSubmit}
                  disabled={getTotalBulkQuantity() === 0}
                  className={`px-6 py-2 rounded-lg text-white font-semibold ${
                    getTotalBulkQuantity() === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : bulkMode === 'refill'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Transfer Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ADD: Internal Transfer Modal */}
      {showInternalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Internal Transfer Between Accounts
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Transfer reserved stock from one account to another
                </p>
              </div>
              <button
                onClick={() => setShowInternalModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-6 pt-4 pb-2 bg-gray-50 border-b">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search design... (e.g., D1, D10)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {products
                  .filter(product => {
                    if (!searchTerm) return true;
                    return product.design.toLowerCase().includes(searchTerm.toLowerCase());
                  })
                  .map((product) => {
                    const productColors = product.colors?.filter(c => isColorActive(c.color)) || [];
                    if (productColors.length === 0) return null;

                    return (
                      <Card key={product._id}>
                        {/* Design Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                          <h3 className="text-lg font-bold text-gray-900">{product.design}</h3>
                        </div>

                        {/* Colors */}
                        <div className="space-y-6">
                          {productColors.map((colorData) => (
                            <div key={colorData.color} className="border-l-4 pl-4" style={{ borderColor: getColorCode(colorData.color) || '#ccc' }}>
                              {/* Color Header */}
                              <div className="flex items-center gap-3 mb-3">
                                <div
                                  className="w-5 h-5 rounded-full border"
                                  style={{ backgroundColor: getColorCode(colorData.color) || '#9CA3AF' }}
                                />
                                <span className="font-semibold">{colorData.color}</span>
                              </div>

                              {/* Size Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {colorData.sizes
                                  ?.filter(s => enabledSizes.includes(s.size))
                                  .map((sizeData) => {
                                    const key = `${product._id}-${colorData.color}-${sizeData.size}`;
                                    const allocatedAccounts = (sizeData.reservedAllocations || []).filter(a => a.quantity > 0);
                                    
                                    if (allocatedAccounts.length === 0) return null;

                                    return (
                                      <div key={sizeData.size} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                                        {/* Size Header */}
                                        <div className="text-center mb-3 pb-2 border-b">
                                          <div className="text-sm font-bold text-gray-900">Size {sizeData.size}</div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            Total Reserved: {sizeData.reservedStock || 0}
                                          </div>
                                        </div>

                                        {/* Transfer Inputs */}
                                        <div className="space-y-3">
                                          {/* From Account */}
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                              From Account
                                            </label>
                                            <select
                                              value={internalTransfers[key]?.fromAccount || ''}
                                              onChange={(e) => handleInternalTransferChange(product._id, colorData.color, sizeData.size, 'fromAccount', e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                            >
                                              <option value="">Select...</option>
                                              {allocatedAccounts.map(alloc => (
                                                <option key={alloc.accountName} value={alloc.accountName}>
                                                  {alloc.accountName} ({alloc.quantity})
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          {/* To Account */}
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                              To Account
                                            </label>
                                            <select
                                              value={internalTransfers[key]?.toAccount || ''}
                                              onChange={(e) => handleInternalTransferChange(product._id, colorData.color, sizeData.size, 'toAccount', e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                            >
                                              <option value="">Select...</option>
                                              {marketplaceAccounts
                                                .filter(acc => acc.accountName !== internalTransfers[key]?.fromAccount)
                                                .map(acc => (
                                                  <option key={acc.accountName} value={acc.accountName}>
                                                    {acc.accountName}
                                                  </option>
                                                ))}
                                            </select>
                                          </div>

                                          {/* Quantity */}
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                              Quantity
                                            </label>
                                            <input
                                              type="number"
                                              min="0"
                                              max={allocatedAccounts.find(a => a.accountName === internalTransfers[key]?.fromAccount)?.quantity || 0}
                                              placeholder="0"
                                              value={internalTransfers[key]?.quantity || ''}
                                              onChange={(e) => handleInternalTransferChange(product._id, colorData.color, sizeData.size, 'quantity', e.target.value)}
                                              className="w-full px-2 py-1.5 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                              disabled={!internalTransfers[key]?.fromAccount}
                                            />
                                            {internalTransfers[key]?.fromAccount && (
                                              <p className="text-xs text-gray-500 mt-1 text-center">
                                                Max: {allocatedAccounts.find(a => a.accountName === internalTransfers[key]?.fromAccount)?.quantity || 0}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                
                {/* No Results Message */}
                {products.filter(p => p.design.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && searchTerm && (
                  <div className="text-center py-12">
                    <FiSearch className="mx-auto text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">No designs found for "{searchTerm}"</p>
                    <p className="text-gray-400 text-sm">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 sticky bottom-0">
              <div className="text-lg font-bold text-gray-900">
                Total units to transfer: <span className="text-purple-600">{getTotalInternalQuantity()}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setInternalTransfers({})}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowInternalModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInternalTransferSubmit}
                  disabled={getTotalInternalQuantity() === 0}
                  className={`px-6 py-2 rounded-lg text-white font-semibold ${
                    getTotalInternalQuantity() === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  Transfer Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Export Inventory</h3>
              <button onClick={() => setShowExportModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">Choose which variants to export to CSV</p>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('all')}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Export All Variants ({allVariants.length})
              </button>
              <button
                onClick={() => handleExport('lowstock')}
                className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
              >
                Export Low Stock ({allVariants.filter(v => v.reservedStock > 0 && v.reservedStock <= 10).length})
              </button>
              <button
                onClick={() => handleExport('outofstock')}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
              >
                Export Out of Stock ({allVariants.filter(v => v.reservedStock === 0).length})
              </button>
            </div>
          </Card>
        </div>
      )}
      {/* ✅ NEW: Allocation Modal */}
      {showAllocationModal && (
        <AllocationModal
          isOpen={showAllocationModal}
          onClose={() => {
            setShowAllocationModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSuccess={fetchData}
        />
      )}
      <ScrollToTop />
    </div>
  );
};

export default ReservedInventory;
