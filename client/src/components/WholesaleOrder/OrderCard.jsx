import { FiEye, FiEdit2, FiTrash2, FiPrinter, FiMessageCircle } from 'react-icons/fi';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import SyncStatusBadge from '../sync/SyncStatusBadge';

const BORDER = {
  Paid: 'border-l-4 border-green-500',
  paid: 'border-l-4 border-green-500',
  Partial: 'border-l-4 border-yellow-500',
  partial: 'border-l-4 border-yellow-500',
  Pending: 'border-l-4 border-red-500',
  pending: 'border-l-4 border-red-500',
};

function PaymentBadge({ status }) {
  const s = status?.toLowerCase();
  if (s === 'paid')    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FiCheckCircle className="mr-1" />Paid</span>;
  if (s === 'partial') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiAlertTriangle className="mr-1" />Partial</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><FiAlertTriangle className="mr-1" />Pending</span>;
}

export default function OrderCard({
  order, syncStatus, isAdmin,
  onView, onEdit, onPayment, onDownload, onPrint, onWhatsApp, onDelete, onResendSync,
}) {
  const borderClass = BORDER[order.paymentStatus] || 'border-l-4 border-gray-300';
  const totalPieces = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow ${borderClass}`}>
      <div className="p-5">

        {/* ── Challan + Sync ── */}
        <div className="flex items-start justify-between mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-indigo-100 text-indigo-800">
            {order.challanNumber}
          </span>
          {/* ✅ FIXED: pass order as object, not spread */}
          <SyncStatusBadge
            order={{
              ...order,
              syncStatus: syncStatus?.syncStatus ?? order.syncStatus,
              customerTenantId: syncStatus?.customerTenantId ?? order.customerTenantId ?? null,
            }}
            onResend={onResendSync}
            loading={false}
          />
        </div>

        {/* ── Buyer ── */}
        <div className="mb-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
            <span>👤</span>
            <span>{order.buyerName}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 font-normal text-sm">{order.buyerContact}</span>
          </div>
          <div className="flex items-center justify-between ml-6">
            {order.businessName && <span className="text-sm text-gray-500">{order.businessName}</span>}
            <PaymentBadge status={order.paymentStatus} />
          </div>
        </div>

        <div className="border-t border-gray-100 my-3" />

        {/* ── Meta ── */}
        <div className="grid grid-cols-3 items-center text-sm text-gray-500 mb-3">
            {/* Left */}
            <span>📅 {format(new Date(order.createdAt), 'MMM dd, yyyy')}</span>

            {/* Center — always exactly in middle regardless of other text lengths */}
            <span className="text-center">
                {order.fulfillmentType === 'factorydirect' ? '🏭 Factory' : '🏬 Warehouse'}
            </span>

            {/* Right */}
            <span className="text-right font-semibold text-gray-700">{totalPieces} pcs</span>
        </div>


        {/* ── Amounts ── */}
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3 mb-4">
          <div>
            <div className="text-xs text-gray-400">Total</div>
            <div className="font-semibold text-gray-900 text-sm">₹{order.totalAmount?.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Paid</div>
            <div className="font-semibold text-green-600 text-sm">₹{order.amountPaid?.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Due</div>
            <div className={`font-semibold text-sm ${order.amountDue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              ₹{order.amountDue?.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 mb-2">
          <button onClick={() => onView(order)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <FiEye size={14} /> View
          </button>
          <button onClick={() => onEdit(order)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <FiEdit2 size={14} /> Edit
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPrint(order)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
            title="Print challan (also downloads PDF)"
          >
            <FiPrinter size={12} /> Print
          </button>
          <button onClick={() => onWhatsApp(order)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-700">
            <FiMessageCircle size={12} /> WhatsApp
          </button>
          {isAdmin && (
            <button onClick={() => onDelete(order._id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-500 hover:text-red-700">
              <FiTrash2 size={12} /> Delete
            </button>
          )}
        </div>

        {/* ── Creator / Edit history ── */}
        {(order.createdBy || order.editHistory?.length > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-400">
            {order.createdBy && (
              <div>Created by <span className="text-gray-600 font-medium">{order.createdBy.userName}</span></div>
            )}
            {order.editHistory?.length > 0 && (() => {
              const last = order.editHistory[order.editHistory.length - 1];
              return (
                <div>
                  Edited by <span className="text-gray-600 font-medium">{last?.editedBy?.userName || 'System'}</span>
                  {' · '}{format(new Date(last.editedAt), 'dd/MM/yy h:mm a')}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
