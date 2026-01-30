// components/subscription/RazorpayPayment.jsx
import { useState } from 'react';
import { paymentService } from '../../services/paymentService';
import toast from 'react-hot-toast';
import ManualPaymentModal from './ManualPaymentModal'; // NEW IMPORT

const RazorpayPayment = ({ planType, planName, onSuccess, onError, user, children }) => {
  const [loading, setLoading] = useState(false);
  const [showProration, setShowProration] = useState(false);
  const [prorationDetails, setProrationDetails] = useState(null);
  
  // NEW STATE
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPaymentData, setManualPaymentData] = useState(null);

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
      
      // NEW: Handle Razorpay payment failure
      razorpay.on('payment.failed', function (response) {
        console.error('Razorpay payment failed:', response.error);
        setLoading(false);
        
        // Show manual payment modal as fallback
        toast.error('Payment failed. Opening manual payment option...');
        setManualPaymentData({
          planType,
          planName,
          amount: amount / 100, // Convert from paise to rupees
          razorpayOrderId: orderId
        });
        setShowManualPayment(true);
      });

      razorpay.open();

    } catch (error) {
      console.error('Payment initiation error:', error);
      
      // NEW: Show manual payment modal as fallback on error
      const errorMessage = error.response?.data?.message || error.message || '';
      
      // Check if it's a Razorpay API error (test keys in production)
      if (
        errorMessage.includes('API') || 
        errorMessage.includes('key') ||
        errorMessage.includes('test') ||
        error.response?.status === 400 ||
        error.response?.status === 401
      ) {
        toast.error('Payment gateway unavailable. Opening manual payment option...');
        
        // Try to get amount from order data or use default
        const amountInRupees = orderData?.data?.amount ? orderData.data.amount / 100 : 0;
        
        setManualPaymentData({
          planType,
          planName,
          amount: amountInRupees,
          razorpayOrderId: orderData?.data?.orderId || null
        });
        setShowManualPayment(true);
      } else {
        toast.error(errorMessage || 'Failed to initiate payment');
        if (onError) onError(error);
      }
      
      setLoading(false);
    }
  };

  return (
    <>
      {/* Proration Details Modal */}
      {showProration && prorationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">🎁 Credit Applied!</h3>
            <p className="text-gray-700 mb-4">
              You had {prorationDetails.daysRemaining} days remaining on your previous plan.
              We've credited ₹{prorationDetails.creditedRupees} to your new subscription!
            </p>
            <button
              onClick={() => setShowProration(false)}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* NEW: Manual Payment Modal */}
      {showManualPayment && manualPaymentData && (
        <ManualPaymentModal
          planType={manualPaymentData.planType}
          planName={manualPaymentData.planName}
          amount={manualPaymentData.amount}
          razorpayOrderId={manualPaymentData.razorpayOrderId}
          onClose={() => {
            setShowManualPayment(false);
            setManualPaymentData(null);
          }}
          onSuccess={() => {
            setShowManualPayment(false);
            setManualPaymentData(null);
            if (onSuccess) onSuccess();
          }}
        />
      )}

      {/* Payment trigger button */}
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Processing...' : children}
      </button>
    </>
  );
};

export default RazorpayPayment;
