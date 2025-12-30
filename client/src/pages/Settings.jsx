// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { productPricingService } from '../services/productPricingService';
import { inventoryService } from '../services/inventoryService';
import toast from 'react-hot-toast';
import { FiSettings } from 'react-icons/fi';

// Components
import GeneralSettings from '../components/settings/GeneralSettings';
import SizeConfiguration from '../components/settings/SizeConfiguration';
import StockThresholds from '../components/settings/StockThresholds';
import StockLockSettings from '../components/settings/StockLockSettings';
import MarketplaceAccounts from '../components/settings/MarketplaceAccounts';
import ProductPricing from '../components/settings/ProductPricing';
import PermissionsSettings from '../components/settings/PermissionsSettings';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import ColorPaletteManager from '../components/settings/ColorPaletteManager';

const Settings = () => {
  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    gstPercentage: 5,
    enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    marketplaceAccounts: [],
    notifications: {},
    emailTemplates: {},
    permissions: { allowSalesEdit: false },
    stockLockEnabled: false,
    stockLockValue: 0,
    maxStockLockThreshold: 0,
    stockThresholds: {
      globalThreshold: 10,
      designOverrides: []
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('company');

  // Marketplace state
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountIsDefault, setNewAccountIsDefault] = useState(false);

  // Pricing state
  const [pricings, setPricings] = useState([]);
  const [products, setProducts] = useState([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingFormData, setPricingFormData] = useState({
    design: '',
    marketplaceAccount: '',
    sellingPrice: 0,
    marketplaceFees: 0,
    returnFees: 0,
    costPrice: 0
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'pricing') {
      fetchPricingsAndProducts();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSettings();
      setSettings({
        ...data,
        permissions: data.permissions || { allowSalesEdit: false },
        enabledSizes: data.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'],
        stockLockEnabled: data.stockLockEnabled ?? false,
        stockLockValue: data.stockLockValue ?? 0,
        maxStockLockThreshold: data.maxStockLockThreshold ?? 0,
        stockThresholds: data.stockThresholds || {
          globalThreshold: 10,
          designOverrides: []
        }
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingsAndProducts = async () => {
    try {
      const [pricingsData, productsData] = await Promise.all([
        productPricingService.getAllPricings(),
        inventoryService.getAllProducts()
      ]);
      setPricings(pricingsData);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
    } catch (error) {
      toast.error('Failed to load pricing data');
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      const updated = await settingsService.updateSettings(settings);
      setSettings(prev => ({
        ...prev,
        ...updated,
        permissions: updated.permissions || prev.permissions
      }));
      toast.success('Settings updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setSettings(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleEmailTemplateChange = (template, field, value) => {
    setSettings(prev => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [template]: {
          ...prev.emailTemplates?.[template],
          [field]: value
        }
      }
    }));
  };

  const handleSizeToggle = (sizeToToggle) => {
    setSettings(prev => {
      const enabled = prev.enabledSizes || [];
      const updatedSizes = enabled.includes(sizeToToggle)
        ? enabled.filter(s => s !== sizeToToggle)
        : [...enabled, sizeToToggle];
      return { ...prev, enabledSizes: updatedSizes };
    });
  };

  // Marketplace handlers
  const handleEditAccount = (account) => {
    setEditingAccountId(account._id);
    setEditingAccountName(account.accountName);
  };

  const handleSaveAccountEdit = async (accountId) => {
    if (!editingAccountName.trim()) {
      toast.error('Account name cannot be empty');
      return;
    }
    try {
      const response = await settingsService.updateMarketplaceAccount(accountId, {
        accountName: editingAccountName.trim()
      });
      setSettings(response.settings);
      setEditingAccountId(null);
      setEditingAccountName('');
      toast.success('Account name updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update account');
    }
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditingAccountName('');
  };

  const handleSetDefaultAccount = async (accountId) => {
    try {
      const response = await settingsService.setDefaultMarketplaceAccount(accountId);
      setSettings(response.settings);
      toast.success('Default account updated successfully');
    } catch (error) {
      toast.error('Failed to set default account');
    }
  };

  const handleToggleAccountActive = async (accountId, currentStatus) => {
    try {
      const response = await settingsService.updateMarketplaceAccount(accountId, {
        isActive: !currentStatus
      });
      setSettings(response.settings);
      toast.success(`Account ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error('Failed to update account status');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    try {
      const response = await settingsService.deleteMarketplaceAccount(accountId);
      setSettings(response.settings);
      toast.success('Account deleted successfully');
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  const handleAddMarketplaceAccount = async () => {
    if (!newAccountName.trim()) {
      toast.error('Account name is required');
      return;
    }
    try {
      const response = await settingsService.addMarketplaceAccount({
        accountName: newAccountName.trim(),
        isDefault: newAccountIsDefault
      });
      setSettings(response.settings);
      setNewAccountName('');
      setNewAccountIsDefault(false);
      toast.success('Marketplace account added successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add marketplace account');
    }
  };

  // Pricing handlers
  const handlePricingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPricing) {
        await productPricingService.updatePricing(editingPricing._id, pricingFormData);
        toast.success('Pricing updated successfully');
      } else {
        await productPricingService.createPricing(pricingFormData);
        toast.success('Pricing created successfully');
      }
      setShowPricingModal(false);
      setEditingPricing(null);
      resetPricingForm();
      fetchPricingsAndProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save pricing');
    }
  };

  const handleEditPricing = (pricing) => {
    setEditingPricing(pricing);
    setPricingFormData({
      design: pricing.design,
      marketplaceAccount: pricing.marketplaceAccount,
      sellingPrice: pricing.sellingPrice,
      marketplaceFees: pricing.marketplaceFees,
      returnFees: pricing.returnFees,
      costPrice: pricing.costPrice
    });
    setShowPricingModal(true);
  };

  const handleDeletePricing = async (id, design, account) => {
    if (!window.confirm(`Delete pricing for ${design} on ${account}?`)) return;
    try {
      await productPricingService.deletePricing(id);
      toast.success('Pricing deleted successfully');
      fetchPricingsAndProducts();
    } catch (error) {
      toast.error('Failed to delete pricing');
    }
  };

  const resetPricingForm = () => {
    setPricingFormData({
      design: '',
      marketplaceAccount: '',
      sellingPrice: 0,
      marketplaceFees: 0,
      returnFees: 0,
      costPrice: 0
    });
  };

  const handlePricingInputChange = (e) => {
    const { name, value } = e.target;
    setPricingFormData(prev => ({
      ...prev,
      [name]: ['sellingPrice', 'marketplaceFees', 'returnFees', 'costPrice'].includes(name)
        ? parseFloat(value) || 0
        : value
    }));
  };

  const tabs = [
    { id: 'company', label: 'General', icon: '🏢' },
    { id: 'sizes-permissions', label: 'Sizes & Permissions', icon: '📏' },
    { id: 'colors', label: 'Color Palette', icon: '🎨' },
    { id: 'thresholds', label: 'Stock Alerts', icon: '🔔' },
    { id: 'stock-lock', label: 'Stock Lock', icon: '🔒' },
    { id: 'accounts', label: 'Marketplace', icon: '🛒' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'notifications', label: 'Notifications', icon: '📧' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FiSettings className="text-3xl text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        </div>
        <p className="text-gray-600">Manage your application settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex overflow-x-auto border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'company' && (
          <GeneralSettings
            settings={settings}
            handleInputChange={handleInputChange}
            handleUpdateSettings={handleUpdateSettings}
            saving={saving}
          />
        )}

        {activeTab === 'sizes-permissions' && (
          <div className="space-y-8">
            <SizeConfiguration
              settings={settings}
              handleSizeToggle={handleSizeToggle}
              handleUpdateSettings={handleUpdateSettings}
              saving={saving}
            />
            <PermissionsSettings
              settings={settings}
              handleNestedChange={handleNestedChange}
              handleUpdateSettings={handleUpdateSettings}
              saving={saving}
            />
          </div>
        )}

        {activeTab === 'colors' && <ColorPaletteManager />}

        {activeTab === 'thresholds' && (
          <StockThresholds
            settings={settings}
            handleInputChange={handleInputChange}
            handleNestedChange={handleNestedChange}
            handleUpdateSettings={handleUpdateSettings}
            saving={saving}
          />
        )}

        {activeTab === 'stock-lock' && (
          <StockLockSettings
            settings={settings}
            handleInputChange={handleInputChange}
            handleUpdateSettings={handleUpdateSettings}
            saving={saving}
          />
        )}

        {activeTab === 'accounts' && (
          <MarketplaceAccounts
            settings={settings}
            editingAccountId={editingAccountId}
            editingAccountName={editingAccountName}
            handleEditAccount={handleEditAccount}
            handleSaveAccountEdit={handleSaveAccountEdit}
            handleCancelEdit={handleCancelEdit}
            handleSetDefaultAccount={handleSetDefaultAccount}
            handleToggleAccountActive={handleToggleAccountActive}
            handleDeleteAccount={handleDeleteAccount}
            setEditingAccountName={setEditingAccountName}
            newAccountName={newAccountName}
            setNewAccountName={setNewAccountName}
            newAccountIsDefault={newAccountIsDefault}
            setNewAccountIsDefault={setNewAccountIsDefault}
            handleAddMarketplaceAccount={handleAddMarketplaceAccount}
          />
        )}

        {activeTab === 'pricing' && (
          <ProductPricing
            pricings={pricings}
            products={products}
            settings={settings}
            showPricingModal={showPricingModal}
            setShowPricingModal={setShowPricingModal}
            editingPricing={editingPricing}
            pricingFormData={pricingFormData}
            handlePricingInputChange={handlePricingInputChange}
            handlePricingSubmit={handlePricingSubmit}
            handleEditPricing={handleEditPricing}
            handleDeletePricing={handleDeletePricing}
            resetPricingForm={resetPricingForm}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsSettings
            settings={settings}
            handleNestedChange={handleNestedChange}
            handleEmailTemplateChange={handleEmailTemplateChange}
            handleUpdateSettings={handleUpdateSettings}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};

export default Settings;
