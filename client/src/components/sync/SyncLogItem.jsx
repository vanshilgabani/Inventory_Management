// src/components/sync/SyncLogItem.jsx

import React, { useState } from 'react';

const SyncLogItem = ({ log, onAccept, onReject }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
      accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
      completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getActionIcon = (action) => {
    const icons = {
      create: (
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
            clipRule="evenodd"
          />
        </svg>
      ),
      update: (
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
      delete: (
        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    };
    return icons[action] || icons.create;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Action Icon */}
          <div className="flex-shrink-0">{getActionIcon(log.action)}</div>

          {/* Details */}
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-gray-900">
                Challan #{log.supplierChallanNumber}
              </h3>
              {getStatusBadge(log.status)}
              <span className="text-xs text-gray-500">
                {log.action.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {log.itemsSynced} items • Synced on{' '}
              {new Date(log.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {log.status === 'pending' && (
            <>
              <button
                onClick={() => onAccept(log._id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Accept
              </button>
              <button
                onClick={() => onReject(log._id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Reject
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Supplier Order ID</p>
              <p className="text-sm font-medium text-gray-900">
                {log.supplierOrderId}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Factory Receiving ID</p>
              <p className="text-sm font-medium text-gray-900">
                {log.tenantFactoryReceivingId || 'N/A'}
              </p>
            </div>
          </div>

          {/* Items Table */}
          {log.items && log.items.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Items:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Design
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Color
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Size
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {log.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.design}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.color}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.size}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Message */}
          {log.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Error:</span> {log.errorMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyncLogItem;
