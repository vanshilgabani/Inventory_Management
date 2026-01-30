// src/pages/InvoiceListPage.jsx

import React, { useState, useEffect } from 'react';
import { getInvoices } from '../services/subscriptionService';

const InvoiceListPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, paid, generated, overdue

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await getInvoices(params);

      if (response.success) {
        setInvoices(response.data.invoices);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
      generated: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
    };
    const badge = badges[status] || badges.generated;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const downloadInvoice = (invoiceId) => {
    // TODO: Implement PDF download
    alert(`Download invoice: ${invoiceId}`);
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-2">View and download your invoices</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {['all', 'paid', 'generated', 'overdue'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? 'You don\'t have any invoices yet'
                : `No ${filter} invoices found`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice._id}
                invoice={invoice}
                getStatusBadge={getStatusBadge}
                downloadInvoice={downloadInvoice}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Invoice Card Component
const InvoiceCard = ({ invoice, getStatusBadge, downloadInvoice }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        {/* Left Side - Invoice Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-4 mb-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Invoice #{invoice._id.slice(-8).toUpperCase()}
                </h3>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {invoice.invoiceType === 'yearly-subscription' && 'Yearly Subscription'}
                {invoice.invoiceType === 'order-based' && 'Monthly Order-Based Bill'}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-14">
            <div>
              <p className="text-xs text-gray-500">Generated</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(invoice.generatedAt).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(invoice.paymentDueDate).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm font-semibold text-gray-900">
                ₹{invoice.totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
            {invoice.status === 'paid' && invoice.paidAt && (
              <div>
                <p className="text-xs text-gray-500">Paid On</p>
                <p className="text-sm font-medium text-green-700">
                  {new Date(invoice.paidAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            )}
          </div>

          {/* Billing Period (for order-based) */}
          {invoice.billingPeriod && (
            <div className="ml-14 mt-3">
              <p className="text-xs text-gray-500">Billing Period</p>
              <p className="text-sm font-medium text-gray-900">
                {invoice.billingPeriod.month}
              </p>
            </div>
          )}
        </div>

        {/* Right Side - Actions */}
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => downloadInvoice(invoice._id)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Download</span>
          </button>
          {invoice.status === 'generated' && (
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceListPage;
