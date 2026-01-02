import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiRepeat, 
  FiFilter, 
  FiDownload, 
  FiCalendar, 
  FiPackage,
  FiArrowLeft,
  FiArrowDown,
  FiArrowUp,
  FiTrendingUp,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiLock
} from 'react-icons/fi';
import Card from '../components/common/Card';
import SkeletonCard from '../components/common/SkeletonCard';
import transferService from '../services/transferService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useColorPalette } from '../hooks/useColorPalette';
import { format } from 'date-fns';

const TransferHistory = () => {
  const navigate = useNavigate();
  const { getColorCode } = useColorPalette();

  // State
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterDesign, setFilterDesign] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Fetch transfers
  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const filters = { limit: 500 };
      if (filterType !== 'all') filters.type = filterType;
      if (filterDesign !== 'all') filters.design = filterDesign;
      if (filterColor !== 'all') filters.color = filterColor;
      if (filterSize !== 'all') filters.size = filterSize;
      if (dateRange.startDate) filters.startDate = dateRange.startDate;
      if (dateRange.endDate) filters.endDate = dateRange.endDate;

      const data = await transferService.getAllTransfers(filters);
      setTransfers(data || []);
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
      toast.error('Failed to load transfer history');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    fetchTransfers();
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilterType('all');
    setFilterDesign('all');
    setFilterColor('all');
    setFilterSize('all');
    setDateRange({ startDate: '', endDate: '' });
    setTimeout(() => fetchTransfers(), 100);
  };

  // Get unique values for filters
  const uniqueDesigns = useMemo(() => {
    return [...new Set(transfers.map(t => t.design))].filter(Boolean).sort();
  }, [transfers]);

  const uniqueColors = useMemo(() => {
    return [...new Set(transfers.map(t => t.color))].filter(Boolean).sort();
  }, [transfers]);

  const uniqueSizes = useMemo(() => {
    return [...new Set(transfers.map(t => t.size))].filter(Boolean).sort();
  }, [transfers]);

