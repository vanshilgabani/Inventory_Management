import React from 'react';
import { FiAlertTriangle, FiPackage, FiLock, FiArrowRight, FiX } from 'react-icons/fi';

const BorrowFromReservedModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  insufficientItems,
  orderType = 'order' // 'order', 'sale', 'direct-sale'
}) => {
  if (!isOpen) return null;

  const totalBorrowNeeded = insufficientItems?.reduce((sum, item) => sum + item.neededFromReserved, 0) || 0;

  const getOrderTypeLabel = () => {
    switch(orderType) {
      case 'sale': return 'Marketplace Order';
      case 'direct-sale': return 'Direct Sale';
      case 'order': return 'Wholesale Order';
      default: return 'Order';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <FiAlertTriangle className="text-white" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Main Inventory Insufficient</h2>
                <p className="text-orange-100 text-sm">Reserved stock borrowing required</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-orange-900">Main inventory is insufficient for this {getOrderTypeLabel()}</p>
                  <p className="text-sm text-orange-700 mt-1">
                    You need to borrow <span className="font-bold">{totalBorrowNeeded} units</span> from Reserved Inventory to complete this order.
                  </p>
                </div>
              </div>
            </div>

            {/* Insufficient Items Table */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiPackage className="text-gray-600" />
                Items Requiring Reserved Stock
              </h3>
              
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Variant</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Requested</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Main Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Reserved Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Borrow Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {insufficientItems?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{item.design}</p>
                            <p className="text-sm text-gray-600">{item.color} - {item.size}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-blue-600">{item.requestedQty}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-semibold text-gray-900">{item.mainStock}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <FiLock className="text-blue-500" size={14} />
                            <span className="text-lg font-semibold text-blue-600">{item.reservedStock}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-bold">
                              {item.neededFromReserved}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FiArrowRight className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Units to Borrow</p>
                    <p className="text-2xl font-bold text-blue-600">{totalBorrowNeeded} units</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Transfer Type</p>
                  <p className="text-sm font-semibold text-purple-700">Emergency Borrow</p>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Note:</span> This action will automatically transfer the required stock from Reserved Inventory to Main Inventory and will be logged in Transfer History.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <FiArrowRight size={18} />
              Confirm & Borrow from Reserved
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BorrowFromReservedModal;
