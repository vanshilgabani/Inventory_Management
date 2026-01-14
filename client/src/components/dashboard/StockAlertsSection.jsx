// src/components/dashboard/StockAlertsSection.jsx

import React, { useState, useMemo } from 'react';
import { FiAlertTriangle, FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { format } from 'date-fns';
import { timeAgo, formatCurrency } from '../../utils/dashboardCalculations';

const StockAlertsSection = ({ outOfStock, lowStock, onExportOutOfStock, onExportLowStock, onRefresh }) => {
  const [expandedOut, setExpandedOut] = useState(false);
  const [expandedLow, setExpandedLow] = useState(false);

  const displayOutOfStock = expandedOut ? outOfStock : outOfStock.slice(0, 5);
  const displayLowStock = expandedLow ? lowStock : lowStock.slice(0, 5);

  // ✅ CALCULATE REVENUE LOSS IMPACT DYNAMICALLY
  const calculateLossImpact = (items) => {
    return items.reduce((sum, item) => {
      // Estimated revenue loss = monthly demand × wholesale price × markup (1.5x)
      return sum + (item.avgPerMonth * item.wholesalePrice * 1.5);
    }, 0);
  };

  const totalLoss = useMemo(() => calculateLossImpact(outOfStock), [outOfStock]);

  // ✅ CALCULATE RECOMMENDED INVESTMENT DYNAMICALLY
  const recommendedInvestment = useMemo(() => {
    return outOfStock.reduce((sum, item) => {
      const qty = Math.ceil(item.avgPerMonth * 1.5); // 1.5 months buffer
      return sum + (qty * item.wholesalePrice);
    }, 0);
  }, [outOfStock]);

  // ✅ CALCULATE RECOMMENDED UNITS DYNAMICALLY
  const recommendedUnits = useMemo(() => {
    return outOfStock.slice(0, 5).reduce((sum, item) => {
      return sum + Math.ceil(item.avgPerMonth * 1.5);
    }, 0);
  }, [outOfStock]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiAlertTriangle className="text-red-500" />
              🚨 Critical Alerts • Immediate Action Required
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              ⓘ Demand Analysis: Wholesale + Direct Sales Only
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* OUT OF STOCK */}
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-red-900 flex items-center gap-2">
                  🔴 OUT OF STOCK ({outOfStock.length} variants)
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Impact: <strong>HIGH</strong> • Estimated Revenue Loss: <strong>{formatCurrency(totalLoss)}/month</strong>
                </p>
              </div>
            </div>
          </div>

          {outOfStock.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Design</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Color</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Last Sold</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">W+D Avg/Mo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayOutOfStock.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.design}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.color}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.size}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.lastSold ? timeAgo(item.lastSold) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.avgPerMonth} units</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center gap-1 ${
                            item.priority === '🔥🔥' ? 'text-red-600 font-bold' :
                            item.priority === '🔥' ? 'text-orange-600 font-semibold' :
                            'text-yellow-600'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {outOfStock.length > 5 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => setExpandedOut(!expandedOut)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    {expandedOut ? (
                      <>Show Less <FiChevronUp /></>
                    ) : (
                      <>Show All {outOfStock.length} Variants <FiChevronDown /></>
                    )}
                  </button>
                </div>
              )}

              <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>💡 Recommendation:</strong> Order <strong>{recommendedUnits}+ units</strong> urgently • 
                  Est. Investment: <strong>{formatCurrency(recommendedInvestment)}</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">✅ No out of stock items</p>
            </div>
          )}
        </div>

        {/* LOW STOCK */}
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
            <h3 className="text-base font-semibold text-yellow-900 flex items-center gap-2">
              🟡 LOW STOCK ({lowStock.length} variants) - Below Reorder Point
            </h3>
          </div>

          {lowStock.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Design</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Color</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Current</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Min</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Days Left</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayLowStock.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.design}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.color}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.size}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.currentStock}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.reorderPoint}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">~{item.daysLeft} days</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            item.daysLeft <= 1 ? 'bg-red-100 text-red-800' :
                            item.daysLeft <= 3 ? 'bg-orange-100 text-orange-800' :
                            item.daysLeft <= 5 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.daysLeft <= 1 ? '🔴 Critical' :
                             item.daysLeft <= 3 ? '🟠 Urgent' :
                             item.daysLeft <= 5 ? '🟡 High' :
                             '🟢 Normal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {lowStock.length > 5 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => setExpandedLow(!expandedLow)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    {expandedLow ? (
                      <>Show Less <FiChevronUp /></>
                    ) : (
                      <>Show All {lowStock.length} Variants <FiChevronDown /></>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">✅ All stock levels healthy</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {(outOfStock.length > 0 || lowStock.length > 0) && (
          <div className="flex flex-wrap gap-3 pt-2">
            {outOfStock.length > 0 && (
              <button
                onClick={onExportOutOfStock}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <FiDownload />
                Export Out of Stock CSV
              </button>
            )}
            {lowStock.length > 0 && (
              <button
                onClick={onExportLowStock}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
              >
                <FiDownload />
                Export Low Stock CSV
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAlertsSection;
