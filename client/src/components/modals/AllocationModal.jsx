import React, { useState, useEffect } from 'react';
import { FiX, FiAlertCircle, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import Modal from '../common/Modal';
import { useEnabledSizes } from '../../hooks/useEnabledSizes';
import { useColorPalette } from '../../hooks/useColorPalette';
import { settingsService } from '../../services/settingsService';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';

const AllocationModal = ({ isOpen, onClose, product, onSuccess }) => {
  const { enabledSizes } = useEnabledSizes();
  const { colors: colorPalette, getColorCode } = useColorPalette();
  
  const [marketplaceAccounts, setMarketplaceAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState({}); // { "color-size": { accountName: quantity } }
  const [errors, setErrors] = useState({}); // { "color-size": "error message" }
  const [localProduct, setLocalProduct] = useState(product);

  // Fetch marketplace accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const settings = await settingsService.getSettings();
        const activeAccounts = settings.marketplaceAccounts?.filter(acc => acc.isActive) || [];
        setMarketplaceAccounts(activeAccounts);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        toast.error('Failed to load marketplace accounts');
      }
    };

    if (isOpen) {
      fetchAccounts();
      initializeAllocations();
    }
  }, [isOpen, product]);

  useEffect(() => {
    setLocalProduct(product);
  }, [product]);

  // ── Exclusion helpers ──────────────────────────────────────────────────────
const isDesignExcluded = (accountName) =>
  (localProduct?.excludedAccounts || []).includes(accountName);

const isVariantExcluded = (accountName, color, size) => {
  const cv = localProduct?.colors?.find(c => c.color === color);
  const sv = cv?.sizes?.find(s => s.size === size);
  return (sv?.excludedFromAutoAllocation || []).includes(accountName);
};

const handleDesignExclusion = async (accountName, exclude) => {
  try {
    await fetch(`/api/settings/auto-allocation/${exclude ? 'exclude' : 'include'}-design`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ design: localProduct.design, accountName })
    });
    // Update local state immediately — no full refresh needed
    setLocalProduct(prev => ({
      ...prev,
      excludedAccounts: exclude
        ? [...(prev.excludedAccounts || []), accountName]
        : (prev.excludedAccounts || []).filter(a => a !== accountName)
    }));
    toast.success(exclude
      ? `${accountName} excluded from all ${localProduct.design} variants`
      : `${accountName} re-included for ${localProduct.design}`
    );
  } catch (err) {
    toast.error('Failed to update exclusion');
  }
};

