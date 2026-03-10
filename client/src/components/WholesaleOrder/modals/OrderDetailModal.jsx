import Modal from '../../common/Modal';
import { FiDownload, FiMessageCircle, FiAlertTriangle, FiCheckCircle, FiEdit2 } from 'react-icons/fi';
import { format } from 'date-fns';
import { useColorPalette } from '../../../hooks/useColorPalette';

function PaymentBadge({ status }) {
  const s = status?.toLowerCase();
  if (s === 'paid')    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><FiCheckCircle className="mr-1" />Paid</span>;
  if (s === 'partial') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiAlertTriangle className="mr-1" />Partial Payment</span>;
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><FiAlertTriangle className="mr-1" />Pending Payment</span>;
}

export default function OrderDetailModal({ order, onClose, onDownload, onWhatsApp, onEdit }) {
  // ✅ Real color codes from palette
  const { getColorCode } = useColorPalette();

  if (!order) return null;

  const totalPieces = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) ?? 0;

  // Group flat items → design → color → { size: qty }
  const grouped = {};
  (order.items || []).forEach(item => {
    const key = `${item.design}__${item.pricePerUnit}`;
    if (!grouped[key]) grouped[key] = { design: item.design, pricePerUnit: item.pricePerUnit, colors: {} };
    if (!grouped[key].colors[item.color]) grouped[key].colors[item.color] = {};
    grouped[key].colors[item.color][item.size] = item.quantity;
  });
  const designGroups = Object.values(grouped);

  return (
    <Modal isOpen={!!order} onClose={onClose} title={`Order — ${order.challanNumber}`}>
      <div className="space-y-5 pb-24">

        {/* ── Summary banner ── */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Order Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Date</div>
              <div className="font-semibold text-gray-900">{format(new Date(order.createdAt), 'MMM dd, yyyy')}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Total Pieces</div>
              <div className="font-semibold text-gray-900">{totalPieces} pcs</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Payment Status</div>
              <PaymentBadge status={order.paymentStatus} />
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Fulfillment</div>
              <div className="font-semibold text-gray-900">
                {order.fulfillmentType === 'factorydirect' ? '🏭 Factory Direct' : '🏬 Warehouse'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Buyer Details ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">👤 Buyer Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Name',       order.buyerName],
              ['Contact',    order.buyerContact],
              ['Business',   order.businessName],
              ['Email',      order.buyerEmail],
              ['GST Number', order.gstNumber],
              ['Address',    order.buyerAddress],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                <div className="font-medium text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Order Items ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            📦 Order Items
            <span className="ml-2 text-sm font-normal text-gray-400">
              {designGroups.length} design{designGroups.length !== 1 ? 's' : ''} · {totalPieces} pcs
            </span>
          </h3>
          <div className="space-y-3">
            {designGroups.map(({ design, pricePerUnit, colors }) => {
              // Calculate design totals
              const designPcs = Object.values(colors).reduce((total, sizes) =>
                total + Object.values(sizes).reduce((s, q) => s + q, 0), 0);
              const designSubtotal = designPcs * pricePerUnit;

              return (
                <div key={design} className="border border-gray-200 rounded-xl overflow-hidden mb-3">

                  {/* ── Design header ── */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">

                    {/* Left: design name · total pcs */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{design}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{designPcs} pcs</span>
                    </div>

                    {/* Right: price/pc + subtotal */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-500 font-medium">₹{pricePerUnit}/pc</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs font-bold text-gray-800">
                        ₹{designSubtotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                  </div>

                  {/* ── Color rows ── */}
                  <div className="px-4 py-2 divide-y divide-gray-100">
                    {Object.entries(colors).map(([color, sizes]) => {
                      const colorTotal = Object.values(sizes).reduce((s, q) => s + q, 0);
                      const hex = getColorCode(color) || '#6b7280';
                      return (
                        <div key={color} className="flex items-center gap-3 py-2">

                          {/* Color dot */}
                          <span
                            title={color}
                            className="w-6 h-6 rounded-full shadow-sm flex-shrink-0"
                            style={{ backgroundColor: hex }}
                          />

                          {/* Size boxes */}
                          <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            {Object.entries(sizes).map(([sz, qty]) =>
                              qty > 0 && (
                                <span key={sz}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-700"
                                >
                                  <span className="font-semibold">{sz}</span>
                                  <span className="text-gray-400">×</span>
                                  <span>{qty}</span>
                                </span>
                              )
                            )}
                          </div>

                          {/* Color total */}
                          <span className="text-xs text-gray-400 font-medium flex-shrink-0">
                            {colorTotal} pcs
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Financials ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">💰 Financial Breakdown</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">₹{order.subtotalAmount?.toLocaleString('en-IN')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount {order.discountType === 'percentage' ? `(${order.discountValue}%)` : '(Fixed)'}</span>
                <span>−₹{order.discountAmount?.toLocaleString('en-IN')}</span>
              </div>
            )}
            {order.gstEnabled && order.gstAmount > 0 && (
              <>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>CGST ({(order.gstPercentage || 5) / 2}%)</span>
                  <span>₹{order.cgst?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>SGST ({(order.gstPercentage || 5) / 2}%)</span>
                  <span>₹{order.sgst?.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold">
              <span>TOTAL AMOUNT</span>
              <span className="text-indigo-600">₹{order.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span className="font-medium">Amount Paid</span>
              <span>−₹{order.amountPaid?.toLocaleString('en-IN')}</span>
            </div>
            <div className="border-t-2 border-gray-800 pt-2 flex justify-between text-base font-bold">
              <span>AMOUNT DUE</span>
              <span className={order.amountDue > 0 ? 'text-red-600' : 'text-gray-400'}>
                ₹{order.amountDue?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Payment History ── */}
        {order.paymentHistory?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              🕐 Payment History
              <span className="ml-2 text-sm font-normal text-gray-400">({order.paymentHistory.length} payments)</span>
            </h3>
            <div className="space-y-3">
              {order.paymentHistory.map((p, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="text-2xl">
                    {p.paymentMethod === 'Cash' ? '💵' : p.paymentMethod === 'UPI' ? '📱' : p.paymentMethod === 'Cheque' ? '🏦' : '💳'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">₹{p.amount?.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-gray-400">
                        {p.paymentDate && format(new Date(p.paymentDate), 'MMM dd, yyyy · h:mm a')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.paymentMethod}</div>
                    {p.notes && <div className="text-xs text-gray-600 mt-1">{p.notes}</div>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center border-t border-gray-200 pt-3 font-semibold text-sm">
                <span>Total Paid</span>
                <span className="text-green-600">₹{order.amountPaid?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {order.notes && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-2">📝 Notes</h3>
            <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-100 rounded-lg p-3">{order.notes}</p>
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 flex gap-3 z-50 md:sticky md:bottom-0 md:-mx-6 md:px-6 md:-mb-6">
        <button onClick={() => onDownload(order)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <FiDownload size={15} /> Download
        </button>
        <button onClick={() => onWhatsApp(order)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">
          <FiMessageCircle size={15} /> WhatsApp
        </button>
        {/* ✅ Always show Edit — removed amountDue > 0 condition */}
        <button onClick={() => onEdit(order)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <FiEdit2 size={14} /> Edit
        </button>
      </div>
    </Modal>
  );
}
