import { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analyticsService';
import { useColorPalette } from '../../hooks/useColorPalette';
import { FiX, FiTrendingUp, FiPackage, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const BuyerProductsModal = ({ buyer, dateRange, onClose }) => {
  const { getColorCode } = useColorPalette();

  const [activeTab, setActiveTab] = useState('top10');
  const [top10, setTop10] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState('');
  const [colorMatrix, setColorMatrix] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingTop10, setLoadingTop10] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);

  const dateParams = dateRange.filterType === 'alltime'
    ? {}
    : { startDate: dateRange.startDate, endDate: dateRange.endDate };

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN');

  useEffect(() => {
    fetchTop10();
    fetchDesigns();
  }, []);

  const fetchTop10 = async () => {
    setLoadingTop10(true);
    try {
      const res = await analyticsService.getTopProductsPerBuyer({
        buyerId: buyer.buyerId,
        ...dateParams,
        limit: 10
      });
      setTop10(res.data || []);
    } catch {
      toast.error('Failed to load top products');
    } finally {
      setLoadingTop10(false);
    }
  };

  const fetchDesigns = async () => {
    try {
      const res = await analyticsService.getBuyerDesignDrilldown({
        buyerId: buyer.buyerId,
        ...dateParams
      });
      setDesigns(res.data?.designs || []);
    } catch {
      console.error('Failed to load designs');
    }
  };

  const handleDesignSelect = async (design) => {
    setSelectedDesign(design);
    setColorMatrix([]);
    setSizes([]);
    setOrderHistory([]);
    if (!design) return;

    setDrillLoading(true);
    try {
      const res = await analyticsService.getBuyerDesignDrilldown({
        buyerId: buyer.buyerId,
        design,
        ...dateParams
      });
      setColorMatrix(res.data?.colorMatrix || []);
      setSizes(res.data?.sizes || []);
      setOrderHistory(res.data?.orderHistory || []);
    } catch {
      toast.error('Failed to load design data');
    } finally {
      setDrillLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fadeIn">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{buyer.buyerName}</h2>
            <p className="text-sm text-gray-500">{buyer.businessName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full font-medium">
              {dateRange.filterType === 'alltime'
                ? '🕐 All Time'
                : `${dateRange.startDate?.split('-').reverse().join('-')} — ${dateRange.endDate?.split('-').reverse().join('-')}`}
            </span>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('top10')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'top10'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiTrendingUp size={15} />
            Top 10 Products
          </button>
          <button
            onClick={() => setActiveTab('drilldown')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'drilldown'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiPackage size={15} />
            Design Drill-down
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── TAB 1: TOP 10 ── */}
          {activeTab === 'top10' && (
            loadingTop10 ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : top10.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FiPackage size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No product data for selected period</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {top10.map((product, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {index + 1}
                      </div>
                      <FiTrendingUp className="text-green-500" size={13} />
                    </div>
                    <div className="font-bold text-gray-900 text-sm mb-1 truncate">{product.design}</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="px-2 py-0.5 bg-white text-xs rounded-full text-gray-600 border">{product.color}</span>
                      <span className="px-2 py-0.5 bg-white text-xs rounded-full text-gray-600 border">{product.size}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-xs text-gray-500">Qty</div>
                        <div className="text-lg font-bold text-indigo-600">{product.totalQuantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Revenue</div>
                        <div className="text-xs font-bold text-green-600">{formatCurrency(product.totalRevenue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── TAB 2: DESIGN DRILL-DOWN ── */}
          {activeTab === 'drilldown' && (
            <div className="space-y-6">

              {/* Design Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-semibold text-gray-700">Select Design:</label>
                <select
                  value={selectedDesign}
                  onChange={(e) => handleDesignSelect(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white min-w-52 cursor-pointer"
                >
                  <option value="">-- Choose a design --</option>
                  {designs.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {designs.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    {designs.length} designs in this period
                  </span>
                )}
              </div>

              {/* Loading */}
              {drillLoading && (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              )}

              {/* Empty state */}
              {!drillLoading && !selectedDesign && (
                <div className="text-center py-16 text-gray-400">
                  <FiShoppingBag size={44} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Select a design above to see the breakdown</p>
                </div>
              )}

              {/* Data */}
              {!drillLoading && selectedDesign && (
                <>
                  {/* ── COLOR × SIZE MATRIX TABLE ── */}
                    {colorMatrix.length > 0 && (
                    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                        {/* Design Header */}
                        <div className="flex items-center justify-between bg-slate-700 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <h5 className="text-base font-bold text-white">{selectedDesign}</h5>
                            <span className="text-xs text-slate-300 bg-slate-600 px-2 py-0.5 rounded">
                            {colorMatrix.length} {colorMatrix.length === 1 ? 'color' : 'colors'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-300">
                            Revenue: <span className="text-white font-bold">
                                {formatCurrency(colorMatrix.reduce((s, r) => s + r.revenue, 0))}
                            </span>
                            </span>
                            <div className="bg-slate-600 px-3 py-1 rounded">
                            <span className="text-xs text-slate-300 font-medium">Total: </span>
                            <span className="text-sm font-bold text-white">
                                {colorMatrix.reduce((s, r) => s + r.totalQuantity, 0)}
                            </span>
                            </div>
                        </div>
                        </div>

                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Color</th>
                                {sizes.map(size => (
                                <th key={size} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase">{size}</th>
                                ))}
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase bg-slate-100">Total</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase bg-slate-100">Revenue</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                            {colorMatrix.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: getColorCode(row.color) }}
                                    />
                                    <span className="font-semibold text-gray-800">{row.color}</span>
                                    </div>
                                </td>
                                {sizes.map(size => (
                                    <td key={size} className="px-3 py-3 text-center">
                                    <span className="text-gray-700 font-medium">
                                        {row.quantities[size] || '-'}
                                    </span>
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-center bg-slate-50">
                                    <span className="inline-block bg-slate-700 text-white px-3 py-1 rounded font-bold text-sm">
                                    {row.totalQuantity}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right bg-slate-50 font-semibold text-green-600">
                                    {formatCurrency(row.revenue)}
                                </td>
                                </tr>
                            ))}

                            {/* Grand Total Row */}
                            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                                <td className="px-4 py-3 font-bold text-indigo-900">Total</td>
                                {sizes.map(size => (
                                <td key={size} className="px-3 py-3 text-center font-bold text-indigo-700">
                                    {colorMatrix.reduce((s, r) => s + (r.quantities[size] || 0), 0) || '-'}
                                </td>
                                ))}
                                <td className="px-4 py-3 text-center bg-indigo-100">
                                <span className="inline-block bg-indigo-700 text-white px-3 py-1 rounded font-bold text-sm">
                                    {colorMatrix.reduce((s, r) => s + r.totalQuantity, 0)}
                                </span>
                                </td>
                                <td className="px-4 py-3 text-right bg-indigo-100 font-bold text-green-700">
                                {formatCurrency(colorMatrix.reduce((s, r) => s + r.revenue, 0))}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    )}

                  {/* ── ORDER HISTORY TABLE ── */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Order History</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        All {orderHistory.length} orders containing <span className="font-medium">{selectedDesign}</span>
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Challan</th>
                            <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items Breakdown</th>
                            <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                            <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                            <th className="text-center py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderHistory.map((order, idx) => (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-3.5 px-5 text-sm text-gray-700 whitespace-nowrap">
                                {formatDate(order.orderDate)}
                              </td>
                              <td className="py-3.5 px-5 text-sm font-medium text-indigo-600 whitespace-nowrap">
                                {order.challanNumber || '—'}
                              </td>
                              <td className="py-3.5 px-5">
                                <div className="flex flex-wrap gap-1">
                                  {order.items.map((item, iIdx) => (
                                    <span
                                      key={iIdx}
                                      className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap"
                                    >
                                      {item.color} {item.size} × {item.quantity} @ {formatCurrency(item.pricePerUnit)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-right font-bold text-gray-900">{order.quantity}</td>
                              <td className="py-3.5 px-5 text-right font-semibold text-green-600 whitespace-nowrap">
                                {formatCurrency(order.revenue)}
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' :
                                  order.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {order.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orderHistory.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm">No orders found</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BuyerProductsModal;
