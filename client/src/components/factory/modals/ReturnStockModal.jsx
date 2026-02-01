import { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import toast from 'react-hot-toast';

const ReturnStockModal = ({ receipt, onClose, onSubmit, products, enabledSizes }) => {
  const [returnType, setReturnType] = useState('same'); // 'same' or 'exchange'
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnNotes, setReturnNotes] = useState('');
  const [exchangeItems, setExchangeItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (receipt) {
      const initialQuantities = {};
      enabledSizes.forEach((size) => {
        initialQuantities[size] = 0;
      });
      setReturnQuantities(initialQuantities);
    }
  }, [receipt, enabledSizes]);

  const handleQuantityChange = (size, value) => {
    const qty = parseInt(value) || 0;
    const borrowed = receipt.quantities?.[size] || 0;
    const returned = receipt.returnedQuantities?.[size] || 0;
    const maxReturn = borrowed - returned;

    if (qty > maxReturn) {
      toast.error(`Maximum returnable for ${size}: ${maxReturn}`);
      return;
    }

    setReturnQuantities({
      ...returnQuantities,
      [size]: qty,
    });
  };

  const handleAddExchangeItem = () => {
    setExchangeItems([
      ...exchangeItems,
      {
        id: Date.now(),
        design: '',
        color: '',
        quantities: {},
      },
    ]);
  };

  const handleRemoveExchangeItem = (id) => {
    setExchangeItems(exchangeItems.filter((item) => item.id !== id));
  };

  const updateExchangeItem = (id, field, value) => {
    setExchangeItems(
      exchangeItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const updateExchangeQuantity = (id, size, value) => {
    setExchangeItems(
      exchangeItems.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          quantities: {
            ...item.quantities,
            [size]: parseInt(value) || 0,
          },
        };
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validation
    if (returnType === 'same') {
      const totalReturning = Object.values(returnQuantities).reduce(
        (sum, qty) => sum + qty,
        0
      );
      if (totalReturning === 0) {
        toast.error('Please enter quantities to return');
        return;
      }
    }

    if (returnType === 'exchange') {
      if (exchangeItems.length === 0) {
        toast.error('Please add exchange items');
        return;
      }

      const invalidItem = exchangeItems.find((item) => !item.design || !item.color);
      if (invalidItem) {
        toast.error('Please select design and color for all exchange items');
        return;
      }

      const totalExchangeQty = exchangeItems.reduce((sum, item) => {
        return sum + Object.values(item.quantities).reduce((s, q) => s + q, 0);
      }, 0);

      if (totalExchangeQty === 0) {
        toast.error('Please enter quantities for exchange items');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        returnType,
        returnQuantities,
        returnNotes,
        exchangeItems:
          returnType === 'exchange'
            ? exchangeItems.map((item) => ({
                design: item.design,
                color: item.color,
                quantities: item.quantities,
              }))
            : [],
      };

      await onSubmit(payload);
      onClose();
    } catch (error) {
      console.error('Return error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!receipt) return null;

  const quantities = receipt.quantities instanceof Map ? Object.fromEntries(receipt.quantities) : receipt.quantities;
  const returnedQuantities = receipt.returnedQuantities || {};

  const getAvailableColors = (design) => {
    const product = products.find((p) => p.design === design);
    return product ? product.colors : [];
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="↩️ Return Borrowed Stock" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Borrowed Item Info */}
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">
            {receipt.design} - {receipt.color}
          </h3>
          <p className="text-sm text-gray-600">
            Borrowed from: <strong>{receipt.sourceName}</strong>
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {enabledSizes.map((size) => {
              const borrowed = quantities[size] || 0;
              const returned = returnedQuantities[size] || 0;
              const remaining = borrowed - returned;

              if (borrowed === 0) return null;

              return (
                <div key={size} className="bg-white p-2 rounded text-center text-sm">
                  <div className="font-medium text-gray-700">{size}</div>
                  <div className="text-xs text-gray-500">
                    {borrowed} - {returned} = <strong className="text-orange-600">{remaining}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Return Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Return Type *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setReturnType('same')}
              className={`p-4 rounded-lg border-2 transition-all ${
                returnType === 'same'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">✅</div>
              <div className="font-semibold text-gray-800">Same Items</div>
              <div className="text-xs text-gray-500">Return the same borrowed items</div>
            </button>
            <button
              type="button"
              onClick={() => setReturnType('exchange')}
              className={`p-4 rounded-lg border-2 transition-all ${
                returnType === 'exchange'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">🔀</div>
              <div className="font-semibold text-gray-800">Exchange</div>
              <div className="text-xs text-gray-500">Return different items</div>
            </button>
          </div>
        </div>

        {/* Return Quantities (Same) */}
        {returnType === 'same' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Return Quantities *
            </label>
            <div className="grid grid-cols-5 gap-4">
              {enabledSizes.map((size) => {
                const borrowed = quantities[size] || 0;
                const returned = returnedQuantities[size] || 0;
                const remaining = borrowed - returned;

                return (
                  <div key={size}>
                    <label className="block text-sm text-gray-600 mb-1 font-medium">
                      {size}
                      {remaining > 0 && (
                        <span className="text-xs text-orange-600 ml-1">
                          (max: {remaining})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      value={returnQuantities[size] || ''}
                      onChange={(e) => handleQuantityChange(size, e.target.value)}
                      disabled={remaining === 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Exchange Items */}
        {returnType === 'exchange' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Exchange Items *
            </label>
            <div className="space-y-4">
              {exchangeItems.map((item, index) => {
                const availableColors = getAvailableColors(item.design);

                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-700">Exchange Item #{index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveExchangeItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Design</label>
                        <select
                          value={item.design}
                          onChange={(e) => updateExchangeItem(item.id, 'design', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Design</option>
                          {products.map((product) => (
                            <option key={product._id} value={product.design}>
                              {product.design}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Color</label>
                        <select
                          value={item.color}
                          onChange={(e) => updateExchangeItem(item.id, 'color', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          disabled={!item.design}
                        >
                          <option value="">Select Color</option>
                          {availableColors.map((colorObj) => (
                            <option key={colorObj.color} value={colorObj.color}>
                              {colorObj.color}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {item.design && item.color && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Quantities</label>
                        <div className="grid grid-cols-5 gap-2">
                          {enabledSizes.map((size) => (
                            <div key={size}>
                              <label className="block text-xs text-gray-500 mb-1">{size}</label>
                              <input
                                type="number"
                                min="0"
                                value={item.quantities[size] || ''}
                                onChange={(e) =>
                                  updateExchangeQuantity(item.id, size, e.target.value)
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddExchangeItem}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
              >
                + Add Exchange Item
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Return Notes {returnType === 'exchange' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            placeholder="Enter return notes..."
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={returnType === 'exchange'}
          />
        </div>

        {/* Action Buttons */}
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
            className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-md hover:from-orange-700 hover:to-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Submit Return'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ReturnStockModal;
