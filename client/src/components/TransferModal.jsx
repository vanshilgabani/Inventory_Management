import React, { useState } from 'react';
import Modal from './common/Modal';
import { FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TransferModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  variant, 
  direction, // 'to-reserved' or 'to-main'
  mainStock = 0, 
  reservedStock = 0 
}) => {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isToReserved = direction === 'to-reserved';
  const maxAvailable = isToReserved ? mainStock : reservedStock;
  const fromStock = isToReserved ? 'Main' : 'Reserved';
  const toStock = isToReserved ? 'Reserved' : 'Main';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const qty = Number(quantity);
    
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    if (qty > maxAvailable) {
      toast.error(`Maximum available: ${maxAvailable} units`);
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        design: variant.design,
        color: variant.color,
        size: variant.size,
        quantity: qty,
        notes
      });
      
      toast.success(`Transferred ${qty} units to ${toStock.toLowerCase()} inventory`);
      setQuantity('');
      setNotes('');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setNotes('');
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={`Transfer to ${toStock} Inventory`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Variant Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Variant</p>
              <p className="text-lg font-bold text-gray-900">
                {variant.design} - {variant.color} - {variant.size}
              </p>
            </div>
          </div>
        </div>

        {/* Stock Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 border-2 ${
            isToReserved ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Main Stock</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{mainStock}</p>
              </div>
              {isToReserved && (
                <div className="bg-green-200 p-2 rounded-full">
                  <FiArrowRight className="text-green-700" size={20} />
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-lg p-4 border-2 ${
            !isToReserved ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              {!isToReserved && (
                <div className="bg-green-200 p-2 rounded-full">
                  <FiArrowLeft className="text-green-700" size={20} />
                </div>
              )}
              <div className={!isToReserved ? '' : 'ml-auto'}>
                <p className="text-sm text-gray-600 font-medium">Reserved Stock</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{reservedStock}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Transfer Amount
          </label>
          <input
            type="number"
            min="1"
            max={maxAvailable}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={`Enter quantity (Max: ${maxAvailable})`}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            autoFocus
          />
          <p className="text-sm text-gray-500 mt-1">
            Available in {fromStock}: <span className="font-semibold">{maxAvailable} units</span>
          </p>
        </div>

        {/* Quick Amount Buttons */}
        {maxAvailable > 0 && (
          <div className="flex gap-2 flex-wrap">
            <p className="text-sm text-gray-600 w-full mb-1">Quick select:</p>
            {[10, 25, 50, 100].filter(val => val <= maxAvailable).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setQuantity(val.toString())}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
              >
                {val}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuantity(maxAvailable.toString())}
              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-200 transition-colors"
            >
              All ({maxAvailable})
            </button>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add a note about this transfer..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Preview */}
        {quantity && Number(quantity) > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">Preview:</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Main Stock After:</p>
                <p className="text-lg font-bold text-gray-900">
                  {isToReserved ? mainStock - Number(quantity) : mainStock + Number(quantity)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Reserved Stock After:</p>
                <p className="text-lg font-bold text-gray-900">
                  {isToReserved ? reservedStock + Number(quantity) : reservedStock - Number(quantity)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !quantity || Number(quantity) <= 0}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Transferring...</span>
              </>
            ) : (
              <>
                {isToReserved ? <FiArrowRight size={20} /> : <FiArrowLeft size={20} />}
                <span>Transfer to {toStock}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TransferModal;
