import React from 'react';
import { FiLock } from 'react-icons/fi';

const PermissionsSettings = ({ settings, handleNestedChange, handleUpdateSettings, saving }) => {
  const allowSalesEdit = settings.permissions?.allowSalesEdit || false;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiLock className="text-blue-600" />
          <h3 className="text-lg font-semibold">User Permissions</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Control what sales users can do across the system (does not affect admins)
        </p>

        {/* Sales Edit Permission */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">Allow Sales Users to Edit/Delete</h4>
              <p className="text-sm text-gray-600 mb-2">
                When <strong>enabled</strong>: Sales users can edit/delete marketplace sales, wholesale orders, 
                direct sales, factory receivings, and inventory.
              </p>
              <p className="text-sm text-gray-600">
                When <strong>disabled</strong>: Sales users can only <strong>view and create</strong> records. 
                Only admins can edit/delete.
              </p>
            </div>
            <div className="ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowSalesEdit}
                  onChange={(e) => handleNestedChange('permissions', 'allowSalesEdit', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-4 py-3 rounded-md ${allowSalesEdit ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm font-medium">
              {allowSalesEdit ? '✅ Sales users CAN edit and delete records' : '🔒 Sales users CANNOT edit or delete records (read-only + create)'}
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

export default PermissionsSettings;
