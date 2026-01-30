// components/subscription/RazorpayPayment.jsx
import { useState } from 'react';
import { paymentService } from '../../services/paymentService';
import toast from 'react-hot-toast';

const RazorpayPayment = ({ 
  planType, 
  planName, 
  onSuccess, 
  onError,
  user,
  children 
}) => {
  const [loading, setLoading] = useState(false);
  const [showProration, setShowProration] = useState(false);
  const [prorationDetails, setProrationDetails] = useState(null);

  const handlePayment = async () => {
    setLoading(true);

    try {
      // Create order
      const orderData = await paymentService.createPaymentOrder(planType);

      if (!orderData.success) {
        throw new Error(orderData.message);
      }

      // For order-based plan (no payment required)
      if (orderData.data.requiresPayment === false) {
        toast.success('Switched to order-based plan!');
        const upgradeResult = await paymentService.upgradePlanFree('order-based');
        if (onSuccess) onSuccess(upgradeResult.data);
        setLoading(false);
        return;
      }

      const { orderId, amount, currency, key, proration } = orderData.data;

      // Show proration details if applicable
      if (proration.creditedRupees > 0) {
        setProrationDetails(proration);
        setShowProration(true);
      }

      // Razorpay options
      const options = {
        key: key,
        amount: amount,
        currency: currency,
        name: 'VeeRaa Impex',
        description: `${planName} Subscription`,
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#6366f1'
        },
        handler: async function (response) {
          // Payment successful
          try {
            const verifyData = await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType
            });

            if (verifyData.success) {
              toast.success(`🎉 ${verifyData.message}`);
              if (onSuccess) onSuccess(verifyData.data);
            } else {
              throw new Error(verifyData.message);
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error(error.response?.data?.message || 'Payment verification failed');
            if (onError) onError(error);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            toast.error('Payment cancelled');
          }
        }
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment initiation error:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
      if (onError) onError(error);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Proration Details Modal */}
      {showProration && prorationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">💰 Upgrade Credit Applied!</h3>
            
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span>Plan Price:</span>
                <span>₹{prorationDetails.baseAmountRupees.toFixed(2)}</span>
              </div>
              
              {prorationDetails.creditedRupees > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Credit Applied:</span>
                  <span>-₹{prorationDetails.creditedRupees.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>GST (18%):</span>
                <span>₹{prorationDetails.gstAmountRupees.toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>₹{prorationDetails.totalAmountRupees.toFixed(2)}</span>
              </div>
            </div>

            {prorationDetails.daysRemaining > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                🎁 You had {prorationDetails.daysRemaining} days remaining, credit adjusted!
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowProration(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowProration(false);
                  // Razorpay will open automatically
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Proceed to Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render children with handlePayment function */}
      {typeof children === 'function' ? (
        children({ handlePayment, loading })
      ) : (
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Subscribe to ${planName}`
          )}
        </button>
      )}
    </>
  );
};

export default RazorpayPayment;
