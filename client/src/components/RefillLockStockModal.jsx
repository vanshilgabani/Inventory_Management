import React from 'react';
import { FiLock, FiAlertCircle, FiArrowUp } from 'react-icons/fi';

const RefillLockStockModal = ({
  isOpen,
  onClose,
  onConfirm,
  items, // Array of { design, color, size, currentLocked, refillAmount, newLocked }
  totalRefillAmount,
  currentTotalLock,
  newTotalLock,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <FiArrowUp size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Refill Locked Stock</h3>
              <p className="text-green-100 text-sm mt-1">
                Restore stock to locked reserve
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
            <FiAlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">About Locked Stock Refill</p>
              <p>
                This will increase the locked stock for the following variants. 
                Locked stock is reserved for marketplace orders and prevents other sales from using it.
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Variants to Refill</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Variant</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Current Lock</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Refill By</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">New Lock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.design}</div>
                        <div className="text-xs text-gray-600">
                          {item.color} • {item.size}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {item.currentLocked}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-green-600">
                          +{item.refillAmount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {item.newLocked}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700">Current Total Locked Stock:</span>
                <span className="font-semibold text-gray-900">{currentTotalLock} units</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700">Refilling By:</span>
                <span className="font-bold text-green-600">+{totalRefillAmount} units</span>
              </div>
              <div className="flex justify-between items-center text-base pt-2 border-t border-green-300">
                <span className="font-semibold text-gray-900">New Total Lock:</span>
                <span className="font-bold text-green-700">{newTotalLock} units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <FiLock size={18} />
            Confirm Refill
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefillLockStockModal;
