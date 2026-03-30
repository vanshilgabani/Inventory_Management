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
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-800 mb-3">📊 Allocation Preview</p>

          {/* ── BILL MODE ── */}
          {paymentPreview.mode === 'bill' && paymentPreview.billAllocation?.map((bill, i) => (
            <div key={i} className="mb-3 p-3 bg-white rounded border border-blue-100">
              <div className="flex justify-between text-sm font-medium text-gray-800">
                <span>📄 {bill.billNumber} ({bill.month} {bill.year})</span>
                <span className={bill.status === 'FULLY_PAID' ? 'text-green-600' : 'text-orange-600'}>
                  {bill.status === 'FULLY_PAID' ? '✅ Fully Paid' : '⚡ Partial'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Balance: ₹{bill.currentBalance?.toLocaleString('en-IN')}</span>
                <span>Allocating: ₹{bill.amountToAllocate?.toLocaleString('en-IN')}</span>
                <span>Remaining: ₹{bill.newBalance?.toLocaleString('en-IN')}</span>
              </div>
              {bill.hasPrevAdj && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Includes ₹{bill.prevAdjAmount?.toLocaleString('en-IN')} previous unbilled adjustment
                </p>
              )}
              {bill.challanBreakdown?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {bill.challanBreakdown.map((c, j) => (
                    <div key={j} className="flex justify-between text-xs text-gray-500 pl-2 border-l-2 border-blue-200">
                      <span>{c.challanNumber}</span>
                      <span>+₹{c.amountAllocated?.toLocaleString('en-IN')} → Due: ₹{c.newDue?.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* ── ORDER MODE ── */}
          {paymentPreview.mode === 'order' && paymentPreview.allocation?.map((order, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-blue-100 text-sm">
              <span className="text-gray-700 font-medium">{order.challanNumber}</span>
              <span className="text-blue-600">+₹{order.amountToAllocate?.toLocaleString('en-IN')}</span>
              <span className={order.status === 'FULLY_PAID' ? 'text-green-600' : 'text-orange-500'}>
                Due: ₹{order.newDue?.toLocaleString('en-IN')}
              </span>
            </div>
          ))}

          {/* ── SUMMARY ── */}
          <div className="mt-3 pt-2 border-t border-blue-200 flex justify-between text-sm font-semibold">
            <span className="text-gray-700">Remaining Due After Payment</span>
            <span className={paymentPreview.remainingDue === 0 ? 'text-green-600' : 'text-red-600'}>
              ₹{paymentPreview.remainingDue?.toLocaleString('en-IN')}
            </span>
          </div>
          {paymentPreview.excessAmount > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ ₹{paymentPreview.excessAmount?.toLocaleString('en-IN')} excess — no more pending dues
            </p>
          )}
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
