import React from 'react';
import { FiBell } from 'react-icons/fi';

const StockThresholds = ({ settings, handleInputChange, handleNestedChange, handleUpdateSettings, saving }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiBell className="text-blue-600" />
          <h3 className="text-lg font-semibold">Stock Threshold Settings</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Global Low Stock Threshold
            </label>
            <input
              type="number"
              min="0"
              value={settings.stockThresholds?.globalThreshold || 0}
              onChange={(e) => handleNestedChange('stockThresholds', 'globalThreshold', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Alert when stock falls below this quantity
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleUpdateSettings}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default StockThresholds;
