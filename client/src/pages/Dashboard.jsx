import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { wholesaleService } from '../services/wholesaleService';
import { directSalesService } from '../services/directSalesService';
import { settlementService } from '../services/settlementService';
import { factoryService } from '../services/factoryService';
import { useEnabledSizes } from '../hooks/useEnabledSizes';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal'; 
import { 
  FiPackage, 
  FiTrendingUp, 
  FiAlertCircle, 
  FiActivity,
  FiArrowRight,
  FiTruck,
  FiShoppingBag,
  FiShoppingCart,
  FiDollarSign,
  FiLayers,
  FiDownload,
  FiCheckSquare,
  FiSquare
} from 'react-icons/fi';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { enabledSizes, loading: sizesLoading } = useEnabledSizes();
  const { user } = useAuth(); // ✅ ADD THIS
  const isAdmin = user?.role === 'admin';
  
  // --- DATA STATES ---
  const [products, setProducts] = useState([]);
  const [marketplaceSales, setMarketplaceSales] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [wholesaleOrders, setWholesaleOrders] = useState([]);
  const [directSales, setDirectSales] = useState([]);
  const [factoryReceivings, setFactoryReceivings] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATES ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedDesigns, setSelectedDesigns] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

const fetchData = async () => {
  try {
    // Fetch all data in parallel
    const [
      productsData, 
      salesData, 
      settlementsData, 
      wholesaleData, 
      directData, 
      factoryData
    ] = await Promise.allSettled([
      inventoryService.getAllProducts(),
      salesService.getAllSales('all'),
      settlementService.getAllSettlements('all'), // ✅ Pass 'all' explicitly
      wholesaleService.getAllOrders(),
      directSalesService.getAllDirectSales(),
      factoryService.getAllReceivings(),
    ]);

    // Handle products
    if (productsData.status === 'fulfilled') {
      const products = Array.isArray(productsData.value) 
        ? productsData.value 
        : productsData.value?.products || [];
      setProducts(products);
    }

    // Handle marketplace sales
    if (salesData.status === 'fulfilled') {
      setMarketplaceSales(salesData.value || []);
    }

    // ✅ Handle settlements with explicit checks
    if (settlementsData.status === 'fulfilled') {
      const settlements = Array.isArray(settlementsData.value) 
        ? settlementsData.value 
        : settlementsData.value?.data || [];
      console.log('✅ Settlements loaded:', settlements.length, settlements);
      setSettlements(settlements);
    } else {
      console.error('❌ Settlements failed:', settlementsData.reason);
      setSettlements([]); // Set empty array as fallback
    }

    // Handle wholesale
    if (wholesaleData.status === 'fulfilled') {
      setWholesaleOrders(wholesaleData.value || []);
    }

    // Handle direct sales
    if (directData.status === 'fulfilled') {
      setDirectSales(directData.value || []);
    }

    // Handle factory
    if (factoryData.status === 'fulfilled') {
      setFactoryReceivings(factoryData.value || []);
    }

  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
  } finally {
    setLoading(false);
  }
};

  // --- 1. FINANCIAL CALCULATIONS ---

  const realizedRevenue = useMemo(() => {
  const settlementTotal = settlements.reduce((sum, s) => sum + Number(s.settlementAmount || 0), 0);
  const wholesalePaid = Array.isArray(wholesaleOrders) ? wholesaleOrders.reduce((sum, o) => sum + Number(o.amountPaid || 0), 0) : 0;
  const directTotal = Array.isArray(directSales) ? directSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0) : 0;
  return settlementTotal + wholesalePaid + directTotal;
}, [settlements, wholesaleOrders, directSales]);

