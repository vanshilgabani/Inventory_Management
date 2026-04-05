import { useEffect, useState } from 'react';
import { FiX, FiPackage } from 'react-icons/fi';
import { format } from 'date-fns';
import { useColorPalette } from '../../../src/hooks/useColorPalette';

const API_URL = import.meta.env.VITE_API_URL;

const OrderDetailDrawer = ({ orderId, onClose }) => {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(false);
  const { getColorCode }      = useColorPalette();

  useEffect(() => {
    if (!orderId) return;
    setDetail(null);
    setLoading(true);

    const token = localStorage.getItem('token');
    fetch(`${API_URL}/factory/received-detail/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(res => { if (res.success) setDetail(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  if (!orderId) return null;

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <p className="font-bold text-slate-800">Order Details</p>
            {detail && (
              <p className="text-xs text-slate-500">
                {detail.batchId} · {detail.sourceName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && detail && (() => {
            const items = detail.items?.length
              ? detail.items
              : [{ design: detail.design, color: detail.color, quantities: detail.quantities, totalQuantity: detail.totalQuantity }];

            const sizes = items.length > 0
              ? [...new Set(items.flatMap(i => Object.keys(i.quantities || {})))]
              : [];

            return (
              <>
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Challan No', detail.batchId || '—'],
                    ['Supplier',   detail.sourceName || '—'],
                    ['Date',       detail.receivedDate ? format(new Date(detail.receivedDate), 'dd MMM yyyy') : '—'],
                    ['Total Qty',  `${detail.totalQuantity} pcs`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-sm font-semibold text-slate-700">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Items table */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Design</th>
                        <th className="px-3 py-2 text-left">Color</th>
                        {sizes.map(s => (
                          <th key={s} className="px-3 py-2 text-center">{s}</th>
                        ))}
                        <th className="px-3 py-2 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{item.design}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 inline-block shrink-0"
                                style={{ background: getColorCode(item.color) }}
                              />
                              <span className="text-slate-600">{item.color}</span>
                            </span>
                          </td>
                          {sizes.map(s => (
                            <td key={s} className="px-3 py-2 text-center text-slate-600">
                              {item.quantities?.[s] || '—'}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-slate-700">
                            {item.totalQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detail.notes && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    📝 {detail.notes}
                  </div>
                )}

                <p className="text-xs text-slate-400 mt-4 text-center">🔒 Read-only (managed by supplier)</p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailDrawer;