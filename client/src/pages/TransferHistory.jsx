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
  FiLock,
  FiX,
  FiBarChart2
} from 'react-icons/fi';
import Card from '../components/common/Card';
import SkeletonCard from '../components/common/SkeletonCard';
import transferService from '../services/transferService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useColorPalette } from '../hooks/useColorPalette';
import { format } from 'date-fns';
import ScrollToTop from '../components/common/ScrollToTop';

const TransferHistory = () => {
  const navigate = useNavigate();
  const { getColorCode } = useColorPalette();

  // State
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  // ✅ NEW: Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalTitle, setModalTitle] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterDesign, setFilterDesign] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // ✅ NEW: Month and Year options
  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const years = ['2024', '2025', '2026', '2027'];

  // Fetch transfers and stats
  useEffect(() => {
    fetchTransfers();
    fetchStats();
  }, []);

  // ✅ NEW: Refetch stats when month/year changes
  useEffect(() => {
    fetchStats();
  }, [selectedMonth, selectedYear]);

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

  // ✅ NEW: Fetch stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const filters = {};
      if (selectedMonth) filters.month = selectedMonth;
      if (selectedYear) filters.year = selectedYear;

      const data = await transferService.getTransferStats(filters);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  // ✅ NEW: Open modal with breakdown
  const openModal = (accountName, breakdown) => {
    setModalTitle(accountName === 'total' ? 'Total Allocation Breakdown' : `${accountName} - Allocation Breakdown`);
    setModalData(breakdown);
    setShowModal(true);
  };

  // ✅ NEW: Group breakdown by design
  const groupedBreakdown = useMemo(() => {
    if (!modalData) return {};
    
    const grouped = {};
    modalData.forEach(item => {
      if (!grouped[item.design]) {
        grouped[item.design] = [];
      }
      grouped[item.design].push(item);
    });
    
    return grouped;
  }, [modalData]);

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

  if (loading && statsLoading) {
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

      {/* ✅ NEW: Month/Year Filter Row */}
      <Card>
        <div className="flex items-center gap-4">
          <FiCalendar className="text-gray-600 text-xl" />
          <span className="text-sm font-medium text-gray-700">Filter Statistics:</span>
          
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {(selectedMonth || selectedYear !== new Date().getFullYear().toString()) && (
            <button
              onClick={() => {
                setSelectedMonth('');
                setSelectedYear(new Date().getFullYear().toString());
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset Filter
            </button>
          )}
        </div>
      </Card>

      {/* ✅ CORRECTED: Stats Cards with proper onClick */}
      {statsLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : stats ? (
        <>
          {/* First Row: Total Transferred + Per-Account Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Transferred Card */}
            <div 
              onClick={() => openModal('total', stats.totalStats.breakdown)}
              className="bg-white rounded-lg shadow-md p-6 bg-gradient-to-br from-green-50 to-green-100 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <FiBarChart2 className="text-green-600" />
                    Total Transferred
                  </p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {stats.totalStats.totalTransferred}
                  </p>
                  <p className="text-xs text-gray-500">units</p>
                  <p className="text-xs text-green-700 mt-1 font-medium">From Main Inventory</p>
                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                    <div>➕ Refills: {stats.totalStats.manualRefills}</div>
                    <div>➕ Emergency: {stats.totalStats.emergencyUse}</div>
                    <div>➖ Returns: {stats.totalStats.manualReturns}</div>
                    <div>➖ Borrows: {stats.totalStats.emergencyBorrow}</div>
                  </div>
                </div>
                <div className="p-3 bg-green-500 rounded-full">
                  <FiArrowDown className="text-2xl text-white" />
                </div>
              </div>
            </div>

            {/* Per-Account Cards */}
            {stats.accountStats.slice(0, 2).map((account, index) => (
              <div
                key={index}
                onClick={() => openModal(account.accountName, account.breakdown)}
                className="bg-white rounded-lg shadow-md p-6 bg-gradient-to-br from-purple-50 to-purple-100 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <FiUser className="text-purple-600" />
                      {account.accountName}
                    </p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                      {account.allocated}
                    </p>
                    <p className="text-xs text-gray-500">units allocated (net)</p>
                    
                    {/* ✅ NEW: Breakdown Stats */}
                    <div className="mt-3 pt-3 border-t border-purple-200 space-y-1 text-xs text-gray-600">
                      {account.manualAllocations > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">➕</span>
                          <span>Allocated: {account.manualAllocations}</span>
                        </div>
                      )}
                      {account.transfersIn > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600">➕</span>
                          <span>Transfers In: {account.transfersIn}</span>
                        </div>
                      )}
                      {account.transfersOut > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-orange-600">➖</span>
                          <span>Transfers Out: {account.transfersOut}</span>
                        </div>
                      )}
                      {account.returns > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600">➖</span>
                          <span>Returns: {account.returns}</span>
                        </div>
                      )}
                      {account.borrows > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-red-600">➖</span>
                          <span>Borrows: {account.borrows}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <FiLock className="text-4xl text-purple-600 opacity-20" />
                </div>
              </div>
            ))}
          </div>

          {/* Second Row: Additional Account Cards (if more than 2 accounts) */}
          {stats.accountStats.length > 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.accountStats.slice(2).map((account, index) => (
                <div
                  key={index}
                  onClick={() => openModal(account.accountName, account.breakdown)}
                  className="bg-white rounded-lg shadow-md p-6 bg-gradient-to-br from-purple-50 to-purple-100 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <FiUser className="text-purple-600" />
                        {account.accountName}
                      </p>
                      <p className="text-3xl font-bold text-purple-600 mt-2">
                        {account.allocated}
                      </p>
                      <p className="text-xs text-gray-500">units allocated (net)</p>
                      
                      {/* ✅ NEW: Breakdown Stats */}
                      <div className="mt-3 pt-3 border-t border-purple-200 space-y-1 text-xs text-gray-600">
                        {account.manualAllocations > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-600">➕</span>
                            <span>Allocated: {account.manualAllocations}</span>
                          </div>
                        )}
                        {account.transfersIn > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600">➕</span>
                            <span>Transfers In: {account.transfersIn}</span>
                          </div>
                        )}
                        {account.transfersOut > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-orange-600">➖</span>
                            <span>Transfers Out: {account.transfersOut}</span>
                          </div>
                        )}
                        {account.returns > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600">➖</span>
                            <span>Returns: {account.returns}</span>
                          </div>
                        )}
                        {account.borrows > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-red-600">➖</span>
                            <span>Borrows: {account.borrows}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <FiLock className="text-4xl text-purple-600 opacity-20" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

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

      {/* ✅ NEW: Modern Breakdown Modal - Pivot Table Style */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-slideUp">
            {/* Modal Header */}
            <div className="relative p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200"
              >
                <FiX className="w-6 h-6 text-white" />
              </button>
              <div className="text-white">
                <h2 className="text-3xl font-bold mb-2">{modalTitle}</h2>
                <p className="text-purple-100 text-sm flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4" />
                  {selectedMonth && selectedYear 
                    ? `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
                    : selectedYear 
                    ? `Year ${selectedYear}`
                    : 'All Time'}
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {modalData && modalData.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {Object.entries(groupedBreakdown).map(([design, items], designIndex) => {

                    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  
                    // ✅ DEBUG: Log to console
                    console.log('Design:', design, 'Items:', items, 'Total:', totalQuantity);
                    // Group items by color and size
                    const colorSizeMap = {};
                    const allSizes = new Set();
                    
                    items.forEach(item => {
                      if (!colorSizeMap[item.color]) {
                        colorSizeMap[item.color] = {};
                      }
                      colorSizeMap[item.color][item.size] = item.quantity;
                      allSizes.add(item.size);
                    });
                    
                    const sortedSizes = Array.from(allSizes).sort();
                    
                    return (
                      <div 
                        key={design} 
                        className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-lg animate-slideIn"
                        style={{ animationDelay: `${designIndex * 0.1}s` }}
                      >
                        {/* Design Header */}
                        <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                                <FiPackage className="text-white text-xl" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white">{design}</h3>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-300">Total</p>
                              <p className={`text-2xl font-bold ${
                                totalQuantity > 0 ? 'text-green-300' : 'text-red-300'
                              }`}>
                                {totalQuantity > 0 ? '+' : ''}{totalQuantity} units
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Pivot Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                                  Color
                                </th>
                                {sortedSizes.map((size) => (
                                  <th
                                    key={size}
                                    className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                                  >
                                    {size}
                                  </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {Object.entries(colorSizeMap).map(([color, sizes], idx) => {
                                const rowTotal = Object.values(sizes).reduce((sum, qty) => sum + qty, 0);
                                const isRowPositive = rowTotal > 0;
                                
                                return (
                                  <tr 
                                    key={idx} 
                                    className="hover:bg-blue-50 transition-colors duration-150"
                                  >
                                    {/* Color Column */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <div
                                          className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md hover:scale-110 transition-transform cursor-pointer"
                                          style={{ backgroundColor: getColorCode(color) || '#9CA3AF' }}
                                          title={color}
                                        />
                                      </div>
                                    </td>
                                    
                                    {/* Size Columns */}
                                    {sortedSizes.map((size) => {
                                      const qty = sizes[size] || 0;
                                      const isPositive = qty > 0;
                                      const isNegative = qty < 0;
                                      
                                      return (
                                        <td key={size} className="px-4 py-3 text-center">
                                          {qty !== 0 ? (
                                            <span
                                              className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                                                isPositive
                                                  ? 'bg-green-100 text-green-800'
                                                  : isNegative
                                                  ? 'bg-red-100 text-red-800'
                                                  : 'bg-gray-100 text-gray-400'
                                              }`}
                                            >
                                              {isPositive ? '+' : ''}{qty}
                                            </span>
                                          ) : (
                                            <span className="text-gray-300">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    
                                    {/* Row Total */}
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${
                                        isRowPositive 
                                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                      }`}>
                                        {isRowPositive ? '+' : ''}{rowTotal}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Grand Total Row */}
                              <tr className="bg-gradient-to-r from-blue-600 to-blue-500 font-bold">
                                <td className="px-4 py-3 text-center text-white">
                                  TOTAL
                                </td>
                                {sortedSizes.map((size) => {
                                  const sizeTotal = Object.values(colorSizeMap).reduce(
                                    (sum, colorSizes) => sum + (colorSizes[size] || 0), 
                                    0
                                  );
                                  return (
                                    <td key={size} className="px-4 py-3 text-center">
                                      <span className={`text-sm font-bold ${
                                        sizeTotal > 0 ? 'text-green-200' : sizeTotal < 0 ? 'text-red-200' : 'text-white'
                                      }`}>
                                        {sizeTotal !== 0 ? (sizeTotal > 0 ? '+' : '') + sizeTotal : '-'}
                                      </span>
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-lg font-bold ${
                                    totalQuantity > 0 ? 'text-green-200' : 'text-red-200'
                                  }`}>
                                    {totalQuantity > 0 ? '+' : ''}{totalQuantity}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-200 mb-6">
                    <FiPackage className="text-6xl text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-xl font-semibold">No allocation data available</p>
                  <p className="text-gray-400 text-sm mt-2">No changes recorded for this period</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">Legend:</span>
                  <span className="ml-3 inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">+</span>
                    Net Addition
                  </span>
                  <span className="ml-3 inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">-</span>
                    Net Reduction
                  </span>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default TransferHistory;
