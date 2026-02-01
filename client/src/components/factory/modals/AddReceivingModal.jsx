import { useState } from 'react';
import Modal from '../../common/Modal';
import toast from 'react-hot-toast';
import { useColorPalette } from '../../../hooks/useColorPalette';

const AddReceivingModal = ({ onClose, onSubmit, products, enabledSizes }) => {
  const { colors, getColorsForDesign, getColorCode, loading: colorsLoading } = useColorPalette();
  
  const [designEntries, setDesignEntries] = useState([
    {
      id: Date.now(),
      selectedDesign: '',
      isNewProduct: false,
      newDesignName: '',
      newDescription: '',
      newWholesalePrice: '',
      newRetailPrice: '',
      batchId: '',
      notes: '',
      stockData: {}, // { colorName: { M: 10, L: 20, ... } }
      sourceType: 'factory',
      sourceName: '',
      returnDueDate: '',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);

  const handleAddEntry = () => {
    setDesignEntries([
      ...designEntries,
      {
        id: Date.now(),
        selectedDesign: '',
        isNewProduct: false,
        newDesignName: '',
        newDescription: '',
        newWholesalePrice: '',
        newRetailPrice: '',
        batchId: '',
        notes: '',
        stockData: {},
        sourceType: 'factory',
        sourceName: '',
        returnDueDate: '',
      },
    ]);
  };

  const handleRemoveEntry = (id) => {
    if (designEntries.length === 1) {
      toast.error('At least one entry is required');
      return;
    }
    setDesignEntries(designEntries.filter((entry) => entry.id !== id));
  };

  const updateEntry = (id, field, value) => {
    setDesignEntries(
      designEntries.map((entry) => {
        if (entry.id !== id) return entry;
        
        // Reset fields when switching between new/existing
        if (field === 'isNewProduct') {
          return {
            ...entry,
            [field]: value,
            selectedDesign: '',
            newDesignName: '',
            stockData: {},
          };
        }
        
        return { ...entry, [field]: value };
      })
    );
  };

  const updateStockData = (id, color, size, value) => {
    setDesignEntries(
      designEntries.map((entry) => {
        if (entry.id !== id) return entry;

        const stockData = { ...entry.stockData };
        if (!stockData[color]) stockData[color] = {};
        stockData[color][size] = parseInt(value) || 0;

        return { ...entry, stockData };
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validation
    for (const entry of designEntries) {
      if (entry.isNewProduct) {
        if (!entry.newDesignName.trim()) {
          toast.error('Please enter design name for new product');
          return;
        }
      } else {
        if (!entry.selectedDesign) {
          toast.error('Please select a design for all entries');
          return;
        }
      }

      const hasStock = Object.values(entry.stockData).some((colorData) =>
        Object.values(colorData).some((qty) => qty > 0)
      );

      if (!hasStock) {
        toast.error(`Please enter stock quantities for ${entry.isNewProduct ? entry.newDesignName : entry.selectedDesign}`);
        return;
      }

      if (['borrowed_buyer', 'borrowed_vendor', 'other'].includes(entry.sourceType)) {
        if (!entry.sourceName.trim()) {
          toast.error(`Please enter source name`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const allPromises = [];

      for (const entry of designEntries) {
        const colorNames = Object.keys(entry.stockData);

        for (const colorName of colorNames) {
          const quantities = entry.stockData[colorName];
          const hasQty = Object.values(quantities).some((q) => q > 0);

          if (!hasQty) continue;

          const receivingPayload = {
            design: entry.isNewProduct ? entry.newDesignName : entry.selectedDesign,
            color: colorName,
            quantities: quantities,
            batchId: entry.batchId || (entry.isNewProduct ? 'Initial Stock' : ''),
            notes: entry.notes || (entry.isNewProduct ? 'New product creation' : ''),
            skipStockUpdate: entry.isNewProduct,
            sourceType: entry.sourceType || 'factory',
          };

          if (['borrowed_buyer', 'borrowed_vendor', 'other'].includes(entry.sourceType)) {
            receivingPayload.sourceName = entry.sourceName.trim().toLowerCase();
            receivingPayload.returnDueDate = entry.returnDueDate || null;
          }

          allPromises.push(onSubmit(receivingPayload));
        }
      }

      await Promise.all(allPromises);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Get available colors for a design
  const getAvailableColorsForEntry = (entry) => {
    if (entry.isNewProduct) {
      // For new products, show all system colors
      return colors;
    } else if (entry.selectedDesign) {
      // For existing products, get colors specific to that design
      return getColorsForDesign(entry.selectedDesign);
    }
    return [];
  };

  if (colorsLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="📥 Receive Stock" size="xl">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading colors...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="📥 Receive Stock"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {designEntries.map((entry, index) => {
          const availableColors = getAvailableColorsForEntry(entry);

          return (
            <div
              key={entry.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Entry #{index + 1}</h3>
                {designEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* New or Existing Product */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.isNewProduct}
                    onChange={(e) => updateEntry(entry.id, 'isNewProduct', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    ➕ This is a new product/design
                  </span>
                </label>
              </div>

              {/* Design Selection or New Design Name */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {entry.isNewProduct ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Design Name *
                      </label>
                      <input
                        type="text"
                        value={entry.newDesignName}
                        onChange={(e) => updateEntry(entry.id, 'newDesignName', e.target.value)}
                        placeholder="Enter design name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={entry.newDescription}
                        onChange={(e) => updateEntry(entry.id, 'newDescription', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Design *
                    </label>
                    <select
                      value={entry.selectedDesign}
                      onChange={(e) => updateEntry(entry.id, 'selectedDesign', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Design</option>
                      {products.map((product) => (
                        <option key={product._id} value={product.design}>
                          {product.design}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Type *
                  </label>
                  <select
                    value={entry.sourceType}
                    onChange={(e) => updateEntry(entry.id, 'sourceType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="factory">🏭 Factory</option>
                    <option value="borrowed_buyer">📦 Borrowed from Buyer</option>
                    <option value="borrowed_vendor">🔄 Borrowed from Vendor</option>
                    <option value="other">📋 Other</option>
                  </select>
                </div>
              </div>

              {/* Pricing for New Product */}
              {entry.isNewProduct && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wholesale Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.newWholesalePrice}
                      onChange={(e) => updateEntry(entry.id, 'newWholesalePrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Retail Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.newRetailPrice}
                      onChange={(e) => updateEntry(entry.id, 'newRetailPrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Source Name & Due Date (for borrowed) */}
              {['borrowed_buyer', 'borrowed_vendor', 'other'].includes(entry.sourceType) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Name *
                    </label>
                    <input
                      type="text"
                      value={entry.sourceName}
                      onChange={(e) => updateEntry(entry.id, 'sourceName', e.target.value)}
                      placeholder="Enter borrower/vendor name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Return Due Date
                    </label>
                    <input
                      type="date"
                      value={entry.returnDueDate}
                      onChange={(e) => updateEntry(entry.id, 'returnDueDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Batch & Notes */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batch ID
                  </label>
                  <input
                    type="text"
                    value={entry.batchId}
                    onChange={(e) => updateEntry(entry.id, 'batchId', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => updateEntry(entry.id, 'notes', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Stock Quantities - Using System Colors */}
              {(entry.selectedDesign || entry.newDesignName) && availableColors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Quantities * (Select from system colors)
                  </label>
                  <div className="space-y-3">
                    {availableColors.map((colorObj) => (
                      <div
                        key={colorObj.colorName}
                        className="bg-white p-3 rounded-md border border-gray-200"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <div
                            className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                            style={{ backgroundColor: colorObj.colorCode }}
                          />
                          <span className="font-medium text-gray-800">{colorObj.colorName}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {enabledSizes.map((size) => (
                            <div key={size}>
                              <label className="block text-xs text-gray-600 mb-1">
                                {size}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={entry.stockData[colorObj.colorName]?.[size] || ''}
                                onChange={(e) =>
                                  updateStockData(
                                    entry.id,
                                    colorObj.colorName,
                                    size,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show message if no colors available */}
              {(entry.selectedDesign || entry.newDesignName) && availableColors.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 font-medium">
                    ⚠️ No colors available in the system
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Please add colors in Settings → Color Palette first
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Entry Button */}
        <button
          type="button"
          onClick={handleAddEntry}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
        >
          + Add Another Entry
        </button>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddReceivingModal;
