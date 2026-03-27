import { useState, useEffect } from 'react';
import { FiPackage, FiShoppingCart, FiInfo, FiZap, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Card from '../common/Card';
import {settingsService} from '../../services/settingsService';
import toast from 'react-hot-toast';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const InventoryModeSettings = () => {
  const [inventoryMode, setInventoryMode] = useState('reserved');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto allocation state
  const [autoConfig, setAutoConfig] = useState({
    enabled: false,
    periodDays: 7,
    newAccountInitialStock: 10,
    rateLimitMinutes: 60,
    directMode: true
  });
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    fetchInventoryMode();
  }, []);

  const fetchInventoryMode = async () => {
    try {
      const settings = await settingsService.getTenantSettings();
      console.log('Fetched settings:', settings); // DEBUG
      const inventoryMode = settings.data?.inventoryMode || settings.inventoryMode || 'reserved';
      console.log('Setting inventory mode to:', inventoryMode); // DEBUG
      setInventoryMode(inventoryMode);

      // Load auto allocation settings
      try {
        const res = await fetch(`${API}/settings/auto-allocation`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data) {
          setAutoConfig({
            enabled:                data.enabled                ?? false,
            periodDays:             data.periodDays             ?? 7,
            newAccountInitialStock: data.newAccountInitialStock ?? 10,
            rateLimitMinutes:       data.rateLimitMinutes       ?? 60,
            directMode:             data.directMode             ?? true
          });
        }
      } catch (_) { /* silent — don't block main settings load */ }

    } catch (error) {
      console.error('Failed to fetch inventory mode:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (mode) => {
    if (saving || mode === inventoryMode) return;
    
    setSaving(true);
    try {
      await settingsService.updateInventoryMode(mode);
      setInventoryMode(mode);
      toast.success(`Inventory mode updated to ${mode === 'main' ? 'Main Inventory' : 'Reserved Inventory'}`);
    } catch (error) {
      toast.error('Failed to update inventory mode');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoConfigSave = async () => {
  if (autoSaving) return;
  setAutoSaving(true);
  try {
    const res = await fetch(`${API}/settings/auto-allocation`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(autoConfig)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save');
    toast.success('Auto allocation settings saved');
  } catch (error) {
    toast.error(error.message || 'Failed to save auto allocation settings');
  } finally {
    setAutoSaving(false);
  }
};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory Mode Settings</h1>
        <p className="text-gray-500 mt-2">
          Configure which inventory to use for marketplace sales (Flipkart, Amazon, etc.)
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <FiInfo className="text-blue-600 mt-1 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">What is this setting?</p>
            <p>
              When you record a marketplace sale, the system needs to know which inventory to deduct from. 
              You can choose between <strong>Reserved Inventory</strong> (dedicated marketplace stock) 
              or <strong>Main Inventory</strong> (shared with wholesale orders).
            </p>
          </div>
        </div>
      </Card>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RESERVED INVENTORY OPTION */}
        <button
          onClick={() => handleModeChange('reserved')}
          disabled={saving}
          className={`
            text-left border-2 rounded-xl p-6 transition-all
            ${inventoryMode === 'reserved' 
              ? 'border-indigo-500 bg-indigo-50 shadow-lg' 
              : 'border-gray-300 hover:border-indigo-300 hover:shadow-md'
            }
            ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="space-y-4">
            {/* Radio Button + Icon */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${inventoryMode === 'reserved' 
                    ? 'border-indigo-500 bg-indigo-500' 
                    : 'border-gray-400'
                  }
                `}>
                  {inventoryMode === 'reserved' && (
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <FiShoppingCart className="text-indigo-600" size={24} />
                  <h3 className="text-lg font-bold text-gray-900">
                    Reserved Inventory
                  </h3>
                </div>
              </div>
              
              {inventoryMode === 'reserved' && (
                <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                  ACTIVE
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">
              Use a dedicated <strong>reserved stock pool</strong> for marketplace sales. 
              This keeps your marketplace inventory separate from wholesale orders.
            </p>

            {/* Benefits */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase">Benefits:</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Clear separation between wholesale and marketplace stock</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Prevents accidental overselling of wholesale orders</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Better tracking and inventory reports</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Recommended for businesses with both B2B and B2C sales</span>
                </div>
              </div>
            </div>

            {/* Use Case */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">Best for:</span> Businesses managing both wholesale orders and marketplace sales
              </p>
            </div>
          </div>
        </button>

        {/* MAIN INVENTORY OPTION */}
        <button
          onClick={() => handleModeChange('main')}
          disabled={saving}
          className={`
            text-left border-2 rounded-xl p-6 transition-all
            ${inventoryMode === 'main' 
              ? 'border-indigo-500 bg-indigo-50 shadow-lg' 
              : 'border-gray-300 hover:border-indigo-300 hover:shadow-md'
            }
            ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="space-y-4">
            {/* Radio Button + Icon */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${inventoryMode === 'main' 
                    ? 'border-indigo-500 bg-indigo-500' 
                    : 'border-gray-400'
                  }
                `}>
                  {inventoryMode === 'main' && (
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <FiPackage className="text-indigo-600" size={24} />
                  <h3 className="text-lg font-bold text-gray-900">
                    Main Inventory
                  </h3>
                </div>
              </div>
              
              {inventoryMode === 'main' && (
                <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                  ACTIVE
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">
              Use your <strong>main inventory pool</strong> directly for marketplace sales. 
              No need to maintain separate reserved stock.
            </p>

            {/* Benefits */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase">Benefits:</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Simpler inventory management (one stock pool)</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>No need to transfer stock to reserved inventory</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span>Easier for marketplace-only businesses</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-600 font-bold flex-shrink-0">⚠</span>
                  <span>Be careful not to oversell if you have wholesale orders</span>
                </div>
              </div>
            </div>

            {/* Use Case */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">Best for:</span> Marketplace-only businesses or those without wholesale operations
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Current Status Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Mode:</p>
            <p className="text-2xl font-bold text-indigo-900">
              {inventoryMode === 'main' ? '📦 Main Inventory' : '🛒 Reserved Inventory'}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Status:</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold text-green-700">Active</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Help Text */}
      <Card className="bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">💡 Need Help Deciding?</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Choose Reserved Inventory if:</strong> You sell both wholesale and marketplace, 
            want clear separation, and need better tracking.
          </p>
          <p>
            <strong>Choose Main Inventory if:</strong> You only sell on marketplaces, want simpler management, 
            and don't need separate stock pools.
          </p>
        </div>
      </Card>
      
      {/* ── Auto Allocation Settings ─────────────────────────────────────── */}
      <Card>
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <FiZap className="text-amber-500" size={22} />
          <h3 className="text-lg font-bold text-gray-900">Auto Allocation Settings</h3>
          {autoConfig.enabled && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full ml-1">
              ACTIVE
            </span>
          )}
        </div>

        <div className="space-y-5">

          {/* Enable / Disable toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Enable Auto Allocation</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically distribute reserved stock across accounts based on sales history
              </p>
            </div>
            <button
              onClick={() => setAutoConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="flex-shrink-0 ml-4"
            >
              {autoConfig.enabled
                ? <FiToggleRight className="text-amber-500 w-9 h-9" />
                : <FiToggleLeft  className="text-gray-400 w-9 h-9" />
              }
            </button>
          </div>

          {/* Fields — only shown when enabled */}
          {autoConfig.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Analysis Period */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Analysis Period (days)
                </label>
                <p className="text-xs text-gray-400">
                  How many past days of sales to use for share calculation
                </p>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={autoConfig.periodDays}
                  onChange={e => setAutoConfig(prev => ({ ...prev, periodDays: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                            focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* New Account Initial Stock */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  New Account Initial Stock
                </label>
                <p className="text-xs text-gray-400">
                  Units given to an account with zero sales history (first time only)
                </p>
                <input
                  type="number"
                  min={0}
                  value={autoConfig.newAccountInitialStock}
                  onChange={e => setAutoConfig(prev => ({ ...prev, newAccountInitialStock: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                            focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* Rate Limit */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Rate Limit (minutes)
                </label>
                <p className="text-xs text-gray-400">
                  Minimum gap between two auto-allocations for the same variant
                </p>
                <input
                  type="number"
                  min={1}
                  value={autoConfig.rateLimitMinutes}
                  onChange={e => setAutoConfig(prev => ({ ...prev, rateLimitMinutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                            focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* Direct Mode toggle */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Direct Mode
                </label>
                <p className="text-xs text-gray-400">
                  Run allocation immediately without any preview step
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setAutoConfig(prev => ({ ...prev, directMode: !prev.directMode }))}
                  >
                    {autoConfig.directMode
                      ? <FiToggleRight className="text-amber-500 w-8 h-8" />
                      : <FiToggleLeft  className="text-gray-400 w-8 h-8" />
                    }
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {autoConfig.directMode ? 'On — runs instantly' : 'Off'}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleAutoConfigSave}
              disabled={autoSaving}
              className={`px-6 py-2 rounded-lg text-white text-sm font-semibold transition-all
                ${autoSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 shadow-sm'
                }`}
            >
              {autoSaving ? 'Saving...' : 'Save Auto Allocation Settings'}
            </button>
          </div>

        </div>
      </Card>

      {/* Warning if mode is being saved */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span className="font-medium">Updating inventory mode...</span>
        </div>
      )}
    </div>
  );
};

export default InventoryModeSettings;
