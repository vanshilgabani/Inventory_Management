import React from 'react';

const GeneralSettings = ({ settings, onInputChange, onSave, saving }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure global business settings
        </p>
      </div>

      {/* GST Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h4 className="font-medium text-gray-900">Tax Configuration</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default GST Percentage (%)
            </label>
            <input
              type="number"
              value={settings.gstPercentage || 5}
              onChange={(e) => onInputChange('gstPercentage', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              min="0"
              max="100"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default tax rate for invoices and bills
            </p>
          </div>
        </div>
      </div>

      {/* Notification Settings Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Company-specific details (name, address, GSTIN, etc.) are now managed in the <strong>Companies</strong> tab.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default GeneralSettings;
