import React from 'react';
import { FiDollarSign, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import Modal from '../common/Modal';

const ProductPricing = ({ 
  pricings,
  products,
  settings,
  showPricingModal,
  setShowPricingModal,
  editingPricing,
  pricingFormData,
  handlePricingInputChange,
  handlePricingSubmit,
  handleEditPricing,
  handleDeletePricing,
  resetPricingForm
}) => {
  const calculateExpectedSettlement = () => {
    return pricingFormData.sellingPrice - pricingFormData.marketplaceFees;
  };

  const calculateProfit = () => {
    return calculateExpectedSettlement() - pricingFormData.costPrice;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiDollarSign className="text-blue-600" />
            <h3 className="text-lg font-semibold">Product Pricing</h3>
          </div>
          <button
            onClick={() => {
              resetPricingForm();
              setShowPricingModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <FiPlus /> Add Pricing
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Configure pricing and fees for each product per marketplace account
        </p>

        {pricings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiDollarSign className="mx-auto text-4xl mb-2 text-gray-400" />
            <p className="font-medium">No pricing configurations yet</p>
            <p className="text-sm">Add your first product pricing to start tracking revenue and profit</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MP Fees</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Settlement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pricings.map((pricing) => {
                  const expectedSettlement = pricing.sellingPrice - pricing.marketplaceFees;
                  const profit = expectedSettlement - pricing.costPrice;
                  
                  return (
                    <tr key={pricing._id}>
                      <td className="px-4 py-3 text-sm">{pricing.design}</td>
                      <td className="px-4 py-3 text-sm">{pricing.marketplaceAccount}</td>
                      <td className="px-4 py-3 text-sm">₹{pricing.sellingPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">₹{pricing.marketplaceFees.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-medium">₹{expectedSettlement.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">₹{pricing.costPrice.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPricing(pricing)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePricing(pricing._id, pricing.design, pricing.marketplaceAccount)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      <Modal
        isOpen={showPricingModal}
        onClose={() => {
          setShowPricingModal(false);
          resetPricingForm();
        }}
        title={editingPricing ? 'Edit Product Pricing' : 'Add Product Pricing'}
      >
        <form onSubmit={handlePricingSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Design</label>
            <select
              name="design"
              value={pricingFormData.design}
              onChange={handlePricingInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Design</option>
              {products.map(product => (
                <option key={product._id} value={product.design}>{product.design}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace Account</label>
            <select
              name="marketplaceAccount"
              value={pricingFormData.marketplaceAccount}
              onChange={handlePricingInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Account</option>
              {settings.marketplaceAccounts?.filter(acc => acc.isActive).map(account => (
                <option key={account._id} value={account.accountName}>{account.accountName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹)</label>
              <input
                type="number"
                name="sellingPrice"
                value={pricingFormData.sellingPrice}
                onChange={handlePricingInputChange}
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace Fees (₹)</label>
              <input
                type="number"
                name="marketplaceFees"
                value={pricingFormData.marketplaceFees}
                onChange={handlePricingInputChange}
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Fees (₹)</label>
              <input
                type="number"
                name="returnFees"
                value={pricingFormData.returnFees}
                onChange={handlePricingInputChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (₹)</label>
              <input
                type="number"
                name="costPrice"
                value={pricingFormData.costPrice}
                onChange={handlePricingInputChange}
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Calculated Fields */}
          <div className="bg-gray-50 p-4 rounded-md space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expected Settlement:</span>
              <span className="font-medium">₹{calculateExpectedSettlement().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-gray-600">Expected Profit:</span>
              <span className={`font-medium ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{calculateProfit().toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowPricingModal(false);
                resetPricingForm();
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editingPricing ? 'Update' : 'Add'} Pricing
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductPricing;
