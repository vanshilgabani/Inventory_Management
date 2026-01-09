import { useState, useEffect, useMemo } from 'react';
import { inventoryService } from '../services/inventoryService';
import { factoryService } from '../services/factoryService';
import { salesService } from '../services/salesService';
import { wholesaleService } from '../services/wholesaleService';
import { directSalesService } from '../services/directSalesService';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import { 
  FiEdit2, 
  FiTrash2, 
  FiSearch, 
  FiDownload, 
  FiAlertCircle,
  FiCheckSquare,
  FiSquare,
  FiGrid,
  FiPlus,
  FiClock,
  FiPackage,
  FiDollarSign,
  FiArrowUpRight,
} from 'react-icons/fi';
import { settingsService } from '../services/settingsService';
import { format } from 'date-fns';
import {useColorPalette} from '../hooks/useColorPalette';
import { useNavigate } from 'react-router-dom';

const Inventory = () => {
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();
  const { colors: activeColors, getColorCode } = useColorPalette();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [stockView, setStockView] = useState('available'); // 'available' or 'full'
  const [stockLockInfo, setStockLockInfo] = useState({ enabled: false, lockValue: 0 });

  
  // UI states
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({
    design: '',
    colors: [],
  });
  
  // Filter states
  const [stockFilter, setStockFilter] = useState('all'); // all, in_stock, low_stock, out_of_stock
  const [colorFilter, setColorFilter] = useState('all');
  const [sortBy, setSortBy] = useState('design'); // design, stock_high, stock_low, value_high
  
  // View mode
  const [viewMode, setViewMode] = useState('detailed'); // detailed, compact
  
  // Batch operations
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPrices, setBulkPrices] = useState({ wholesale: '', retail: '' });
  
  // Stock history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState({ receivings: [], sales: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Permissions
  const [permissions, setPermissions] = useState({ allowSalesEdit: false });

  useEffect(() => {
    fetchPermissionsAndSettings();
    fetchProducts();
  }, []);

  const fetchPermissionsAndSettings = async () => {
    try {
      const settingsData = await settingsService.getSettings();
      setSettings(settingsData);
      setPermissions(settingsData.permissions || { allowSalesEdit: false });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

const fetchProducts = async () => {
  try {
    const data = await inventoryService.getAllProducts();
    
    console.log('📦 Received data:', data); // ✅ ADD THIS
    
    // Handle both legacy array and new object shape with stockLockSettings
    if (Array.isArray(data)) {
      setProducts(data);
      setStockLockInfo({ enabled: false, lockValue: 0 });
    } else {
      setProducts(data?.products);
      if (data?.stockLockSettings) {
        console.log('🔒 Stock lock settings:', data.stockLockSettings); // ✅ ADD THIS
        setStockLockInfo({
          enabled: !!data.stockLockSettings.enabled,
          lockValue: Number(data.stockLockSettings.lockValue) || 0,
          maxThreshold: Number(data.stockLockSettings.maxThreshold) || 0
        });
      } else {
        setStockLockInfo({ enabled: false, lockValue: 0 });
      }
    }
  } catch (error) {
    toast.error('Failed to fetch products');
  } finally {
    setLoading(false);
  }
};

  const canEditDelete = () => {
    return user?.role === 'admin' || permissions.allowSalesEdit;
  };

  // Get global threshold
  const globalThreshold = settings?.stockThresholds?.globalThreshold || 10;

    // Helper: Check if color is active in palette
const isColorActive = (colorName) => {
  return activeColors.some(c => c.colorName === colorName);
};

// Get all unique colors from products (only active ones)
const allColors = useMemo(() => {
  const colors = new Set();
  products.forEach(p => {
    p.colors?.forEach(c => {
      // ✅ Only add active colors to the filter dropdown
      if (isColorActive(c.color)) {
        colors.add(c.color);
      }
    });
  });
  return Array.from(colors).sort();
}, [products, activeColors]); // ← Add activeColors to deps

  // ✅ NEW: Create flat variant list (each variant is separate)
  // NEW: Create flat variant list (each variant is separate)
const allVariants = useMemo(() => {
  const variants = [];
  products.forEach(product => {
    if (product.colors && Array.isArray(product.colors)) {
      // ✅ FILTER: Only process active colors
      product.colors
        .filter(color => isColorActive(color.color))  // ← ADD THIS LINE
        .forEach(color => {
          if (color.sizes && Array.isArray(color.sizes)) {
            color.sizes
              .filter(s => enabledSizes.includes(s.size))
              .forEach(size => {
                // ... rest of the existing code (don't change anything below)
                const currentStock = size.currentStock || 0;
                const lockedStock = size.lockedStock || 0;
                const availableStock = size.availableStock !== undefined 
                  ? size.availableStock 
                  : currentStock - lockedStock;
                
                const stock = stockView === 'available' ? availableStock : currentStock;
                
                let status = 'instock';
                if (stock === 0) {
                  status = 'outofstock';
                } else if (stock <= globalThreshold) {
                  status = 'lowstock';
                }
                
                variants.push({
                  productId: product._id,
                  design: product.design,
                  color: color.color,
                  size: size.size,
                  stock: stock,
                  wholesalePrice: color.wholesalePrice || 0,
                  retailPrice: color.retailPrice || 0,
                  value: stock * (color.wholesalePrice || 0),
                  status: status
                });
              });
          }
        });
    }
  });
  return variants;
}, [products, enabledSizes, globalThreshold, stockView, stockLockInfo.enabled, activeColors]); // ← Add activeColors to deps

  // ✅ Apply filters at VARIANT level
  const filteredVariants = useMemo(() => {
    let filtered = [...allVariants];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.design.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.size.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Stock status filter
    if (stockFilter !== 'all') {
      filtered = filtered.filter(v => v.status === stockFilter);
    }

    // Color filter
    if (colorFilter !== 'all') {
      filtered = filtered.filter(v => v.color === colorFilter);
    }

    // Sorting
    if (sortBy === 'design') {
      filtered.sort((a, b) => a.design.localeCompare(b.design) || a.color.localeCompare(b.color));
    } else if (sortBy === 'stock_high') {
      filtered.sort((a, b) => b.stock - a.stock);
    } else if (sortBy === 'stock_low') {
      filtered.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === 'value_high') {
      filtered.sort((a, b) => b.value - a.value);
    }

    return filtered;
  }, [allVariants, searchTerm, stockFilter, colorFilter, sortBy]);

  // ✅ Group filtered variants by design and color
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
      
      grouped[key].colors[variant.color].sizes.push({
        size: variant.size,
        stock: variant.stock,
        status: variant.status
      });
    });
    
    return Object.values(grouped);
  }, [filteredVariants]);

  // Summary stats (from ALL variants, not filtered)
  const stats = useMemo(() => {
    const lowStock = allVariants.filter(v => v.status === 'lowstock').length;
    const outOfStock = allVariants.filter(v => v.status === 'outofstock').length;
    const totalValue = allVariants.reduce((sum, v) => sum + (v.value || 0), 0);
    const totalStock = allVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

    return { lowStock, outOfStock, totalValue, totalStock };
  }, [allVariants]);

  // Export functions
  const handleExport = (type) => {
    let dataToExport = [];
    
    if (type === 'all') {
      dataToExport = allVariants;
    } else if (type === 'lowstock') {
      dataToExport = allVariants.filter(v => v.status === 'lowstock');
    } else if (type === 'outofstock') {
      dataToExport = allVariants.filter(v => v.status === 'outofstock');
    }

    if (dataToExport.length === 0) {
      toast.error('No variants to export');
      return;
    }

    const headers = ['Design', 'Color', 'Size', 'Stock', 'Wholesale Price', 'Value'];
    const rows = dataToExport.map(v => [
      v.design,
      v.color,
      v.size,
      v.stock,
      v.wholesalePrice,
      v.value
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Inventory_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success(`Exported ${rows.length} variants`);
    setShowExportModal(false);
  };

  // Batch selection
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    const visibleProductIds = [...new Set(groupedVariants.map(g => g.productId))];
    if (selectedProducts.length === visibleProductIds.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(visibleProductIds);
    }
  };

  // Bulk price update
  const handleBulkPriceUpdate = async (e) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      toast.error('No products selected');
      return;
    }

    if (!bulkPrices.wholesale && !bulkPrices.retail) {
      toast.error('Enter at least one price');
      return;
    }

    try {
      const updates = selectedProducts.map(productId => {
        const product = products.find(p => p._id === productId);
        const updatedColors = product.colors.map(color => ({
          ...color,
          wholesalePrice: bulkPrices.wholesale ? Number(bulkPrices.wholesale) : color.wholesalePrice,
          retailPrice: bulkPrices.retail ? Number(bulkPrices.retail) : color.retailPrice
        }));

        return inventoryService.updateProduct(productId, {
          design: product.design,
          colors: updatedColors
        });
      });

      await Promise.all(updates);
      toast.success(`Updated ${selectedProducts.length} products`);
      setShowBulkPriceModal(false);
      setBulkPrices({ wholesale: '', retail: '' });
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast.error('Failed to update prices');
    }
  };

  // Stock history
  const handleViewHistory = async (design) => {
    setHistoryProduct({ design });
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const [receivings, marketplaceSales, wholesaleOrders, directSales] = await Promise.all([
        factoryService.getAllReceivings(),
        salesService.getAllSales('all'),
        wholesaleService.getAllOrders(),
        directSalesService.getAllDirectSales()
      ]);

      const productReceivings = receivings
        .filter(r => r.design === design)
        .map(r => ({
          type: 'receiving',
          date: r.receivedDate,
          design: r.design,
          color: r.color,
          quantity: r.totalQuantity,
          source: r.sourceType,
          notes: r.notes
        }));

      const productSales = [
        ...marketplaceSales.filter(s => s.design === design).map(s => ({
          type: 'marketplace',
          date: s.saleDate,
          design: s.design,
          color: s.color,
          size: s.size,
          quantity: s.quantity,
          account: s.accountName
        })),
        ...wholesaleOrders.flatMap(o =>
          o.items?.filter(i => i.design === design).map(i => ({
            type: 'wholesale',
            date: o.createdAt,
            design: i.design,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            buyer: o.businessName || o.buyerName
          }))
        ),
        ...directSales.flatMap(s =>
          s.items?.filter(i => i.design === design).map(i => ({
            type: 'direct',
            date: s.createdAt,
            design: i.design,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            customer: s.customerName
          }))
        )
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistoryData({ receivings: productReceivings, sales: productSales });
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Edit/Delete handlers
  const handleOpenModal = (productId) => {
    const product = products.find(p => p._id === productId);
    setCurrentProduct(product);
    setFormData({
      design: product.design,
      colors: product.colors,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.updateProduct(currentProduct._id, formData);
      toast.success('Product updated successfully');
      setShowModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await inventoryService.deleteProduct(productId);
        toast.success('Product deleted successfully');
        fetchProducts();
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const handleSizeChange = (colorIndex, sizeIndex, field, value) => {
    const updatedColors = [...formData.colors];
    updatedColors[colorIndex].sizes[sizeIndex][field] = Number(value);
    setFormData({ ...formData, colors: updatedColors });
  };

  const handleColorPriceChange = (colorIndex, field, value) => {
    const updatedColors = [...formData.colors];
    updatedColors[colorIndex][field] = Number(value);
    setFormData({ ...formData, colors: updatedColors });
  };

  const getStatusBadge = (status) => {
    const badges = {
      in_stock: { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: '🟢' },
      low_stock: { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
      out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: '🔴' }
    };
    return badges[status] || badges.in_stock;
  };

  if (loading || sizesLoading) return <Loader />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        
        <div className="flex items-center space-x-3">
          {/* ✅ NEW: Reserved Inventory Button */}
          <button
            onClick={() => navigate('/reserved-inventory')}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FiPackage className="w-5 h-5" />
            <span>Reserved Inventory</span>
          </button>
          
          {/* ✅ NEW: Transfer History Button */}
          <button
            onClick={() => navigate('/transfer-history')}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <FiArrowUpRight className="w-5 h-5" />
            <span>Transfer History</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-2xl text-orange-600" />
              <div>
                <h3 className="font-bold text-gray-900">Stock Alerts</h3>
                <p className="text-sm text-gray-600">
                  {stats.lowStock > 0 && <span className="mr-3">🟡 {stats.lowStock} Low Stock Variants</span>}
                  {stats.outOfStock > 0 && <span>🔴 {stats.outOfStock} Out of Stock Variants</span>}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStockFilter('lowstock')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600"
              >
                View Low Stock
              </button>
              <button
                onClick={() => setStockFilter('outofstock')}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
              >
                View Out of Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiPackage className="text-2xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalStock}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiDollarSign className="text-2xl text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{(stats.totalValue / 1000).toFixed(1)}k
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FiAlertCircle className="text-2xl text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <FiAlertCircle className="text-2xl text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by design, color, or size..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              {/* Stock Status Filter */}
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              >
                <option value="all">All Stock Status</option>
                <option value="instock">✅ In Stock</option>
                <option value="lowstock">⚠️ Low Stock</option>
                <option value="outofstock">❌ Out of Stock</option>
              </select>

              {/* Color Filter */}
              <select
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              >
                <option value="all">All Colors</option>
                {allColors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              >
                <option value="design">Sort: A-Z</option>
                <option value="stock_high">Sort: Stock (High)</option>
                <option value="stock_low">Sort: Stock (Low)</option>
                <option value="value_high">Sort: Value (High)</option>
              </select>

              {/* Clear Filters */}
              {(searchTerm || stockFilter !== 'all' || colorFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStockFilter('all');
                    setColorFilter('all');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {selectedProducts.length > 0 && (
                <>
                  <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
                    {selectedProducts.length} selected
                  </span>
                  <button
                    onClick={() => setShowBulkPriceModal(true)}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 flex items-center gap-2"
                  >
                    <FiDollarSign /> Bulk Price
                  </button>
                  <button
                    onClick={() => setSelectedProducts([])}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </>
              )}
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center gap-2"
              >
                <FiDownload /> Export
              </button>
            </div>
          </div>

          {/* Select All */}
          {groupedVariants.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600"
              >
                {selectedProducts.length === [...new Set(groupedVariants.map(g => g.productId))].length ? (
                  <FiCheckSquare className="text-blue-600" />
                ) : (
                  <FiSquare />
                )}
                Select All Visible Products
              </button>
              <p className="text-sm text-gray-600">
                Showing <span className="font-bold">{filteredVariants.length}</span> variants
                {stockFilter !== 'all' && ` (${stockFilter.replace('_', ' ')} only)`}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Products List */}
      <div className="space-y-4">
        {groupedVariants.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <FiPackage className="mx-auto text-5xl mb-4 text-gray-300" />
              <p className="text-lg font-semibold">No variants found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          </Card>
        ) : (
          groupedVariants.map((group) => {
            const isSelected = selectedProducts.includes(group.productId);
            
            // Calculate totals for this filtered group
            const groupTotal = Object.values(group.colors).reduce((sum, color) => 
              sum + color.sizes.reduce((s, size) => s + size.stock, 0), 0
            );
            
            const groupValue = Object.values(group.colors).reduce((sum, color) => 
              sum + color.sizes.reduce((s, size) => s + (size.stock * color.wholesalePrice), 0), 0
            );

            return (
              <Card key={`${group.productId}-${group.design}`} className={`${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="space-y-4">
                  {/* Product Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleProductSelection(group.productId)}
                        className="text-2xl"
                      >
                        {isSelected ? (
                          <FiCheckSquare className="text-blue-600" />
                        ) : (
                          <FiSquare className="text-gray-400" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-900">{group.design}</h3>
                          {stockFilter !== 'all' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              Filtered View
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Showing Stock: <span className="font-bold">{groupTotal}</span> • 
                          Value: <span className="font-bold">₹{groupValue.toLocaleString()}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewHistory(group.design)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 flex items-center gap-2 text-sm"
                      >
                        <FiClock /> History
                      </button>
                      {canEditDelete() && (
                        <>
                          <button
                            onClick={() => handleOpenModal(group.productId)}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center gap-2 text-sm"
                          >
                            <FiEdit2 /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(group.productId)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 flex items-center gap-2 text-sm"
                          >
                            <FiTrash2 /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Colors - Only show filtered variants */}
                  <div className="space-y-2">
                    {Object.values(group.colors).map((color, idx) => {
                      const colorTotal = color.sizes.reduce((sum, size) => sum + size.stock, 0);
                      
                      return (
                        <div
                          key={idx}
                          className="border rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-full border-2 border-gray-300"
                                style={{ backgroundColor: getColorCode(color.color) }}
                              />
                              <span className="font-bold text-sm text-gray-900">{color.color}</span>
                              <span className="text-xs text-gray-500">({colorTotal} units)</span>
                            </div>
                            <div className="flex gap-3 text-xs">
                              <span className="text-gray-600">
                                W: <span className="font-semibold">₹{color.wholesalePrice}</span>
                              </span>
                              <span className="text-gray-600">
                                R: <span className="font-semibold">₹{color.retailPrice}</span>
                              </span>
                            </div>
                          </div>

                          {/* Sizes - Inline with color-coded backgrounds */}
                          <div className="flex flex-wrap gap-2">
                          {color.sizes.map((size, sIdx) => {
                            // ✅ FIXED: Get original size data from product
                            const originalProduct = products.find(p => p._id === group.productId);
                            const originalColor = originalProduct?.colors?.find(c => c.color === color.color);
                            const originalSize = originalColor?.sizes?.find(s => s.size === size.size);
                            
                            const currentStock = originalSize?.currentStock || 0;
                            const lockedStock = originalSize?.lockedStock || 0;
                            const availableStock = currentStock - lockedStock;
                            
                            // ✅ ALWAYS use availableStock for color (not currentStock)
                            let badgeColor;
                            if (availableStock === 0) {
                              badgeColor = 'bg-red-500 text-white'; // Red for 0 available
                            } else if (availableStock < 5) {
                              badgeColor = 'bg-orange-500 text-white'; // Orange below 5 available
                            } else if (availableStock < globalThreshold) {
                              badgeColor = 'bg-yellow-500 text-white'; // Yellow below threshold
                            } else {
                              badgeColor = 'bg-green-500 text-white'; // Green for good available stock
                            }
                            
                            // Format display text based on view mode
                            let displayText;
                            if (stockView === 'full' && stockLockInfo.enabled && lockedStock > 0) {
                              // Full mode with locks: "M - 50/5" (50 available, 5 locked)
                              displayText = `${size.size} - ${availableStock}/${lockedStock}`;
                            } else if (stockView === 'available' && stockLockInfo.enabled) {
                              // Available mode: "M - 50" (available only)
                              displayText = `${size.size} - ${availableStock}`;
                            } else {
                              // Full mode without locks OR stock lock disabled: "M - 50" (total)
                              displayText = `${size.size} - ${currentStock}`;
                            }
                            
                            return (
                              <span
                                key={sIdx}
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeColor}`}
                                title={
                                  stockLockInfo.enabled && lockedStock > 0
                                    ? `Total: ${currentStock}, Locked: ${lockedStock}, Available: ${availableStock}`
                                    : `Stock: ${currentStock}`
                                }
                              >
                                {displayText}
                              </span>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Product"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Design
            </label>
            <input
              type="text"
              value={formData.design}
              disabled
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Colors & Stock</h3>
            {formData.colors?.map((color, colorIndex) => (
              <div key={colorIndex} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: getColorCode(color.color) }}
                  />
                  <span className="font-bold">{color.color}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Wholesale Price
                    </label>
                    <input
                      type="number"
                      value={color.wholesalePrice}
                      onChange={(e) => handleColorPriceChange(colorIndex, 'wholesalePrice', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Retail Price
                    </label>
                    <input
                      type="number"
                      value={color.retailPrice}
                      onChange={(e) => handleColorPriceChange(colorIndex, 'retailPrice', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {color.sizes
                    ?.filter(size => enabledSizes.includes(size.size))
                    .map((size, sizeIndex) => {
                      const originalSizeIndex = color.sizes.findIndex(s => s.size === size.size);
                      return (
                        <div key={sizeIndex}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {size.size}
                          </label>
                          <input
                            type="number"
                            value={size.currentStock}
                            onChange={(e) => handleSizeChange(colorIndex, originalSizeIndex, 'currentStock', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                            min="0"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
            >
              Update Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Price Modal */}
      <Modal
        isOpen={showBulkPriceModal}
        onClose={() => setShowBulkPriceModal(false)}
        title="Bulk Price Update"
        size="md"
      >
        <form onSubmit={handleBulkPriceUpdate} className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <p className="text-sm font-semibold text-gray-900">
              Updating prices for <span className="text-blue-600">{selectedProducts.length}</span> products
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Leave a field empty to keep existing prices
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Wholesale Price (₹)
            </label>
            <input
              type="number"
              value={bulkPrices.wholesale}
              onChange={(e) => setBulkPrices({ ...bulkPrices, wholesale: e.target.value })}
              placeholder="Enter new wholesale price"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Retail Price (₹)
            </label>
            <input
              type="number"
              value={bulkPrices.retail}
              onChange={(e) => setBulkPrices({ ...bulkPrices, retail: e.target.value })}
              placeholder="Enter new retail price"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowBulkPriceModal(false)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600"
            >
              Update Prices
            </button>
          </div>
        </form>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Inventory"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose which variants to export to CSV
          </p>

          <button
            onClick={() => handleExport('all')}
            className="w-full px-6 py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <FiPackage className="text-2xl" />
              <div className="text-left">
                <p className="font-bold">Export All Stock</p>
                <p className="text-xs opacity-90">{allVariants.length} variants</p>
              </div>
            </div>
            <FiDownload className="text-xl" />
          </button>

          <button
            onClick={() => handleExport('lowstock')}
            className="w-full px-6 py-4 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-2xl" />
              <div className="text-left">
                <p className="font-bold">Export Low Stock Only</p>
                <p className="text-xs opacity-90">{stats.lowStock} variants</p>
              </div>
            </div>
            <FiDownload className="text-xl" />
          </button>

          <button
            onClick={() => handleExport('outofstock')}
            className="w-full px-6 py-4 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-2xl" />
              <div className="text-left">
                <p className="font-bold">Export Out of Stock Only</p>
                <p className="text-xs opacity-90">{stats.outOfStock} variants</p>
              </div>
            </div>
            <FiDownload className="text-xl" />
          </button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Stock History - ${historyProduct?.design}`}
      >
        {loadingHistory ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Receivings */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiPackage className="text-blue-500" /> 
                Factory Receivings ({historyData.receivings.length})
              </h3>
              {historyData.receivings.length === 0 ? (
                <p className="text-sm text-gray-500">No receivings found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historyData.receivings.slice(0, 20).map((r, idx) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm">{r.color}</p>
                          <p className="text-xs text-gray-600">{r.notes || 'No notes'}</p>
                          <p className="text-xs text-gray-500 mt-1">Source: {r.source}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">+{r.quantity}</p>
                          <p className="text-xs text-gray-500">{format(new Date(r.date), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiPackage className="text-green-500" /> 
                Sales ({historyData.sales.length})
              </h3>
              {historyData.sales.length === 0 ? (
                <p className="text-sm text-gray-500">No sales found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historyData.sales.slice(0, 20).map((s, idx) => (
                    <div key={idx} className="border-l-4 border-green-500 pl-3 py-2 bg-green-50 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm">
                            {s.color} - {s.size}
                          </p>
                          <p className="text-xs text-gray-600">
                            {s.type === 'marketplace' && `${s.account}`}
                            {s.type === 'wholesale' && `Wholesale: ${s.buyer}`}
                            {s.type === 'direct' && `Direct: ${s.customer}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">-{s.quantity}</p>
                          <p className="text-xs text-gray-500">{format(new Date(s.date), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Inventory;