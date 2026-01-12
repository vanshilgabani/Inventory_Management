import React from 'react';
import Modal from '../common/Modal';
import { FiCreditCard, FiFileText } from 'react-icons/fi';

const CreditLimitModal = ({
  isOpen,
  onClose,
  selectedBuyer,
  creditForm,
  setCreditForm,
  handleCreditSubmit,
  isSubmitting
}) => {
  if (!selectedBuyer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Credit Limit">
      <form onSubmit={handleCreditSubmit} className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Buyer</span>
            <span className="font-semibold text-gray-900">{selectedBuyer.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Limit</span>
            <span className="text-lg font-bold text-gray-900">
              ₹{(selectedBuyer.creditLimit || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-600">Outstanding</span>
            <span className="text-lg font-bold text-red-600">
              ₹{selectedBuyer.totalDue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCreditCard className="inline w-4 h-4 mr-1" />
            New Credit Limit
          </label>
          <input
            type="number"
            step="0.01"
            value={creditForm.creditLimit}
            onChange={(e) => setCreditForm({ ...creditForm, creditLimit: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter credit limit"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiFileText className="inline w-4 h-4 mr-1" />
            Reason for Change
          </label>
          <textarea
            value={creditForm.reason}
            onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="3"
            placeholder="Enter reason for updating credit limit..."
            required
          />
        </div>

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
            {isSubmitting ? 'Updating...' : 'Update Limit'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreditLimitModal;
