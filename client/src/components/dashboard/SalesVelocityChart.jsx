// src/components/dashboard/SalesVelocityChart.jsx

import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/dashboardCalculations';

const SalesVelocityChart = ({ velocityData, dateFilter, onDateFilterChange }) => {
  const { last7Days, avgDaily, forecast, wholesalePercentage, directPercentage, wholesaleUnits, directUnits } = velocityData;

  const maxUnits = Math.max(...last7Days.map(day => day.units));
  const isToday = (date) => format(new Date(), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🔥 Sales Velocity
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Wholesale + Direct Sales Only
            </p>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Daily Breakdown:</h3>
          
          <div className="space-y-3">
            {last7Days.map((day, idx) => {
              const percentage = maxUnits > 0 ? (day.units / maxUnits) * 100 : 0;
              const isPeak = day.units === maxUnits;
              const today = isToday(day.date);
              
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700">
                    {day.dayName}, {format(day.date, 'MMM d')}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div 
                        className={`h-full rounded-lg transition-all ${
                          isPeak ? 'bg-gradient-to-r from-red-500 to-red-600' :
                          percentage > 70 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                          percentage > 40 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                          'bg-gradient-to-r from-green-500 to-green-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-24 text-sm font-semibold text-gray-900">
                      {day.units} units
                    </div>
                    <div className="w-20 text-xs">
                      {isPeak && <span className="text-red-600 font-semibold">(Peak)</span>}
                      {today && <span className="text-blue-600 font-semibold">(Today)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Average</p>
            <p className="text-lg font-bold text-gray-900">{avgDaily} units/day</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Best Day</p>
            <p className="text-lg font-bold text-gray-900">
              {last7Days.find(d => d.units === maxUnits)?.dayName || 'N/A'} ({maxUnits}u)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Trend</p>
            <p className="text-lg font-bold text-green-600 flex items-center gap-1">
              <FiTrendingUp /> Consistent Growth
            </p>
          </div>
        </div>

        {/* Forecast */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📈 7-Day Forecast (W+D):</h3>
          <div className="space-y-2">
            <p className="text-sm text-blue-800">
              <strong>Expected Sales:</strong> ~{forecast} units ({formatCurrency(forecast * 500)})
            </p>
            <p className="text-sm text-blue-800">
              <strong>Recommended Buffer:</strong> {Math.round(forecast * 1.5)} units to maintain healthy stock
            </p>
          </div>
        </div>

        {/* Channel Split */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Channel Split:</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">🟪 Wholesale</span>
                <span className="text-sm font-semibold text-gray-900">{wholesalePercentage}% ({wholesaleUnits} units)</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${wholesalePercentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">🟠 Direct Sales</span>
                <span className="text-sm font-semibold text-gray-900">{directPercentage}% ({directUnits} units)</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${directPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesVelocityChart;
