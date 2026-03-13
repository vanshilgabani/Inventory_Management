import { useState, useEffect } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import { skuMappingService } from '../../services/skuMappingService';
import toast from 'react-hot-toast';

const SKUMappingModal = ({
  isOpen,
  onClose,
  sku,
  accountName,
  availableProducts,
  onMappingComplete
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [formData, setFormData] = useState({ design: '', color: '', size: '' });
  const [availableColors, setAvailableColors] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [stockInfo, setStockInfo] = useState(null);

  // ✅ FIX 1: Derive design list directly from availableProducts (never empty if products loaded)
  const availableDesigns = availableProducts?.map(p => p.design) || [];

  useEffect(() => {
    if (isOpen && sku) {
      fetchSuggestions();
    }
  }, [isOpen, sku]);

  // ✅ FIX 2: Re-apply colors/sizes whenever availableProducts prop updates (race condition fix)
  useEffect(() => {
    if (availableProducts?.length > 0) {
      if (formData.design) {
        updateAvailableColors(formData.design);
      }
      if (formData.design && formData.color) {
        updateAvailableSizes(formData.design, formData.color);
      }
    }
  }, [availableProducts]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const data = await skuMappingService.getSuggestions(sku, accountName);
      setSuggestions(data);

      const suggestedDesign = data.suggestions?.design || '';
      const suggestedColor = data.suggestions?.color || '';
      const suggestedSize = data.suggestions?.size || '';

      setFormData({ design: suggestedDesign, color: suggestedColor, size: suggestedSize });

      // ✅ FIX 3: Only call these if availableProducts is already loaded
      // If not loaded yet, the useEffect above will handle it when they arrive
      if (availableProducts?.length > 0) {
        if (suggestedDesign) updateAvailableColors(suggestedDesign);
        if (suggestedDesign && suggestedColor) updateAvailableSizes(suggestedDesign, suggestedColor);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const updateAvailableColors = (design) => {
    const product = availableProducts?.find(p => p.design === design);
    setAvailableColors(product ? product.colors.map(c => c.color) : []);
  };

  const updateAvailableSizes = (design, color) => {
    const product = availableProducts?.find(p => p.design === design);
    if (product) {
      const colorVariant = product.colors.find(c => c.color === color);
      if (colorVariant) {
        setAvailableSizes(colorVariant.sizes.map(s => s.size));
        if (formData.size) {
          const sizeVariant = colorVariant.sizes.find(s => s.size === formData.size);
          if (sizeVariant) {
            setStockInfo({ reserved: sizeVariant.reservedStock || 0, main: sizeVariant.currentStock || 0 });
          }
        }
        return;
      }
    }
    setAvailableSizes([]);
  };

  const handleDesignChange = (design) => {
    setFormData({ design, color: '', size: '' });
    updateAvailableColors(design);
    setAvailableSizes([]);
    setStockInfo(null);
  };

  const handleColorChange = (color) => {
    setFormData(prev => ({ ...prev, color, size: '' }));
    updateAvailableSizes(formData.design, color);
    setStockInfo(null);
  };

  const handleSizeChange = (size) => {
    setFormData(prev => ({ ...prev, size }));
    const product = availableProducts?.find(p => p.design === formData.design);
    if (product) {
      const colorVariant = product.colors.find(c => c.color === formData.color);
      if (colorVariant) {
        const sizeVariant = colorVariant.sizes.find(s => s.size === size);
        if (sizeVariant) {
          setStockInfo({ reserved: sizeVariant.reservedStock || 0, main: sizeVariant.currentStock || 0 });
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.design || !formData.color || !formData.size) {
      toast.error('Please select design, color, and size');
      return;
    }
    try {
      setSaving(true);
      await skuMappingService.createMapping({
        accountName,
        marketplaceSKU: sku,
        design: formData.design,
        color: formData.color,
        size: formData.size,
        mappingSource: 'manual'
      });
      toast.success('SKU mapped successfully!');
      onMappingComplete({ sku, design: formData.design, color: formData.color, size: formData.size });
      onClose();
    } catch (error) {
      console.error('Failed to create mapping:', error);
      toast.error(error.response?.data?.message || 'Failed to create mapping');
    } finally {
      setSaving(false);
    }
  };

  const getWaistInfo = (size) => {
    const waistMap = {
      'S': '28"', 'M': '30"', 'L': '32"',
      'XL': '34"', 'XXL': '36"',
      '3XL': '38"', '4XL': '40"', '5XL': '42"'
    };
    return waistMap[size] || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50001 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">🗺️ Map Marketplace SKU</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading suggestions...</p>
            </div>
          ) : (
            <>
              {/* SKU Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marketplace SKU from CSV:
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-lg">
                  {sku}
                </div>
              </div>

              <div className="border-t pt-4"></div>

              {/* ✅ FIX: Design dropdown now uses availableDesigns from products, not suggestions API */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Design: <span className="text-red-500">*</span>
                </label>
                {availableDesigns.length === 0 ? (
                  <div className="w-full px-4 py-2 border border-yellow-300 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    ⏳ Loading products... please wait
                  </div>
                ) : (
                  <select
                    value={formData.design}
                    onChange={(e) => handleDesignChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select design</option>
                    {availableDesigns.map(design => (
                      <option key={design} value={design}>
                        {design === suggestions?.suggestions?.design ? `🌟 ${design} (Suggested)` : design}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color: <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  disabled={!formData.design}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select color</option>
                  {availableColors.map(color => (
                    <option key={color} value={color}>
                      {color === suggestions?.suggestions?.color ? `✓ ${color} (Auto-detected)` : color}
                    </option>
                  ))}
                </select>
                {formData.design && availableColors.length > 0 && (
                  <p className="mt-1 text-sm text-gray-500">Available: {availableColors.join(', ')}</p>
                )}
              </div>

              {/* Size Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size: <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.size}
                  onChange={(e) => handleSizeChange(e.target.value)}
                  disabled={!formData.color}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select size</option>
                  {availableSizes.map(size => (
                    <option key={size} value={size}>
                      {size}{getWaistInfo(size) ? ` (Waist ${getWaistInfo(size)})` : ''}
                      {size === suggestions?.suggestions?.size ? ' 🌟 Suggested' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Size Mapping Info */}
              {suggestions?.parsed?.rawSize && formData.size && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Size Mapping:</strong> {suggestions.parsed.rawSize}" (in CSV) = {formData.size} (in your inventory)
                  </p>
                </div>
              )}

              {/* Stock Info */}
              {stockInfo && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    ℹ️ <strong>Stock Check:</strong> {formData.design} - {formData.color} - {formData.size}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Reserved: {stockInfo.reserved} units | Main: {stockInfo.main} units
                  </p>
                </div>
              )}

              {/* Remember Checkbox */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={true} readOnly
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">☑️ Remember this mapping for future imports</span>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  This SKU will be automatically mapped in future CSV imports.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
            Skip This SKU
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.design || !formData.color || !formData.size || saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Saving...</>
            ) : (
              <><FiCheck /> Save & Continue</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SKUMappingModal;
