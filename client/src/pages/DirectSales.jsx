import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { directSalesService } from '../services/directSalesService';
import { inventoryService } from '../services/inventoryService';
import { settingsService } from '../services/settingsService';
import { generateInvoice, sendChallanViaWhatsApp } from '../components/InvoiceGenerator';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import BorrowFromReservedModal from '../components/BorrowFromReservedModal';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import {
  FiPlus,
  FiTrash2,
  FiShoppingBag,
  FiSearch,
  FiX,
  FiList,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiCalendar,
  FiDollarSign,
  FiDownload,
  FiSend,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { formatDate, formatCurrency } from '../utils/dateUtils'; 
import SkeletonCard from '../components/common/SkeletonCard';
import { useEditSession } from '../hooks/useEditSession'; // ✅ ADD THIS
import EditSessionManager from '../components/EditSessionManager'; // ✅ ADD THIS
import { useAuth } from '../context/AuthContext';
import UseLockStockModal from '../components/UseLockStockModal';

const DirectSales = () => {
const { enabledSizes, loading: sizesLoading } = useEnabledSizes();
const { hasActiveSession, refreshSession } = useEditSession(); // ✅ ADD THIS
const { user } = useAuth(); // ✅ ADD THIS (if not already present)
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCustomerListModal, setShowCustomerListModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [searchMobile, setSearchMobile] = useState('');
  const [customerFound, setCustomerFound] = useState(null);
  const [showUseLockModal, setShowUseLockModal] = useState(false);
  const [useLockData, setUseLockData] = useState(null);
  const [pendingSaleData, setPendingSaleData] = useState(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [borrowData, setBorrowData] = useState(null);
  
  // ✅ GST State
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstPercentage, setGstPercentage] = useState(5);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerMobile: '',
    customerEmail: '',
    customerAddress: '',
    paymentMethod: 'Cash',
    notes: '',
  });

  const getInitialPieces = () => {
    const pieces = {};
    enabledSizes.forEach(size => {
      pieces[size] = 0;
    });
    return pieces;
  };

  const [orderItems, setOrderItems] = useState([
    {
      design: '',
      color: '',
      pricePerUnit: 0,
      mode: 'sets',
      sets: 0,
      pieces: {}
    }
  ]);

  useEffect(() => {
    if (enabledSizes.length > 0) {
      setOrderItems([{
        design: '',
        color: '',
        pricePerUnit: 0,
        mode: 'sets',
        sets: 0,
        pieces: getInitialPieces()
      }]);
    }
  }, [enabledSizes]);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchData = async () => {
    try {
      const [salesData, productsData] = await Promise.all([
      directSalesService.getAllDirectSales(),
      inventoryService.getAllProducts(),
      ]);
    setSales(salesData);
    setProducts(Array.isArray(productsData) ? productsData : (productsData?.products || []));
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch GST Settings
  const fetchSettings = async () => {
    try {
      const response = await settingsService.getSettings();
      setGstPercentage(response.gstPercentage || 5);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchAllCustomers = async () => {
    try {
      const customers = await directSalesService.getAllCustomers();
      setAllCustomers(customers);
      setShowCustomerListModal(true);
    } catch (error) {
      toast.error('Failed to fetch customers');
    }
  };

  const selectCustomer = (customer) => {
    setCustomerFound(customer);
    setFormData({
      ...formData,
      customerName: customer.name,
      customerMobile: customer.mobile,
      customerEmail: customer.email || '',
      customerAddress: customer.address || '',
    });
    setSearchMobile(customer.mobile);
    setShowCustomerListModal(false);
    toast.success('Customer selected!');
  };

const handleBorrowConfirm = async () => {
  if (!pendingSaleData) return;

  try {
    console.log('User confirmed borrowing from reserved, creating sale...');
    
    // ✅ ADD borrowFromReserved: true flag
    const saleDataWithFlag = {
      ...pendingSaleData,
      borrowFromReserved: true  // ← ADD THIS
    };
    
    await directSalesService.createSaleWithReservedBorrow(saleDataWithFlag);
    
    toast.success('Sale created successfully! Stock borrowed from Reserved Inventory.', { duration: 5000 });
    
    // Close modals
    setShowBorrowModal(false);
    setBorrowData(null);
    setPendingSaleData(null);
    setShowModal(false);
    setIsSubmitting(false);
    
    // Refresh data
    fetchData();
  } catch (error) {
    console.error('Failed to create sale with borrow:', error);
    toast.error(error.response?.data?.message || 'Failed to create sale');
    setIsSubmitting(false);
  }
};

  const handleSearchCustomer = async () => {
    if (searchMobile.length === 10) {
      try {
        const customer = await directSalesService.getCustomerByMobile(searchMobile);
        setCustomerFound(customer);
        setFormData({
          ...formData,
          customerName: customer.name,
          customerMobile: customer.mobile,
          customerEmail: customer.email || '',
          customerAddress: customer.address || '',
        });
        toast.success('Customer found!');
      } catch (error) {
        setCustomerFound(null);
        setFormData({
          ...formData,
          customerMobile: searchMobile,
        });
        toast.info('New customer - fill in details');
      }
    }
  };

  const handleAddItem = () => {
    setOrderItems([
      ...orderItems,
      {
        design: '',
        color: '',
        pricePerUnit: 0,
        mode: 'sets',
        sets: 0,
        pieces: getInitialPieces()
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleItemDesignChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index] = {
      design: value,
      color: '',
      pricePerUnit: 0,
      mode: 'sets',
      sets: 0,
      pieces: getInitialPieces()
    };
    setOrderItems(newItems);
  };

  const handleItemColorChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index].color = value;
    const product = products.find(p => p.design === newItems[index].design);
    if (product) {
      const selectedColor = product.colors.find(c => c.color === value);
      if (selectedColor) {
        newItems[index].pricePerUnit = selectedColor.retailPrice;
      }
    }
    setOrderItems(newItems);
  };

  const handlePriceChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index].pricePerUnit = Number(value) || 0;
    setOrderItems(newItems);
  };

  const handleModeChange = (index, mode) => {
    const newItems = [...orderItems];
    newItems[index].mode = mode;
    newItems[index].sets = 0;
    newItems[index].pieces = getInitialPieces();
    setOrderItems(newItems);
  };

  const handleSetsChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index].sets = Number(value) || 0;
    setOrderItems(newItems);
  };

  const handlePiecesChange = (index, size, value) => {
    const newItems = [...orderItems];
    newItems[index].pieces[size] = Number(value) || 0;
    setOrderItems(newItems);
  };

  const getStock = (design, color, size) => {
    const product = products.find(p => p.design === design);
    if (!product) return 0;
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) return 0;
    const sizeStock = colorVariant.sizes.find(s => s.size === size);
    return sizeStock ? sizeStock.currentStock : 0;
  };

  const getFinalQuantities = (item) => {
    if (item.mode === 'sets') {
      const setsCount = Number(item.sets) || 0;
      const quantities = {};
      enabledSizes.forEach(size => {
        quantities[size] = setsCount;
      });
      return quantities;
    } else {
      return item.pieces;
    }
  };

  const getColorCode = (colorName) => {
    const colorMap = {
      'Black': 'bg-black',
      'White': 'bg-white border border-gray-300',
      'Red': 'bg-red-500',
      'Blue': 'bg-blue-500',
      'Green': 'bg-green-500',
      'Yellow': 'bg-yellow-400',
      'Purple': 'bg-purple-500',
      'Pink': 'bg-pink-400',
      'Orange': 'bg-orange-500',
      'Brown': 'bg-amber-700',
      'Grey': 'bg-gray-400',
      'Gray': 'bg-gray-400',
      'Light Grey': 'bg-gray-300',
      'Dark Grey': 'bg-gray-600',
      'Navy': 'bg-blue-900',
      'Maroon': 'bg-red-900',
      'Khaki': 'bg-yellow-700',
    };
    return colorMap[colorName] || 'bg-gray-400';
  };

  // ✅ Calculate Total with GST
  const calculateTotal = () => {
    let totalQty = 0;
    let subtotal = 0;
    
    orderItems.forEach(item => {
      const quantities = getFinalQuantities(item);
      Object.keys(quantities).forEach(size => {
        if (quantities[size] > 0 && enabledSizes.includes(size)) {
          totalQty += quantities[size];
          subtotal += quantities[size] * item.pricePerUnit;
        }
      });
    });
    
    const gst = gstEnabled ? (subtotal * gstPercentage) / 100 : 0;
    const total = subtotal + gst;
    
    return {
      totalQty,
      subtotal,
      gstAmount: gst,
      cgst: gst / 2,
      sgst: gst / 2,
      total
    };
  };

