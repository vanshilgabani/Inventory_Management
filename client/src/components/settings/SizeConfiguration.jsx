import React, { useState, useEffect } from 'react';
import { FiPackage, FiPlus, FiX, FiRefreshCw } from 'react-icons/fi';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';

const SizeConfiguration = ({ saving }) => {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [addingSize, setAddingSize] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [syncing, setSyncing] = useState(false);  // ✅ NEW

  useEffect(() => {
    fetchSizes();
  }, []);

  const fetchSizes = async () => {
    try {
      setLoading(true);
      const allSizes = await settingsService.getAllSizes();
      setSizes(allSizes);
    } catch (error) {
      console.error('Failed to fetch sizes:', error);
      toast.error('Failed to load sizes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSize = async (e) => {
    e.preventDefault();
    
    if (!newSizeName.trim()) {
      toast.error('Please enter a size name');
      return;
    }

    setAddingSize(true);
    
    try {
      const result = await settingsService.addSize(newSizeName.trim());
      
      // ✅ Show sync stats if available
      if (result.syncStats) {
        toast.success(
          `Size "${result.size.name}" added and synced to ${result.syncStats.productsUpdated} products!`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Size "${result.size.name}" added successfully!`);
      }
      
      setNewSizeName('');
      setShowAddModal(false);
      
      // Refresh sizes list
      await fetchSizes();
    } catch (error) {
      toast.error(error.message || 'Failed to add size');
    } finally {
      setAddingSize(false);
    }
  };

  const handleToggleSize = async (sizeName, currentlyEnabled) => {
    setToggling(sizeName);
    
    try {
      const result = await settingsService.toggleSize(sizeName, !currentlyEnabled);
      
      // ✅ Show sync stats if available
      let message = result.message;
      if (result.syncStats && result.syncStats.productsUpdated > 0) {
        message += ` (${result.syncStats.sizesAdded} size entries added)`;
      }
      
      toast.success(message, { duration: 4000 });
      
      if (result.warning) {
        toast(result.warning, { 
          icon: '⚠️',
          duration: 6000,
          style: {
            background: '#fef3c7',
            color: '#92400e'
          }
        });
      }
      
      // Refresh sizes list
      await fetchSizes();
    } catch (error) {
      toast.error(error.message || 'Failed to toggle size');
    } finally {
      setToggling(null);
    }
  };

  // ✅ NEW: Manual sync handler
  const handleSyncProducts = async () => {
    if (!window.confirm(
      'This will sync all products with current size configuration.\n\n' +
      'Missing sizes will be added to existing products.\n\n' +
      'Continue?'
    )) {
      return;
    }

    setSyncing(true);
    
    try {
      const result = await settingsService.syncProductsWithSizes();
      
      if (result.success) {
        toast.success(
          `✅ Synced ${result.stats.productsUpdated}/${result.stats.totalProducts} products!\n` +
          `Added ${result.stats.sizesAdded} size entries.`,
          { duration: 6000 }
        );
      } else {
        toast.error(result.message || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <FiPackage className="text-indigo-600 mr-3" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Size Configuration</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading sizes...</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FiPackage className="text-indigo-600 mr-3" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Size Configuration</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage product sizes - Add new sizes or enable/disable existing ones
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* ✅ NEW: Sync Products Button */}
            <button
              onClick={handleSyncProducts}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync all products with current size configuration"
            >
              {syncing ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Syncing...
                </>
              ) : (
                <>
                  <FiRefreshCw className="mr-2" />
                  Sync Products
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <FiPlus className="mr-2" />
              Add New Size
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>✨ Auto-Sync Enabled:</strong> When you add or enable a size, it's automatically added to all existing products.
            Use "Sync Products" to manually ensure all products have current sizes.
          </p>
        </div>

        {/* Sizes List */}
        <div className="space-y-3">
          {sizes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sizes configured. Click "Add New Size" to get started.
            </div>
          ) : (
            sizes.map((size) => (
              <div
                key={size.name}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                  size.isEnabled
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-4">
                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleSize(size.name, size.isEnabled)}
                    disabled={toggling === size.name}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      size.isEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                    } ${toggling === size.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        size.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Size Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-lg font-semibold ${
                        size.isEnabled ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {size.name}
                      </span>
                      {!size.isEnabled && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {size.isEnabled ? 'Active in system' : 'Hidden from new entries'}
                    </p>
                  </div>
                </div>

                {/* Display Order Badge */}
                <div className="text-sm text-gray-500">
                  Order: {size.displayOrder}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {sizes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Total Sizes: <strong>{sizes.length}</strong></span>
              <span>Enabled: <strong className="text-green-600">{sizes.filter(s => s.isEnabled).length}</strong></span>
              <span>Disabled: <strong className="text-gray-500">{sizes.filter(s => !s.isEnabled).length}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Add Size Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Size</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewSizeName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSize}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Name
                </label>
                <input
                  type="text"
                  value={newSizeName}
                  onChange={(e) => setNewSizeName(e.target.value)}
                  placeholder="e.g., 3XL, XS, 4XL"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max 10 characters, letters and numbers only
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                <p className="text-sm text-green-800">
                  <strong>✨ Auto-Sync:</strong> This size will be automatically added to all existing products.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSizeName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  disabled={addingSize}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={addingSize || !newSizeName.trim()}
                >
                  {addingSize ? 'Adding & Syncing...' : 'Add Size'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SizeConfiguration;
