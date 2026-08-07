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
  FiPlus, FiTrash2, FiShoppingBag, FiSearch, FiX, FiList, FiFilter,
  FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiCalendar,
  FiDollarSign, FiDownload, FiSend, FiEdit2, FiUser, FiClock, FiCheckCircle,
  FiPackage, FiCreditCard,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { formatDate } from '../utils/dateUtils';
import SkeletonCard from '../components/common/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import ScrollToTop from '../components/common/ScrollToTop';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Color dot helper (visual chip color) ───────────────────────
const getColorCode = (colorName) => {
  const colorMap = {
    'Black': 'bg-black', 'White': 'bg-white border border-gray-300',
    'Red': 'bg-red-500', 'Blue': 'bg-blue-500', 'Green': 'bg-green-500',
    'Yellow': 'bg-yellow-400', 'Purple': 'bg-purple-500', 'Pink': 'bg-pink-400',
    'Orange': 'bg-orange-500', 'Brown': 'bg-amber-700', 'Grey': 'bg-gray-400',
    'Gray': 'bg-gray-400', 'Light Grey': 'bg-gray-300', 'Dark Grey': 'bg-gray-600',
    'Navy': 'bg-blue-900', 'Maroon': 'bg-red-900', 'Khaki': 'bg-yellow-700',
  };
  return colorMap[colorName] || 'bg-gray-400';
};

const emptyItem = (getInitialPieces) => ({
  design: '', color: '', pricePerUnit: 0, mode: 'sets', sets: 0,
  pieces: getInitialPieces ? getInitialPieces() : {},
});

