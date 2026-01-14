// src/components/dashboard/SmartRecommendations.jsx

import React, { useMemo } from 'react';
import { FiPackage, FiDollarSign, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { formatCurrency } from '../../utils/dashboardCalculations';

const SmartRecommendations = ({ reorderData, pendingCollections, slowMovers, wholesaleOrders, directSales, products }) => {
  const { recommendations, summary } = reorderData;
  const criticalCollections = pendingCollections.filter(c => c.priority === '🔴');

  // ✅ CALCULATE TOP COLOR PERFORMANCE DYNAMICALLY
  const topColorPerformance = useMemo(() => {
    const colorSales = {};
    
    // Count sales by color from wholesale orders
    wholesaleOrders.forEach(order => {
      order.items?.forEach(item => {
        if (!colorSales[item.color]) {
          colorSales[item.color] = 0;
        }
        colorSales[item.color] += item.quantity;
      });
    });
    
    // Count sales by color from direct sales
    directSales.forEach(sale => {
      sale.items?.forEach(item => {
        if (!colorSales[item.color]) {
          colorSales[item.color] = 0;
        }
        colorSales[item.color] += item.quantity;
      });
    });
    
    // Sort colors by sales volume
    const sortedColors = Object.entries(colorSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 colors
    
    if (sortedColors.length === 0) return null;
    
    const totalSales = Object.values(colorSales).reduce((sum, val) => sum + val, 0);
    const topColorNames = sortedColors.map(([color]) => color).join(', ');
    const topColorPercentage = totalSales > 0 
      ? ((sortedColors.reduce((sum, [_, qty]) => sum + qty, 0) / totalSales) * 100).toFixed(0)
      : 0;
    
    return { topColorNames, topColorPercentage };
  }, [wholesaleOrders, directSales]);

  // ✅ CALCULATE TOP SIZE PERFORMANCE DYNAMICALLY
  const topSizePerformance = useMemo(() => {
    const sizeSales = {};
    
    // Count sales by size from wholesale orders
    wholesaleOrders.forEach(order => {
      order.items?.forEach(item => {
        if (!sizeSales[item.size]) {
          sizeSales[item.size] = 0;
        }
        sizeSales[item.size] += item.quantity;
      });
    });
    
    // Count sales by size from direct sales
    directSales.forEach(sale => {
      sale.items?.forEach(item => {
        if (!sizeSales[item.size]) {
          sizeSales[item.size] = 0;
        }
        sizeSales[item.size] += item.quantity;
      });
    });
    
    // Sort sizes by sales volume
    const sortedSizes = Object.entries(sizeSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2); // Top 2 sizes
    
    if (sortedSizes.length === 0) return null;
    
    const totalSales = Object.values(sizeSales).reduce((sum, val) => sum + val, 0);
    const topSizeNames = sortedSizes.map(([size]) => size).join(' and ');
    const topSizePercentage = totalSales > 0 
      ? ((sortedSizes.reduce((sum, [_, qty]) => sum + qty, 0) / totalSales) * 100).toFixed(0)
      : 0;
    
    return { topSizeNames, topSizePercentage };
  }, [wholesaleOrders, directSales]);

  // ✅ CALCULATE DISCOUNT PERCENTAGE DYNAMICALLY
  const recommendedDiscount = useMemo(() => {
    if (slowMovers.length === 0) return 0;
    
    // Calculate average time items have been in stock without sales
    const avgMonthsInStock = slowMovers.reduce((sum, item) => {
      // Estimate months based on current stock (rough estimate)
      return sum + (item.currentStock / 10); // Assume 10 units per month turnover
    }, 0) / slowMovers.length;
    
    // Higher discount for longer stagnation
    if (avgMonthsInStock > 6) return 20;
    if (avgMonthsInStock > 3) return 15;
    if (avgMonthsInStock > 1) return 10;
    return 5;
  }, [slowMovers]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          💡 Smart Recommendations
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Based on Wholesale + Direct Sales Data
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* REORDER PRIORITIES */}
        {recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FiPackage className="text-blue-600 text-xl" />
              <h3 className="text-base font-semibold text-gray-900">URGENT REORDER PRIORITIES</h3>
            </div>

            <div className="space-y-4">
              {recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">
                          {idx + 1}. {rec.design}-{rec.color}/{rec.size}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          rec.urgency === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          rec.urgency === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {rec.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{rec.reason}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-500">Current Stock</p>
                      <p className="text-sm font-semibold text-gray-900">{rec.currentStock} units</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-500">Avg Demand</p>
                      <p className="text-sm font-semibold text-gray-900">{rec.avgPerMonth}/month ({rec.avgPerDay}/day)</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-xs text-blue-700 font-medium">Recommended Qty</p>
                      <p className="text-sm font-bold text-blue-900">{rec.recommendedQty} units</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-xs text-blue-700 font-medium">Investment</p>
                      <p className="text-sm font-bold text-blue-900">{formatCurrency(rec.estimatedCost)}</p>
                    </div>
                  </div>

                  {/* Stock Duration */}
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⏱️</span>
                        <span className="text-sm font-semibold text-green-900">Stock Duration</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-900">
                          {rec.daysWillLast === 999 ? '∞' : rec.daysWillLast} days
                        </p>
                        <p className="text-xs text-green-700">
                          (~{rec.monthsWillLast === '∞' ? '∞' : rec.monthsWillLast} months supply)
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-green-800 mt-2">
                      💡 This reorder will last approximately <strong>{rec.daysWillLast === 999 ? 'indefinitely' : `${rec.daysWillLast} days`}</strong> based on current W+D sales velocity
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-blue-700 font-medium">Total Variants</p>
                  <p className="text-lg font-bold text-blue-900">{summary.totalVariants}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium">Total Units</p>
                  <p className="text-lg font-bold text-blue-900">{summary.totalQty}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium">Investment</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(summary.totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium">Expected ROI</p>
                  <p className="text-lg font-bold text-green-600">+{summary.expectedROI}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200"></div>

        {/* FINANCIAL ACTIONS */}
        {criticalCollections.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FiDollarSign className="text-green-600 text-xl" />
              <h3 className="text-base font-semibold text-gray-900">FINANCIAL ACTIONS</h3>
            </div>

            <div className="space-y-2">
              {criticalCollections.slice(0, 3).map((collection, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-2xl">📞</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Follow up with {collection.buyerName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(collection.amount)} • {collection.daysOverdue} days overdue
                      {collection.type === 'bill' && ` • Bill #${collection.billNumber}`}
                    </p>
                  </div>
                  <span className="text-lg">{collection.priority}</span>
                </div>
              ))}

              {pendingCollections.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-900">
                    <strong>Total Outstanding:</strong> {formatCurrency(pendingCollections.reduce((sum, c) => sum + c.amount, 0))} from {pendingCollections.length} buyers
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200"></div>

        {/* INVENTORY OPTIMIZATION */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="text-purple-600 text-xl" />
            <h3 className="text-base font-semibold text-gray-900">INVENTORY OPTIMIZATION</h3>
          </div>

          <div className="space-y-2">
            {/* Slow Movers Discount */}
            {slowMovers.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-2xl">🏷️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Discount slow-moving items ({recommendedDiscount}% recommended)
                  </p>
                  <p className="text-xs text-gray-600">
                    {slowMovers.length} variants with 0 sales in last 30 days • {slowMovers.reduce((sum, s) => sum + s.currentStock, 0)} units blocking inventory
                  </p>
                </div>
              </div>
            )}

            {/* Top Colors */}
            {topColorPerformance && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-2xl">🎨</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Focus on high-velocity colors
                  </p>
                  <p className="text-xs text-gray-600">
                    {topColorPerformance.topColorNames} showing {topColorPerformance.topColorPercentage}% of total demand
                  </p>
                </div>
              </div>
            )}

            {/* Top Sizes */}
            {topSizePerformance && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-2xl">📏</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Prioritize {topSizePerformance.topSizeNames} sizes
                  </p>
                  <p className="text-xs text-gray-600">
                    These sizes account for {topSizePerformance.topSizePercentage}% of W+D sales volume
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View All Actions Button */}
        <div className="pt-4 border-t border-gray-200">
          <button className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2">
            <FiAlertCircle />
            View All Recommended Actions
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartRecommendations;
