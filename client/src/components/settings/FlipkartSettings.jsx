import { useState, useEffect, useMemo } from 'react';
import { flipkartService } from '../../services/flipkartService';
import { inventoryService } from '../../services/inventoryService';
import { settingsService } from '../../services/settingsService';
import { useEnabledSizes } from '../../hooks/useEnabledSizes';
import toast from 'react-hot-toast';
import {
  FiCheck,
  FiX,
  FiRefreshCw,
  FiClock,
  FiPackage,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiEdit2,
  FiSave,
  FiSearch
} from 'react-icons/fi';
import Card from '../common/Card';

const FlipkartSettings = () => {
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [inventoryMode, setInventoryMode] = useState('main');

  // ✅ NEW: Account management
  const [marketplaceAccounts, setMarketplaceAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [currentAccountConfig, setCurrentAccountConfig] = useState({
    enabled: false,
    appId: '',
    appSecret: '',
    locationId: '',
    syncTime: '14:00',
    syncFrequency: 'daily',
    secondSyncTime: '20:00',
    autoSyncEnabled: false
  });

  const [credentials, setCredentials] = useState({
    appId: '',
    appSecret: '',
    locationId: ''
  });

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Variant management
  const [allVariants, setAllVariants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingVariant, setEditingVariant] = useState(null);
  const [editingFSN, setEditingFSN] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchInventoryMode();
  }, []);

  // ✅ NEW: Load account config when selectedAccountId changes
  useEffect(() => {
    if (selectedAccountId && marketplaceAccounts.length > 0) {
      loadAccountConfig(selectedAccountId);
    }
  }, [selectedAccountId, marketplaceAccounts]);

  const fetchInventoryMode = async () => {
    try {
      const { inventoryMode } = await settingsService.getTenantSettings();
      setInventoryMode(inventoryMode || 'main');
    } catch (error) {
      console.error('Failed to fetch inventory mode:', error);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSettings();
      
      // ✅ Get active marketplace accounts
      const activeAccounts = data.marketplaceAccounts?.filter(acc => acc.isActive) || [];
      setMarketplaceAccounts(activeAccounts);

      // ✅ Auto-select first active account
      if (activeAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(activeAccounts[0]._id);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Load config for selected account
  const loadAccountConfig = (accountId) => {
    const account = marketplaceAccounts.find(acc => acc._id === accountId);
    if (!account) return;

    const flipkartConfig = account.flipkart || {};
    
    setCurrentAccountConfig({
      enabled: flipkartConfig.enabled || false,
      appId: flipkartConfig.appId || '',
      appSecret: flipkartConfig.appSecret || '',
      locationId: flipkartConfig.locationId || '',
      syncTime: flipkartConfig.syncTime || '14:00',
      syncFrequency: flipkartConfig.syncFrequency || 'daily',
      secondSyncTime: flipkartConfig.secondSyncTime || '20:00',
      autoSyncEnabled: flipkartConfig.autoSyncEnabled || false
    });

    // Reset credentials (for security, don't pre-fill secrets)
    setCredentials({
      appId: '',
      appSecret: '',
      locationId: flipkartConfig.locationId || ''
    });
  };

  const fetchProducts = async () => {
    if (!selectedAccountId) {
      toast.error('Please select a marketplace account first');
      return;
    }

    setProductsLoading(true);
    try {
      const fullProducts = await inventoryService.getAllProducts();
      setProducts(Array.isArray(fullProducts) ? fullProducts : fullProducts?.products || []);

      const selectedAccount = marketplaceAccounts.find(acc => acc._id === selectedAccountId);
      const accountName = selectedAccount?.accountName;

      // ✅ Transform into variants with account-specific FSN
      const variants = [];
      fullProducts.forEach(product => {
        product.colors?.forEach(color => {
          color.sizes?.forEach(size => {
            if (!enabledSizes.includes(size.size)) return;

            // ✅ Find FSN for THIS account
            const accountMapping = product.flipkart?.accountMappings?.find(
              am => am.accountId === selectedAccountId
            );
            const variantMapping = accountMapping?.variantMappings?.find(
              m => m.color === color.color && m.size === size.size
            );

            // ✅ Find allocated stock for THIS account
            const allocation = size.reservedAllocations?.find(
              a => a.accountName === accountName
            );

            variants.push({
              productId: product._id,
              design: product.design,
              color: color.color,
              size: size.size,
              stock: inventoryMode === 'reserved' 
                ? (allocation?.quantity || 0)
                : (size.currentStock || 0),
              enabled: accountMapping?.enabled || false,
              fsn: variantMapping?.fsn || '',
              flipkartSKU: variantMapping?.flipkartSKU || '',
              lastSynced: accountMapping?.lastSyncedAt || null,
              syncStatus: accountMapping?.lastSyncStatus || null
            });
          });
        });
      });

      setAllVariants(variants);
      toast.success(`Loaded ${variants.length} variants for ${accountName}`);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!credentials.appId || !credentials.appSecret) {
      toast.error('Please enter App ID and App Secret');
      return;
    }

    setTesting(true);
    try {
      const result = await flipkartService.testCredentials(
        credentials.appId,
        credentials.appSecret
      );
      if (result.success) {
        toast.success('✅ Credentials are valid!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid credentials');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedAccountId) {
      toast.error('Please select a marketplace account');
      return;
    }

    if (currentAccountConfig.enabled) {
      // Check if credentials exist or are being provided
      const hasExistingCreds = currentAccountConfig.appId && currentAccountConfig.appSecret;
      const hasNewCreds = credentials.appId && credentials.appSecret;
      
      if (!hasExistingCreds && !hasNewCreds) {
        toast.error('App ID and App Secret are required');
        return;
      }
      if (!credentials.locationId && !currentAccountConfig.locationId) {
        toast.error('Location ID is required');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        enabled: currentAccountConfig.enabled,
        autoSyncEnabled: currentAccountConfig.autoSyncEnabled,
        syncTime: currentAccountConfig.syncTime,
        syncFrequency: currentAccountConfig.syncFrequency,
        secondSyncTime: currentAccountConfig.secondSyncTime,
        locationId: credentials.locationId || currentAccountConfig.locationId
      };

      // Only send credentials if they're filled
      if (credentials.appId) payload.appId = credentials.appId;
      if (credentials.appSecret) payload.appSecret = credentials.appSecret;

      await settingsService.updateAccountFlipkart(selectedAccountId, payload);
      
      toast.success('Settings saved successfully! 🎉');
      
      // Refresh settings
      await fetchSettings();
      
      // Clear credential fields
      setCredentials({
        appId: '',
        appSecret: '',
        locationId: credentials.locationId
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVariantSync = async (variant) => {
    try {
      // Update product's account mapping
      const product = products.find(p => p._id === variant.productId);
      let accountMappings = product.flipkart?.accountMappings || [];
      
      const mappingIndex = accountMappings.findIndex(am => am.accountId === selectedAccountId);
      
      if (mappingIndex >= 0) {
        accountMappings[mappingIndex].enabled = !variant.enabled;
      } else {
        const selectedAccount = marketplaceAccounts.find(acc => acc._id === selectedAccountId);
        accountMappings.push({
          accountId: selectedAccountId,
          accountName: selectedAccount.accountName,
          enabled: true,
          variantMappings: []
        });
      }

      await flipkartService.updateProductMapping(variant.productId, {
        accountMappings
      });

      setAllVariants(prev => prev.map(v =>
        v.productId === variant.productId &&
        v.color === variant.color &&
        v.size === variant.size
          ? { ...v, enabled: !variant.enabled }
          : v
      ));

      toast.success('Variant sync status updated');
    } catch (error) {
      toast.error('Failed to update variant');
    }
  };

  const handleEditFSN = (variant) => {
    setEditingVariant({
      productId: variant.productId,
      design: variant.design,
      color: variant.color,
      size: variant.size
    });
    setEditingFSN(variant.fsn || '');
  };

  const handleSaveFSN = async () => {
    if (!editingFSN.trim()) {
      toast.error('FSN cannot be empty');
      return;
    }

    if (!selectedAccountId) {
      toast.error('No account selected');
      return;
    }

    setSavingVariant(true);
    try {
      const product = products.find(p => p._id === editingVariant.productId);
      const selectedAccount = marketplaceAccounts.find(acc => acc._id === selectedAccountId);
      
      // Get or create account mappings
      let accountMappings = product.flipkart?.accountMappings || [];
      
      // Find this account's mapping
      let accountMapping = accountMappings.find(am => am.accountId === selectedAccountId);
      
      if (!accountMapping) {
        // Create new account mapping
        accountMapping = {
          accountId: selectedAccountId,
          accountName: selectedAccount.accountName,
          enabled: true,
          variantMappings: []
        };
        accountMappings.push(accountMapping);
      }

      // Update or add variant mapping
      const variantIndex = accountMapping.variantMappings.findIndex(
        m => m.color === editingVariant.color && m.size === editingVariant.size
      );

      if (variantIndex >= 0) {
        accountMapping.variantMappings[variantIndex].fsn = editingFSN.trim();
        accountMapping.variantMappings[variantIndex].flipkartSKU = editingFSN.trim();
      } else {
        accountMapping.variantMappings.push({
          color: editingVariant.color,
          size: editingVariant.size,
          fsn: editingFSN.trim(),
          flipkartSKU: editingFSN.trim()
        });
      }

      // Save to backend
      await flipkartService.updateProductMapping(editingVariant.productId, {
        accountMappings
      });

      // Update local state
      setAllVariants(prev => prev.map(v =>
        v.productId === editingVariant.productId &&
        v.color === editingVariant.color &&
        v.size === editingVariant.size
          ? { ...v, fsn: editingFSN.trim(), flipkartSKU: editingFSN.trim() }
          : v
      ));

      toast.success('FSN saved successfully');
      setEditingVariant(null);
      setEditingFSN('');
    } catch (error) {
      toast.error('Failed to save FSN');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingVariant(null);
    setEditingFSN('');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Filter variants
  const filteredVariants = useMemo(() => {
    let filtered = allVariants;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.design.toLowerCase().includes(term) ||
        v.color.toLowerCase().includes(term) ||
        v.size.toLowerCase().includes(term) ||
        v.fsn.toLowerCase().includes(term)
      );
    }

    if (filterStatus === 'enabled') {
      filtered = filtered.filter(v => v.enabled);
    } else if (filterStatus === 'disabled') {
      filtered = filtered.filter(v => !v.enabled);
    } else if (filterStatus === 'no-fsn') {
      filtered = filtered.filter(v => !v.fsn);
    }

    return filtered;
  }, [allVariants, searchTerm, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const totalVariants = allVariants.length;
    const enabledCount = allVariants.filter(v => v.enabled && v.fsn).length;
    const missingFSN = allVariants.filter(v => !v.fsn).length;
    const readyToSync = allVariants.filter(v => v.enabled && v.fsn).length;

    return { totalVariants, enabledCount, missingFSN, readyToSync };
  }, [allVariants]);

  if (loading || sizesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiRefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const selectedAccount = marketplaceAccounts.find(acc => acc._id === selectedAccountId);
  const hasCredentials = currentAccountConfig.appId && currentAccountConfig.appSecret;

  return (
    <div className="space-y-6">
      {/* ✅ NEW: Account Selector */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">📦 Marketplace Account</h3>
            <p className="text-sm text-gray-600 mt-1">
              Select which marketplace account to configure
            </p>
          </div>
        </div>

        {marketplaceAccounts.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              No active marketplace accounts found. Please add one in{' '}
              <strong>Settings → Marketplace Accounts</strong>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Account:</label>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {marketplaceAccounts.map(account => (
                <option key={account._id} value={account._id}>
                  {account.accountName}
                  {account.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {/* Show rest only if account is selected */}
      {!selectedAccountId ? (
        <Card>
          <div className="text-center py-8 text-gray-500">
            Please select a marketplace account to configure Flipkart sync
          </div>
        </Card>
      ) : (
        <>
          {/* Status Banner */}
          {currentAccountConfig.enabled && (
            <div className={`p-4 rounded-lg border ${
              hasCredentials && currentAccountConfig.locationId
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start gap-3">
                {hasCredentials && currentAccountConfig.locationId ? (
                  <>
                    <FiCheck className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900">Flipkart Sync Enabled for {selectedAccount?.accountName}</h3>
                      <p className="text-sm text-green-700 mt-1">
                        {stats.readyToSync} variants ready •{' '}
                        {currentAccountConfig.autoSyncEnabled ? (
                          <>Next sync: {currentAccountConfig.syncTime}</>
                        ) : (
                          <>Manual sync only</>
                        )}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <FiAlertCircle className="text-yellow-600 mt-0.5 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900">Configuration Incomplete</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Please enter your Flipkart API credentials and Location ID to activate sync
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Inventory Mode Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FiPackage className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Inventory Mode: {inventoryMode === 'reserved' ? 'Reserved Stock' : 'Main Stock'}
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {inventoryMode === 'reserved'
                    ? `Syncing reserved allocations for ${selectedAccount?.accountName}. Each account has separate stock allocation.`
                    : 'Syncing main stock to Flipkart. Total warehouse inventory will be synced.'
                  }
                  {' '}
                  <span className="font-medium">
                    Change this in Settings → Inventory Mode
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Master Enable Toggle */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Enable Flipkart Sync</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Turn on to sync inventory with your Flipkart seller account for {selectedAccount?.accountName}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentAccountConfig.enabled}
                  onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </Card>

          {/* API Credentials */}
          {currentAccountConfig.enabled && (
            <>
              <Card>
                <h3 className="text-lg font-semibold mb-4">API Credentials</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App ID {hasCredentials && <span className="text-green-600 text-xs">(Configured ✓)</span>}
                    </label>
                    <input
                      type="text"
                      value={credentials.appId}
                      onChange={(e) => setCredentials(prev => ({ ...prev, appId: e.target.value }))}
                      placeholder={hasCredentials ? "Enter new App ID to update" : "Enter Flipkart App ID"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App Secret {hasCredentials && <span className="text-green-600 text-xs">(Configured ✓)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={credentials.appSecret}
                        onChange={(e) => setCredentials(prev => ({ ...prev, appSecret: e.target.value }))}
                        placeholder={hasCredentials ? "Enter new secret to update" : "Enter Flipkart App Secret"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      >
                        {showSecret ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location ID
                    </label>
                    <input
                      type="text"
                      value={credentials.locationId}
                      onChange={(e) => setCredentials(prev => ({ ...prev, locationId: e.target.value }))}
                      placeholder="LOC12345678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Find this in your Flipkart Seller Hub → Inventory section
                    </p>
                  </div>

                  <button
                    onClick={handleTestCredentials}
                    disabled={testing || !credentials.appId || !credentials.appSecret}
                    className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    {testing ? (
                      <><FiRefreshCw className="inline animate-spin mr-2" />Testing...</>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                </div>
              </Card>

              {/* Auto Sync Schedule */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Auto-Sync Schedule</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Automatically sync at scheduled times
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentAccountConfig.autoSyncEnabled}
                      onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, autoSyncEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {currentAccountConfig.autoSyncEnabled && (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sync Frequency
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="daily"
                            checked={currentAccountConfig.syncFrequency === 'daily'}
                            onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, syncFrequency: e.target.value }))}
                            className="mr-2"
                          />
                          Daily
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="twice_daily"
                            checked={currentAccountConfig.syncFrequency === 'twice_daily'}
                            onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, syncFrequency: e.target.value }))}
                            className="mr-2"
                          />
                          Twice Daily
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sync Time
                      </label>
                      <input
                        type="time"
                        value={currentAccountConfig.syncTime}
                        onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, syncTime: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    {currentAccountConfig.syncFrequency === 'twice_daily' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Second Sync Time
                        </label>
                        <input
                          type="time"
                          value={currentAccountConfig.secondSyncTime}
                          onChange={(e) => setCurrentAccountConfig(prev => ({ ...prev, secondSyncTime: e.target.value }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Variant Management */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Variant Management</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Assign FSN (Flipkart SKU Number) to each variant for {selectedAccount?.accountName} • Showing {enabledSizes.join(', ')} sizes only
                    </p>
                  </div>

                  {allVariants.length === 0 && (
                    <button
                      onClick={fetchProducts}
                      disabled={productsLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {productsLoading ? (
                        <><FiRefreshCw className="animate-spin" size={16} />Loading...</>
                      ) : (
                        <><FiPackage size={16} />Load Products</>
                      )}
                    </button>
                  )}
                </div>

                {allVariants.length > 0 && (
                  <>
                    {/* Filters */}
                    <div className="flex gap-3 mb-4">
                      <div className="flex-1 relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search design, color, size, FSN..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="all">All Variants</option>
                        <option value="enabled">Enabled Only</option>
                        <option value="disabled">Disabled Only</option>
                        <option value="no-fsn">Missing FSN</option>
                      </select>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{stats.totalVariants}</div>
                        <div className="text-xs text-blue-700">Total Variants</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{stats.readyToSync}</div>
                        <div className="text-xs text-green-700">Ready to Sync</div>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{stats.missingFSN}</div>
                        <div className="text-xs text-yellow-700">Missing FSN</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{stats.enabledCount}</div>
                        <div className="text-xs text-purple-700">Enabled</div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Design</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Color</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Size</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Stock</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">FSN</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Enabled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredVariants.map((variant, idx) => {
                            const isEditing = editingVariant?.productId === variant.productId &&
                              editingVariant?.color === variant.color &&
                              editingVariant?.size === variant.size;

                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{variant.design}</td>
                                <td className="px-4 py-3">{variant.color}</td>
                                <td className="px-4 py-3">{variant.size}</td>
                                <td className="px-4 py-3">{variant.stock}</td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={editingFSN}
                                        onChange={(e) => setEditingFSN(e.target.value)}
                                        placeholder="Enter FSN"
                                        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                      />
                                      <button
                                        onClick={handleSaveFSN}
                                        disabled={savingVariant}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                      >
                                        <FiSave size={16} />
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                      >
                                        <FiX size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className={variant.fsn ? 'text-gray-900' : 'text-gray-400'}>
                                        {variant.fsn || 'Not set'}
                                      </span>
                                      <button
                                        onClick={() => handleEditFSN(variant)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      >
                                        <FiEdit2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {variant.lastSynced && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      variant.syncStatus === 'success'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {variant.syncStatus === 'success' ? '✓ Synced' : '✗ Failed'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={variant.enabled}
                                      onChange={() => handleToggleVariantSync(variant)}
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <><FiRefreshCw className="animate-spin" />Saving...</>
              ) : (
                <><FiSave />Save Settings</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FlipkartSettings;
