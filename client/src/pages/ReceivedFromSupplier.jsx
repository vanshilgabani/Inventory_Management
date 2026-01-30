import { useState, useEffect } from 'react';
import { FiTruck, FiPackage, FiCalendar, FiDownload, FiRefreshCw, FiChevronDown, FiChevronUp, FiCheckCircle, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useColorPalette } from '../../src/hooks/useColorPalette';

const ReceivedFromSupplier = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalItems: 0,
    lastSyncDate: null
  });

  const { getColorCode } = useColorPalette();

  useEffect(() => {
    fetchReceivedOrders();
  }, []);

  const fetchReceivedOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/supplier-sync/received-from-supplier', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ FIX: Access nested data
      const ordersData = result.data?.orders || [];
      setOrders(ordersData);
      
      // Calculate total units
      const totalUnits = ordersData.reduce((sum, order) => sum + order.totalQuantity, 0);
      
      setStats({
        totalOrders: result.data?.totalOrders || 0,
        totalItems: totalUnits,
        lastSyncDate: ordersData[0]?.receivedDate || null
      });

    } catch (error) {
      console.error('Failed to fetch received orders:', error);
      toast.error('Failed to load received orders');
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const exportToExcel = () => {
    try {
      const exportData = [];
      
      orders.forEach(order => {
        order.items.forEach(item => {
          const row = {
            'Order Date': format(new Date(order.orderDate), 'dd MMM yyyy'),
            'Challan Number': order.challanNumber,
            'Supplier': order.supplierName,
            'Design': item.design,
            'Color': item.color,
          };
          
          Object.entries(item.quantities).forEach(([size, qty]) => {
            row[`${size}`] = qty;
          });
          
          row['Total Quantity'] = item.totalQuantity;
          
          exportData.push(row);
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Received Orders');
      
      const filename = `Received_From_Supplier_${format(new Date(), 'dd-MMM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      toast.success('Exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading received orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      {/* Header Section */}
      <div className="mb-8 animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Received from Supplier
            </h1>
            <p className="text-gray-600 mt-2">Auto-synced orders from your supplier</p>
          </div>
          
          <button
            onClick={exportToExcel}
            disabled={orders.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <FiDownload className="text-xl" />
            Export to Excel
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-indigo-500 transform hover:scale-105 transition-all duration-300 animate-slideInLeft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="bg-indigo-100 p-4 rounded-xl">
                <FiTruck className="text-3xl text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all duration-300 animate-slideInLeft" style={{animationDelay: '0.1s'}}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Units Received</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalItems}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-xl">
                <FiPackage className="text-3xl text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500 transform hover:scale-105 transition-all duration-300 animate-slideInLeft" style={{animationDelay: '0.2s'}}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Last Sync</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.lastSyncDate ? format(new Date(stats.lastSyncDate), 'dd MMM, HH:mm') : 'Never'}
                </p>
              </div>
              <div className="bg-purple-100 p-4 rounded-xl">
                <FiRefreshCw className="text-3xl text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center animate-fadeIn">
          <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiTruck className="text-5xl text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No Orders Received Yet</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Orders from your supplier will appear here automatically when they create wholesale orders for you.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => (
            <div
              key={order.orderId}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-indigo-200 transform hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* 📌 Order Header with Sidebar - Clickable */}
              <div
                onClick={() => toggleOrderExpansion(order.orderId)}
                className="flex cursor-pointer relative overflow-hidden"
              >
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Left Sidebar - Icon with Glow Effect */}
                <div className={`relative w-24 flex flex-col items-center justify-center ${
                  order.acceptedBy 
                    ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700' 
                    : 'bg-gradient-to-br from-green-500 via-emerald-600 to-green-700'
                } shadow-lg`}>
                  {/* Animated Glow */}
                  <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                  
                  {/* Icon Circle with Glassmorphism */}
                  <div className="relative w-12 h-12 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center mb-2 shadow-xl border-2 border-white/30 group-hover:scale-110 transition-transform duration-300">
                    {order.acceptedBy ? (
                      <FiUser className="w-5 h-5 text-white drop-shadow-lg" />
                    ) : (
                      <FiCheckCircle className="w-7 h-7 text-white drop-shadow-lg" />
                    )}
                  </div>
                  
                  {/* Initials Badge */}
                  <div className="relative text-[11px] font-black text-white/95 tracking-widest px-2 py-0.5 bg-white/20 rounded-full backdrop-blur-sm">
                    {order.acceptedBy 
                      ? order.acceptedBy.substring(0, 3).toUpperCase() 
                      : 'AUTO'}
                  </div>
                  
                  {/* Decorative Line */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20"></div>
                </div>

                {/* Right Content with Padding */}
                <div className="relative flex-1 py-3 px-6 bg-gradient-to-br from-white to-gray-50/30">
                  <div className="space-y-2">
                    {/* Top Row - Challan & Total */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Challan Number */}
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors duration-300">
                        {order.challanNumber}
                      </h3>
                      
                      {/* Total Units Badge */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-baseline gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                          <span className="text-2xl font-black">{order.totalQuantity}</span>
                          <span className="text-xs font-semibold opacity-90">units</span>
                        </div>
                        
                        {/* Expand Icon */}
                        <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-all duration-300">
                          {expandedOrders[order.orderId] ? (
                            <FiChevronUp className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
                          ) : (
                            <FiChevronDown className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge with Animation */}
                    <div className="flex items-center">
                      {order.acceptedBy ? (
                        <div className="inline-flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-sm font-bold shadow-sm border border-blue-200 group-hover:shadow-md transition-all duration-300">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <FiUser className="w-4 h-4" />
                          <span>Accepted by {order.acceptedBy}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 rounded-full text-sm font-bold shadow-sm border border-green-200 group-hover:shadow-md transition-all duration-300">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>Auto-Synced</span>
                        </div>
                      )}
                    </div>

                    {/* Elegant Divider with Gradient */}
                    <div className="relative h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    </div>

                    {/* Metadata Grid with Icons */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Supplier */}
                      <div className="flex items-center gap-2.5 group/item">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 group-hover/item:bg-indigo-100 flex items-center justify-center transition-colors duration-300">
                          <FiTruck className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Supplier</div>
                          <div className="text-xs font-bold text-gray-900 truncate">{order.supplierName}</div>
                        </div>
                      </div>

                      {/* Order Date */}
                      <div className="flex items-center gap-2.5 group/item">
                        <div className="w-9 h-9 rounded-lg bg-purple-50 group-hover/item:bg-purple-100 flex items-center justify-center transition-colors duration-300">
                          <FiCalendar className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Date</div>
                          <div className="text-sm font-bold text-gray-900">{format(new Date(order.orderDate), 'dd MMM, HH:mm')}</div>
                        </div>
                      </div>

                      {/* Items Count */}
                      <div className="flex items-center gap-2.5 group/item">
                        <div className="w-9 h-9 rounded-lg bg-pink-50 group-hover/item:bg-pink-100 flex items-center justify-center transition-colors duration-300">
                          <FiPackage className="w-4 h-4 text-pink-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Items</div>
                          <div className="text-sm font-bold text-gray-900">{order.items?.length || 0} Item{order.items?.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative Corner Accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-100/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>

              {/* Expanded Content (keep your existing expanded content here) */}
              {expandedOrders[order.orderId] && (
                <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 animate-slideDown">
                  <h4 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Order Items</h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(
                      order.items.reduce((acc, item) => {
                        if (!acc[item.design]) {
                          acc[item.design] = [];
                        }
                        acc[item.design].push(item);
                        return acc;
                      }, {})
                    ).map(([design, designItems], designIndex) => {
                      const designTotal = designItems.reduce((sum, item) => sum + item.totalQuantity, 0);
                      
                      return (
                        <div
                          key={designIndex}
                          className="bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200"
                        >
                          <div className="flex items-center justify-between bg-slate-700 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <h5 className="text-base font-bold text-white">{design}</h5>
                              <span className="text-xs text-slate-300 bg-slate-600 px-2 py-0.5 rounded">
                                {designItems.length} {designItems.length === 1 ? 'color' : 'colors'}
                              </span>
                            </div>
                            <div className="bg-slate-600 px-3 py-1 rounded">
                              <span className="text-xs text-slate-300 font-medium">Total: </span>
                              <span className="text-sm font-bold text-white">{designTotal}</span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Color</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase">M</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase">L</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase">XL</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase">XXL</th>
                                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase bg-slate-100">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {designItems.map((item, colorIndex) => (
                                  <tr key={colorIndex} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-4 h-4 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0" 
                                          style={{backgroundColor: getColorCode(item.color)}}
                                        ></div>
                                        <span className="font-semibold text-gray-800 text-sm">{item.color}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className="text-gray-700 font-medium">
                                        {item.quantities['M'] || '-'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className="text-gray-700 font-medium">
                                        {item.quantities['L'] || '-'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className="text-gray-700 font-medium">
                                        {item.quantities['XL'] || '-'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className="text-gray-700 font-medium">
                                        {item.quantities['XXL'] || '-'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center bg-slate-50">
                                      <span className="inline-block bg-slate-700 text-white px-3 py-1 rounded font-bold text-sm">
                                        {item.totalQuantity}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                    <p className="text-xs text-amber-800 flex items-center gap-2">
                      <span>🔒</span>
                      <span className="font-medium">Read-only (managed by supplier)</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReceivedFromSupplier;
