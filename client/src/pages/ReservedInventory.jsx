import React, { useState, useEffect, useMemo } from 'react';
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
  FiX
} from 'react-icons/fi';
import Card from '../components/common/Card';
import SkeletonCard from '../components/common/SkeletonCard';
import TransferModal from '../components/TransferModal';
import { inventoryService } from '../services/inventoryService';
import transferService from '../services/transferService';
import toast from 'react-hot-toast';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import { useColorPalette } from '../hooks/useColorPalette';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ScrollToTop from '../components/common/ScrollToTop';

const ReservedInventory = () => {
  const { enabledSizes } = useEnabledSizes();
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

  // Transfer Modal (single)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDirection, setTransferDirection] = useState('to-reserved');
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Bulk Transfer Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState('refill'); // 'refill' or 'return'
  const [bulkQuantities, setBulkQuantities] = useState({}); // { productId-color-size: quantity }

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsData, transfersData] = await Promise.all([
        inventoryService.getAllProducts(),
        transferService.getRecentTransfers()
      ]);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
      setRecentTransfers(transfersData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
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

  // Flatten products into variants
  const allVariants = useMemo(() => {
    const variants = [];
    products.forEach(product => {
      product.colors?.forEach(color => {
        if (isColorActive(color.color)) {
          color.sizes?.forEach(size => {
            if (enabledSizes.includes(size.size)) {
              variants.push({
                productId: product._id,
                design: product.design,
                color: color.color,
                size: size.size,
                mainStock: size.currentStock || 0,
                reservedStock: size.reservedStock || 0,
                wholesalePrice: color.wholesalePrice || 0,
                retailPrice: color.retailPrice || 0
              });
            }
          });
        }
      });
    });
    return variants;
  }, [products, enabledSizes, activeColors]);

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
      filtered = filtered.filter(v => v.reservedStock > 0 && v.reservedStock <= 10);
    } else if (filterStock === 'out') {
      filtered = filtered.filter(v => v.reservedStock === 0);
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

      grouped[key].colors[variant.color].sizes.push({
        size: variant.size,
        mainStock: variant.mainStock,
        reservedStock: variant.reservedStock
      });
    });
    return Object.values(grouped);
  }, [filteredVariants]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalReserved = allVariants.reduce((sum, v) => sum + v.reservedStock, 0);
    const lowStock = allVariants.filter(v => v.reservedStock > 0 && v.reservedStock <= 10).length;
    const outOfStock = allVariants.filter(v => v.reservedStock === 0).length;
    const lastTransfer = recentTransfers.length > 0 ? recentTransfers[0] : null;
    const lastTransferTime = lastTransfer ? getTimeAgo(new Date(lastTransfer.createdAt)) : 'No transfers yet';
    return { totalReserved, lowStock, outOfStock, lastTransferTime };
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

  const getTotalBulkQuantity = () => {
    return Object.values(bulkQuantities).reduce((sum, qty) => sum + qty, 0);
  };

const handleBulkTransferSubmit = async () => {
  const totalQty = getTotalBulkQuantity();
  if (totalQty === 0) {
    toast.error('Please enter at least one quantity');
    return;
  }

  try {
    const transfers = Object.entries(bulkQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([key, quantity]) => {
        const [productId, color, size] = key.split('-');
        const variant = allVariants.find(
          v => v.productId === productId && v.color === color && v.size === size
        );
        return {
          design: variant.design,
          color: variant.color,
          size: variant.size,
          quantity
        };
      });

    // Use bulk endpoint instead of individual calls
    if (bulkMode === 'refill') {
      await transferService.bulkTransferToReserved({ 
        transfers, 
        notes: 'Bulk refill from Reserved Inventory page' 
      });
    } else {
      await transferService.bulkTransferToMain({ 
        transfers, 
        notes: 'Bulk return from Reserved Inventory page' 
      });
    }

    toast.success(`Successfully transferred ${totalQty} units`);
    setShowBulkModal(false);
    setBulkQuantities({});
    await fetchData();
  } catch (error) {
    console.error('Bulk transfer error:', error);
    toast.error(error.response?.data?.message || 'Failed to process bulk transfer');
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

    const headers = ['Design', 'Color', 'Size', 'Reserved Stock', 'Main Stock', 'Wholesale Price', 'Retail Price'];
    const rows = dataToExport.map(v => [
      v.design,
      v.color,
      v.size,
      v.reservedStock,
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
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh
        </button>
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
          <select
            value={filterDesign}
            onChange={(e) => setFilterDesign(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Designs</option>
            {uniqueDesigns.map(design => (
              <option key={design} value={design}>{design}</option>
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
                            {colorData.sizes.map((sizeData) => (
                              <div
                                key={sizeData.size}
                                className={`relative border-2 rounded-lg p-3 group hover:shadow-lg transition-all ${getStockStatusColor(sizeData.reservedStock)}`}
                              >

                                {/* Stock Display */}
                                <div className="text-center">
                                  <div className="text-sm font-bold">
                                    {sizeData.size}:{sizeData.reservedStock}/{sizeData.mainStock}
                                  </div>
                                </div>

                                {/* Action Buttons (Show on hover) */}
                                <div className="hidden group-hover:flex flex-col gap-1">
                                  <button
                                    onClick={() => openTransferModal({
                                      design: group.design,
                                      color: colorData.color,
                                      size: sizeData.size
                                    }, 'to-reserved')}
                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                  >
                                    <FiArrowDown className="w-3 h-3" />
                                    Refill
                                  </button>
                                  <button
                                    onClick={() => openTransferModal({
                                      design: group.design,
                                      color: colorData.color,
                                      size: sizeData.size
                                    }, 'to-main')}
                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                  >
                                    <FiArrowUp className="w-3 h-3" />
                                    Return
                                  </button>
                                </div>
                              </div>
                            ))}
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
                  Enter quantities to transfer {bulkMode === 'refill' ? 'from Main → Reserved' : 'from Reserved → Main'}
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Search Bar - NEW */}
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
                    // Filter products based on search term
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
                              {/* Color Header with Quick Fill */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-5 h-5 rounded-full border"
                                      style={{ backgroundColor: getColorCode(colorData.color) || '#9CA3AF' }}
                                    />
                                    <span className="font-semibold">{colorData.color}</span>
                                  </div>
                                  <button
                                    onClick={() => handleQuickFillColor(product._id, { ...colorData, sizes: colorData.sizes.filter(s => enabledSizes.includes(s.size)) })}
                                    className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >
                                    Quick Fill All
                                  </button>
                                </div>

                              {/* Size Input Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {colorData.sizes
                                  ?.filter(s => enabledSizes.includes(s.size))
                                  .map((sizeData) => {
                                    const key = `${product._id}-${colorData.color}-${sizeData.size}`;
                                    return (
                                      <div key={sizeData.size} className="border-2 border-gray-200 rounded-lg p-3">
                                        <div className="text-center mb-2">
                                          <div className="text-xs text-black-900 font-bold">Size {sizeData.size}</div>
                                          <div className="text-xs text-gray-500">
                                            {bulkMode === 'return' ? `Reserved:${sizeData.reservedStock || 0}` : `Main:${sizeData.currentStock || 0}`}
                                          </div>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder="0"
                                          value={bulkQuantities[key] || ''}
                                          onChange={(e) => handleBulkQuantityChange(product._id, colorData.color, sizeData.size, e.target.value)}
                                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
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
      <ScrollToTop />
    </div>
  );
};

export default ReservedInventory;