const { totalRevenue, revenueBreakdown } = useMemo(() => {
  const marketplaceTotal = settlements.reduce((sum, s) => sum + Number(s.settlementAmount || 0), 0);
  const wholesaleTotal = Array.isArray(wholesaleOrders) ? wholesaleOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) : 0;
  const directTotal = Array.isArray(directSales) ? directSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0) : 0;
  
  return {
    totalRevenue: marketplaceTotal + wholesaleTotal + directTotal,
    revenueBreakdown: {
      marketplace: marketplaceTotal,
      wholesale: wholesaleTotal,
      direct: directTotal
    }
  };
}, [settlements, wholesaleOrders, directSales]);

  const pipelineValue = useMemo(() => {
    return Array.isArray(wholesaleOrders) ? wholesaleOrders.reduce((sum, o) => sum + Number(o.amountDue || 0), 0) : 0;
  }, [wholesaleOrders]);

  const topUnpaidBuyers = useMemo(() => {
    if (!Array.isArray(wholesaleOrders)) return [];
    const buyerDues = {};
    wholesaleOrders.forEach(order => {
        const due = Number(order.amountDue || 0);
        if (due > 0) {
            const name = order.businessName || order.buyerName || 'Unknown';
            if (!buyerDues[name]) buyerDues[name] = 0;
            buyerDues[name] += due;
        }
    });
    return Object.entries(buyerDues)
        .map(([name, totalDue]) => ({ name, totalDue }))
        .sort((a, b) => b.totalDue - a.totalDue)
        .slice(0, 3);
  }, [wholesaleOrders]);

  // --- 2. INVENTORY CALCULATIONS ---

  const { totalInventoryValue, totalStockCount } = useMemo(() => {
      let value = 0;
      let count = 0;
      if (Array.isArray(products)) {
        products.forEach(p => {
            if (p.colors && Array.isArray(p.colors)) {
                p.colors.forEach(c => {
                    const price = Number(c.wholesalePrice || 0);
                    if (c.sizes && Array.isArray(c.sizes)) {
                        c.sizes.forEach(s => {
                            if (enabledSizes.includes(s.size)) {
                                const stock = Number(s.currentStock || 0);
                                value += (stock * price);
                                count += stock;
                            }
                        });
                    }
                });
            }
        });
      }
      return { totalInventoryValue: value, totalStockCount: count };
  }, [products, enabledSizes]);

  const { topMovers, replenishmentAlerts } = useMemo(() => {
    const salesMap = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const processSale = (design, color, size, qty, dateStr) => {
        if (!design || !color || !size) return;
        const key = `${design}-${color}-${size}`;
        const date = new Date(dateStr);
        if (!salesMap[key]) salesMap[key] = { qty: 0, lastDate: date };
        if (date >= thirtyDaysAgo) salesMap[key].qty += qty;
    };

    if (Array.isArray(marketplaceSales)) marketplaceSales.forEach(s => processSale(s.design, s.color, s.size, s.quantity, s.saleDate));
    if (Array.isArray(wholesaleOrders)) wholesaleOrders.forEach(o => o.items?.forEach(item => processSale(item.design, item.color, item.size, item.quantity, o.createdAt)));
    if (Array.isArray(directSales)) directSales.forEach(s => s.items?.forEach(item => processSale(item.design, item.color, item.size, item.quantity, s.createdAt)));

    const movers = [];
    const alerts = [];

    if (Array.isArray(products)) {
        products.forEach(p => {
            p.colors?.forEach(c => {
                c.sizes?.forEach(s => {
                    if (!enabledSizes.includes(s.size)) return;
                    const key = `${p.design}-${c.color}-${s.size}`;
                    const salesData = salesMap[key] || { qty: 0 };
                    
                    const itemData = {
                        id: `${p.design}-${c.color}-${s.size}`, 
                        name: p.design,
                        variant: `${c.color} - ${s.size}`,
                        velocity: salesData.qty,
                        stock: s.currentStock,
                        reorderPoint: s.reorderPoint || 10
                    };

                    if (itemData.velocity > 0) movers.push(itemData);
                    if (itemData.stock <= itemData.reorderPoint) alerts.push(itemData);
                });
            });
        });
    }

    return {
        topMovers: movers.sort((a, b) => b.velocity - a.velocity),
        replenishmentAlerts: alerts
    };
  }, [products, marketplaceSales, wholesaleOrders, directSales, enabledSizes]);

  const groupedLowStock = useMemo(() => {
      const groups = {};
      replenishmentAlerts.forEach(item => {
          if (!groups[item.name]) groups[item.name] = [];
          groups[item.name].push(item);
      });
      return groups;
  }, [replenishmentAlerts]);

  // --- 3. EXPORT HANDLERS ---

  const toggleDesignSelection = (designName) => {
      setSelectedDesigns(prev => 
        prev.includes(designName) ? prev.filter(d => d !== designName) : [...prev, designName]
      );
  };

  const toggleSelectAllDesigns = () => {
      const allDesigns = Object.keys(groupedLowStock);
      setSelectedDesigns(selectedDesigns.length === allDesigns.length ? [] : allDesigns);
  };

  const openExportModal = () => {
      setSelectedDesigns([]); 
      setShowExportModal(true);
  };

  const handleDownloadCSV = () => {
      let itemsToExport = [];
      const designsToProcess = selectedDesigns.length > 0 ? selectedDesigns : Object.keys(groupedLowStock);
      
      designsToProcess.forEach(design => {
          if (groupedLowStock[design]) {
              itemsToExport = [...itemsToExport, ...groupedLowStock[design]];
          }
      });

      if (itemsToExport.length === 0) return;

      const headers = ['Design', 'Color', 'Size', 'Current Stock']; 
      const rows = itemsToExport.map(item => [
          item.name,
          item.variant.split(' - ')[0], 
          item.variant.split(' - ')[1], 
          item.stock
      ]);

      const csvContent = [
          headers.join(','), 
          ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Low_Stock_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      
      setShowExportModal(false);
  };

  // --- 4. ACTIVITY FEED ---
  const recentActivity = useMemo(() => {
    const activities = [];
    if (Array.isArray(wholesaleOrders)) wholesaleOrders.slice(0, 5).forEach(o => activities.push({
        title: `Wholesale: ${o.businessName || o.buyerName}`,
        desc: `₹${(o.totalAmount || 0).toLocaleString()} - ${o.items?.length || 0} items`,
        date: new Date(o.createdAt),
        link: '/wholesale',
        icon: FiShoppingCart,
        color: 'text-purple-600 bg-purple-100'
    }));
    if (Array.isArray(marketplaceSales)) marketplaceSales.slice(0, 5).forEach(s => activities.push({
        title: `Marketplace: ${s.accountName}`,
        desc: `${s.design} (${s.quantity}) - ${s.status}`,
        date: new Date(s.saleDate),
        link: '/sales',
        icon: FiShoppingBag,
        color: 'text-blue-600 bg-blue-100'
    }));
    if (Array.isArray(factoryReceivings)) factoryReceivings.slice(0, 5).forEach(r => activities.push({
        title: `Factory: Received Stock`,
        desc: `${r.design} - ${r.totalQuantity} units`,
        date: new Date(r.receivedDate),
        link: '/factory-receiving',
        icon: FiTruck,
        color: 'text-green-600 bg-green-100'
    }));
    return activities.sort((a, b) => b.date - a.date).slice(0, 8);
  }, [wholesaleOrders, marketplaceSales, factoryReceivings]);


  if (loading || sizesLoading) return <Loader />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Command Center</h1>
           <p className="text-gray-500">Real-time overview of finance and operations</p>
        </div>
        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
            Today: {format(new Date(), 'dd MMM yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Total Sales */}
        <div className="h-full group relative">
            <Card className="h-full bg-white border border-gray-200 relative overflow-hidden">
                <div className="transition-opacity duration-300 group-hover:opacity-0">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 font-medium">Total Sales</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-800">₹ {totalRevenue.toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FiTrendingUp className="text-xl"/></div>
                    </div>
                    <p className="text-xs text-gray-400">Hover for Breakdown</p>
                </div>
                <div className="absolute inset-0 bg-white p-6 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2 tracking-wider">Sales Breakdown</h4>
                    <div className="space-y-1.5 w-full">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                            <span className="text-xs text-gray-500">Marketplace</span>
                            <span className="text-sm font-bold text-gray-800">₹{(revenueBreakdown.marketplace).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                            <span className="text-xs text-gray-500">Wholesale</span>
                            <span className="text-sm font-bold text-gray-800">₹{(revenueBreakdown.wholesale).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Direct</span>
                            <span className="text-sm font-bold text-gray-800">₹{(revenueBreakdown.direct).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>

        {/* Pipeline Value */}
        <div className="h-full group relative">
            <Card className="h-full bg-white border border-gray-200 relative overflow-hidden">
                <div className="transition-opacity duration-300 group-hover:opacity-0">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 font-medium">Pipeline Value</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-800">₹ {pipelineValue.toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><FiActivity className="text-xl"/></div>
                    </div>
                    <p className="text-xs text-gray-400">Unpaid Wholesale</p>
                </div>
                <div className="absolute inset-0 bg-white p-5 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <h4 className="text-xs font-bold text-orange-600 uppercase mb-2 tracking-wider">Top Buyer Dues</h4>
                    <div className="space-y-2 w-full">
                        {topUnpaidBuyers.length > 0 ? (
                            topUnpaidBuyers.map((buyer, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0">
                                    <div className="truncate pr-2">
                                        <p className="text-xs font-medium text-gray-700 truncate w-24">{buyer.name}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-800 whitespace-nowrap">₹{(buyer.totalDue).toFixed(2)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-2">No pending payments</p>
                        )}
                    </div>
                </div>
            </Card>
        </div>

        {/* Inventory Value */}
        <Card className="bg-white border border-gray-200">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-gray-500 font-medium">Inv. Value</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-800">₹ {totalInventoryValue.toLocaleString('en-IN')}</h3>
                </div>
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><FiLayers className="text-xl"/></div>
            </div>
            <p className="text-xs text-gray-400">@ Wholesale Price</p>
        </Card>

        {/* Total Stock */}
        <Card className="bg-white border border-gray-200">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-gray-500 font-medium">Total Stock</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-800">{totalStockCount.toLocaleString('en-IN')}</h3>
                </div>
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FiPackage className="text-xl"/></div>
            </div>
            <p className="text-xs text-gray-400">All Variants</p>
        </Card>
      </div>

      {/* Main Content Grid (FIXED HEIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Top Movers */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FiTrendingUp className="text-green-600 text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Top Movers</h3>
                  <p className="text-xs text-gray-500">Best sellers (Last 30 days)</p>
                </div>
              </div>
            </div>

            {/* Fixed Height Container with Internal Scroll */}
            <div className="h-[220px] flex flex-col">
              {topMovers.length > 0 ? (
                <>
                  {/* Sticky Header */}
                  <div className="grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-xs font-semibold text-gray-600 bg-white">
                    <div className="col-span-4">Design</div>
                    <div className="col-span-3">Variant</div>
                    <div className="col-span-2 text-center">Velocity</div>
                    <div className="col-span-3 text-right">Stock</div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto mt-2 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {topMovers.map((item, idx) => (
                      <div 
                        key={idx}
                        className="grid grid-cols-12 gap-2 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm"
                      >
                        <div className="col-span-4 font-medium text-gray-800 truncate">
                          {item.name}
                        </div>
                        <div className="col-span-3 text-gray-600 text-xs truncate">
                          {item.variant}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            {item.velocity}
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className={`font-semibold ${
                            item.stock <= item.reorderPoint ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            {item.stock}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400 text-center">No sales data yet.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FiAlertCircle className="text-red-600 text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Low Stock Alert</h3>
                  <p className="text-xs text-gray-500">{replenishmentAlerts.length} items need attention</p>
                </div>
              </div>
              {replenishmentAlerts.length > 0 && (
                <button
                  onClick={openExportModal}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                  <FiDownload /> Export
                </button>
              )}
            </div>

            {/* Fixed Height Container with Internal Scroll */}
            <div className="h-[220px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {Object.keys(groupedLowStock).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupedLowStock).map(([design, items]) => {
                    const colorSizeMap = {};
                    items.forEach(item => {
                      const [color, size] = item.variant.split(' - ');
                      if (!colorSizeMap[color]) colorSizeMap[color] = {};
                      colorSizeMap[color][size] = { stock: item.stock, reorderPoint: item.reorderPoint };
                    });

                    const allColors = Object.keys(colorSizeMap);
                    const allSizes = [...new Set(items.map(i => i.variant.split(' - ')[1]))].sort();

                    return (
                      <div key={design} className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <h4 className="font-semibold text-gray-800 mb-3">{design}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-white">
                                <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">Color</th>
                                {allSizes.map(size => (
                                  <th key={size} className="border border-gray-300 px-2 py-1 text-center font-semibold text-gray-700">{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {allColors.map(color => (
                                <tr key={color} className="bg-white hover:bg-gray-50">
                                  <td className="border border-gray-300 px-2 py-1 font-medium text-gray-700">{color}</td>
                                  {allSizes.map(size => {
                                    const item = colorSizeMap[color][size];
                                    return (
                                      <td key={size} className="border border-gray-300 px-2 py-1 text-center">
                                        {item ? (
                                          <div className="relative group">
                                            <span className={`font-semibold ${
                                              item.stock === 0 ? 'text-red-600' : 'text-orange-600'
                                            }`}>
                                              {item.stock}
                                            </span>
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                              Min: {item.reorderPoint}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-gray-300">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400 text-center">Stock levels are healthy!</p>
                </div>
              )}
            </div>
          </Card>
        </div>

      {/* Activity Feed */}
      <Card>
          <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-800 text-lg">Recent Activity</h3>
          </div>
          <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                  <div 
                    key={i} 
                    onClick={() => navigate(activity.link)}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
                  >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activity.color}`}>
                          <activity.icon />
                      </div>
                      <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{activity.title}</h4>
                          <p className="text-xs text-gray-500">{activity.desc}</p>
                      </div>
                      <div className="text-right">
                          <span className="text-xs text-gray-400 block">{format(activity.date, 'MMM dd')}</span>
                          <span className="text-xs text-gray-300">{format(activity.date, 'HH:mm')}</span>
                      </div>
                      <FiArrowRight className="text-gray-300" />
                  </div>
              ))}
              {recentActivity.length === 0 && <p className="text-center text-gray-400 py-8">No recent activity.</p>}
          </div>
      </Card>

      {/* Export Modal */}
      <Modal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)}
        title="Select Designs to Export"
      >
          <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Select All Designs</span>
                  <div className="cursor-pointer text-xl" onClick={toggleSelectAllDesigns}>
                      {selectedDesigns.length === Object.keys(groupedLowStock).length && Object.keys(groupedLowStock).length > 0
                        ? <FiCheckSquare className="text-blue-600"/> 
                        : <FiSquare className="text-gray-400"/>
                      }
                  </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 custom-scrollbar">
                  {Object.keys(groupedLowStock).map((design, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                            selectedDesigns.includes(design) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={() => toggleDesignSelection(design)}
                      >
                          <div>
                              <p className="font-bold text-gray-800">{design}</p>
                              <p className="text-xs text-gray-500">
                                  {groupedLowStock[design].length} variants affected
                              </p>
                          </div>
                          <div className="text-xl">
                              {selectedDesigns.includes(design) 
                                ? <FiCheckSquare className="text-blue-600"/> 
                                : <FiSquare className="text-gray-300"/>
                              }
                          </div>
                      </div>
                  ))}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t mt-4">
                  <button 
                      onClick={() => setShowExportModal(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm"
                  >
                      Cancel
                  </button>
                  <button 
                      onClick={handleDownloadCSV}
                      disabled={replenishmentAlerts.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                      <FiDownload /> 
                      Download Report
                  </button>
              </div>
          </div>
      </Modal>

    </div>
  );
};

export default Dashboard;
