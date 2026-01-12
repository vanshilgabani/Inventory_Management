import React from 'react';
import Modal from '../common/Modal';
import { wholesaleService } from '../../services/wholesaleService';
import { monthlyBillService } from '../../services/monthlyBillService';
import toast from 'react-hot-toast';
import { FiTrash2, FiCalendar, FiDollarSign, FiFileText } from 'react-icons/fi';
import { format } from 'date-fns';

const PaymentHistoryModal = ({
  isOpen,
  onClose,
  selectedBuyer,
  paymentHistory,
  fetchInitialData,
  setPaymentHistory
}) => {
  if (!selectedBuyer) return null;

  const handleDeletePayment = async (payment, paymentIndex) => {
    const isChallanPayment = payment.source === 'challan';
    const isBillPayment = payment.source === 'bill';

    let confirmMessage = 'Are you sure you want to delete this payment?';
    if (isChallanPayment) {
      confirmMessage = `Delete this ₹${payment.amount.toLocaleString('en-IN')} challan payment?\n\nThis will only remove the payment record. Order totals won't change since this payment was made before bill generation.`;
    } else if (isBillPayment) {
      confirmMessage = `Delete this ₹${payment.amount.toLocaleString('en-IN')} bill payment?\n\nThis will restore the bill balance by ₹${payment.amount.toLocaleString('en-IN')}.`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      if (isBillPayment) {
        await monthlyBillService.deletePayment(payment.billId, paymentIndex);
        toast.success('Bill payment deleted successfully');
      } else if (isChallanPayment) {
        await wholesaleService.deleteOrderPayment(payment.orderId, paymentIndex);
        toast.success('Challan payment deleted successfully');
      } else {
        await wholesaleService.deleteBulkPayment(selectedBuyer._id, payment.id);
        toast.success('Payment deleted successfully');
      }

      const history = await wholesaleService.getBulkPaymentHistory(selectedBuyer._id);
      setPaymentHistory(history.payments);
      await fetchInitialData();
    } catch (error) {
      console.error('Delete payment error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete payment';
      toast.error(errorMsg);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment History">
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">{selectedBuyer.name}</h3>
          <p className="text-sm text-gray-600">
            Total Payments: ₹{selectedBuyer.totalPaid.toLocaleString('en-IN')} ({paymentHistory.length} transactions)
          </p>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiDollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No payment history found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {paymentHistory.map((payment, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        {payment.paymentMethod}
                      </span>
                      {payment.source && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {payment.source === 'challan' ? 'Challan Payment' : 'Bill Payment'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" />
                        {format(new Date(payment.paymentDate), 'dd MMM yyyy')}
                      </span>
                      {payment.challanNumber && (
                        <span className="flex items-center gap-1">
                          <FiFileText className="w-3 h-3" />
                          Challan: {payment.challanNumber}
                        </span>
                      )}
                      {payment.billNumber && (
                        <span className="flex items-center gap-1">
                          <FiFileText className="w-3 h-3" />
                          Bill: {payment.billNumber}
                        </span>
                      )}
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-gray-500 mt-1">Note: {payment.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePayment(payment, index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete payment"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentHistoryModal;
