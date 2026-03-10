import { useState } from 'react';
import Modal from '../../common/Modal';
import { wholesaleService } from '../../../services/wholesaleService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export default function PaymentModal({ show, order, onSuccess, onClose }) {
  const [amount,  setAmount]  = useState('');
  const [method,  setMethod]  = useState('Cash');
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);

  if (!show || !order) return null;

  const handleRecord = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > order.amountDue) { toast.error('Amount exceeds outstanding due'); return; }

    const newHistory = [
      ...(order.paymentHistory || []),
      { amount: amt, method, notes, date: new Date().toISOString() }
    ];
    const newPaid = (order.amountPaid || 0) + amt;

    setLoading(true);
    try {
      await wholesaleService.updateOrderPaymentHistory(order._id, {
        paymentHistory: newHistory,
        amountPaid: newPaid,
      });
      toast.success('Payment recorded!');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Record Payment" size="sm">
      <div className="p-5 space-y-4">

        {/* Order summary */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="font-bold text-gray-900">{order.businessName || order.buyerName}</p>
          <p className="text-xs text-gray-400 mt-0.5">#{order.challanNumber}</p>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold">₹{order.totalAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Paid</span>
            <span className="font-semibold text-green-600">₹{order.amountPaid?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mt-1 pt-2 border-t border-gray-200">
            <span className="font-semibold text-gray-800">Due</span>
            <span className="font-bold text-red-600">₹{order.amountDue?.toLocaleString()}</span>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Payment Amount</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Max ₹${order.amountDue?.toLocaleString()}`}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Method */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {METHODS.map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  method === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. UPI ref 12345"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Payment history */}
        {order.paymentHistory?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Previous Payments</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {order.paymentHistory.map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                  <span>{p.method} · {p.notes || '—'}</span>
                  <span className="font-semibold text-green-600">₹{p.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleRecord}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl
                     font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {loading ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </Modal>
  );
}
