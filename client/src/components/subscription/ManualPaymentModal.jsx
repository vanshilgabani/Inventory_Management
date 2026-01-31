import { useState } from 'react';
import { FiX, FiCreditCard, FiDollarSign, FiCheck, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import upiQRCode from '../../../public/upi-qr-code.png.jpeg';

const ManualPaymentModal = ({ onClose, planType, planName, amount, razorpayOrderId, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const paymentDetails = {
    upiId: 'vanshilgabani-1@oksbi',
    upiNumber: '9328822592',
    name: 'Vanshil Rajubhai Gabani'
  };

  // ✅ Copy to clipboard function
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Complete Payment</h2>
            <p className="text-blue-100 text-sm mt-1">Choose your preferred payment method</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Plan Details */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Plan Selected</p>
                <p className="text-xl font-bold text-gray-800">{planName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-2xl font-bold text-blue-600">₹{amount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 text-lg">Select Payment Method</h3>

            {/* UPI Payment Option */}
            <div
              onClick={() => setPaymentMethod('upi')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                paymentMethod === 'upi'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'upi' ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                    <FiCreditCard className={paymentMethod === 'upi' ? 'text-white' : 'text-gray-500'} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">UPI Payment</p>
                    <p className="text-sm text-gray-500">Pay using any UPI app</p>
                  </div>
                </div>
                {paymentMethod === 'upi' && (
                  <FiCheck className="text-blue-500" size={24} />
                )}
              </div>

              {/* ✅ UPI Details - Show when selected */}
              {paymentMethod === 'upi' && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  {/* ✅ OPTION 1: Use static QR code image (Recommended) */}
                  <div className="flex flex-col items-center bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Scan QR Code to Pay</p>
                    <div className="bg-white p-3 rounded-lg border-2 border-gray-300">
                      {/* ✅ Replace with your actual QR code image */}
                      <img 
                        src={upiQRCode} 
                        alt="UPI QR Code" 
                        className="w-48 h-48"
                        onError={(e) => {
                          // Fallback: Show text if image not found
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div style={{ display: 'none' }} className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-500 text-sm text-center p-4">
                        QR Code not available.<br/>Please use UPI ID below.
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Scan with any UPI app (GPay, PhonePe, Paytm, etc.)
                    </p>
                  </div>

                  {/* UPI Details */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Or pay manually using:</p>
                    
                    {/* UPI ID */}
                    <div className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">UPI ID</p>
                        <p className="font-mono font-semibold text-gray-800">{paymentDetails.upiId}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(paymentDetails.upiId);
                        }}
                        className="text-blue-500 hover:text-blue-600 p-2 hover:bg-blue-50 rounded transition"
                      >
                        <FiCopy size={18} />
                      </button>
                    </div>

                    {/* Mobile Number */}
                    <div className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Mobile Number</p>
                        <p className="font-mono font-semibold text-gray-800">{paymentDetails.upiNumber}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(paymentDetails.upiNumber);
                        }}
                        className="text-blue-500 hover:text-blue-600 p-2 hover:bg-blue-50 rounded transition"
                      >
                        <FiCopy size={18} />
                      </button>
                    </div>

                    {/* Name */}
                    <div className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Account Name</p>
                        <p className="font-semibold text-gray-800">{paymentDetails.name}</p>
                      </div>
                    </div>

                    {/* Amount to Pay */}
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded border border-blue-200">
                      <div>
                        <p className="text-xs text-blue-600 font-semibold">Amount to Pay</p>
                        <p className="font-bold text-xl text-blue-600">₹{amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> After making the payment, click "I Have Paid" below.
                      Admin will verify and activate your subscription within 24 hours.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Cash Payment Option */}
            <div
              onClick={() => setPaymentMethod('cash')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                paymentMethod === 'cash'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'cash' ? 'bg-green-500' : 'bg-gray-200'
                  }`}>
                    <FiDollarSign className={paymentMethod === 'cash' ? 'text-white' : 'text-gray-500'} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Cash Payment</p>
                    <p className="text-sm text-gray-500">Pay at our office</p>
                  </div>
                </div>
                {paymentMethod === 'cash' && (
                  <FiCheck className="text-green-500" size={24} />
                )}
              </div>

              {paymentMethod === 'cash' && (
                <div className="mt-4 pt-4 border-t border-gray-200 bg-green-50 p-4 rounded">
                  <p className="text-sm text-gray-700">
                    Please arrange to pay cash of{' '}
                    <strong className="text-green-600">₹{amount.toLocaleString()}</strong> to our office.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Note:</strong> After confirming, admin will review your request.
                    Your subscription will be activated after payment verification.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={!paymentMethod || loading}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition ${
                paymentMethod && !loading
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Processing...' : 'I Have Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualPaymentModal;
