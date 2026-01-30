import { useState } from 'react';
import { FiX, FiCreditCard, FiDollarSign, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ManualPaymentModal = ({ onClose, planType, planName, amount, razorpayOrderId, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState(''); // 'upi' or 'cash'
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const paymentDetails = {
    upiId: '9328822592@upi',
    upiNumber: '9328822592',
    name: 'Vanshil Rajubhai Gabani'
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/payment/manual-payment-request', {
        planType,
        paymentMethod,
        amount,
        razorpayOrderId
      });

      if (response.data.success) {
        toast.success('Payment request submitted! Admin will verify soon.');
        if (onSuccess) onSuccess();
        onClose();
      }

    } catch (error) {
      console.error('Manual payment request failed:', error);
      toast.error(error.response?.data?.message || 'Failed to submit payment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Manual Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Plan Info */}
          <div className="bg-indigo-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Plan Selected</p>
            <p className="text-xl font-bold text-indigo-600">{planName}</p>
            <p className="text-2xl font-extrabold text-gray-800 mt-2">₹{amount.toLocaleString()}</p>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Payment Method
            </label>

            {/* UPI Option */}
            <button
              onClick={() => setPaymentMethod('upi')}
              className={`w-full p-4 rounded-lg border-2 transition flex items-center justify-between ${
                paymentMethod === 'upi'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <FiCreditCard size={24} className="text-indigo-600" />
                <span className="font-semibold text-gray-800">UPI Payment</span>
              </div>
              {paymentMethod === 'upi' && (
                <FiCheck size={20} className="text-indigo-600" />
              )}
            </button>

            {/* Cash Option */}
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`w-full p-4 rounded-lg border-2 transition flex items-center justify-between ${
                paymentMethod === 'cash'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <FiDollarSign size={24} className="text-green-600" />
                <span className="font-semibold text-gray-800">Cash Payment</span>
              </div>
              {paymentMethod === 'cash' && (
                <FiCheck size={20} className="text-green-600" />
              )}
            </button>
          </div>

          {/* Payment Details (for UPI) */}
          {paymentMethod === 'upi' && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-lg border border-indigo-200">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FiCreditCard className="text-indigo-600" />
                Payment Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">UPI ID:</span>
                  <span className="font-semibold text-gray-800">{paymentDetails.upiId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">UPI Number:</span>
                  <span className="font-semibold text-gray-800">{paymentDetails.upiNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-semibold text-gray-800">{paymentDetails.name}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> After making the payment, click "I Have Paid" below. 
                  Admin will verify and activate your subscription within 24 hours.
                </p>
              </div>
            </div>
          )}

          {/* Cash Instructions */}
          {paymentMethod === 'cash' && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-lg border border-green-200">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FiDollarSign className="text-green-600" />
                Cash Payment Instructions
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Please arrange to pay cash of <strong>₹{amount.toLocaleString()}</strong> to our office.
              </p>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> After confirming, admin will review your request. 
                  Your subscription will be activated after payment verification.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={!paymentMethod || loading}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold text-white transition ${
              !paymentMethod || loading
                ? 'bg-gray-400 cursor-not-allowed'
                : paymentMethod === 'upi'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Submitting...' : paymentMethod === 'cash' ? 'Confirm Cash Payment' : 'I Have Paid'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualPaymentModal;
