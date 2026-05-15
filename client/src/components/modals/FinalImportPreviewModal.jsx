import React, { useMemo } from 'react';
import Modal from '../common/Modal';
import {
  FiCheckCircle,
  FiTruck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const FinalImportPreviewModal = ({
  isOpen,
  onClose,
  previewData,
  onConfirm,
  onBack,
  isImporting,
}) => {
  if (!previewData) return null;

  const {
    totalUnits = 0,
    totalOrders = 0,
    accountName = '',
    dispatchDate = '',
    productBreakdown = new Map(),
    skippedOrders = 0,
    multiProductOrders = [], // [{orderId,buyerName,city,pinCode,units}]
  } = previewData;

  // Build sorted array for variant table
  const breakdownArray = useMemo(() => {
    const raw =
      typeof productBreakdown.values === 'function'
        ? Array.from(productBreakdown.values())
        : Array.isArray(productBreakdown)
        ? productBreakdown
        : [];
    return raw
      .slice()
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
  }, [productBreakdown]);

  const variantCount = breakdownArray.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-50 p-2">
              <FiCheckCircle className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Final Import Check – Flipkart Orders
              </h2>
              <p className="text-xs text-gray-500">
                All validations passed • Ready to proceed
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Top stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <div className="text-emerald-700">Units to be imported</div>
              <div className="mt-1 text-lg font-semibold text-emerald-900">
                {totalUnits}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 px-3 py-2">
              <div className="text-blue-700">Flipkart Orders</div>
              <div className="mt-1 text-lg font-semibold text-blue-900">
                {totalOrders}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Variants</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {variantCount}
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <div className="text-amber-700">Returns / Cancelled</div>
              <div className="mt-1 text-lg font-semibold text-amber-900">
                {skippedOrders}
              </div>
            </div>
          </div>

          {/* Account + dispatch date */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
            <div>
              <span className="text-gray-500">Account: </span>
              <span className="font-medium text-gray-900">
                {accountName || '-'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <FiTruck className="text-gray-500" />
              <span>Dispatch Date:</span>
              <span className="font-medium text-gray-900">
                {formatDate(dispatchDate)}
              </span>
            </div>
          </div>

          {/* Only collapsible: Multi-product Flipkart orders */}
          {multiProductOrders.length > 0 && (
            <details className="border border-blue-100 rounded-xl overflow-hidden">
              <summary className="px-4 py-2.5 bg-blue-50 cursor-pointer hover:bg-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-900">
                    Multi-product Flipkart orders
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {multiProductOrders.length} orders
                  </span>
                </div>
                <span className="text-[11px] text-blue-800">
                  Click to view Tracking + Order IDs
                </span>
              </summary>

              <div className="px-4 pb-3 pt-1 text-xs">
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {multiProductOrders.slice(0, 20).map((o) => (
                    <div
                      key={o.trackingId}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-blue-100 shadow-sm"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(o.trackingId);
                              toast.success('Tracking ID copied');
                            }}
                            className="text-[11px] font-mono text-blue-700 hover:underline"
                          >
                            <span className="font-semibold text-gray-600">
                              Tracking ID:
                            </span>{' '}
                            {o.trackingId || 'N/A'}
                          </button>

                          {o.orderId && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(o.orderId);
                                toast.success('Order ID copied');
                              }}
                              className="text-[11px] font-mono text-gray-700 hover:underline"
                            >
                              <span className="font-semibold text-gray-600">
                                Order ID:
                              </span>{' '}
                              {o.orderId}
                            </button>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-600">
                          <span className="font-semibold text-gray-700">
                            Buyer:
                          </span>{' '}
                          {o.buyerName || '-'}
                          {o.city ? ` • ${o.city}` : ''}
                          {o.pinCode ? ` • ${o.pinCode}` : ''}
                        </div>
                      </div>

                      <div className="ml-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                          {o.units} units
                        </span>
                      </div>
                    </div>
                  ))}

                  {multiProductOrders.length > 20 && (
                    <div className="text-[11px] text-blue-700">
                      + {multiProductOrders.length - 20} more…
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}

          {/* Units by Variant */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-sm">
                  Units by Variant
                </span>
                <span className="text-xs text-gray-500">
                  {variantCount}{' '}
                  {variantCount === 1 ? 'variant' : 'variants'}
                </span>
              </div>
            </div>

            {variantCount === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-500">
                No variants detected. Check your CSV or go back to mapping.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Design • Color • Size
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Units
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownArray.map((item) => (
                      <tr
                        key={`${item.design}-${item.color}-${item.size}`}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-3 py-2">
                          <span className="text-gray-800">
                            {item.design || '-'}
                          </span>
                          <span className="text-gray-800">
                            {' '} 
                            • {item.color || '-'}
                          </span>
                          <span className="text-gray-500">
                            {' '}
                            • {item.size || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {item.quantity || 0}
                        </td>
                        {/*<td className="px-3 py-2 text-right text-gray-700">
                          {item.orderCount || 0}{' '}
                          <span className="text-[11px] text-gray-500">
                            {item.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </td>*/}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 py-2.5 bg-gray-50 border-t text-[11px] text-gray-500 flex items-center justify-between">
              <span>✨ All SKUs mapped & validated</span>
              <span>Inventory will be updated after import.</span>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={isImporting}
            className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isImporting}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isImporting ? 'Importing…' : 'Import Units'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FinalImportPreviewModal;