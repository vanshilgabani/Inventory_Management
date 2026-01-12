import React from 'react';
import Modal from '../common/Modal';
import { FiDollarSign, FiCalendar, FiCreditCard, FiFileText } from 'react-icons/fi';

const PaymentModal = ({
  isOpen,
  onClose,
  selectedBuyer,
  paymentForm,
  setPaymentForm,
  paymentPreview,
  handlePaymentAmountChange,
  handlePaymentSubmit,
  isSubmitting
}) => {
  if (!selectedBuyer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
      <form onSubmit={handlePaymentSubmit} className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Buyer</span>
            <span className="font-semibold text-gray-900">{selectedBuyer.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Due</span>
            <span className="text-lg font-bold text-red-600">
              ₹{selectedBuyer.totalDue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiDollarSign className="inline w-4 h-4 mr-1" />
            Payment Amount
          </label>
          <input
            type="number"
            step="0.01"
            value={paymentForm.amount}
            onChange={(e) => handlePaymentAmountChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCreditCard className="inline w-4 h-4 mr-1" />
            Payment Method
          </label>
          <select
            value={paymentForm.paymentMethod}
            onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Card">Card</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCalendar className="inline w-4 h-4 mr-1" />
            Payment Date
          </label>
          <input
            type="date"
            value={paymentForm.paymentDate}
            onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiFileText className="inline w-4 h-4 mr-1" />
            Notes (Optional)
          </label>
          <textarea
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="2"
            placeholder="Add any notes..."
          />
        </div>

        {paymentPreview && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <h4 className="font-semibold text-green-900 text-sm mb-2">Payment Preview</h4>
            <div className="text-sm text-green-800">
              <p>Amount: ₹{paymentPreview.amount?.toLocaleString('en-IN')}</p>
              <p>Will be allocated to {paymentPreview.ordersAffected?.length || 0} order(s)</p>
              {paymentPreview.remaining > 0 && (
                <p className="text-orange-600 mt-1">
                  Excess: ₹{paymentPreview.remaining.toLocaleString('en-IN')} (will be saved as advance)
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentModal;