// ✅ UPDATED: Handle locked stock with modal
const createSaleWithLock = async (saleData) => {
  try {
    return await directSalesService.createDirectSale(saleData);
  } catch (err) {
    const data = err?.response?.data;
    const code = data?.code;

    // Handle locked-stock flow
    if ((code === 'INSUFFICIENT_AVAILABLE_STOCK' || code === 'INSUFFICIENTAVAILABLESTOCK') && data?.canUseLockedStock) {
      // Store data for modal
      setUseLockData({
        insufficientItems: data.insufficientItems || [],
        totalNeededFromLock: data.totalNeededFromLock || 0,
        currentLockValue: data.currentLockValue || 0,
        newLockValue: data.newLockValue || 0,
      });
      setPendingSaleData(saleData);
      setShowUseLockModal(true);
      
      // Don't throw error, let modal handle it
      return null;
    }

    // For other errors, throw
    throw err;
  }
};

// ✅ UPDATED: Handle confirming use of locked stock
const handleConfirmUseLock = async () => {
  if (!useLockData || !pendingSaleData) return;

  try {
    // ✅ NEW: Reduce locked stock for specific variants
    const token = localStorage.getItem('token');
    
    // Prepare items array for reducing variant locks
    const itemsToReduce = useLockData.insufficientItems.map(item => ({
      design: item.design,
      color: item.color,
      size: item.size,
      reduceBy: item.neededFromLock,
    }));

    console.log('🔓 Reducing variant locks:', itemsToReduce);

    const response = await fetch('/api/inventory/reduce-variant-lock', {
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

    const lockResult = await response.json();
    console.log('✅ Locks reduced:', lockResult);

    // Retry creating the sale
    const createdSale = await directSalesService.createDirectSale(pendingSaleData);
    
    toast.success('Sale created successfully using locked stock!');
    setShowUseLockModal(false);
    setUseLockData(null);
    setPendingSaleData(null);
    setShowModal(false);
    resetForm();
    fetchData();

  } catch (error) {
    console.error('Use locked stock error:', error);
    toast.error(error.message || 'Failed to use locked stock');
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) {
    toast.error('Please wait, sale is being saved...');
    return;
  }

  // Validation
  if (orderItems.length === 0) {
    toast.error('Please add at least one item');
    return;
  }

  // Flatten items
  const flattenedItems = [];
  orderItems.forEach((item) => {
    const colorQuantities = getFinalQuantities(item);
    Object.keys(colorQuantities).forEach((size) => {
      if (colorQuantities[size] > 0 && enabledSizes.includes(size)) {
        flattenedItems.push({
          design: item.design,
          color: item.color,
          size: size,
          quantity: colorQuantities[size],
          pricePerUnit: item.pricePerUnit,
        });
      }
    });
  });

  if (flattenedItems.length === 0) {
    toast.error('Please add at least one item with quantity > 0');
    return;
  }

  setIsSubmitting(true);

    try {
    const totals = calculateTotal();
    const saleData = {
      customerName: formData.customerName || 'Walk-in Customer',
      customerContact: formData.customerMobile || '',
      items: flattenedItems,
      subtotalAmount: totals.subtotal,
      gstAmount: totals.gstAmount,
      totalAmount: totals.total,
      paymentMethod: formData.paymentMethod || 'Cash',
      notes: formData.notes || '',
    };

    if (editingSale) {
      await directSalesService.updateSale(editingSale._id, saleData);
      toast.success('Sale updated successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } else {
          // ✅ NEW: Try creating with lock check first
          try {
            const result = await createSaleWithLock(saleData);
            // Only show success if not waiting for lock confirmation
            if (result) {
              toast.success('Sale created successfully');
              setShowModal(false);
              resetForm();
              fetchData();
            }
          } catch (lockError) {
            // ✅ Handle borrow from reserved error
            if (lockError.response?.data?.code === 'MAIN_INSUFFICIENT_BORROW_RESERVED') {
              console.log('Main insufficient, showing borrow modal:', lockError.response.data);
              setBorrowData({
                insufficientItems: lockError.response.data.insufficientItems,
                totalNeededFromReserved: lockError.response.data.totalNeededFromReserved
              });
              setPendingSaleData(saleData);
              setShowBorrowModal(true);
              setIsSubmitting(false);
              return; // Don't throw error
            }
            throw lockError; // Re-throw other errors
          }
        }

  } catch (error) {
    console.error('Submit error:', error);
    
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.message || error.message;

    switch (errorCode) {
      case 'INSUFFICIENT_STOCK':
        toast.error(`${errorMessage} - Insufficient stock`);
        break;
      case 'PRODUCT_NOT_FOUND':
        toast.error(`${errorMessage} - Product not found`);
        break;
      case 'INVALID_DATA':
        toast.error(`${errorMessage} - Invalid data provided`);
        break;
      default:
        toast.error(errorMessage || 'Failed to save sale');
    }
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDelete = async (id) => {
  if (!window.confirm('Are you sure you want to delete this sale?')) return;
  
  try {
    await directSalesService.deleteDirectSale(id);
    await refreshSession(); // ✅ Refresh session
    fetchData();
    toast.success('Sale deleted successfully');
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
      toast.error('Failed to delete sale');
    }
  }
};

  const handleDownloadChallan = async (group) => {
    try {
      const subtotal = group.items.reduce((sum, sale) => sum + (sale.quantity * sale.pricePerUnit), 0);
      const gstAmount = group.totalGst || 0;
      const hasGst = group.items.some(sale => sale.gstEnabled);

      const orderForInvoice = {
        challanNumber: `DS_${group.key.slice(0, 8).toUpperCase()}`,
        buyerName: group.customerName,
        buyerContact: group.customerMobile,
        buyerAddress: group.items[0]?.customerAddress || '',
        buyerEmail: group.items[0]?.customerEmail || '',
        businessName: '',
        gstNumber: '',
        orderDate: group.saleDate,
        items: group.items.map(sale => ({
          design: sale.design,
          color: sale.color,
          size: sale.size,
          quantity: sale.quantity,
          pricePerUnit: sale.pricePerUnit,
        })),
        subtotalAmount: subtotal,
        discountAmount: 0,
        discountType: 'none',
        discountValue: 0,
        gstEnabled: hasGst,
        gstAmount: gstAmount,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        totalAmount: group.totalAmount,
        _id: group.key
      };

      await generateInvoice(orderForInvoice);
      toast.success('Challan downloaded successfully!');
    } catch (error) {
      console.error('Error generating challan:', error);
      toast.error('Failed to generate challan');
    }
  };

  // ✅ Send WhatsApp
  const handleSendWhatsApp = async (group) => {
    try {
      const subtotal = group.items.reduce((sum, sale) => sum + (sale.quantity * sale.pricePerUnit), 0);
      const gstAmount = group.totalGst || 0;
      const hasGst = group.items.some(sale => sale.gstEnabled);

      const orderForWhatsApp = {
        challanNumber: `DS_${group.key.slice(0, 8).toUpperCase()}`,
        buyerName: group.customerName,
        buyerContact: group.customerMobile,
        buyerAddress: group.items[0]?.customerAddress || '',
        buyerEmail: group.items[0]?.customerEmail || '',
        businessName: '',
        gstNumber: '',
        orderDate: group.saleDate,
        items: group.items.map(sale => ({
          design: sale.design,
          color: sale.color,
          size: sale.size,
          quantity: sale.quantity,
          pricePerUnit: sale.pricePerUnit,
        })),
        subtotalAmount: subtotal,
        discountAmount: 0,
        discountType: 'none',
        discountValue: 0,
        gstEnabled: hasGst,
        gstAmount: gstAmount,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        totalAmount: group.totalAmount,
        _id: group.key
      };

      await generateInvoice(orderForWhatsApp);
      await sendChallanViaWhatsApp(orderForWhatsApp);
      toast.success('Opening WhatsApp...');
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerMobile: '',
      customerEmail: '',
      customerAddress: '',
      paymentMethod: 'Cash',
      notes: '',
    });
    setOrderItems([
      {
        design: '',
        color: '',
        pricePerUnit: 0,
        mode: 'sets',
        sets: 0,
        pieces: getInitialPieces()
      }
    ]);
    setSearchMobile('');
    setCustomerFound(null);
    setGstEnabled(true);
  };

  const getFilteredSales = () => {
    let filtered = [...sales];

    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.design?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customerMobile?.includes(searchTerm)
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') {
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(sale => new Date(sale.saleDate) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      filtered = filtered.filter(sale => new Date(sale.saleDate) >= monthAgo);
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentFilter);
    }

    return filtered;
  };

  const filteredSales = getFilteredSales();

const groupSalesByCustomerAndDate = (salesArray) => {
  const grouped = {};

  salesArray.forEach((sale) => {
    // ✅ Handle both old and new structure
    const items = sale.items || [{ 
      design: sale.design, 
      color: sale.color, 
      size: sale.size, 
      quantity: sale.quantity,
      pricePerUnit: sale.pricePerUnit 
    }];

    items.forEach((item) => {
      const saleDate = new Date(sale.saleDate || sale.createdAt).toISOString().split('T')[0];
      const timeKey = format(new Date(sale.saleDate || sale.createdAt), 'HH:mm');
      const key = `${sale.customerMobile}-${saleDate}-${timeKey}`;

      if (!grouped[key]) {
        grouped[key] = {
          key,
          customerName: sale.customerName,
          customerMobile: sale.customerMobile,
          saleDate: sale.saleDate || sale.createdAt,
          paymentMethod: sale.paymentMethod,
          items: [],
          totalAmount: 0,
          totalQuantity: 0,
          totalGst: 0,
        };
      }

      // Add item to group
      grouped[key].items.push({
        ...sale,
        design: item.design,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
      });

      const saleTotal = (item.quantity || 0) * (item.pricePerUnit || 0);
      grouped[key].totalAmount += saleTotal;
      grouped[key].totalQuantity += item.quantity || 0;
      grouped[key].totalGst += sale.gstAmount || 0;
    });
  });

  return Object.values(grouped);
};

  const groupedSales = groupSalesByCustomerAndDate(filteredSales);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSales = groupedSales.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(groupedSales.length / itemsPerPage);

  const totalSales = filteredSales.length;
  const totalRevenue = filteredSales.reduce((sum, sale) => {
    const saleTotal = sale.totalAmount || (sale.quantity * sale.pricePerUnit + (sale.gstAmount || 0));
    return sum + saleTotal;
  }, 0);
  // ✅ FIXED: Calculate total units correctly
  const totalUnits = filteredSales.reduce((sum, sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      // New structure: sum all items
      return sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
    } else {
      // Old structure: single quantity
      return sum + (sale.quantity || 0);
    }
  }, 0);

  const formatCurrency = (amount) => {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const toggleRow = (key) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

// WITH:
if (loading || sizesLoading) return (
  <div className="p-6 space-y-4">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiShoppingBag className="text-blue-600" /> Direct Sales (B2C)
          </h1>
          <p className="text-gray-600 text-sm mt-1">Record retail and marketplace sales</p>
        </div>
        {user?.role === 'salesperson' && (
      <div className="mb-6">
        <EditSessionManager />
      </div>
    )}
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <FiPlus /> Record Sale
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FiShoppingBag className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FiDollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Units Sold</p>
              <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <FiList className="text-purple-600" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, design..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Sales Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">No sales found</td>
                </tr>
              ) : (
                                currentSales.map(group => (
                  <React.Fragment key={group.key}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(group.key)}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{group.customerName}</div>
                        <div className="text-xs text-gray-500">{group.customerMobile}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{format(new Date(group.saleDate), 'dd MMM yyyy HH:mm')}</td>
                      <td className="px-4 py-3 text-sm">{group.items.length} item(s)</td>
                      <td className="px-4 py-3 text-sm font-semibold">{group.totalQuantity}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(group.totalAmount)}</div>
                        {group.totalGst > 0 && (
                          <div className="text-xs text-blue-600">GST: {formatCurrency(group.totalGst)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          {group.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleRow(group.key); }} className="text-blue-600 hover:text-blue-800">
                          {expandedRows.has(group.key) ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(group.key) && (
                      <tr>
                        <td colSpan="7" className="bg-gray-50 px-4 py-3">
                          <div className="space-y-3">
                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => handleDownloadChallan(group)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                              >
                                <FiDownload /> Download Challan
                              </button>
                              <button
                                onClick={() => handleSendWhatsApp(group)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                              >
                                <FiSend /> Send WhatsApp
                              </button>
                            </div>

                            {/* Display individual items */}
                            <div className="space-y-2">
                              {group.items.map((sale, idx) => {
                                const itemTotal = (sale.quantity || 0) * (sale.pricePerUnit || 0);
                                const saleTotal = itemTotal + (sale.gstAmount || 0);
                                
                                return (
                                  <div key={sale._id || idx} className="flex justify-between items-center bg-white p-3 rounded border">
                                    <div className="flex items-center gap-3">
                                      <span className={`w-4 h-4 rounded-full ${getColorCode(sale.color)}`}></span>
                                      <div>
                                        <p className="font-medium">{sale.design} - {sale.color}</p>
                                        <p className="text-sm text-gray-600">
                                          Size: {sale.size} • Qty: {sale.quantity} • ₹{sale.pricePerUnit}
                                          {sale.gstAmount > 0 && (
                                            <span className="text-blue-600 ml-2">
                                              + GST ₹{(sale.gstAmount / group.items.length).toFixed(2)}
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="font-semibold">₹{itemTotal.toFixed(2)}</span>
                                      <button
                                        onClick={() => handleDelete(sale._id)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <FiTrash2 size={18} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-700">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, groupedSales.length)} of {groupedSales.length} groups
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft />
              </button>
              <span className="px-3 py-1 border rounded-lg bg-blue-50 text-blue-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Sale Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Direct Sale">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Customer by Mobile</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    maxLength="10"
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={handleSearchCustomer} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <FiSearch /> Search
                  </button>
                  <button type="button" onClick={fetchAllCustomers} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2">
                    <FiList /> All Customers
                  </button>
                </div>
              </div>
            </div>
            {customerFound && (
              <div className="bg-white p-3 rounded border-l-4 border-green-500">
                <p className="font-semibold text-green-700">✓ Customer Found</p>
                <p className="text-sm text-gray-600">Total Purchases: {customerFound.totalPurchases || 0} • Total Spent: {formatCurrency(customerFound.totalSpent || 0)}</p>
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input type="text" required value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
              <input type="text" required value={formData.customerMobile} onChange={(e) => setFormData({ ...formData, customerMobile: e.target.value })} maxLength="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={formData.customerEmail} onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea value={formData.customerAddress} onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Items</h3>
              <button type="button" onClick={handleAddItem} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                <FiPlus /> Add Item
              </button>
            </div>

            {orderItems.map((item, itemIndex) => {
              const product = products.find(p => p.design === item.design);
              return (
                <div key={itemIndex} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Design *</label>
                        <select value={item.design} onChange={(e) => handleItemDesignChange(itemIndex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                          <option value="">Select Design</option>
                          {products.map(p => <option key={p._id} value={p.design}>{p.design}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color *</label>
                        <select value={item.color} onChange={(e) => handleItemColorChange(itemIndex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required disabled={!item.design}>
                          <option value="">Select Color</option>
                          {product?.colors.map(c => <option key={c._id} value={c.color}>{c.color}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit *</label>
                        <input
                          type="number"
                          value={item.pricePerUnit}
                          onChange={(e) => handlePriceChange(itemIndex, e.target.value)}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>
                    {orderItems.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(itemIndex)} className="ml-2 text-red-600 hover:text-red-800">
                        <FiX size={20} />
                      </button>
                    )}
                  </div>

                  {item.design && item.color && (
                    <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700">Quantity Input Mode</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleModeChange(itemIndex, 'sets')} className={`px-3 py-1 rounded text-sm ${item.mode === 'sets' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            Sets
                          </button>
                          <button type="button" onClick={() => handleModeChange(itemIndex, 'pieces')} className={`px-3 py-1 rounded text-sm ${item.mode === 'pieces' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            Pieces
                          </button>
                        </div>
                      </div>

                      {item.mode === 'sets' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Sets (1 set = 1 of each size)</label>
                          <input type="number" min="0" value={item.sets} onChange={(e) => handleSetsChange(itemIndex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                          
                          <div className="mt-2 grid grid-cols-5 gap-2">
                            {enabledSizes.map(size => {
                              const stock = getStock(item.design, item.color, size);
                              return (
                                <div key={size} className="text-center p-2 bg-white rounded border">
                                  <div className="text-xs text-gray-600">{size}</div>
                                  <div className={`text-sm font-semibold ${stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                    Stock: {stock}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {enabledSizes.map(size => {
                            const stock = getStock(item.design, item.color, size);
                            return (
                              <div key={size}>
                                <label className="block text-xs text-gray-600 mb-1">{size}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.pieces[size] || 0}
                                  onChange={(e) => handlePiecesChange(itemIndex, size, e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <div className={`text-xs mt-1 ${stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                  Stock: {stock}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ✅ GST Section */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm font-semibold text-gray-900">
                  Include GST ({gstPercentage}%)
                </span>
              </label>
              
              {gstEnabled && (
                <div className="text-sm text-gray-700">
                  <span className="mr-3">CGST: {(gstPercentage / 2).toFixed(2)}%</span>
                  <span>SGST: {(gstPercentage / 2).toFixed(2)}%</span>
                </div>
              )}
            </div>
            
            {/* Price Breakdown */}
            <div className="space-y-2 text-sm bg-white p-3 rounded border">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity:</span>
                <span className="font-semibold">{calculateTotal().totalQty} pcs</span>
              </div>
              
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">₹{calculateTotal().subtotal.toFixed(2)}</span>
              </div>
              
              {gstEnabled && (
                <>
                  <div className="flex justify-between text-blue-600">
                    <span>CGST ({(gstPercentage / 2).toFixed(2)}%):</span>
                    <span>₹{calculateTotal().cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>SGST ({(gstPercentage / 2).toFixed(2)}%):</span>
                    <span>₹{calculateTotal().sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total GST:</span>
                    <span className="text-blue-600">₹{calculateTotal().gstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between text-lg font-bold border-t-2 pt-2">
                <span>Grand Total:</span>
                <span className="text-green-600">₹{calculateTotal().total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmitting} // ✅ ADD THIS
            >
              {isSubmitting ? ( // ✅ ADD THIS
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                editingSale ? 'Update Sale' : 'Create Sale'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer List Modal */}
      <Modal isOpen={showCustomerListModal} onClose={() => setShowCustomerListModal(false)} title="All Customers" size="large">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allCustomers.map(customer => (
            <div key={customer._id} onClick={() => selectCustomer(customer)} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.mobile}</p>
                  {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Purchases: {customer.totalPurchases || 0}</p>
                  <p className="text-xs text-gray-500">Spent: {formatCurrency(customer.totalSpent || 0)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
      {/* ⬇️ ADD THIS - Borrow From Reserved Modal */}
      <BorrowFromReservedModal
        isOpen={showBorrowModal}
        onClose={() => {
          setShowBorrowModal(false);
          setBorrowData(null);
          setPendingSaleData(null);
          setIsSubmitting(false);
        }}
        onConfirm={handleBorrowConfirm}
        insufficientItems={borrowData?.insufficientItems}
        totalNeededFromReserved={borrowData?.totalNeededFromReserved || 0}
      />
    </div>
  );
};

export default DirectSales;
