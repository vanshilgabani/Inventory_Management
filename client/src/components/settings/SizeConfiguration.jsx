// src/components/settings/SizeConfiguration.jsx
import React from 'react';
import { FiPackage } from 'react-icons/fi';

const SizeConfiguration = ({ settings, handleSizeToggle, handleUpdateSettings, saving }) => {
  // Match useEnabledSizes + your actual sizes
  const allSizes = ['S', 'M', 'L', 'XL', 'XXL'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiPackage className="text-blue-600" />
          <h3 className="text-lg font-semibold">Available Sizes</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select which sizes you want to use in your inventory
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {allSizes.map(size => (
            <label
              key={size}
              className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={settings.enabledSizes?.includes(size)}
                onChange={() => handleSizeToggle(size)}
                className="mr-2"
              />
              <span className="font-medium">Size {size}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-500 bg-yellow-50 p-3 rounded border border-yellow-200">
          <strong>Note:</strong> Disabling a size will hide it from new product entries but won't affect existing inventory.
        </p>
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

export default SizeConfiguration;
