// components/subscription/RazorpayPayment.jsx
import { useState } from 'react';
import { paymentService } from '../../services/paymentService';
import toast from 'react-hot-toast';
import ManualPaymentModal from './ManualPaymentModal';

const RazorpayPayment = ({ planType, planName, onSuccess, onError, user, children }) => {
  const [loading, setLoading] = useState(false);
  const [showProration, setShowProration] = useState(false);
  const [prorationDetails, setProrationDetails] = useState(null);
  
  // Manual payment state
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPaymentData, setManualPaymentData] = useState(null);

  // Get plan price for manual payment fallback
  const getPlanPrice = (planType) => {
    const prices = {
      'yearly': 5999,
      'monthly': 999,
      'order-based': 0 // No upfront payment
    };
    return prices[planType] || 0;
  };

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      // Create order
      const orderData = await paymentService.createPaymentOrder(planType);
      
      if (!orderData.success) {
        throw new Error(orderData.message || 'Failed to create order');
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
      if (proration && proration.creditedRupees > 0) {
        setProrationDetails(proration);
        setShowProration(true);
      }

      // Check if Razorpay is loaded
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
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
            
            // Show manual payment as fallback
            setManualPaymentData({
              planType,
              planName,
              amount: amount / 100,
              razorpayOrderId: orderId
            });
            setShowManualPayment(true);
            
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
      
      // Handle Razorpay payment failure
      razorpay.on('payment.failed', function (response) {
        console.error('Razorpay payment failed:', response.error);
        toast.error('Payment failed. Opening manual payment option...');
        
        setManualPaymentData({
          planType,
          planName,
          amount: amount / 100,
          razorpayOrderId: orderId
        });
        setShowManualPayment(true);
        setLoading(false);
      });

      razorpay.open();

    } catch (error) {
      console.error('Payment initiation error:', error);
      setLoading(false);
      
      const errorMessage = error.response?.data?.message || error.message || '';
      
      // ✅ FIX: Check if it's a Razorpay API/backend error
      const isRazorpayError = 
        errorMessage.toLowerCase().includes('api') ||
        errorMessage.toLowerCase().includes('key') ||
        errorMessage.toLowerCase().includes('test') ||
        errorMessage.toLowerCase().includes('order') ||
        errorMessage.toLowerCase().includes('razorpay') ||
        error.response?.status === 400 ||
        error.response?.status === 401 ||
        error.response?.status === 500;

      if (isRazorpayError) {
        // Show manual payment as fallback
        console.log('🔄 Razorpay error detected, opening manual payment modal...');
        toast.error('Payment gateway unavailable. Please use manual payment.');
        
        const planPrice = getPlanPrice(planType);
        
        setManualPaymentData({
          planType,
          planName,
          amount: planPrice,
          razorpayOrderId: null
        });
        setShowManualPayment(true);
      } else {
        // Other errors
        toast.error(errorMessage || 'Failed to initiate payment');
        if (onError) onError(error);
      }
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

      {/* Manual Payment Modal */}
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
