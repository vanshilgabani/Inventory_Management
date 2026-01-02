import { useState, useEffect, useMemo, useCallback } from 'react';
import { wholesaleService } from '../services/wholesaleService';
import { inventoryService } from '../services/inventoryService';
import { settingsService } from '../services/settingsService';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import BorrowFromReservedModal from '../components/BorrowFromReservedModal';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import { 
  FiPlus, FiEdit2, FiTrash2, FiDownload, FiEye, FiSearch, 
  FiFilter, FiX, FiMessageCircle, FiShoppingCart, FiCopy,
  FiChevronDown, FiChevronRight, FiAlertTriangle, FiCheckCircle
} from 'react-icons/fi';
import { format } from 'date-fns';
import { generateInvoice, sendChallanViaWhatsApp } from '../components/InvoiceGenerator';
import { useAuth } from '../context/AuthContext';
import { debounce } from '../utils/debounce';
import { formatDate, getDaysFromNow } from '../utils/dateUtils';
import SkeletonCard from '../components/common/SkeletonCard';
import UseLockStockModal from '../components/UseLockStockModal';
import { useColorPalette } from '../hooks/useColorPalette';

const Wholesale = () => {
  const { isAdmin } = useAuth();
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();
  const { colors, getColorsForDesign, getColorCode } = useColorPalette();

  // State Management
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [allBuyers, setAllBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBuyerListModal, setShowBuyerListModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [editingPaymentHistory, setEditingPaymentHistory] = useState(null);
  const [searchMobile, setSearchMobile] = useState('');
  const [buyerFound, setBuyerFound] = useState(null);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstPercentage, setGstPercentage] = useState(5);
  const [showUseLockModal, setShowUseLockModal] = useState(false);
  const [useLockData, setUseLockData] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [quickFilters, setQuickFilters] = useState([]);
  const [showDraftsListModal, setShowDraftsListModal] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedColors, setExpandedColors] = useState({});
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [borrowData, setBorrowData] = useState(null);

  const [formData, setFormData] = useState({
    buyerName: '',
    buyerContact: '',
    buyerEmail: '',
    buyerAddress: '',
    businessName: '',
    gstNumber: '',
    deliveryDate: '',
    notes: '',
    discountType: 'none',
    discountValue: 0,
    gstEnabled: true,
    fulfillmentType: 'warehouse'
  });

  const [orderItems, setOrderItems] = useState([
    { 
      design: '', 
      selectedColors: [], 
      pricePerUnit: 0, 
      colorData: {},
      isCollapsed: false,
      isComplete: false
    }
  ]);

  // Auto-save draft functionality
  useEffect(() => {
    if (showModal && !editingOrder) {
      const interval = setInterval(() => {
        autoSaveDraft();
      }, 30000); // Auto-save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [showModal, formData, orderItems, editingOrder]);

// Load all saved drafts on mount
useEffect(() => {
  loadAllDrafts();
  
  // Update timestamps every 30 seconds
  const interval = setInterval(() => {
    loadAllDrafts();
  }, 30000);
  
  return () => clearInterval(interval);
}, []);

// Function to load all drafts from localStorage
const loadAllDrafts = () => {
  const draftsData = localStorage.getItem('wholesaleDrafts');
  if (draftsData) {
    try {
      const parsed = JSON.parse(draftsData);
      // Remove expired drafts (older than 7 days)
      const validDrafts = parsed.filter(draft => {
        const age = Date.now() - draft.timestamp;
        return age < 7 * 24 * 60 * 60 * 1000; // 7 days
      });
      setSavedDrafts(validDrafts);
      
      // Update localStorage if any drafts were removed
      if (validDrafts.length !== parsed.length) {
        localStorage.setItem('wholesaleDrafts', JSON.stringify(validDrafts));
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
      setSavedDrafts([]);
    }
  } else {
    setSavedDrafts([]);
  }
};

// Keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e) => {
    if (!showModal) return;
    
    // Ctrl+Shift+A for Add new item (instead of Ctrl+N)
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      e.stopPropagation();
      handleAddItem();
      toast.success('New item added!');
      return;
    }
    
    // Ctrl+S for Save draft
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      autoSaveDraft();
      toast.success('Draft saved!');
      return;
    }
    
    // Ctrl+Shift+D for Duplicate (when an item is focused)
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      e.stopPropagation();
      // Duplicate last item if exists
      if (orderItems.length > 0) {
        const lastIndex = orderItems.length - 1;
        duplicateItem(lastIndex);
      }
      return;
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowModal(false);
      resetForm();
      return;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [showModal, orderItems]);

// Generate unique draft name based on business name
const generateDraftName = (businessName, buyerName) => {
  const baseName = businessName || buyerName || 'Unnamed Draft';
  
  // Check if name already exists
  const existingNames = savedDrafts.map(d => d.name);
  
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  // Find the highest number suffix
  let counter = 1;
  let newName = `${baseName} - ${counter}`;
  
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName} - ${counter}`;
  }
  
  return newName;
};

// Auto-save current draft
const autoSaveDraft = () => {
  if (!formData.buyerContact && orderItems.length === 1 && !orderItems[0].design) {
    return; // Don't save empty draft
  }

  const draftName = generateDraftName(formData.businessName, formData.buyerName);
  
  const draftData = {
    id: currentDraftId || Date.now(), // Use existing ID or create new
    name: draftName,
    formData,
    orderItems,
    gstEnabled,
    timestamp: Date.now()
  };

  let drafts = [...savedDrafts];
  
  // Check if we're editing an existing draft
  const existingIndex = drafts.findIndex(d => d.id === draftData.id);
  
  if (existingIndex >= 0) {
    // Update existing draft
    drafts[existingIndex] = draftData;
  } else {
    // Add new draft
    if (drafts.length >= 10) {
      // Remove oldest draft if limit reached
      drafts.sort((a, b) => a.timestamp - b.timestamp);
      drafts.shift();
    }
    drafts.push(draftData);
  }
  
  // Save to localStorage
  localStorage.setItem('wholesaleDrafts', JSON.stringify(drafts));
  setSavedDrafts(drafts);
  setCurrentDraftId(draftData.id);
};

// Load a specific draft
const loadDraft = (draft) => {
  setFormData(draft.formData);
  setOrderItems(draft.orderItems);
  setGstEnabled(draft.gstEnabled);
  setSearchMobile(draft.formData.buyerContact);
  setCurrentDraftId(draft.id); // Track which draft we're editing
  setShowDraftsListModal(false);
  setShowModal(true);
  toast.success(`Draft "${draft.name}" loaded!`);
};

// Delete a specific draft
const deleteDraft = (draftId) => {
  if (!window.confirm('Are you sure you want to delete this draft?')) {
    return;
  }
  
  const updatedDrafts = savedDrafts.filter(d => d.id !== draftId);
  localStorage.setItem('wholesaleDrafts', JSON.stringify(updatedDrafts));
  setSavedDrafts(updatedDrafts);
  toast.success('Draft deleted!');
};

// Delete current draft after successful order submission
const deleteCurrentDraft = () => {
  if (currentDraftId) {
    const updatedDrafts = savedDrafts.filter(d => d.id !== currentDraftId);
    localStorage.setItem('wholesaleDrafts', JSON.stringify(updatedDrafts));
    setSavedDrafts(updatedDrafts);
    setCurrentDraftId(null);
  }
};

// Clear all drafts
const clearAllDrafts = () => {
  if (!window.confirm('Are you sure you want to delete ALL drafts?')) {
    return;
  }
  localStorage.removeItem('wholesaleDrafts');
  setSavedDrafts([]);
  toast.success('All drafts cleared!');
};

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'border-l-4 border-green-500';
      case 'partial':
        return 'border-l-4 border-yellow-500';
      case 'pending':
        return 'border-l-4 border-red-500';
      default:
        return 'border-l-4 border-gray-300';
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FiCheckCircle className="mr-1" /> Paid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FiAlertTriangle className="mr-1" /> Partial Payment
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <FiAlertTriangle className="mr-1" /> Pending Payment
          </span>
        );
      default:
        return null;
    }
  };

  const toggleItemCollapse = (index) => {
    const newItems = [...orderItems];
    newItems[index].isCollapsed = !newItems[index].isCollapsed;
    setOrderItems(newItems);
  };

  const toggleColorExpand = (itemIndex, color) => {
    const key = `${itemIndex}-${color}`;
    setExpandedColors(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const duplicateItem = (index) => {
    const itemToDuplicate = orderItems[index];
    const newItem = {
      ...JSON.parse(JSON.stringify(itemToDuplicate)), // Deep copy
      design: '', // Reset design for user to select
      isCollapsed: false,
      isComplete: false
    };
    const newItems = [...orderItems];
    newItems.splice(index + 1, 0, newItem);
    setOrderItems(newItems);
    toast.success('Item duplicated! Select a design.');
  };

  const checkItemComplete = (item) => {
    if (!item.design || !item.pricePerUnit || item.selectedColors.length === 0) {
      return false;
    }

    for (const color of item.selectedColors) {
      const colorData = item.colorData[color];
      if (!colorData) return false;
      
      const quantities = colorData.mode === 'sets' 
        ? { total: colorData.sets }
        : Object.values(colorData.pieces);
      
      const hasQuantity = colorData.mode === 'sets' 
        ? colorData.sets > 0
        : Object.values(colorData.pieces).some(q => q > 0);
      
      if (!hasQuantity) return false;
    }

    return true;
  };

  const autoCollapseItem = (index) => {
    const item = orderItems[index];
    if (checkItemComplete(item)) {
      const newItems = [...orderItems];
      newItems[index].isCollapsed = true;
      newItems[index].isComplete = true;
      setOrderItems(newItems);
    }
  };

  const getStock = (design, color, size) => {
    const product = products.find(p => p.design === design);
    if (!product) return 0;
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) return 0;
    const sizeStock = colorVariant.sizes.find(s => s.size === size);
    return sizeStock ? sizeStock.currentStock : 0;
  };

  const getAvailableStock = (design, color, size) => {
    const product = products.find(p => p.design === design);
    if (!product) return 0;
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) return 0;
    const sizeStock = colorVariant.sizes.find(s => s.size === size);
    return sizeStock ? (sizeStock.currentStock - (sizeStock.lockedStock || 0)) : 0;
  };

  const getTotalAvailableForColor = (design, color) => {
    const product = products.find(p => p.design === design);
    if (!product) return 0;
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) return 0;
    return colorVariant.sizes.reduce((total, sizeStock) => {
      return total + (sizeStock.currentStock - (sizeStock.lockedStock || 0));
    }, 0);
  };

  const getStockStatus = (available, requested) => {
    if (requested === 0) return null;
    if (requested > available) {
      return { icon: '🔴', text: `Exceeds by ${requested - available}!`, color: 'text-red-600' };
    }
    if (available < requested * 1.2) { // Less than 20% buffer
      return { icon: '⚠️', text: 'Low Stock', color: 'text-yellow-600' };
    }
    return { icon: '✅', text: 'In Stock', color: 'text-green-600' };
  };

  const getFinalQuantities = (item) => {
    const result = [];
    item.selectedColors.forEach(color => {
      const colorData = item.colorData[color];
      if (!colorData) return;

      let quantities;
      if (colorData.mode === 'sets') {
        const setsCount = Number(colorData.sets) || 0;
        quantities = {};
        enabledSizes.forEach(size => {
          quantities[size] = setsCount;
        });
      } else {
        quantities = colorData.pieces;
      }

      result.push({ color, quantities });
    });
    return result;
  };

  const calculateTotal = () => {
    const flattenedItems = [];
    orderItems.forEach(item => {
      const colorQuantities = getFinalQuantities(item);
      colorQuantities.forEach(({ color, quantities }) => {
        Object.keys(quantities).forEach(size => {
          if (quantities[size] > 0) {
            flattenedItems.push({
              quantity: quantities[size],
              pricePerUnit: item.pricePerUnit
            });
          }
        });
      });
    });

    const subtotal = flattenedItems.reduce((sum, item) => 
      sum + (item.quantity * item.pricePerUnit), 0
    );

    let discountAmount = 0;
    if (formData.discountType === 'percentage') {
      discountAmount = (subtotal * formData.discountValue) / 100;
    } else if (formData.discountType === 'fixed') {
      discountAmount = formData.discountValue;
    }

    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  };

  const getTotalPiecesInItem = (item) => {
    let total = 0;
    const colorQuantities = getFinalQuantities(item);
    colorQuantities.forEach(({ quantities }) => {
      Object.values(quantities).forEach(qty => {
        total += qty || 0;
      });
    });
    return total;
  };

  const getItemSubtotal = (item) => {
    const totalPieces = getTotalPiecesInItem(item);
    return totalPieces * (item.pricePerUnit || 0);
  };

  // Data Fetching
  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchAllBuyers();
    fetchSettings();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await wholesaleService.getAllOrders();
      setOrders(data);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await inventoryService.getAllProducts();
      setProducts(Array.isArray(data) ? data : (data?.products || []));
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchAllBuyers = async () => {
    try {
      const buyers = await wholesaleService.getAllBuyers();
      setAllBuyers(buyers);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await settingsService.getSettings();
      setGstPercentage(response.gstPercentage || 5);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

    // Buyer Search and Selection
  const selectBuyer = (buyer) => {
    setBuyerFound(buyer);
    setFormData(prev => ({
      ...prev,
      buyerName: buyer.name,
      buyerContact: buyer.mobile,
      buyerEmail: buyer.email || '',
      buyerAddress: buyer.address || '',
      businessName: buyer.businessName || '',
      gstNumber: buyer.gstNumber || '',
    }));
    setSearchMobile(buyer.mobile);
    setShowBuyerListModal(false);

    const availableCredit = (buyer.creditLimit || 0) - (buyer.totalDue || 0);
    if (buyer.creditLimit > 0) {
      toast.success(`Buyer selected! Available Credit: ₹${availableCredit.toLocaleString('en-IN')}`);
    } else {
      toast.success('Buyer selected!');
    }
  };

  const debouncedSearchBuyer = useMemo(
    () => debounce(async (mobile) => {
      if (mobile.length !== 10) {
        setBuyerFound(null);
        return;
      }

      try {
        const buyer = await wholesaleService.getBuyerByMobile(mobile);
        setBuyerFound(buyer);
        setFormData(prev => ({
          ...prev,
          buyerName: buyer.name,
          buyerContact: buyer.mobile,
          buyerEmail: buyer.email || '',
          buyerAddress: buyer.address || '',
          businessName: buyer.businessName || '',
          gstNumber: buyer.gstNumber || '',
        }));
        toast.success('Buyer found!');
      } catch (error) {
        setBuyerFound(null);
        setFormData(prev => ({
          ...prev,
          buyerContact: mobile,
        }));
        toast('New buyer - fill in details');
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (searchMobile.length === 10 && !editingOrder) {
      debouncedSearchBuyer(searchMobile);
    }
  }, [searchMobile, debouncedSearchBuyer, editingOrder]);

  // Item Management Functions
  const handleAddItem = () => {
    // Auto-collapse previous item if complete
    if (orderItems.length > 0) {
      const lastIndex = orderItems.length - 1;
      autoCollapseItem(lastIndex);
    }

    setOrderItems([
      ...orderItems,
      { 
        design: '', 
        selectedColors: [], 
        pricePerUnit: 0, 
        colorData: {},
        isCollapsed: false,
        isComplete: false
      }
    ]);
  };

const handleBorrowConfirm = async () => {
  if (!pendingOrderData) return;
  
  try {
    console.log('User confirmed borrowing from reserved, creating order...');
    console.log('📦 Sending data:', pendingOrderData); // ✅ DEBUG
    
    await wholesaleService.createOrderWithReservedBorrow(pendingOrderData);
    
    toast.success('Order created successfully! Stock borrowed from Reserved Inventory.', { duration: 5000 });
    
    // Close modals
    setShowBorrowModal(false);
    setBorrowData(null);
    setPendingOrderData(null);
    setShowModal(false);
    setSubmitting(false);
    
    // Refresh data
    deleteCurrentDraft();
    resetForm();
    fetchOrders();
    fetchProducts();
    
  } catch (error) {
    console.error('Failed to create order with borrow:', error);
    console.error('❌ Full error response:', error.response?.data); // ✅ SHOW FULL ERROR
    toast.error(error.response?.data?.message || 'Failed to create order');
    setSubmitting(false);
  }
};

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push({ 
        design: '', 
        selectedColors: [], 
        pricePerUnit: 0, 
        colorData: {},
        isCollapsed: false,
        isComplete: false
      });
    }
    setOrderItems(newItems);
  };

  const handleItemDesignChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index] = {
      design: value,
      selectedColors: [],
      pricePerUnit: newItems[index].pricePerUnit || 0,
      colorData: {},
      isCollapsed: false,
      isComplete: false
    };
    setOrderItems(newItems);
  };

  const handleColorToggle = (index, color) => {
    const newItems = [...orderItems];
    const item = newItems[index];

    if (item.selectedColors.includes(color)) {
      item.selectedColors = item.selectedColors.filter(c => c !== color);
      delete item.colorData[color];
    } else {
      item.selectedColors.push(color);
      const pieces = {};
      enabledSizes.forEach(size => {
        pieces[size] = 0;
      });
      item.colorData[color] = {
        mode: 'sets',
        sets: 0,
        pieces: pieces
      };
    }
    setOrderItems(newItems);
  };

  const handlePriceChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index].pricePerUnit = Number(value) || 0;
    setOrderItems(newItems);
  };

  const handleModeChange = (index, color, mode) => {
    const newItems = [...orderItems];
    newItems[index].colorData[color].mode = mode;
    newItems[index].colorData[color].sets = 0;
    const pieces = {};
    enabledSizes.forEach(size => {
      pieces[size] = 0;
    });
    newItems[index].colorData[color].pieces = pieces;
    setOrderItems(newItems);
  };

  const handleSetsChange = (index, color, value) => {
    const newItems = [...orderItems];
    newItems[index].colorData[color].sets = Number(value) || 0;
    setOrderItems(newItems);
  };

  const handlePiecesChange = (index, color, size, value) => {
    const newItems = [...orderItems];
    newItems[index].colorData[color].pieces[size] = Number(value) || 0;
    setOrderItems(newItems);
  };

  // Filter Functions
  const handleQuickFilter = (filter) => {
    if (quickFilters.includes(filter)) {
      setQuickFilters(quickFilters.filter(f => f !== filter));
    } else {
      setQuickFilters([...quickFilters, filter]);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterPayment('all');
    setQuickFilters([]);
  };

  const filteredOrders = orders.filter(order => {
    // Quick filters
    if (quickFilters.includes('due') && order.amountDue <= 0) return false;
    if (quickFilters.includes('today')) {
      const today = new Date().toDateString();
      const orderDate = new Date(order.createdAt).toDateString();
      if (today !== orderDate) return false;
    }
    if (quickFilters.includes('pending') && order.paymentStatus !== 'pending') return false;
    if (quickFilters.includes('paid') && order.paymentStatus !== 'paid') return false;

    // Status filters
    if (filterStatus !== 'all' && order.orderStatus !== filterStatus) return false;
    if (filterPayment !== 'all' && order.paymentStatus !== filterPayment) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      if (query === 'due') {
        return order.amountDue > 0;
      }
      if (order.buyerName?.toLowerCase().includes(query)) return true;
      if (order.businessName?.toLowerCase().includes(query)) return true;
      if (order.buyerContact?.includes(query)) return true;
      if (order.challanNumber?.toLowerCase().includes(query)) return true;
      if (order.createdAt) {
        const orderDate = format(new Date(order.createdAt), 'yyyy-MM-dd');
        const orderDateFormatted = format(new Date(order.createdAt), 'dd/MM/yyyy');
        const orderDateDisplay = format(new Date(order.createdAt), 'MMM dd, yyyy');
        if (orderDate.includes(query) || orderDateFormatted.includes(query) || 
            orderDateDisplay.toLowerCase().includes(query)) {
          return true;
        }
      }
      return false;
    }

    return true;
  });

  // Loading State
  if (loading || sizesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wholesale Orders</h1>
            <p className="text-gray-500 mt-1">Manage your B2B orders</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wholesale Orders</h1>
          <p className="text-gray-500 mt-1">Manage your B2B orders</p>
        </div>
        <div className="flex gap-2">
          {/* Saved Drafts Button - Shows only if drafts exist */}
          {savedDrafts.length > 0 && (
            <button
              onClick={() => setShowDraftsListModal(true)}
              className="inline-flex items-center px-4 py-2 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              📋 Saved Drafts
              <span className="ml-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {savedDrafts.length}
              </span>
            </button>
          )}
          
          <button
            onClick={() => {
              setShowModal(true);
              setEditingOrder(null);
              setCurrentDraftId(null); // Start fresh draft
              resetForm();
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FiPlus className="mr-2" />
            Create Order
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by buyer, contact, challan, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 font-medium">Quick Filters:</span>
            <button
              onClick={() => handleQuickFilter('due')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                quickFilters.includes('due')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔴 Due Only
            </button>
            <button
              onClick={() => handleQuickFilter('today')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                quickFilters.includes('today')
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Today
            </button>
            <button
              onClick={() => handleQuickFilter('pending')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                quickFilters.includes('pending')
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⏳ Pending
            </button>
            <button
              onClick={() => handleQuickFilter('paid')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                quickFilters.includes('paid')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✅ Paid
            </button>
          </div>

          {/* Advanced Filters */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {(searchQuery || quickFilters.length > 0 || filterPayment !== 'all') && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-sm text-gray-600">Active:</span>
              {quickFilters.map(filter => (
                <span
                  key={filter}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  {filter}
                  <button
                    onClick={() => handleQuickFilter(filter)}
                    className="ml-1 hover:text-indigo-600"
                  >
                    ⓧ
                  </button>
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FiShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || quickFilters.length > 0
                ? `No orders match your search "${searchQuery}"`
                : 'Create your first wholesale order to get started'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order._id}
              className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow ${getPaymentStatusColor(order.paymentStatus)}`}
            >
              <div className="p-6">
                {/* Challan Number */}
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-indigo-100 text-indigo-800">
                    📋 {order.challanNumber}
                  </span>
                </div>

                {/* Buyer Info */}
                <div className="mb-4">
                  <div className="flex items-center text-gray-900 font-semibold mb-1">
                    <span className="mr-2">👤</span>
                    {order.buyerName}
                    <span className="mx-2 text-gray-400">|</span>
                    <span className="text-gray-600 font-normal">📱 {order.buyerContact}</span>
                  </div>
                  {order.businessName && (
                    <div className="text-sm text-gray-600 ml-6">{order.businessName}</div>
                  )}
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                {/* Date & Fulfillment */}
                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <span className="mr-2">📅</span>
                  {format(new Date(order.createdAt), 'MMM dd, yyyy')}
                  <span className="mr-2 ml-4">•</span>
                  <span className="mr-2 ml-2">{order.fulfillmentType === 'factory_direct' ? '🏭' : '📦'}</span>
                  {order.fulfillmentType === 'factory_direct' ? 'Factory Direct' : 'Warehouse'}
                  <span className="ml-6 mr-6"> • </span>
                  <span className='font-bold mr-1 text-[15px]'>{order.items?.reduce((sum, item) =>sum + (item.quantity || 0), 0) || 0}</span>
                  <span className='text-xs'>Total Pieces</span>
                </div>

                {/* Amount Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                    <div className="font-semibold text-gray-900">
                      ₹{order.totalAmount?.toLocaleString('en-IN')}
                    </div>
                    {order.gstEnabled && order.gstAmount > 0 && (
                      <div className="text-xs text-gray-500">GST ₹{order.gstAmount?.toFixed(2)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Paid Amount</div>
                    <div className="font-semibold text-green-600">
                      ₹{order.amountPaid?.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Due Amount</div>
                    <div className={`font-semibold ${order.amountDue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      ₹{order.amountDue?.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Payment Status Badge */}
                <div className="mb-4">
                  {getPaymentStatusBadge(order.paymentStatus)}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setViewingOrder(order)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <FiEye className="mr-1" /> View
                    </button>
                    <button
                      onClick={() => handleEditOrder(order)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <FiEdit2 className="mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setPaymentOrder(order);
                        setShowPaymentModal(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      💳 Payment
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleDownloadChallan(order)}
                      className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      <FiDownload className="mr-1" /> PDF
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(order)}
                      className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      <FiMessageCircle className="mr-1" /> WhatsApp
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(order._id)}
                        className="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs text-red-600 hover:text-red-800"
                      >
                        <FiTrash2 className="mr-1" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Draft Auto-Save Indicator */}
{!editingOrder && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          💾
        </div>
        <div className="ml-3">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Auto-save enabled</span> - Your draft is being saved every 30 seconds
          </p>
        </div>
      </div>
      {savedDrafts && (
        <button
          type="button"
          onClick={() => {
            if (currentDraftId) {
              deleteDraft(currentDraftId);
              setShowModal(false);
              resetForm();
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear Draft
        </button>
      )}
    </div>
  </div>
)}

      {/* Saved Drafts List Modal */}
      <Modal
        isOpen={showDraftsListModal}
        onClose={() => setShowDraftsListModal(false)}
        title="📋 Saved Drafts"
      >
        <div className="space-y-4">
          {savedDrafts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No saved drafts</p>
              <p className="text-sm mt-2">Drafts will auto-save every 30 seconds while creating orders</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {savedDrafts.length} of 10 drafts saved • Auto-saves every 30 seconds
                </p>
                <button
                  onClick={clearAllDrafts}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Clear All Drafts
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {savedDrafts
                  .sort((a, b) => b.timestamp - a.timestamp) // Newest first
                  .map((draft) => {
                    const totalPieces = draft.orderItems.reduce((total, item) => {
                      let itemTotal = 0;
                      item.selectedColors?.forEach(color => {
                        const colorData = item.colorData[color];
                        if (colorData?.mode === 'sets') {
                          itemTotal += (colorData.sets || 0) * 5; // Assuming 5 sizes
                        } else if (colorData?.pieces) {
                          itemTotal += Object.values(colorData.pieces).reduce((sum, qty) => sum + (qty || 0), 0);
                        }
                      });
                      return total + itemTotal;
                    }, 0);

                    const designNames = [...new Set(
                                          draft.orderItems
                                            .filter(item => item.design)
                                            .map(item => item.design)
                                        )];

                    // Calculate total amount
                    let totalAmount = 0;
                    draft.orderItems.forEach(item => {
                      if (item.design && item.pricePerUnit) {
                        let itemPieces = 0;
                        item.selectedColors?.forEach(color => {
                          const colorData = item.colorData[color];
                          if (colorData?.mode === 'sets') {
                            itemPieces += (colorData.sets || 0) * 5;
                          } else if (colorData?.pieces) {
                            itemPieces += Object.values(colorData.pieces).reduce((sum, qty) => sum + (qty || 0), 0);
                          }
                        });
                        totalAmount += itemPieces * item.pricePerUnit;
                      }
                    });

                    const timeAgo = Math.round((Date.now() - draft.timestamp) / 60000);
                    const timeText = timeAgo < 60 
                      ? `${timeAgo} minute${timeAgo !== 1 ? 's' : ''} ago`
                      : timeAgo < 1440
                      ? `${Math.round(timeAgo / 60)} hour${Math.round(timeAgo / 60) !== 1 ? 's' : ''} ago`
                      : `${Math.round(timeAgo / 1440)} day${Math.round(timeAgo / 1440) !== 1 ? 's' : ''} ago`;

                    return (
                      <div
                        key={draft.id}
                        className="border-2 border-indigo-200 rounded-lg p-4 hover:border-indigo-400 transition-colors bg-gradient-to-r from-indigo-50 to-purple-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                              {draft.name}
                            </h3>
                            
                            <div className="space-y-1 text-sm text-gray-600 mb-3">
                              {draft.formData.buyerName && (
                                <div className="flex items-center">
                                  <span className="mr-2">👤</span>
                                  <span>{draft.formData.buyerName}</span>
                                </div>
                              )}
                              {draft.formData.buyerContact && (
                                <div className="flex items-center">
                                  <span className="mr-2">📱</span>
                                  <span>{draft.formData.buyerContact}</span>
                                </div>
                              )}
                              <div className="flex items-center text-xs text-gray-500">
                                <span className="mr-2">🕐</span>
                                <span>Saved: {timeText}</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => loadDraft(draft)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                              >
                                📂 Load Draft
                              </button>
                              <button
                                onClick={() => deleteDraft(draft.id)}
                                className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-700 font-medium">
                                  {designNames.join(', ')}
                                </span>
                                <span>• {totalPieces} pieces</span>
                                {totalAmount > 0 && (
                                  <span>• 💰 ₹{totalAmount.toLocaleString('en-IN')}</span>
                                )}
                              </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Create/Edit Order Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingOrder ? '✏️ Edit Wholesale Order' : '📋 Create Wholesale Order'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sticky Order Summary */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-indigo-900 mb-2">💰 ORDER SUMMARY</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 text-sm">
              <div>
                <span className="text-gray-600 text-xs">Subtotal:</span>
                <span className="ml-2 font-semibold text-gray-900">₹{calculateTotal().subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Discount:</span>
                <span className="ml-2 font-semibold text-red-600">-₹{calculateTotal().discountAmount.toLocaleString('en-IN')}</span>
              </div>            
              <div>
                <span className="text-gray-600 text-xs">TOTAL:</span>
                <span className="ml-2 font-bold text-indigo-600">
                  ₹{(gstEnabled 
                    ? calculateTotal().total * (1 + gstPercentage / 100) 
                    : calculateTotal().total
                  ).toLocaleString('en-IN')}
                </span>                
                <p className="text-gray-600 text-xs">GST : <span className='text-yellow-700'>₹{gstEnabled ? ((calculateTotal().total * gstPercentage) / 100).toFixed(0) : 0}</span></p>
              </div>
              <div>
                <span className="text-gray-600 text-xs">Qty:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {orderItems.reduce((total, item) => total + getTotalPiecesInItem(item), 0)} pcs
                </span>
              </div>
            </div>
          </div>

          {/* Buyer Details Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">👤</span> Buyer Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mobile Number Search */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    placeholder="Enter 10-digit mobile"
                    maxLength={10}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowBuyerListModal(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    📋 Browse Buyers
                  </button>
                </div>
                {buyerFound && (
                  <div className="mt-2 text-sm text-green-600 flex items-center">
                    <FiCheckCircle className="mr-1" />
                    Buyer found! 
                    {buyerFound.creditLimit > 0 && (
                      <span className="ml-2">
                        Available Credit: ₹{((buyerFound.creditLimit || 0) - (buyerFound.totalDue || 0)).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.buyerName}
                  onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.buyerEmail}
                  onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.buyerAddress}
                  onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fulfillment Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="warehouse"
                      checked={formData.fulfillmentType === 'warehouse'}
                      onChange={(e) => setFormData({ ...formData, fulfillmentType: e.target.value })}
                      className="mr-2"
                    />
                    📦 Warehouse
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="factory_direct"
                      checked={formData.fulfillmentType === 'factory_direct'}
                      onChange={(e) => setFormData({ ...formData, fulfillmentType: e.target.value })}
                      className="mr-2"
                    />
                    🏭 Factory Direct
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">📦</span> Order Items
              </h3>
              <span className="text-sm text-gray-500">Ctrl+Shift+A to add new item</span>
            </div>

            <div className="space-y-4">
              {orderItems.map((item, index) => (
                <div key={index}>
                  {/* COLLAPSED VIEW */}
                  {item.isCollapsed ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Header */}
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{index + 1}️⃣</span>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                Item {index + 1} - {item.design}
                              </h4>
                              <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                                <span>💰 ₹{item.pricePerUnit}/pc</span>
                                <span>🎨 {item.selectedColors.length} Colors</span>
                                <span>📦 {getTotalPiecesInItem(item)} pcs</span>
                                <span className="font-semibold text-indigo-600">
                                  Subtotal: ₹{getItemSubtotal(item).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Colors & Sizes - Compact Grid (2 per row) */}
                          {item.selectedColors.length > 0 && (
                            <div className="ml-8 space-y-2">
                              {/* Process colors in pairs */}
                              {(() => {
                                const colorPairs = [];
                                for (let i = 0; i < item.selectedColors.length; i += 2) {
                                  colorPairs.push(item.selectedColors.slice(i, i + 2));
                                }
                                
                                return colorPairs.map((colorPair, pairIndex) => (
                                  <div key={pairIndex} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {colorPair.map((color) => {
                                      const colorData = item.colorData[color];
                                      
                                      // Calculate quantities per size
                                      const sizeBreakdown = enabledSizes.map(size => {
                                        const qty = colorData.mode === 'sets' 
                                          ? colorData.sets 
                                          : (colorData.pieces?.[size] || 0);
                                        return { size, qty };
                                      }).filter(item => item.qty > 0);
                                      
                                      const colorTotal = sizeBreakdown.reduce((sum, item) => sum + item.qty, 0);
                                      
                                      return (
                                        <div 
                                          key={color}
                                          className="flex items-center gap-2 bg-white rounded px-3 py-2 border border-gray-200"
                                        >
                                          {/* Color code only */}
                                          <div 
                                            className="w-5 h-5 rounded-full border-2 border-gray-400 flex-shrink-0"
                                            style={{ backgroundColor: getColorCode(color) }}  // ✅ ADD THIS!
                                            title={color}
                                          />                                        
                                          {/* Size breakdown in one line */}
                                          <div className="flex-1 text-xs text-gray-700 font-mono">
                                            {sizeBreakdown.map((item, idx) => (
                                              <span key={item.size}>
                                                <span className="font-semibold">{item.size}</span>
                                                <span className="text-gray-500">:</span>
                                                <span className="text-indigo-600">{item.qty}</span>
                                                {idx < sizeBreakdown.length - 1 && (
                                                  <span className="text-gray-400 mx-1">•</span>
                                                )}
                                              </span>
                                            ))}
                                            <span className="text-gray-500 mx-1">=</span>
                                            <span className="font-bold text-gray-900">{colorTotal}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => toggleItemCollapse(index)}
                          className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <FiEdit2 className="inline mr-1" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateItem(index)}
                          className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <FiCopy className="inline mr-1" />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="px-3 py-1 bg-white border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // EXPANDED EDIT VIEW
                    <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Item #{index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FiTrash2 /> Remove
                        </button>
                      </div>

                      {/* Design Selection */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Design *</label>
                        <select
                          value={item.design}
                          onChange={(e) => {
                            handleItemDesignChange(index, e.target.value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        >
                          <option value="">Select Design</option>
                          {products.map(product => (
                            <option key={product._id} value={product.design}>
                              {product.design}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Per Unit *</label>
                        <input
                          type="number"
                          value={item.pricePerUnit || ''}
                          onChange={(e) => handlePriceChange(index, e.target.value)}
                          placeholder="₹ 0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        />
                      </div>

                      {/* Color Selection */}
                      {item.design && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Colors
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {getColorsForDesign(item.design).map((colorObj) => (
                              <button
                                key={colorObj.colorName}
                                type="button"
                                onClick={() => handleColorToggle(index, colorObj.colorName)}
                                className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                                  item.selectedColors.includes(colorObj.colorName)
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded-full border-2 border-gray-400"
                                    style={{ backgroundColor: colorObj.colorCode }}
                                  />
                                  {colorObj.colorName}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                          {/* Color-wise Quantity Entry */}
                          {item.selectedColors.map(color => {
                            const colorData = item.colorData[color];
                            const availableStock = getTotalAvailableForColor(item.design, color);

                            return (
                              <div key={color} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full border-2 border-gray-400 ${getColorCode(color)}`}></div>
                                    <h5 className="font-semibold text-gray-900">{color}</h5>
                                    <span className="text-sm text-gray-600">(Available: {availableStock} pcs)</span>
                                  </div>
                                </div>

                                {/* Mode Selection */}
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Mode:</label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center">
                                      <input
                                        type="radio"
                                        checked={colorData.mode === 'sets'}
                                        onChange={() => handleModeChange(index, color, 'sets')}
                                        className="mr-2"
                                      />
                                      Sets
                                    </label>
                                    <label className="flex items-center">
                                      <input
                                        type="radio"
                                        checked={colorData.mode === 'pieces'}
                                        onChange={() => handleModeChange(index, color, 'pieces')}
                                        className="mr-2"
                                      />
                                      Individual Pieces
                                    </label>
                                  </div>
                                </div>

                                {/* Sets Mode */}
                                {colorData.mode === 'sets' && (
                                  <div className="mb-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Sets:</label>
                                    <input
                                      type="number"
                                      value={colorData.sets || ''}
                                      onChange={(e) => handleSetsChange(index, color, e.target.value)}
                                      placeholder="0"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    {colorData.sets > 0 && (
                                      <div className="mt-2 text-sm text-gray-600">
                                        Auto-filled: {enabledSizes.map(size => `${size}:${colorData.sets}`).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Pieces Mode */}
                                {colorData.mode === 'pieces' && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {enabledSizes.map(size => {
                                      const available = getAvailableStock(item.design, color, size);
                                      const requested = colorData.pieces[size] || 0;
                                      const status = getStockStatus(available, requested);

                                      return (
                                        <div key={size}>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Size {size}
                                          </label>
                                          <input
                                            type="number"
                                            value={colorData.pieces[size] || ''}
                                            onChange={(e) => handlePiecesChange(index, color, size, e.target.value)}
                                            placeholder="0"
                                            className={`w-full px-2 py-1 text-sm border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                                              status?.icon === '🔴' ? 'border-red-500 bg-red-50' : 
                                              status?.icon === '⚠️' ? 'border-yellow-500 bg-yellow-50' : 
                                              'border-gray-300'
                                            }`}
                                          />
                                          <div className="text-xs text-gray-500 mt-1">Stock: {available}</div>
                                          {status && (
                                            <div className={`text-xs ${status.color} mt-1 font-medium`}>
                                              {status.icon} {status.text}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                      {/* Auto-collapse when moving to next */}
                      {item.design && item.pricePerUnit && item.selectedColors.length > 0 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-green-800">
                              ✅ Item complete! Click "Add Another Design" or edit other items.
                            </span>
                            <button
                              type="button"
                              onClick={() => autoCollapseItem(index)}
                              className="text-sm text-green-700 font-medium hover:text-green-900"
                            >
                              Collapse →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Item Button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-600 font-medium transition-colors"
            >
              <FiPlus className="inline mr-2" />
              Add Another Design (Ctrl + Shift + A)
            </button>
          </div>

                        {/* Pricing Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">💰</span> Pricing
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.discountType === 'none'}
                      onChange={() => setFormData({ ...formData, discountType: 'none', discountValue: 0 })}
                      className="mr-2"
                    />
                    None
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.discountType === 'percentage'}
                      onChange={() => setFormData({ ...formData, discountType: 'percentage' })}
                      className="mr-2"
                    />
                    Percentage
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.discountType === 'fixed'}
                      onChange={() => setFormData({ ...formData, discountType: 'fixed' })}
                      className="mr-2"
                    />
                    Fixed
                  </label>
                </div>
                {formData.discountType !== 'none' && (
                  <input
                    type="number"
                    value={formData.discountValue || ''}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    placeholder={formData.discountType === 'percentage' ? 'Enter %' : 'Enter ₹'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* GST */}
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={gstEnabled}
                    onChange={(e) => setGstEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable GST ({gstPercentage}%)</span>
                </label>
                {gstEnabled && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    <div>CGST ({gstPercentage / 2}%): ₹{((calculateTotal().total * gstPercentage) / 200).toFixed(2)}</div>
                    <div>SGST ({gstPercentage / 2}%): ₹{((calculateTotal().total * gstPercentage) / 200).toFixed(2)}</div>
                    <div className="font-semibold mt-1">Total GST: ₹{((calculateTotal().total * gstPercentage) / 100).toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📝</span> Notes
            </h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Add any special instructions or notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Auto-save indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-blue-600">💾</span>
              <span className="text-sm font-medium text-blue-900">
                Auto-saving to: <strong>{generateDraftName(formData.businessName, formData.buyerName)}</strong>
              </span>
              <span className="text-xs text-blue-600">(every 30 seconds)</span>
            </div>
            {savedDrafts.length > 0 && (
              <div className="text-xs text-blue-600 mt-1">
                {savedDrafts.length} of 10 drafts saved
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 sticky bottom-0 bg-white p-4 border-t-2 border-gray-200 -mx-6 -mb-6">
            <button
              type="button"
              onClick={() => {
                autoSaveDraft();
                toast.success('Draft saved!');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              💾 Save Draft (Ctrl + S)
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Processing...' : (editingOrder ? '✅ Update Order' : '✅ Create Order')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Order Modal */}
      <Modal
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        title={`📋 Order ${viewingOrder?.challanNumber || ''}`}
      >
        {viewingOrder && (
          <div className="space-y-6">
            {/* Order Summary Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">📊 ORDER SUMMARY</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 mb-1">📅 Date</div>
                  <div className="font-semibold text-gray-900">
                    {format(new Date(viewingOrder.createdAt), 'MMM dd, yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">📦 Total Pieces</div>
                  <div className="font-semibold text-gray-900">
                    {viewingOrder.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} pcs
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">💳 Payment Status</div>
                  <div>{getPaymentStatusBadge(viewingOrder.paymentStatus)}</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">🏭 Fulfillment</div>
                  <div className="font-semibold text-gray-900">
                    {viewingOrder.fulfillmentType === 'factory_direct' ? '🏭 Factory Direct' : '📦 Warehouse'}
                  </div>
                </div>
              </div>
            </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ORDER ITEMS - NEW COMPACT DESIGN */}
      {/* ═══════════════════════════════════════════ */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📦</span> 
          Order Items 
          <span className="ml-3 text-sm font-normal text-gray-600">
            ({(() => {
              // Count unique designs
              const uniqueDesigns = {};
              viewingOrder.items?.forEach(item => {
                const key = `${item.design}-${item.pricePerUnit}`;
                uniqueDesigns[key] = true;
              });
              return Object.keys(uniqueDesigns).length;
            })()} designs • {viewingOrder.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} pieces)
          </span>
        </h3>

        <div className="space-y-4">
          {(() => {
            // Group items by design and price
            const groupedItems = {};
            viewingOrder.items?.forEach(item => {
              const key = `${item.design}-${item.pricePerUnit}`;
              if (!groupedItems[key]) {
                groupedItems[key] = {
                  design: item.design,
                  pricePerUnit: item.pricePerUnit,
                  colors: {}
                };
              }
              if (!groupedItems[key].colors[item.color]) {
                groupedItems[key].colors[item.color] = {};
              }
              groupedItems[key].colors[item.color][item.size] = item.quantity;
            });

            return Object.values(groupedItems).map((group, idx) => {
              const totalPcs = Object.values(group.colors).reduce((sum, sizes) => 
                sum + Object.values(sizes).reduce((s, q) => s + q, 0), 0
              );
              const subtotal = totalPcs * group.pricePerUnit;
              const colorCount = Object.keys(group.colors).length;

              return (
                <div key={idx} className="border-2 border-indigo-200 rounded-lg overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50">
                  {/* Header */}
                  <div className="bg-indigo-100 px-4 py-3 border-b-2 border-indigo-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <span className="text-lg">{idx + 1}️⃣</span>
                        <span className="font-bold">{group.design}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-indigo-600">₹{group.pricePerUnit}/pc</span>
                        <span className="text-gray-600">•</span>
                        <span>{colorCount} color{colorCount !== 1 ? 's' : ''}</span>
                        <span className="text-gray-600">•</span>
                        <span>{totalPcs} pcs</span>
                      </div>
                      <div className="text-sm font-bold text-indigo-600">
                        Subtotal: ₹{subtotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Colors & Sizes - Inline Display */}
                  <div className="p-4 space-y-2">
                    {Object.entries(group.colors).map(([color, sizes]) => {
                      // Build size breakdown string
                      const sizeBreakdown = Object.entries(sizes)
                        .filter(([size, qty]) => qty > 0)
                        .map(([size, qty]) => `${size}:${qty}`)
                        .join(' • ');
                      
                      const colorTotal = Object.values(sizes).reduce((sum, qty) => sum + qty, 0);

                      return (
                        <div 
                          key={color}
                          className="flex items-center gap-3 bg-white rounded-md px-4 py-2 border border-gray-200"
                        >
                          {/* Color code only */}
                          <div 
                            className="w-5 h-5 rounded-full border-2 border-gray-400 flex-shrink-0"
                            style={{ backgroundColor: getColorCode(color) }}  // ✅ ADD THIS!
                            title={color}
                          />
                          {/* Size breakdown */}
                          <div className="flex-1 text-sm font-mono text-gray-700">
                            {sizeBreakdown} <span className="text-gray-500 mx-2">=</span> <span className="font-bold text-gray-900">{colorTotal} pcs</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

            {/* Financial Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">💰</span> Financial Breakdown
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">₹{viewingOrder.subtotalAmount?.toLocaleString('en-IN')}</span>
                </div>
                
                {viewingOrder.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between text-red-600">
                      <span>Discount ({viewingOrder.discountType === 'percentage' ? `${viewingOrder.discountValue}%` : 'Fixed'})</span>
                      <span className="font-semibold">-₹{viewingOrder.discountAmount?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-t border-gray-300 pt-2"></div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">After Discount</span>
                      <span className="font-semibold text-gray-900">
                        ₹{(viewingOrder.subtotalAmount - viewingOrder.discountAmount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}

                {viewingOrder.gstEnabled && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>CGST ({gstPercentage / 2}%)</span>
                      <span>+₹{viewingOrder.cgst?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST ({gstPercentage / 2}%)</span>
                      <span>+₹{viewingOrder.sgst?.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="border-t-2 border-gray-400 pt-2"></div>
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-gray-900">TOTAL AMOUNT</span>
                  <span className="font-bold text-indigo-600">₹{viewingOrder.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
                
                <div className="flex justify-between text-green-600">
                  <span className="font-medium">Amount Paid</span>
                  <span className="font-semibold">-₹{viewingOrder.amountPaid?.toLocaleString('en-IN')}</span>
                </div>

                <div className="border-t-2 border-gray-900 pt-2"></div>
                <div className="flex justify-between text-lg">
                  <span className="font-bold text-gray-900">AMOUNT DUE</span>
                  <span className={`font-bold ${viewingOrder.amountDue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    ₹{viewingOrder.amountDue?.toLocaleString('en-IN')}
                    {viewingOrder.amountDue > 0 && ' 🔴'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {viewingOrder.paymentHistory && viewingOrder.paymentHistory.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">💳</span> Payment History ({viewingOrder.paymentHistory.length} payments)
                </h3>

                <div className="space-y-4">
                  {viewingOrder.paymentHistory.map((payment, idx) => (
                    <div key={idx} className="relative pl-6">
                      {idx < viewingOrder.paymentHistory.length - 1 && (
                        <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-300"></div>
                      )}
                      <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-indigo-500"></div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {payment.paymentMethod === 'Cash' ? '💵' :
                               payment.paymentMethod === 'UPI' ? '📱' :
                               payment.paymentMethod === 'Cheque' ? '💳' : '💰'}
                            </span>
                            <div>
                              <div className="font-semibold text-gray-900">₹{payment.amount?.toLocaleString('en-IN')}</div>
                              <div className="text-sm text-gray-600">{payment.paymentMethod}</div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.paymentDate && format(new Date(payment.paymentDate), 'MMM dd, yyyy, hh:mm a')}
                          </div>
                        </div>
                        {payment.notes && (
                          <div className="text-sm text-gray-600 mt-2 pl-11">"{payment.notes}"</div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="border-t-2 border-gray-300 pt-3 mt-4">
                    <div className="flex justify-between items-center font-semibold text-gray-900">
                      <span>Total Paid:</span>
                      <span className="text-lg text-green-600">₹{viewingOrder.amountPaid?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingOrder.notes && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">📝</span> Notes
                </h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-gray-700">
                  {viewingOrder.notes}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 sticky bottom-0 bg-white p-4 border-t-2 border-gray-200 -mx-6 -mb-6">
              <button
                onClick={() => handleDownloadChallan(viewingOrder)}
                className="flex-1 min-w-[150px] px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiDownload className="inline mr-2" />
                Download Invoice
              </button>
              <button
                onClick={() => handleSendWhatsApp(viewingOrder)}
                className="flex-1 min-w-[150px] px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiMessageCircle className="inline mr-2" />
                WhatsApp
              </button>
              <button
                onClick={() => {
                  setViewingOrder(null);
                  handleEditOrder(viewingOrder);
                }}
                className="flex-1 min-w-[150px] px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                <FiEdit2 className="inline mr-2" />
                Edit Order
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Use Locked Stock Modal */}
      {showUseLockModal && useLockData && (
        <Modal
          isOpen={showUseLockModal}
          onClose={() => setShowUseLockModal(false)}
          title="⚠️ Insufficient Stock - Use Locked Stock?"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Some items exceed available stock, but locked stock is available to fulfill this order.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">📦 Items Requiring Locked Stock</h4>
              <div className="space-y-2">
                {useLockData.insufficientItems?.map((item, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    • {item.design} / {item.color} / Size {item.size}
                    <span className="ml-2 font-semibold text-red-600">
                      Needs: {item.neededFromLock} pcs from lock
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">📊 Lock Status</h4>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Total Needed from Lock:</span>
                  <span className="font-semibold">{useLockData.totalNeededFromLock} pcs</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ Using locked stock will reduce your safety buffer. Continue?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUseLockModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ❌ Cancel
              </button>
              <button
                onClick={handleConfirmUseLock}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700"
              >
                ✅ Use Locked Stock & Create Order
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ✅ NEW: Borrow from Reserved Modal */}
      {showBorrowModal && borrowData && (
        <BorrowFromReservedModal
          isOpen={showBorrowModal}
          onClose={() => {
            setShowBorrowModal(false);
            setBorrowData(null);
            setPendingOrderData(null);
            setSubmitting(false);
          }}
          onConfirm={handleBorrowConfirm}
          insufficientItems={borrowData.insufficientItems}
          orderType="order"
        />
      )}

      {/* Buyer List Modal */}
      <Modal
        isOpen={showBuyerListModal}
        onClose={() => setShowBuyerListModal(false)}
        title="📋 Select Buyer"
        size="large"
      >
        <div className="space-y-3">
          {allBuyers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No buyers found</p>
              <p className="text-sm mt-2">Buyers will appear here after creating orders</p>
            </div>
          ) : (
            allBuyers.map(buyer => (
              <button
                key={buyer.mobile}
                onClick={() => selectBuyer(buyer)}
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-semibold text-gray-900">{buyer.name}</div>
                {buyer.businessName && (
                  <div className="text-sm text-gray-600">{buyer.businessName}</div>
                )}
                <div className="text-sm text-gray-500 mt-1">📱 {buyer.mobile}</div>
                {buyer.creditLimit > 0 && (
                  <div className="text-sm text-indigo-600 mt-1">
                    Credit: ₹{((buyer.creditLimit || 0) - (buyer.totalDue || 0)).toLocaleString('en-IN')} available
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentOrder(null);
            setPaymentAmount('');
            setPaymentMethod('Cash');
            setPaymentNotes('');
          }}
          title="💳 Record Payment"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Challan: #{paymentOrder.challanNumber}</div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <div className="text-xs text-gray-500">Total Amount</div>
                  <div className="font-semibold text-gray-900">₹{paymentOrder.totalAmount?.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Amount Due</div>
                  <div className="font-semibold text-red-600">₹{paymentOrder.amountDue?.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
                placeholder="Add payment reference or notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentOrder(null);
                  setPaymentAmount('');
                  setPaymentMethod('Cash');
                  setPaymentNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                Record Payment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  // Handler Functions
  function handleEditOrder(order) {
    setEditingOrder(order);
    setFormData({
      buyerName: order.buyerName,
      buyerContact: order.buyerContact,
      buyerEmail: order.buyerEmail || '',
      buyerAddress: order.buyerAddress || '',
      businessName: order.businessName || '',
      gstNumber: order.gstNumber || '',
      deliveryDate: order.deliveryDate ? order.deliveryDate.split('T')[0] : '',
      notes: order.notes || '',
      discountType: order.discountType || 'none',
      discountValue: order.discountValue || 0,
      gstEnabled: order.gstEnabled || false,
      fulfillmentType: order.fulfillmentType || 'warehouse'
    });

    const groupedItems = {};
    order.items.forEach(item => {
      const key = `${item.design}-${item.pricePerUnit}`;
      if (!groupedItems[key]) {
        groupedItems[key] = {
          design: item.design,
          selectedColors: [],
          pricePerUnit: item.pricePerUnit,
          colorData: {},
          isCollapsed: false,
          isComplete: false
        };
      }
      if (!groupedItems[key].selectedColors.includes(item.color)) {
        groupedItems[key].selectedColors.push(item.color);
        groupedItems[key].colorData[item.color] = {
          mode: 'pieces',
          sets: 0,
          pieces: {}
        };
        enabledSizes.forEach(size => {
          groupedItems[key].colorData[item.color].pieces[size] = 0;
        });
      }
      groupedItems[key].colorData[item.color].pieces[item.size] = item.quantity;
    });

    setOrderItems(Object.values(groupedItems));
    setSearchMobile(order.buyerContact);
    setBuyerFound(null);
    setShowModal(true);
    toast('Editing order - modify and save', { icon: '✏️' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validation
      const flattenedItems = [];
      orderItems.forEach((item) => {
        if (!item.design) return;
        
        const colorQuantities = getFinalQuantities(item);
        colorQuantities.forEach(({ color, quantities }) => {
          Object.keys(quantities).forEach((size) => {
            if (quantities[size] > 0 && enabledSizes.includes(size)) {
              flattenedItems.push({
                design: item.design,
                color: color,
                size: size,
                quantity: quantities[size],
                pricePerUnit: item.pricePerUnit,
              });
            }
          });
        });
      });

      if (flattenedItems.length === 0) {
        toast.error('Please add at least one item with quantity');
        setSubmitting(false);
        return;
      }

      // Calculate totals
      const totals = calculateTotal();

      const orderData = {
        buyerName: formData.buyerName,
        buyerContact: formData.buyerContact,
        buyerEmail: formData.buyerEmail,
        buyerAddress: formData.buyerAddress,
        businessName: formData.businessName,
        gstNumber: formData.gstNumber,
        deliveryDate: formData.deliveryDate,
        items: flattenedItems,
        subtotalAmount: totals.subtotal,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        discountAmount: totals.discountAmount,
        gstEnabled: gstEnabled,
        gstAmount: gstEnabled ? (totals.total * gstPercentage) / 100 : 0,
        totalAmount: gstEnabled ? totals.total * (1 + gstPercentage / 100) : totals.total,
        notes: formData.notes,
        fulfillmentType: formData.fulfillmentType,
      };

      if (editingOrder) {
        await wholesaleService.updateOrder(editingOrder._id, orderData);
        toast.success('Order updated successfully');
        deleteCurrentDraft();
        setShowModal(false);
        resetForm();
        fetchOrders();
      } else {
        // ✅ NEW: Create new order with borrow check
        try {
          await wholesaleService.createOrder(orderData);
          toast.success('Order created successfully');
          deleteCurrentDraft();
          setShowModal(false);
          resetForm();
          fetchOrders();
        } catch (createError) {
          // ✅ Handle borrow from reserved error
          if (createError.response?.data?.code === 'MAIN_INSUFFICIENT_BORROW_RESERVED') {
            console.log('Main insufficient, showing borrow modal:', createError.response.data);
            setBorrowData({
              insufficientItems: createError.response.data.insufficientItems,
              totalNeededFromReserved: createError.response.data.totalNeededFromReserved
            });
            setPendingOrderData({
              ...orderData,
              borrowFromReserved: true  // ✅ Add flag here
            });
            setShowBorrowModal(true);
            setSubmitting(false);
            return; // Don't throw error
          }
          throw createError; // Re-throw other errors
        }
      }

      setSubmitting(false);

    } catch (error) {
      console.error('Order submission error:', error);
      const errorData = error.response?.data;
      const errorCode = errorData?.code;

      // Handle specific error codes
      if (errorCode === 'INSUFFICIENT_AVAILABLE_STOCK' && errorData?.canUseLockedStock) {
        setUseLockData({
          insufficientItems: errorData.insufficientItems || [],
          totalNeededFromLock: errorData.totalNeededFromLock || 0,
          currentLockValue: errorData.currentLockValue || 0,
          newLockValue: errorData.newLockValue || 0,
        });
        setPendingOrderData({
          buyerName: formData.buyerName,
          buyerContact: formData.buyerContact,
          buyerEmail: formData.buyerEmail,
          buyerAddress: formData.buyerAddress,
          businessName: formData.businessName,
          gstNumber: formData.gstNumber,
          deliveryDate: formData.deliveryDate,
          items: orderItems.map(item => ({
            design: item.design,
            color: item.color,
            sizes: item.sizes,
            pricePerUnit: item.pricePerUnit,
          })),
          notes: formData.notes,
          fulfillmentType: formData.fulfillmentType,
        });
        setShowUseLockModal(true);
      } else if (errorCode === 'INSUFFICIENT_STOCK') {
        toast.error(errorData?.message || 'Insufficient stock');
      } else if (errorCode === 'BUYER_CREDIT_EXCEEDED') {
        toast.error(errorData?.message || 'Buyer credit limit exceeded');
      } else {
        toast.error(errorData?.message || 'Failed to create order');
      }
      
      setSubmitting(false);
    }
  };

  async function handleConfirmUseLock() {
    if (!useLockData || !pendingOrderData) return;

    try {
      const token = localStorage.getItem('token');
      const itemsToReduce = useLockData.insufficientItems.map(item => ({
        design: item.design,
        color: item.color,
        size: item.size,
        reduceBy: item.neededFromLock,
      }));

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/inventory/reduce-variant-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: itemsToReduce }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reduce locked stock');
      }

      if (editingOrder) {
        await wholesaleService.updateOrder(editingOrder._id, pendingOrderData);
        toast.success('Order updated successfully using locked stock!');
      } else {
        await wholesaleService.createOrder(pendingOrderData);
        toast.success('Order created successfully using locked stock!');
      }

      setShowUseLockModal(false);
      setUseLockData(null);
      setPendingOrderData(null);
      setShowModal(false);
      deleteCurrentDraft();
      resetForm();
      fetchOrders();
    } catch (error) {
      console.error('Use locked stock error:', error);
      toast.error(error.message || 'Failed to use locked stock');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await wholesaleService.deleteOrder(id);
      toast.success('Order deleted successfully');
      fetchOrders();
      fetchAllBuyers();
    } catch (error) {
      toast.error('Failed to delete order');
    }
  }

  async function handlePayment() {
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    if (Number(paymentAmount) > paymentOrder.amountDue) {
      toast.error('Payment cannot exceed due amount');
      return;
    }

    try {
      const newAmountPaid = paymentOrder.amountPaid + Number(paymentAmount);
      await wholesaleService.updateOrder(paymentOrder._id, {
        amountPaid: newAmountPaid,
        paymentMethod,
        paymentNotes
      });
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      setPaymentOrder(null);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentNotes('');
      fetchOrders();
      fetchAllBuyers();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  }

  async function handleDownloadChallan(order) {
    try {
      await generateInvoice(order);
      toast.success('Challan downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate challan');
    }
  }

  async function handleSendWhatsApp(order) {
    if (!order.buyerContact) {
      toast.error('No contact number available');
      return;
    }
    try {
      await sendChallanViaWhatsApp(order);
      toast.success('Opening WhatsApp...');
    } catch (error) {
      toast.error('Failed to send via WhatsApp');
    }
  }

  function resetForm() {
    setFormData({
      buyerName: '',
      buyerContact: '',
      buyerEmail: '',
      buyerAddress: '',
      businessName: '',
      gstNumber: '',
      deliveryDate: '',
      notes: '',
      discountType: 'none',
      discountValue: 0,
      gstEnabled: true,
      fulfillmentType: 'warehouse'
    });
    setOrderItems([
      { 
        design: '', 
        selectedColors: [], 
        pricePerUnit: 0, 
        colorData: {},
        isCollapsed: false,
        isComplete: false
      }
    ]);
    setSearchMobile('');
    setBuyerFound(null);
    setEditingOrder(null);
    setExpandedItems({});
    setExpandedColors({});
    setCurrentDraftId(null);
  }
};

export default Wholesale;
