import React, { useState } from 'react';
import Modal from './common/Modal';
import { FiAlertTriangle, FiPackage, FiShoppingBag } from 'react-icons/fi';

const InsufficientReservedStockModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  variant,
  reservedStock = 0,
  mainStock = 0,
  required = 0
}) => {
  const [loading, setLoading] = useState(false);
  const deficit = required - reservedStock;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Insufficient Reserved Stock"
      size="large"
    >
      <div className="space-y-6">
        {/* Alert Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start">
            <FiAlertTriangle className="text-yellow-600 mt-1 mr-3 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">Reserved Stock Insufficient</h3>
              <p className="text-sm text-yellow-700 mt-1">
                The reserved inventory for marketplace sales doesn't have enough stock. 
                You can use main inventory to fulfill this order.
              </p>
            </div>
          </div>
        </div>

        {/* Variant Info */}
        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Order Variant</p>
          <p className="text-xl font-bold text-gray-900">
            {variant?.design} - {variant?.color} - {variant?.size}
          </p>
        </div>

        {/* Stock Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Reserved Stock</p>
                <p className="text-3xl font-bold text-red-900 mt-2">{reservedStock}</p>
              </div>
              <FiShoppingBag className="text-red-400" size={32} />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Order Needs</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{required}</p>
              </div>
              <FiPackage className="text-blue-400" size={32} />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Main Stock</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{mainStock}</p>
              </div>
              <FiPackage className="text-green-400" size={32} />
            </div>
          </div>
        </div>

        {/* Calculation */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3">Stock Usage Breakdown:</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">From Reserved Stock:</span>
              <span className="font-bold text-blue-900">{reservedStock} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">From Main Stock (Emergency):</span>
              <span className="font-bold text-orange-600">{deficit} units</span>
            </div>
            <div className="border-t-2 border-blue-300 pt-2 mt-2"></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-900 font-semibold">Total for Order:</span>
              <span className="font-bold text-green-600 text-lg">{required} units ✓</span>
            </div>
          </div>
        </div>

        {/* Main Stock Check */}
        {mainStock >= deficit ? (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <span>Main inventory has sufficient stock to cover the deficit!</span>
            </p>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <span className="text-2xl">❌</span>
              <span>Main inventory also doesn't have enough stock. Please receive more inventory first.</span>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || mainStock < deficit}
            className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <FiAlertTriangle size={18} />
                <span>Use Main Stock & Create Order</span>
              </>
            )}
          </button>
        </div>

        {/* Warning Note */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> This will be logged as an emergency transfer in your transfer history. 
            Consider refilling your reserved inventory soon.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default InsufficientReservedStockModal;
