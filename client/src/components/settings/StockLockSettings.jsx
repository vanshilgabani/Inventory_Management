// src/components/settings/StockLockSettings.jsx
import React from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import toast from 'react-hot-toast';

const StockLockSettings = ({ settings, handleInputChange, handleUpdateSettings, saving }) => {
  const enabled = settings.stockLockEnabled || false;
  const lockValue = settings.stockLockValue || 0;
  const maxThreshold = settings.maxStockLockThreshold || 0;
  const [distributing, setDistributing] = React.useState(false);

const handleDistribute = async () => {
  if (distributing) return;
  
  setDistributing(true);
  try {
    const token = localStorage.getItem('token');
    const thresholdValue = settings.maxStockLockThreshold || 0;
    
    if (thresholdValue <= 0) {
      toast.error('Please enter a threshold value greater than 0');
      setDistributing(false);
      return;
    }
    
    const response = await fetch('/api/settings/stock-lock/distribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ threshold: thresholdValue })
    });
    
    // ✅ FIXED: Check response before parsing JSON
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.message || 'Failed to distribute');
      setDistributing(false);
      return;
    }
    
    const data = await response.json();
    
    // ✅ FIXED: Access data directly (not data.data)
    toast.success(`✅ ${data.totalDistributed} units distributed across ${data.variantCount} variants!`);
    
    // Refresh settings
    if (typeof handleUpdateSettings === 'function') {
      handleUpdateSettings();
    } else {
      setTimeout(() => window.location.reload(), 1000);
    }
    
  } catch (error) {
    console.error('Distribution error:', error);
    toast.error('Failed to distribute stock lock');
  } finally {
    setDistributing(false);
  }
};

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          {enabled ? <FiLock className="text-blue-600" /> : <FiUnlock className="text-gray-400" />}
          <h3 className="text-lg font-semibold">Stock Lock Settings</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Reserve stock exclusively for marketplace sales. When enabled, this amount is deducted from
          available stock for wholesale and direct orders.
        </p>

        {/* Enable/Disable Toggle */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => handleInputChange('stockLockEnabled', e.target.checked)}
                className="sr-only"
              />
              <div
                className={`block w-14 h-8 rounded-full ${
                  enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                  enabled ? 'transform translate-x-6' : ''
                }`}
              ></div>
            </div>
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900">
                {enabled ? 'Stock Lock Enabled' : 'Stock Lock Disabled'}
              </span>
              <p className="text-xs text-gray-500">
                {enabled
                  ? 'Marketplace orders use locked stock first'
                  : 'Enable to reserve stock for marketplace sales'}
              </p>
            </div>
          </label>
        </div>

        {enabled && (
          <div className="space-y-4 border-t pt-4">
            {/* Current Lock Value (read-only) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Current Locked Stock</p>
                  <p className="text-xs text-gray-500">
                    Updated automatically with marketplace sales and lock adjustments
                  </p>
                </div>
                <div className="text-2xl font-bold text-blue-600">{lockValue}</div>
              </div>
            </div>

            {/* Max Threshold Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Lock Threshold
              </label>
              <input
                type="number"
                min="0"
                value={maxThreshold}
                onChange={(e) =>
                  handleInputChange(
                    'maxStockLockThreshold',
                    Number.isNaN(parseInt(e.target.value))
                      ? 0
                      : parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter maximum lock value"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum stock that can be reserved for marketplace. When creating orders, transfer
                amount cannot exceed this limit.
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">How it works:</h4>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Locked stock is reserved exclusively for marketplace orders.</li>
                <li>Wholesale and direct orders use only non-locked stock.</li>
                <li>Marketplace orders can transfer stock from available to locked up to the threshold.</li>
                <li>Lock value is adjusted when marketplace orders are created or reversed.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleUpdateSettings}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleDistribute}
          disabled={!enabled || distributing}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {distributing ? '🔄 Distributing...' : '🔄 Distribute Lock Now'}
        </button>
      </div>
    </div>
  );
};

export default StockLockSettings;
