// src/components/dashboard/DesignPerformanceTable.jsx

import React, { useState, useMemo } from 'react';
import { FiDownload, FiTrendingUp, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { formatCurrency } from '../../utils/dashboardCalculations';

const DesignPerformanceTable = ({ performanceData, dateFilter, onDateFilterChange, onExport }) => {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState('sold'); // sold, revenue, design
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedData = useMemo(() => {
    const data = [...performanceData];
    data.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'sold') {
        comparison = b.sold - a.sold;
      } else if (sortBy === 'revenue') {
        comparison = b.revenue - a.revenue;
      } else if (sortBy === 'design') {
        comparison = a.design.localeCompare(b.design);
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });
    return data;
  }, [performanceData, sortBy, sortOrder]);

  const displayData = expanded ? sortedData : sortedData.slice(0, 10);
  const slowMovers = sortedData.filter(item => item.sold === 0 && item.currentStock > 0);
  
  const totalSales = sortedData.reduce((sum, item) => sum + item.sold, 0);
  const totalRevenue = sortedData.reduce((sum, item) => sum + item.revenue, 0);

  // ✅ CALCULATE RECOMMENDED DISCOUNT DYNAMICALLY
  const recommendedDiscount = useMemo(() => {
    if (slowMovers.length === 0) return 0;
    
    const totalSlowStock = slowMovers.reduce((sum, item) => sum + item.currentStock, 0);
    const avgSlowStock = totalSlowStock / slowMovers.length;
    
    // Discount based on severity
    if (avgSlowStock > 50) return 20; // Heavy stock = higher discount
    if (avgSlowStock > 30) return 15;
    if (avgSlowStock > 15) return 12;
    if (avgSlowStock > 5) return 10;
    return 8;
  }, [slowMovers]);

  // ✅ CALCULATE TOTAL BLOCKED INVENTORY VALUE
  const blockedInventoryValue = useMemo(() => {
    return slowMovers.reduce((sum, item) => {
      // Find product to get wholesale price
      const estimatedPrice = 400; // Fallback average
      return sum + (item.currentStock * estimatedPrice);
    }, 0);
  }, [slowMovers]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getVelocityBar = (sold) => {
    const maxSold = Math.max(...performanceData.map(item => item.sold));
    const percentage = maxSold > 0 ? (sold / maxSold) * 100 : 0;

    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              percentage > 80 ? 'bg-red-500' :
              percentage > 50 ? 'bg-orange-500' :
              percentage > 20 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiTrendingUp className="text-blue-600" />
              📈 Design Performance
            </h2>
            <p className="text-sm text-gray-500 mt-1">Wholesale + Direct Sales Only</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <FiDownload />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Total Sales</p>
            <p className="text-lg font-bold text-gray-900">{totalSales} units</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Total Revenue</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Active Variants</p>
            <p className="text-lg font-bold text-gray-900">{performanceData.filter(i => i.sold > 0).length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Slow Movers</p>
            <p className="text-lg font-bold text-orange-600">{slowMovers.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th 
                onClick={() => handleSort('design')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
              >
                Design {sortBy === 'design' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Color</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Size</th>
              <th 
                onClick={() => handleSort('sold')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
              >
                Sold {sortBy === 'sold' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                onClick={() => handleSort('revenue')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
              >
                Revenue {sortBy === 'revenue' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Velocity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayData.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.design}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.color}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.size}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.sold}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.revenue)}</td>
                <td className="px-4 py-3 text-sm">{getVelocityBar(item.sold)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-lg">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand Button */}
      {performanceData.length > 10 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            {expanded ? (
              <>
                Show Top 10 Only <FiChevronUp />
              </>
            ) : (
              <>
                Show All {performanceData.length} Variants <FiChevronDown />
              </>
            )}
          </button>
        </div>
      )}

      {/* Slow Movers */}
      {slowMovers.length > 0 && (
        <div className="px-6 py-4 bg-orange-50 border-t border-orange-200">
          <h3 className="text-sm font-semibold text-orange-900 mb-2">
            🐌 Slow Movers ({slowMovers.length} variants with 0 sales)
          </h3>
          <div className="space-y-1">
            {slowMovers.slice(0, 3).map((item, idx) => (
              <p key={idx} className="text-sm text-orange-800">
                • {item.design}-{item.color}/{item.size}: {item.currentStock} units in stock
              </p>
            ))}
            {slowMovers.length > 3 && (
              <p className="text-sm text-orange-700 italic">
                ... +{slowMovers.length - 3} more
              </p>
            )}
          </div>
          <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded">
            <p className="text-sm text-orange-900">
              <strong>💡 Action:</strong> Discount {recommendedDiscount}% recommended to clear dead stock
            </p>
            <p className="text-xs text-orange-800 mt-1">
              Blocked Inventory Value: {formatCurrency(blockedInventoryValue)} • {slowMovers.reduce((sum, s) => sum + s.currentStock, 0)} units
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignPerformanceTable;
