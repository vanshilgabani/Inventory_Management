import React, { useState } from 'react';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiLock, FiUnlock } from 'react-icons/fi';

const UseLockStockModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  insufficientItems = [],
  totalNeededFromLock = 0,
  currentLockValue = 0,
  newLockValue = 0,
}) => {
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Use lock stock error:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔓 Use Locked Stock"
      size="large"
    >
      <div className="space-y-4">
        {/* Alert Message */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start">
            <FiAlertTriangle className="text-yellow-600 mt-1 mr-3" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">
                Insufficient Available Stock
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                The available stock is not enough to fulfill this order. However, there is sufficient locked stock that can be used.
              </p>
            </div>
          </div>
        </div>

        {/* Insufficient Items Details */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h4 className="font-semibold text-gray-900">Items Requiring Locked Stock</h4>
          </div>
          <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {insufficientItems.map((item, idx) => (
              <div key={idx} className="px-4 py-3 bg-white hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.design} - {item.color} - {item.size}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600">
                      <span>Requested: <strong>{item.requestedQty || item.neededQty}</strong></span>
                      <span className="text-green-600">Available: <strong>{item.availableStock}</strong></span>
                      <span className="text-blue-600">Current Stock: <strong>{item.currentStock}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      <FiUnlock className="mr-1" size={14} />
                      Need {item.neededFromLock} from lock
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Lock Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Current Lock</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{currentLockValue}</p>
              </div>
              <FiLock className="text-blue-400" size={32} />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Will Use</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{totalNeededFromLock}</p>
              </div>
              <FiUnlock className="text-orange-400" size={32} />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">New Lock</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{newLockValue}</p>
              </div>
              <FiLock className="text-green-400" size={32} />
            </div>
          </div>
        </div>

        {/* Warning if lock will be depleted */}
        {newLockValue < 50 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <FiAlertTriangle className="text-red-600 mt-1 mr-3" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Warning: Low Locked Stock
                </p>
                <p className="text-sm text-red-600 mt-1">
                  After this order, your locked stock will be at {newLockValue} units. Consider refilling soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Using Locked Stock...</span>
              </>
            ) : (
              <>
                <FiUnlock size={18} />
                <span>Use Locked Stock & Create Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UseLockStockModal;