const handleVariantExclusion = async (accountName, color, size, exclude) => {
  try {
    await fetch(`/api/settings/auto-allocation/${exclude ? 'exclude' : 'include'}-variant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ design: localProduct.design, color, size, accountName })
    });
    // Update local state immediately
    setLocalProduct(prev => ({
      ...prev,
      colors: prev.colors.map(cv =>
        cv.color !== color ? cv : {
          ...cv,
          sizes: cv.sizes.map(sv =>
            sv.size !== size ? sv : {
              ...sv,
              excludedFromAutoAllocation: exclude
                ? [...(sv.excludedFromAutoAllocation || []), accountName]
                : (sv.excludedFromAutoAllocation || []).filter(a => a !== accountName)
            }
          )
        }
      )
    }));
    toast.success(exclude
      ? `${accountName} excluded from ${color}-${size}`
      : `${accountName} re-included for ${color}-${size}`
    );
  } catch (err) {
    toast.error('Failed to update exclusion');
  }
};
// ───────────────────────────────────────────────────────────────────────────

  // Initialize allocations from existing data
  const initializeAllocations = () => {
    if (!product) return;

    const initialAllocations = {};
    product.colors?.forEach(colorData => {
      colorData.sizes?.forEach(sizeData => {
        const key = `${colorData.color}-${sizeData.size}`;
        initialAllocations[key] = {};
      });
    });

    setAllocations(initialAllocations);
  };

// Handle allocation input change - NOW IN ADD MODE
const handleAllocationChange = (color, size, accountName, value) => {
  const key = `${color}-${size}`;
  const numValue = parseInt(value) || 0;

  setAllocations(prev => ({
    ...prev,
    [key]: {
      ...prev[key],
      [accountName]: numValue // This is the amount TO ADD
    }
  }));

  // Clear error for this variant when user types
  setErrors(prev => {
    const newErrors = { ...prev };
    delete newErrors[key];
    return newErrors;
  });
};

// Calculate stats for a variant - UPDATED FOR ADD MODE
const getVariantStats = (color, size) => {
  const colorData = product.colors?.find(c => c.color === color);
  const sizeData = colorData?.sizes?.find(s => s.size === size);
  const reservedTotal = sizeData?.reservedStock || 0;

  const key = `${color}-${size}`;
  const addAmounts = allocations[key] || {};
  
  // Calculate current total allocated
  const currentAllocated = sizeData?.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
  
  // Calculate new amounts being added
  const adding = Object.values(addAmounts).reduce((sum, qty) => sum + qty, 0);
  
  // Total after adding
  const totalAfterAdd = currentAllocated + adding;
  
  // Pool after adding
  const pool = reservedTotal - totalAfterAdd;
  
  const isValid = totalAfterAdd <= reservedTotal;

  return {
    reservedTotal,
    currentAllocated,
    adding,
    totalAfterAdd,
    pool,
    isValid,
    hasChanges: adding > 0
  };
}

  // Get status icon for variant
  const getStatusIcon = (color, size) => {
    const stats = getVariantStats(color, size);

    if (!stats.isValid) {
      return <FiAlertCircle className="text-red-500" />;
    }

    if (stats.pool > 0) {
      return <FiAlertTriangle className="text-yellow-500" />;
    }

    return <FiCheckCircle className="text-green-500" />;
  };

  // Validate all allocations
  const validateAllocations = () => {
    const newErrors = {};
    let hasError = false;

    product.colors?.forEach(colorData => {
      colorData.sizes?.forEach(sizeData => {
        const key = `${colorData.color}-${sizeData.size}`;
        const stats = getVariantStats(colorData.color, sizeData.size);

        if (!stats.isValid) {
          newErrors[key] = `Over-allocated by ${stats.allocated - stats.reservedTotal} units`;
          hasError = true;
        }
      });
    });

    setErrors(newErrors);
    return !hasError;
  };

// Handle submit - UPDATED FOR ADD MODE
const handleSubmit = async () => {
  if (!validateAllocations()) {
    toast.error('Please fix allocation errors before saving');
    return;
  }

  try {
    setLoading(true);

    // Transform allocations data for API
    const allocationData = [];

    product.colors?.forEach(colorData => {
      colorData.sizes?.forEach(sizeData => {
        const key = `${colorData.color}-${sizeData.size}`;
        const addAmounts = allocations[key] || {};

        // Build final allocations array (current + new)
        const finalAllocations = {};

        // 1. Start with existing allocations
        sizeData.reservedAllocations?.forEach(alloc => {
          finalAllocations[alloc.accountName] = {
            quantity: alloc.quantity,
            allocatedAt: alloc.allocatedAt,
            updatedAt: alloc.updatedAt
          };
        });

        // 2. Add new amounts to existing or create new
        Object.entries(addAmounts).forEach(([accountName, addAmount]) => {
          if (addAmount > 0) {
            if (finalAllocations[accountName]) {
              // Adding to existing
              finalAllocations[accountName].quantity += addAmount;
              finalAllocations[accountName].updatedAt = new Date();
              // Keep original allocatedAt
            } else {
              // New allocation
              finalAllocations[accountName] = {
                quantity: addAmount,
                allocatedAt: new Date(),
                updatedAt: new Date()
              };
            }
          }
        });

        // 3. Convert to array format for API
        const accounts = Object.entries(finalAllocations)
          .filter(([_, data]) => data.quantity > 0)
          .map(([accountName, data]) => ({
            accountName,
            quantity: data.quantity,
            allocatedAt: data.allocatedAt,
            updatedAt: data.updatedAt
          }));

        if (accounts.length > 0) {
          allocationData.push({
            color: colorData.color,
            size: sizeData.size,
            accounts
          });
        }
      });
    });

    await inventoryService.allocateReservedStock(product._id, allocationData);
    
    toast.success('Stock allocated successfully!');
    onSuccess && onSuccess();
    onClose();

  } catch (error) {
    console.error('Allocation error:', error);
    toast.error(error.response?.data?.message || 'Failed to allocate stock');
  } finally {
    setLoading(false);
  }
};

  // Quick fill: Allocate all pool to one account
  const handleQuickFill = (color, size, accountName) => {
    const stats = getVariantStats(color, size);
    if (stats.pool <= 0) {
      toast.error('No pool stock available');
      return;
    }

    const key = `${color}-${size}`;
    setAllocations(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [accountName]: (prev[key]?.[accountName] || 0) + stats.pool
      }
    }));

    toast.success(`Added ${stats.pool} units to ${accountName}`);
  };

  // Clear all allocations for a variant
  const handleClearVariant = (color, size) => {
    const key = `${color}-${size}`;
    setAllocations(prev => ({
      ...prev,
      [key]: {}
    }));
  };

  if (!product) return null;

  // Get active colors for this product
  const activeColors = localProduct.colors?.filter(colorData => 
    colorPalette.some(c => c.colorName === colorData.color)
  ) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Allocate Reserved Stock - ${product.design}`}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <FiAlertCircle className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How to allocate stock:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Enter quantities for each marketplace account</li>
              <li>Total allocations must not exceed reserved stock</li>
              <li>Unallocated stock remains in the "Pool"</li>
              <li>✓ = Fully allocated | ⚠️ = Pool remaining | ✗ = Over-allocated</li>
            </ul>
          </div>
        </div>

        {/* Accounts Legend */}
        <div className="flex flex-wrap gap-2 pb-4 border-b">
          <span className="text-sm font-medium text-gray-700">Accounts:</span>
          {marketplaceAccounts.map(account => (
            <span
              key={account._id}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                account.isDefault
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {account.accountName}
              {account.isDefault && ' (Default)'}
            </span>
          ))}
        </div>

        {/* Allocation Tables - One per color */}
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {activeColors.map(colorData => (
            <div key={colorData.color} className="border rounded-lg overflow-hidden">
              {/* Color Header */}
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: getColorCode(colorData.color) }}
                  title={colorData.color}
                />
                <h3 className="font-semibold text-gray-900">{colorData.color}</h3>
              </div>

              {/* Allocation Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 w-20">Size</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-700 w-24">Reserved</th>
                      {marketplaceAccounts.map(account => (
                        <th key={account._id} className="px-4 py-2 text-center font-medium text-gray-700 w-32">
                        <div className="space-y-1">
                          <span>{account.accountName}</span>
                          {/* Design-level exclusion toggle */}
                          <div>
                            <button
                              onClick={() => handleDesignExclusion(account.accountName, !isDesignExcluded(account.accountName))}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all ${
                                isDesignExcluded(account.accountName)
                                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-500'
                              }`}
                              title={isDesignExcluded(account.accountName)
                                ? `Re-include for all ${localProduct?.design} variants`
                                : `Exclude from all ${localProduct?.design} variants`}
                            >
                              {isDesignExcluded(account.accountName) ? '🚫 Design Excl.' : '🚫 Excl. Design'}
                            </button>
                          </div>
                        </div>
                      </th>
                      ))}
                      {<th className="px-4 py-2 text-center font-medium text-gray-700 w-24">Pool</th>}
                      <th className="px-4 py-2 text-center font-medium text-gray-700 w-16">Status</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-700 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {colorData.sizes
                      ?.filter(sizeData => enabledSizes.includes(sizeData.size))
                      .map(sizeData => {
                        const key = `${colorData.color}-${sizeData.size}`;
                        const stats = getVariantStats(colorData.color, sizeData.size);
                        const hasError = errors[key];

                        return (
                          <tr key={sizeData.size} className={hasError ? 'bg-red-50' : ''}>
                            {/* Size */}
                            <td className="px-4 py-3 font-medium text-gray-900">{sizeData.size}</td>

                            {/* Reserved Total */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-blue-600">
                                {sizeData.reservedStock || 0}
                              </span>
                            </td>

                            {/* Account Inputs - UPDATED */}
                            {marketplaceAccounts.map(account => {
                              const existingAlloc = sizeData.reservedAllocations?.find(
                                a => a.accountName === account.accountName
                              );
                              const currentQty  = existingAlloc?.quantity || 0;
                              const adding      = allocations[key]?.[account.accountName] || 0;
                              const dExcluded   = isDesignExcluded(account.accountName);
                              const vExcluded   = isVariantExcluded(account.accountName, colorData.color, sizeData.size);

                              // If design excluded — show badge, no input
                              if (dExcluded) {
                                return (
                                  <td key={account._id} className="px-4 py-3 text-center">
                                    <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-semibold">
                                      Design Excluded
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td key={account._id} className="px-4 py-3">
                                  <div className="space-y-1">

                                    {vExcluded ? (
                                      // Variant excluded — show badge + re-include button
                                      <div className="text-center space-y-1">
                                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-semibold block">
                                          Variant Excluded
                                        </span>
                                        <button
                                          onClick={() => handleVariantExclusion(account.accountName, colorData.color, sizeData.size, false)}
                                          className="text-[10px] text-blue-500 hover:underline"
                                        >
                                          Re-include
                                        </button>
                                      </div>
                                    ) : (
                                      // Normal input + variant exclude button
                                      <>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0"
                                            value={allocations[key]?.[account.accountName] || ''}
                                            onChange={(e) => handleAllocationChange(
                                              colorData.color, sizeData.size,
                                              account.accountName, e.target.value
                                            )}
                                            className="w-full px-2 py-1 border rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={currentQty > 0 ? `${currentQty}` : '0'}
                                          />
                                          {stats.pool > 0 && (
                                            <button
                                              onClick={() => handleQuickFill(colorData.color, sizeData.size, account.accountName)}
                                              className="text-blue-500 hover:text-blue-700 text-xs"
                                              title="Add all pool"
                                            >
                                              +
                                            </button>
                                          )}
                                        </div>
                                        {adding > 0 && (
                                          <p className="text-xs text-gray-600 text-center">
                                            {currentQty} + {adding} = {currentQty + adding}
                                          </p>
                                        )}
                                        {/* Variant-level exclude button */}
                                        <button
                                          onClick={() => handleVariantExclusion(account.accountName, colorData.color, sizeData.size, true)}
                                          className="text-[10px] text-gray-400 hover:text-red-500 block w-full text-center transition-colors"
                                          title="Exclude this account from auto allocation for this variant only"
                                        >
                                          ⚡ Excl. Variant
                                        </button>
                                      </>
                                    )}

                                  </div>
                                </td>
                              );
                            })}

                            {/* Pool */}
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${
                                stats.pool < 0 ? 'text-red-600' : 
                                stats.pool > 0 ? 'text-yellow-600' : 
                                'text-green-600'
                              }`}>
                                {stats.pool}
                              </span>
                            </td>

                            {/* Status Icon */}
                            <td className="px-4 py-3 text-center">
                              {getStatusIcon(colorData.color, sizeData.size)}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleClearVariant(colorData.color, sizeData.size)}
                                className="text-gray-400 hover:text-red-500 text-xs"
                              >
                                Clear
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Error display for this color */}
              {colorData.sizes?.some(sizeData => errors[`${colorData.color}-${sizeData.size}`]) && (
                <div className="bg-red-50 px-4 py-2 border-t border-red-200">
                  {colorData.sizes?.map(sizeData => {
                    const key = `${colorData.color}-${sizeData.size}`;
                    return errors[key] ? (
                      <p key={key} className="text-xs text-red-600">
                        {sizeData.size}: {errors[key]}
                      </p>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Accounts:</span> {marketplaceAccounts.length}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save Allocations'
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AllocationModal;