// Calculate meaningful stats with corrected logic
const stats = useMemo(() => {
  // BORROWED: Main → Reserved + Emergency Use from Main
  const manualRefills = transfers
    .filter(t => t.type === 'manual_refill')
    .reduce((sum, t) => sum + t.quantity, 0);

  const emergencyUseFromMain = transfers
    .filter(t => t.type === 'emergency_use') // Main → Sold for marketplace
    .reduce((sum, t) => sum + t.quantity, 0);

  const totalBorrowed = manualRefills + emergencyUseFromMain;

  // RETURNED: Reserved → Main + Wholesale/Direct sales from Reserved ONLY
  const manualReturns = transfers
    .filter(t => t.type === 'manual_return')
    .reduce((sum, t) => sum + t.quantity, 0);

  // Only count wholesale/direct sales from Reserved (NOT marketplace sales)
  const wholesaleSalesFromReserved = transfers
    .filter(t => 
      (t.from === 'reserved' && t.to === 'sold' && t.type !== 'marketplace_order') || 
      (t.notes && (t.notes.toLowerCase().includes('wholesale') || t.notes.toLowerCase().includes('direct')))
    )
    .reduce((sum, t) => sum + t.quantity, 0);

  const totalReturned = manualReturns + wholesaleSalesFromReserved;

  // NET BALANCE: What you currently owe to main inventory
  const netBalance = totalBorrowed - totalReturned;

  // Most active design
  const designCounts = {};
  transfers.forEach(t => {
    designCounts[t.design] = (designCounts[t.design] || 0) + 1;
  });
  const mostActiveDesign = Object.keys(designCounts).length > 0
    ? Object.keys(designCounts).reduce((a, b) => designCounts[a] > designCounts[b] ? a : b)
    : 'N/A';

  // Today's activity
  const today = new Date().toDateString();
  const todayTransfers = transfers.filter(t => 
    new Date(t.createdAt).toDateString() === today
  ).length;

  return {
    totalBorrowed,
    totalReturned,
    netBalance,
    mostActiveDesign,
    todayTransfers
  };
}, [transfers]);

  // Export to CSV
  const handleExportCSV = () => {
    if (transfers.length === 0) {
      toast.error('No transfers to export');
      return;
    }

    const csvData = transfers.map(t => ({
      'Date': format(new Date(t.createdAt), 'dd MMM yyyy, hh:mm a'),
      'Type': t.type.replace(/_/g, ' ').toUpperCase(),
      'Design': t.design,
      'Color': t.color,
      'Size': t.size,
      'Quantity': t.quantity,
      'From': t.from,
      'To': t.to,
      'Main Stock Before': t.mainStockBefore,
      'Main Stock After': t.mainStockAfter,
      'Reserved Stock Before': t.reservedStockBefore,
      'Reserved Stock After': t.reservedStockAfter,
      'Performed By': t.performedBy?.name || 'System',
      'Notes': t.notes || ''
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Transfer history exported!');
  };

  // Toggle card expansion
  const toggleCardExpansion = (index) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Helper: Get transfer type info
  const getTransferTypeInfo = (type) => {
    const types = {
      'manual_refill': {
        icon: <FiArrowDown className="w-5 h-5" />,
        label: 'Manual Refill',
        badge: 'bg-green-100 text-green-800 border-green-200',
        borderColor: 'border-green-500',
        bgColor: 'bg-green-50',
        iconBg: 'bg-green-500',
        description: 'Main → Reserved',
        quantityColor: 'text-green-600'
      },
      'manual_return': {
        icon: <FiArrowUp className="w-5 h-5" />,
        label: 'Manual Return',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        borderColor: 'border-blue-500',
        bgColor: 'bg-blue-50',
        iconBg: 'bg-blue-500',
        description: 'Reserved → Main',
        quantityColor: 'text-blue-600'
      },
      'marketplace_order': {
        icon: <FiPackage className="w-5 h-5" />,
        label: 'Marketplace Sale',
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        borderColor: 'border-purple-500',
        bgColor: 'bg-purple-50',
        iconBg: 'bg-purple-500',
        description: 'Reserved → Sold',
        quantityColor: 'text-purple-600'
      },
      'emergency_use': {
        icon: <FiPackage className="w-5 h-5" />,
        label: 'Emergency Use',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        borderColor: 'border-orange-500',
        bgColor: 'bg-orange-50',
        iconBg: 'bg-orange-500',
        description: 'Main → Sold',
        quantityColor: 'text-orange-600'
      },
      'emergency_borrow': {
        icon: <FiRepeat className="w-5 h-5" />,
        label: 'Emergency Borrow',
        badge: 'bg-red-100 text-red-800 border-red-200',
        borderColor: 'border-red-500',
        bgColor: 'bg-red-50',
        iconBg: 'bg-red-500',
        description: 'Reserved → Main',
        quantityColor: 'text-red-600'
      }
    };
    return types[type] || {
      icon: <FiPackage className="w-5 h-5" />,
      label: 'Transfer',
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      borderColor: 'border-gray-500',
      bgColor: 'bg-gray-50',
      iconBg: 'bg-gray-500',
      description: 'Unknown',
      quantityColor: 'text-gray-600'
    };
  };

  // Format date
  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reserved-inventory')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <FiRepeat className="text-3xl text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Transfer History</h1>
            </div>
            <p className="text-gray-600 mt-1">Complete audit trail of all inventory movements</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <FiDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards - Updated with correct logic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Borrowed */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Borrowed</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalBorrowed}</p>
              <p className="text-xs text-gray-500">units</p>
              <p className="text-xs text-green-700 mt-1 font-medium">From Main Inventory</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full">
              <FiArrowDown className="text-2xl text-white" />
            </div>
          </div>
        </Card>

        {/* Total Returned/Used */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returned/Used</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalReturned}</p>
              <p className="text-xs text-gray-500">units</p>
              <p className="text-xs text-blue-700 mt-1 font-medium">Returned + Sales from Reserved</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full">
              <FiArrowUp className="text-2xl text-white" />
            </div>
          </div>
        </Card>

        {/* Net Outstanding */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Outstanding</p>
              <p className={`text-3xl font-bold ${stats.netBalance >= 0 ? 'text-purple-600' : 'text-green-600'}`}>
                {stats.netBalance >= 0 ? '+' : ''}{stats.netBalance}
              </p>
              <p className="text-xs text-gray-500">units</p>
              <p className="text-xs text-purple-700 mt-1 font-medium">
                {stats.netBalance >= 0 ? 'Owed to Main' : 'Surplus Returned'}
              </p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full">
              <FiTrendingUp className="text-2xl text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Most Active Design</p>
              <p className="text-2xl font-bold text-orange-600">{stats.mostActiveDesign}</p>
              <p className="text-xs text-gray-500">highest transfer count</p>
            </div>
            <FiPackage className="text-4xl text-orange-600 opacity-20" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Activity</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.todayTransfers}</p>
              <p className="text-xs text-gray-500">transfers today</p>
            </div>
            <FiClock className="text-4xl text-indigo-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Filters Section - Collapsible */}
      <Card>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2">
            <FiFilter className="text-xl text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            {(filterType !== 'all' || filterDesign !== 'all' || filterColor !== 'all' || filterSize !== 'all' || dateRange.startDate || dateRange.endDate) && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Active
              </span>
            )}
          </div>
          {showFilters ? (
            <FiChevronUp className="text-xl text-gray-400" />
          ) : (
            <FiChevronDown className="text-xl text-gray-400" />
          )}
        </div>

        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="manual_refill">Manual Refill</option>
                <option value="manual_return">Manual Return</option>
                <option value="marketplace_order">Marketplace Sale</option>
                <option value="emergency_use">Emergency Use</option>
                <option value="emergency_borrow">Emergency Borrow</option>
              </select>

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
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sizes</option>
                {uniqueSizes.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="From Date"
                />
              </div>

              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="To Date"
                />
              </div>

              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Apply Filters
              </button>

              <button
                onClick={handleClearFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Transfers List */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Recent Transfers</h3>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            {transfers.length} {transfers.length === 1 ? 'transfer' : 'transfers'}
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="mx-auto text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No transfers found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer, index) => {
              const typeInfo = getTransferTypeInfo(transfer.type);
              const isExpanded = expandedCards[index];

              return (
                <div
                  key={index}
                  className={`border-l-4 ${typeInfo.borderColor} bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Left: Type Info */}
                      <div className="flex items-center gap-4">
                        <div className={`p-3 ${typeInfo.iconBg} rounded-full text-white`}>
                          {typeInfo.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{typeInfo.label}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${typeInfo.badge} border`}>
                              {typeInfo.description}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{formatDate(transfer.createdAt)}</p>
                        </div>
                      </div>

                      {/* Center: Variant Info */}
                      <div className="flex-1 mx-8">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-bold text-gray-900">{transfer.design}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div
                                className="w-4 h-4 rounded-full border-2 border-gray-300"
                                style={{ backgroundColor: getColorCode(transfer.color) || '#9CA3AF' }}
                              />
                              <span className="text-sm text-gray-600">
                                {transfer.color} - Size {transfer.size}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity & Actions */}
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${typeInfo.quantityColor}`}>
                          {transfer.type === 'manual_refill' || transfer.type === 'emergency_use' ? '+' : '-'}{transfer.quantity}
                        </p>
                        <p className="text-xs text-gray-500">units</p>
                        <button
                          onClick={() => toggleCardExpansion(index)}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <FiChevronUp className="w-4 h-4" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <FiChevronDown className="w-4 h-4" />
                              Show Details
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-3 gap-4">
                          {/* Stock Changes */}
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Main Stock</p>
                            <p className="text-sm">
                              {transfer.mainStockBefore} → {transfer.mainStockAfter}
                              <span className={`ml-2 font-semibold ${
                                transfer.mainStockAfter > transfer.mainStockBefore
                                  ? 'text-green-600'
                                  : transfer.mainStockAfter < transfer.mainStockBefore
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}>
                                ({transfer.mainStockAfter > transfer.mainStockBefore ? '+' : ''}
                                {transfer.mainStockAfter - transfer.mainStockBefore})
                              </span>
                            </p>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Reserved Stock</p>
                            <p className="text-sm">
                              {transfer.reservedStockBefore} → {transfer.reservedStockAfter}
                              <span className={`ml-2 font-semibold ${
                                transfer.reservedStockAfter > transfer.reservedStockBefore
                                  ? 'text-green-600'
                                  : transfer.reservedStockAfter < transfer.reservedStockBefore
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}>
                                ({transfer.reservedStockAfter > transfer.reservedStockBefore ? '+' : ''}
                                {transfer.reservedStockAfter - transfer.reservedStockBefore})
                              </span>
                            </p>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Performed By</p>
                            <div className="flex items-center gap-2">
                              <FiUser className="w-4 h-4 text-gray-400" />
                              <p className="text-sm">{transfer.performedBy?.name || 'System'}</p>
                            </div>
                          </div>
                        </div>

                        {transfer.notes && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs font-semibold text-yellow-800 mb-1">Notes:</p>
                            <p className="text-sm text-yellow-900">"{transfer.notes}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TransferHistory;
