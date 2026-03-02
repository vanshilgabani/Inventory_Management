// components/subscription/UnpaidInvoiceWarning.jsx

import { useState, useEffect } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const UnpaidInvoiceWarning = ({ currentPlan }) => {
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentPlan?.planType === 'order-based') {
      fetchUnpaidInvoices();
    }
  }, [currentPlan]);

  const fetchUnpaidInvoices = async () => {
    try {
      const response = await api.get('/subscription/invoices?status=generated');
      if (response.data.success) {
        setUnpaidInvoices(response.data.data.invoices);
      }
    } catch (error) {
      console.error('Failed to fetch unpaid invoices:', error);
    }
  };

  if (unpaidInvoices.length === 0) return null;

  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="text-yellow-600 text-2xl flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-yellow-900 mb-2">
            Unpaid Invoice{unpaidInvoices.length > 1 ? 's' : ''} Found
          </h3>
          <p className="text-yellow-800 mb-3">
            You have {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? 's' : ''} totaling{' '}
            <strong>₹{totalUnpaid.toLocaleString()}</strong>.
          </p>
          <p className="text-sm text-yellow-700 mb-3">
            ⚠️ You must clear all pending payments before upgrading to a different plan.
          </p>
          <button
            onClick={() => navigate('/subscription/invoices')}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
          >
            View & Pay Invoices
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnpaidInvoiceWarning;