const DirectSales = () => {
  const { enabledSizes, getSizesForDesign, loading: sizesLoading } = useEnabledSizes();
  const { user } = useAuth();

  // ── Core state ─────────────────────────────────────────────
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // ── GST ────────────────────────────────────────────────────
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstPercentage, setGstPercentage] = useState(5);

  const [formData, setFormData] = useState({
    customerName: '', customerMobile: '', customerEmail: '',
    customerAddress: '', paymentMethod: 'Cash', notes: '',
  });

  const getInitialPieces = () => {
    const pieces = {};
    enabledSizes.forEach(size => { pieces[size] = 0; });
    return pieces;
  };

  const [orderItems, setOrderItems] = useState([
    { design: '', color: '', pricePerUnit: 0, mode: 'sets', sets: 0, pieces: {} }
  ]);

  useEffect(() => {
    if (enabledSizes.length > 0) {
      setOrderItems([{ design: '', color: '', pricePerUnit: 0, mode: 'sets', sets: 0, pieces: getInitialPieces() }]);
    }
  }, [enabledSizes]);

  useEffect(() => { fetchData(); fetchSettings(); }, []);

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
      const saleDataWithFlag = { ...pendingSaleData, borrowFromReserved: true };
      await directSalesService.createSaleWithReservedBorrow(saleDataWithFlag);
      toast.success('Sale created successfully! Stock borrowed from Reserved Inventory.', { duration: 5000 });
      setShowBorrowModal(false);
      setBorrowData(null);
      setPendingSaleData(null);
      setShowModal(false);
      setIsSubmitting(false);
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
        setFormData({ ...formData, customerMobile: searchMobile });
        toast('New customer - fill in details', { icon: '📝' });
      }
    }
  };

  const handleAddItem = () => {
    setOrderItems([
      ...orderItems,
      { design: '', color: '', pricePerUnit: 0, mode: 'sets', sets: 0, pieces: getInitialPieces() }
    ]);
  };

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleItemDesignChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index] = { design: value, color: '', pricePerUnit: 0, mode: 'sets', sets: 0, pieces: getInitialPieces() };
    setOrderItems(newItems);
  };

  const handleItemColorChange = (index, value) => {
    const newItems = [...orderItems];
    newItems[index].color = value;
    const product = products.find(p => p.design === newItems[index].design);
    if (product) {
      const selectedColor = product.colors.find(c => c.color === value);
      if (selectedColor) newItems[index].pricePerUnit = selectedColor.retailPrice;
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
      enabledSizes.forEach(size => { quantities[size] = setsCount; });
      return quantities;
    }
    return item.pieces;
  };

  const getItemTotalPieces = (item) => {
    const q = getFinalQuantities(item);
    return Object.keys(q).reduce((s, size) => s + (enabledSizes.includes(size) ? (Number(q[size]) || 0) : 0), 0);
  };

  // ── Totals with GST ──────────────────────────────────────────
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
    return { totalQty, subtotal, gstAmount: gst, cgst: gst / 2, sgst: gst / 2, total };
  };

  const createSaleWithLock = async (saleData) => {
    try {
      return await directSalesService.createDirectSale(saleData);
    } catch (err) {
      const data = err?.response?.data;
      const code = data?.code;
      if ((code === 'INSUFFICIENT_AVAILABLE_STOCK' || code === 'INSUFFICIENTAVAILABLESTOCK') && data?.canUseLockedStock) {
        setUseLockData({
          insufficientItems: data.insufficientItems || [],
          totalNeededFromLock: data.totalNeededFromLock || 0,
          currentLockValue: data.currentLockValue || 0,
          newLockValue: data.newLockValue || 0,
        });
        setPendingSaleData(saleData);
        setShowUseLockModal(true);
        return null;
      }
      throw err;
    }
  };

  const handleConfirmUseLock = async () => {
    if (!useLockData || !pendingSaleData) return;
    try {
      const token = localStorage.getItem('token');
      const itemsToReduce = useLockData.insufficientItems.map(item => ({
        design: item.design, color: item.color, size: item.size, reduceBy: item.neededFromLock,
      }));
      const response = await fetch(`${API}/inventory/reduce-variant-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ items: itemsToReduce }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reduce locked stock');
      }
      await response.json();
      await directSalesService.createDirectSale(pendingSaleData);
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
    if (isSubmitting) { toast.error('Please wait, sale is being saved...'); return; }
    if (orderItems.length === 0) { toast.error('Please add at least one item'); return; }

    const flattenedItems = [];
    orderItems.forEach((item) => {
      const colorQuantities = getFinalQuantities(item);
      Object.keys(colorQuantities).forEach((size) => {
        if (colorQuantities[size] > 0 && enabledSizes.includes(size)) {
          flattenedItems.push({
            design: item.design, color: item.color, size,
            quantity: colorQuantities[size], pricePerUnit: item.pricePerUnit,
          });
        }
      });
    });

    if (flattenedItems.length === 0) { toast.error('Please add at least one item with quantity > 0'); return; }

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
        try {
          const result = await createSaleWithLock(saleData);
          if (result) {
            toast.success('Sale created successfully');
            setShowModal(false);
            resetForm();
            fetchData();
          }
        } catch (lockError) {
          if (lockError.response?.data?.code === 'MAIN_INSUFFICIENT_BORROW_RESERVED') {
            setBorrowData({
              insufficientItems: lockError.response.data.insufficientItems,
              totalNeededFromReserved: lockError.response.data.totalNeededFromReserved
            });
            setPendingSaleData(saleData);
            setShowBorrowModal(true);
            setIsSubmitting(false);
            return;
          }
          throw lockError;
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message || error.message;
      switch (errorCode) {
        case 'INSUFFICIENT_STOCK': toast.error(`${errorMessage} - Insufficient stock`); break;
        case 'PRODUCT_NOT_FOUND': toast.error(`${errorMessage} - Product not found`); break;
        case 'INVALID_DATA': toast.error(`${errorMessage} - Invalid data provided`); break;
        default: toast.error(errorMessage || 'Failed to save sale');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = (group) => {
    // Reconstruct an editable sale from a grouped row (uses first item's sale id/meta)
    const firstSale = group.items[0];
    setEditingSale(firstSale);
    setFormData({
      customerName: group.customerName || '',
      customerMobile: group.customerMobile || '',
      customerEmail: firstSale?.customerEmail || '',
      customerAddress: firstSale?.customerAddress || '',
      paymentMethod: group.paymentMethod || 'Cash',
      notes: firstSale?.notes || '',
    });
    setSearchMobile(group.customerMobile || '');
    setOrderItems(group.items.map(sale => ({
      design: sale.design, color: sale.color, pricePerUnit: sale.pricePerUnit,
      mode: 'pieces', sets: 0,
      pieces: { ...getInitialPieces(), [sale.size]: sale.quantity },
    })));
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;
    try {
      const response = await directSalesService.deleteDirectSale(id);
      if (response?.success || response?.message) {
        setSales(prevSales => prevSales.filter(sale => sale._id !== id));
        await fetchData();
        toast.success(response?.message || 'Sale deleted successfully', { icon: '✅', duration: 3000 });
      } else {
        throw new Error('Delete response invalid');
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (error.response?.status === 403) {
        const errorCode = error.response?.data?.code;
        if (errorCode === 'NO_ACTIVE_SESSION') toast.error('No active edit session. Please start a session first.');
        else if (errorCode === 'LIMIT_EXHAUSTED') toast.error('Edit limit exhausted. Your session has ended.');
        else toast.error(error.response?.data?.message || 'Access denied');
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to delete sale');
      }
      await fetchData();
    }
  };

  const buildInvoicePayload = (group) => {
    const subtotal = group.items.reduce((sum, sale) => sum + (sale.quantity * sale.pricePerUnit), 0);
    const gstAmount = group.totalGst || 0;
    const hasGst = group.items.some(sale => sale.gstEnabled);
    return {
      challanNumber: `DS_${group.key.slice(0, 8).toUpperCase()}`,
      buyerName: group.customerName,
      buyerContact: group.customerMobile,
      buyerAddress: group.items[0]?.customerAddress || '',
      buyerEmail: group.items[0]?.customerEmail || '',
      businessName: '', gstNumber: '', orderDate: group.saleDate,
      items: group.items.map(sale => ({
        design: sale.design, color: sale.color, size: sale.size,
        quantity: sale.quantity, pricePerUnit: sale.pricePerUnit,
      })),
      subtotalAmount: subtotal, discountAmount: 0, discountType: 'none', discountValue: 0,
      gstEnabled: hasGst, gstAmount, cgst: gstAmount / 2, sgst: gstAmount / 2,
      totalAmount: group.totalAmount, _id: group.key,
    };
  };

  const handleDownloadChallan = async (group) => {
    try {
      await generateInvoice(buildInvoicePayload(group));
      toast.success('Challan downloaded successfully!');
    } catch (error) {
      console.error('Error generating challan:', error);
      toast.error('Failed to generate challan');
    }
  };

  const handleSendWhatsApp = async (group) => {
    try {
      const payload = buildInvoicePayload(group);
      await generateInvoice(payload);
      await sendChallanViaWhatsApp(payload);
      toast.success('Opening WhatsApp...');
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '', customerMobile: '', customerEmail: '',
      customerAddress: '', paymentMethod: 'Cash', notes: '',
    });
    setOrderItems([{ design: '', color: '', pricePerUnit: 0, mode: 'sets', sets: 0, pieces: getInitialPieces() }]);
    setSearchMobile('');
    setCustomerFound(null);
    setGstEnabled(true);
    setEditingSale(null);
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
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(sale => new Date(sale.saleDate) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);
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
      const items = sale.items || [{
        design: sale.design,
        color: sale.color,
        size: sale.size,
        quantity: sale.quantity,
        pricePerUnit: sale.pricePerUnit,
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
            notes: sale.notes || '',
            items: [],
            totalAmount: 0,
            totalQuantity: 0,
            totalGst: 0,
            createdByUser: sale.createdByUser || null,
            updatedByUser: sale.updatedByUser || null,
            createdAt: sale.createdAt,
            updatedAt: sale.updatedAt,
          };
        }

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
    let saleTotal = 0;
    if (typeof sale.totalAmount === 'number' && !isNaN(sale.totalAmount)) {
      saleTotal = sale.totalAmount;
    } else if (Array.isArray(sale.items)) {
      const itemsSubtotal = sale.items.reduce(
        (s, it) => s + (Number(it.quantity) || 0) * (Number(it.pricePerUnit) || 0),
        0
      );
      saleTotal = itemsSubtotal + (Number(sale.gstAmount) || 0);
    } else {
      saleTotal = (Number(sale.quantity) || 0) * (Number(sale.pricePerUnit) || 0) + (Number(sale.gstAmount) || 0);
    }
    return sum + (Number(saleTotal) || 0);
  }, 0);
  const totalUnits = filteredSales.reduce((sum, sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      return sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
    }
    return sum + (sale.quantity || 0);
  }, 0);

  const formatCurrency = (amount) => '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toggleRow = (key) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) newExpanded.delete(key); else newExpanded.add(key);
    setExpandedRows(newExpanded);
  };

  const totals = calculateTotal();
  const totalPiecesInModal = orderItems.reduce((s, item) => s + getItemTotalPieces(item), 0);

  if (loading || sizesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Loader message="Loading Sales..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-lg text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiShoppingBag /> Direct Sales <span className="text-blue-200 text-lg font-medium">B2C</span>
          </h1>
          <p className="text-blue-100 text-sm mt-1">Record retail and marketplace sales</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-white text-blue-700 px-5 py-2.5 rounded-xl font-semibold shadow hover:bg-blue-50 flex items-center gap-2 transition-colors"
        >
          <FiPlus /> Record Sale
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full"><FiShoppingBag className="text-blue-600" size={24} /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full"><FiDollarSign className="text-green-600" size={24} /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Units Sold</p>
              <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full"><FiList className="text-purple-600" size={24} /></div>
          </div>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ── Sales list (card-based, like wholesale) ── */}
      <div className="space-y-3">
        {currentSales.length === 0 ? (
          <Card><p className="text-center text-gray-500 py-8">No sales found</p></Card>
        ) : currentSales.map(group => {
          const isOpen = expandedRows.has(group.key);
          return (
            <Card key={group.key} className="!p-0 overflow-hidden">
              {/* Row header */}
              <div
                onClick={() => toggleRow(group.key)}
                className="flex flex-wrap items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  {(group.customerName?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-[160px] flex-1">
                  <p className="font-semibold text-gray-900">{group.customerName}</p>
                  <p className="text-xs text-gray-500">{group.customerMobile}</p>
                </div>
                <div className="text-sm text-gray-600 min-w-[130px]">
                  {format(new Date(group.saleDate), 'dd MMM yyyy, HH:mm')}
                </div>
                <div className="text-sm text-gray-600 min-w-[80px]">{group.items.length} item(s)</div>
                <div className="text-sm font-semibold text-gray-900 min-w-[60px]">{group.totalQuantity} pcs</div>
                <div className="min-w-[120px]">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(group.totalAmount)}</p>
                  {group.totalGst > 0 && <p className="text-xs text-blue-600">GST: {formatCurrency(group.totalGst)}</p>}
                </div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium flex items-center gap-1">
                  <FiCreditCard size={12} /> {group.paymentMethod}
                </span>
                <button className="ml-auto text-blue-600 hover:text-blue-800">
                  {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleDownloadChallan(group)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
                      <FiDownload /> Download Challan
                    </button>
                    <button onClick={() => handleSendWhatsApp(group)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium">
                      <FiSend /> Send WhatsApp
                    </button>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {group.items.map((sale, idx) => {
                      const itemTotal = (sale.quantity || 0) * (sale.pricePerUnit || 0);
                      return (
                        <div key={sale._id || idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <span className={`w-4 h-4 rounded-full ${getColorCode(sale.color)}`} />
                            <div>
                              <p className="font-medium text-gray-900">{sale.design} - {sale.color}</p>
                              <p className="text-sm text-gray-600">
                                Size: {sale.size} • Qty: {sale.quantity} • ₹{sale.pricePerUnit}
                                {sale.gstAmount > 0 && (
                                  <span className="text-blue-600 ml-2">+ GST ₹{(sale.gstAmount / group.items.length).toFixed(2)}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-gray-900">₹{itemTotal.toFixed(2)}</span>
                            <button onClick={() => handleDelete(sale._id)} className="text-red-600 hover:text-red-800">
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Creator / Editor / Timestamp details */}
                  <div className="bg-white rounded-lg border border-gray-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-gray-400" />
                      <span>
                        <span className="font-medium text-gray-800">Created by:</span>{' '}
                        {group.createdByUser?.userName || 'System'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiClock className="text-gray-400" />
                      <span>
                        <span className="font-medium text-gray-800">Created at:</span>{' '}
                        {group.createdAt ? format(new Date(group.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                      </span>
                    </div>
                    {group.updatedByUser && (
                      <div className="flex items-center gap-2">
                        <FiEdit2 className="text-gray-400" />
                        <span>
                          <span className="font-medium text-gray-800">Last edited by:</span>{' '}
                          {group.updatedByUser?.userName || '—'}
                        </span>
                      </div>
                    )}
                    {group.updatedAt && group.updatedAt !== group.createdAt && (
                      <div className="flex items-center gap-2">
                        <FiClock className="text-gray-400" />
                        <span>
                          <span className="font-medium text-gray-800">Last edited at:</span>{' '}
                          {format(new Date(group.updatedAt), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    )}
                    {group.notes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700">
                        <p className="font-medium text-yellow-800 mb-1">📝 Notes</p>
                        <p>{group.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-gray-700">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, groupedSales.length)} of {groupedSales.length} groups
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              <FiChevronLeft />
            </button>
            <span className="px-3 py-1 border rounded-lg bg-blue-50 text-blue-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ RECORD DIRECT SALE MODAL (wholesale-style) ═══════════════ */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingSale ? 'Edit Direct Sale' : 'Record Direct Sale'} size="large">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Sticky live summary ── */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-indigo-100 rounded-xl px-4 py-3 shadow-sm -mx-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Live Summary</span>
              {customerFound && (
                <span className="text-xs text-gray-500">· {formData.customerName}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                ['Subtotal', `₹${totals.subtotal.toLocaleString('en-IN')}`, 'text-gray-900'],
                ['GST', `+₹${totals.gstAmount.toFixed(2)}`, 'text-yellow-600'],
                ['TOTAL', `₹${totals.total.toLocaleString('en-IN')}`, 'text-indigo-700 text-base font-extrabold'],
                ['Qty', `${totalPiecesInModal} pcs`, 'text-gray-900'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex flex-col">
                  <span className="text-[10px] uppercase text-gray-400 font-medium">{label}</span>
                  <span className={`text-sm font-semibold ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Customer details ── */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            {!customerFound ? (
              <>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FiUser /> Customer Details</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={handleSearchCustomer} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
                    <FiSearch /> Search
                  </button>
                  <button type="button" onClick={fetchAllCustomers} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium">
                    <FiList /> All Customers
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                    <input type="text" required value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                    <input type="text" required value={formData.customerMobile} maxLength={10}
                      onChange={(e) => setFormData({ ...formData, customerMobile: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea value={formData.customerAddress} rows={2}
                      onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FiUser /> Customer</h3>
                  <button type="button"
                    onClick={() => { setCustomerFound(null); setSearchMobile(''); setFormData({ ...formData, customerName: '', customerMobile: '', customerEmail: '', customerAddress: '' }); }}
                    className="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50">
                    ✏️ Change Customer
                  </button>
                </div>
                <div className="bg-white p-3 rounded-lg border-l-4 border-green-500 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                    {(formData.customerName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{formData.customerName}</p>
                    <p className="text-xs text-gray-500">{formData.customerMobile}{formData.customerEmail ? ` · ${formData.customerEmail}` : ''}</p>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <p>Purchases: {customerFound.totalPurchases || 0}</p>
                    <p>Spent: {formatCurrency(customerFound.totalSpent || 0)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* ── Order Items (collapsible cards, wholesale-style) ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FiPackage /> Order Items</h3>
              <span className="text-xs text-gray-500">{orderItems.length} item(s) · {totalPiecesInModal} pcs</span>
            </div>

            {orderItems.map((item, itemIndex) => {
              const product = products.find(p => p.design === item.design);
              const itemPieces = getItemTotalPieces(item);
              return (
                <div key={itemIndex} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Design *</label>
                        <select value={item.design} required
                          onChange={(e) => handleItemDesignChange(itemIndex, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                          <option value="">Select Design</option>
                          {products.map(p => <option key={p._id} value={p.design}>{p.design}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color *</label>
                        <select value={item.color} required disabled={!item.design}
                          onChange={(e) => handleItemColorChange(itemIndex, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                          <option value="">Select Color</option>
                          {product?.colors.map(c => <option key={c._id || c.color} value={c.color}>{c.color}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit *</label>
                        <input type="number" required min={0} value={item.pricePerUnit}
                          onChange={(e) => handlePriceChange(itemIndex, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    {orderItems.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(itemIndex)} className="mt-6 text-red-600 hover:text-red-800">
                        <FiX size={20} />
                      </button>
                    )}
                  </div>

                  {item.design && item.color && (
                    <div className="bg-gray-50 p-3 rounded-lg space-y-3 border border-gray-100">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full ${getColorCode(item.color)}`} />
                          <label className="text-sm font-medium text-gray-700">Quantity Input Mode</label>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{itemPieces} pcs · ₹{(itemPieces * item.pricePerUnit).toLocaleString('en-IN')}</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleModeChange(itemIndex, 'sets')}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${item.mode === 'sets' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
                              Sets
                            </button>
                            <button type="button" onClick={() => handleModeChange(itemIndex, 'pieces')}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${item.mode === 'pieces' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
                              Pieces
                            </button>
                          </div>
                        </div>
                      </div>

                      {item.mode === 'sets' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Sets (1 set = 1 of each size)</label>
                          <input type="number" min={0} value={item.sets}
                            onChange={(e) => handleSetsChange(itemIndex, e.target.value)}
                            className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                          <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {enabledSizes.map(size => {
                              const stock = getStock(item.design, item.color, size);
                              return (
                                <div key={size} className="text-center p-2 bg-white rounded-lg border border-gray-200">
                                  <div className="text-xs text-gray-600">{size}</div>
                                  <div className={`text-sm font-semibold ${stock < 10 ? 'text-red-600' : 'text-green-600'}`}>Stock: {stock}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {enabledSizes.map(size => {
                            const stock = getStock(item.design, item.color, size);
                            const qty = Number(item.pieces?.[size]) || 0;
                            const over = qty > stock;
                            return (
                              <div key={size}>
                                <label className="block text-xs text-gray-600 mb-1">{size}</label>
                                <input type="number" min={0} value={item.pieces?.[size] || 0}
                                  onChange={(e) => handlePiecesChange(itemIndex, size, e.target.value)}
                                  className={`w-full px-2 py-1.5 border rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 ${over ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`} />
                                <div className={`text-xs mt-1 text-center ${stock < 10 ? 'text-red-600' : 'text-green-600'}`}>Stock: {stock}</div>
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

            <button type="button" onClick={handleAddItem}
              className="w-full py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors">
              <FiPlus /> Add Another Item
            </button>
          </div>

          {/* ── GST Section ── */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" />
                <span className="ml-3 text-sm font-semibold text-gray-900">Include GST ({gstPercentage}%)</span>
              </label>
              {gstEnabled && (
                <div className="text-sm text-gray-700">
                  <span className="mr-3">CGST: {(gstPercentage / 2).toFixed(2)}%</span>
                  <span>SGST: {(gstPercentage / 2).toFixed(2)}%</span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-semibold">{totals.totalQty} pcs</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {gstEnabled && (
                <>
                  <div className="flex justify-between text-blue-600">
                    <span>CGST ({(gstPercentage / 2).toFixed(2)}%)</span>
                    <span>₹{totals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>SGST ({(gstPercentage / 2).toFixed(2)}%)</span>
                    <span>₹{totals.sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total GST</span>
                    <span className="text-blue-600">₹{totals.gstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 pt-2">
                <span>Grand Total</span>
                <span className="text-green-600">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} rows={2}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* ── Edit history (only when editing) ── */}
          {editingSale && (editingSale.createdByUser || editingSale.updatedByUser) && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
              {editingSale.createdByUser && (
                <div className="flex items-center gap-2"><FiUser className="text-gray-400" /> Created by: {editingSale.createdByUser.userName}</div>
              )}
              {editingSale.updatedByUser && (
                <div className="flex items-center gap-2"><FiEdit2 className="text-gray-400" /> Last edited by: {editingSale.updatedByUser.userName}</div>
              )}
            </div>
          )}

          {/* ── Sticky footer buttons ── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle /> {editingSale ? 'Update Sale' : 'Create Sale'}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Customer list modal ── */}
      <Modal isOpen={showCustomerListModal} onClose={() => setShowCustomerListModal(false)} title="All Customers" size="large">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allCustomers.map(customer => (
            <div key={customer._id} onClick={() => selectCustomer(customer)}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{customer.name}</p>
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

      {/* ── Use-locked-stock confirmation modal ── */}
      <Modal isOpen={showUseLockModal} onClose={() => { setShowUseLockModal(false); setUseLockData(null); setPendingSaleData(null); }} title="Use Locked Stock?">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Available stock is insufficient for this sale. Do you want to use stock reserved under lock for the following item(s)?
          </p>
          <div className="space-y-2">
            {useLockData?.insufficientItems?.map((it, idx) => (
              <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded-lg border border-gray-200">
                <span>{it.design} - {it.color} ({it.size})</span>
                <span className="font-medium">Need {it.neededFromLock} from lock</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowUseLockModal(false); setUseLockData(null); setPendingSaleData(null); }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleConfirmUseLock} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Confirm & Use Locked Stock
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Borrow from reserved modal ── */}
      <BorrowFromReservedModal
        isOpen={showBorrowModal}
        onClose={() => { setShowBorrowModal(false); setBorrowData(null); setPendingSaleData(null); setIsSubmitting(false); }}
        onConfirm={handleBorrowConfirm}
        insufficientItems={borrowData?.insufficientItems}
        totalNeededFromReserved={borrowData?.totalNeededFromReserved || 0}
      />

      <ScrollToTop />
    </div>
  );
};

export default DirectSales;
