const Product = require('../models/Product');
const MarketplaceSale = require('../models/MarketplaceSale');
const WholesaleOrder = require('../models/WholesaleOrder');
const DirectSale = require('../models/DirectSale');
const Settlement = require('../models/Settlement'); // ✅ Import Settlement

// @desc Get dashboard stats
// @route GET /api/analytics/dashboard
// @access Private
const getDashboardStats = async (req, res) => {
  try {
    // Inventory stats
    const products = await Product.find({
      organizationId: req.organizationId,
    });

    let totalInventoryValue = 0;
    let totalStock = 0;
    let lowStockCount = 0;

    products.forEach((product) => {
      product.colors.forEach((color) => {
        color.sizes.forEach((size) => {
          totalStock += size.currentStock;
          totalInventoryValue += size.currentStock * color.retailPrice;
          if (size.currentStock <= size.reorderPoint) {
            lowStockCount += 1;
          }
        });
      });
    });

    // Dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Fetch Settlements for Revenue (Marketplace)
    const todaySettlements = await Settlement.find({
        settlementDate: { $gte: today },
        organizationId: req.organizationId
    });

    const monthlySettlements = await Settlement.find({
        settlementDate: { $gte: monthStart },
        organizationId: req.organizationId
    });

    // 2. Other Channels (Direct + Wholesale)
    const todayDirectSales = await DirectSale.find({
      saleDate: { $gte: today },
      organizationId: req.organizationId,
    });
    const todayWholesale = await WholesaleOrder.find({
      orderDate: { $gte: today },
      organizationId: req.organizationId,
    });

    const monthlyDirectSales = await DirectSale.find({
      saleDate: { $gte: monthStart },
      organizationId: req.organizationId,
    });
    const monthlyWholesale = await WholesaleOrder.find({
      orderDate: { $gte: monthStart },
      organizationId: req.organizationId,
    });

    // 3. Calculate Counts (Sales count is still useful from Orders)
    const todayMarketplaceSales = await MarketplaceSale.find({
        saleDate: { $gte: today },
        organizationId: req.organizationId
    });
    
    const todaySalesCount =
      todayMarketplaceSales.length +
      todayDirectSales.length +
      todayWholesale.length;

    // 4. Calculate Revenue (Marketplace = Settlements)
    const todayRevenue =
      todaySettlements.reduce((sum, s) => sum + (s.settlementAmount || 0), 0) + // ✅ Settlements
      todayDirectSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0) +
      todayWholesale.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const monthlyRevenue =
      monthlySettlements.reduce((sum, s) => sum + (s.settlementAmount || 0), 0) + // ✅ Settlements
      monthlyDirectSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0) +
      monthlyWholesale.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Pending wholesale payments
    const pendingOrders = await WholesaleOrder.find({
      paymentStatus: { $in: ['Pending', 'Partial'] },
      organizationId: req.organizationId,
    });

    const pendingAmount = pendingOrders.reduce(
      (sum, order) => sum + (order.amountDue || 0),
      0
    );

    res.json({
      totalStock,
      totalInventoryValue,
      lowStockCount,
      todaySalesCount,
      todayRevenue,
      monthlyRevenue,
      pendingAmount,
      totalProducts: products.length,
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get sales by channel
// @route GET /api/analytics/sales-by-channel
// @access Private
const getSalesByChannel = async (req, res) => {
  try {
    const settlements = await Settlement.find({ organizationId: req.organizationId }); // ✅ Fetch Settlements
    const marketplaceSales = await MarketplaceSale.find({ organizationId: req.organizationId }); // For count only
    const wholesaleSales = await WholesaleOrder.find({ organizationId: req.organizationId });
    const directSales = await DirectSale.find({ organizationId: req.organizationId });

    // ✅ Marketplace Revenue = Sum of Settlements
    const marketplaceRevenue = settlements.reduce(
      (sum, s) => sum + (s.settlementAmount || 0),
      0
    );
    const marketplaceCount = marketplaceSales.length;

    const wholesaleRevenue = wholesaleSales.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );
    const wholesaleCount = wholesaleSales.length;

    const directRevenue = directSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0
    );
    const directCount = directSales.length;

    res.json({
      marketplace: { count: marketplaceCount, revenue: marketplaceRevenue },
      wholesale: { count: wholesaleCount, revenue: wholesaleRevenue },
      direct: { count: directCount, revenue: directRevenue },
    });
  } catch (error) {
    console.error('getSalesByChannel error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get revenue trends last 12 months
// @route GET /api/analytics/revenue-trends
// @access Private
const getRevenueTrends = async (req, res) => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Fetch Data
    const settlements = await Settlement.find({ // ✅ Fetch Settlements
        settlementDate: { $gte: oneYearAgo },
        organizationId: req.organizationId
    });
    const directSales = await DirectSale.find({
      saleDate: { $gte: oneYearAgo },
      organizationId: req.organizationId,
    });
    const wholesaleOrders = await WholesaleOrder.find({
      orderDate: { $gte: oneYearAgo },
      organizationId: req.organizationId,
    });

    const revenueByMonth = {};

    // 1. Marketplace (Settlements)
    settlements.forEach((s) => {
      const month = s.settlementDate.toISOString().slice(0, 7); // YYYY-MM
      if (!revenueByMonth[month]) revenueByMonth[month] = 0;
      revenueByMonth[month] += s.settlementAmount || 0;
    });

    // 2. Direct Sales
    directSales.forEach((sale) => {
      const month = sale.saleDate.toISOString().slice(0, 7);
      if (!revenueByMonth[month]) revenueByMonth[month] = 0;
      revenueByMonth[month] += sale.totalAmount || 0;
    });

    // 3. Wholesale
    wholesaleOrders.forEach((order) => {
      const month = order.orderDate.toISOString().slice(0, 7);
      if (!revenueByMonth[month]) revenueByMonth[month] = 0;
      revenueByMonth[month] += order.totalAmount || 0;
    });

    // Format for Chart
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trends = Object.keys(revenueByMonth)
      .map((month) => {
        const [year, monthNum] = month.split('-');
        return {
          month: `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`,
          revenue: revenueByMonth[month],
          units: 0,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA - dateB;
      });

    res.json(trends);
  } catch (error) {
    console.error('getRevenueTrends error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getBestSellingDesigns = async (req, res) => {
    // This remains based on QUANTITY, so Sales data is still correct here.
    // No changes needed for logic, just keep existing implementation.
    try {
        const marketplaceSales = await MarketplaceSale.find({ organizationId: req.organizationId });
        const directSales = await DirectSale.find({ organizationId: req.organizationId });
        const wholesaleOrders = await WholesaleOrder.find({ organizationId: req.organizationId });

        const salesByDesign = {};

        // Marketplace
        marketplaceSales.forEach((sale) => {
            const key = `${sale.design}-${sale.color}`;
            if (!salesByDesign[key]) salesByDesign[key] = { design: sale.design, color: sale.color, quantity: 0, revenue: 0 };
            salesByDesign[key].quantity += sale.quantity || 0;
            // Revenue here is approximate gross for "Best Selling" sorting, not accounting
            salesByDesign[key].revenue += sale.totalSellingPrice || 0; 
        });

        // Direct
        directSales.forEach((sale) => {
            const key = `${sale.design}-${sale.color}`;
            if (!salesByDesign[key]) salesByDesign[key] = { design: sale.design, color: sale.color, quantity: 0, revenue: 0 };
            salesByDesign[key].quantity += sale.quantity || 0;
            salesByDesign[key].revenue += sale.totalAmount || 0;
        });

        // Wholesale
        wholesaleOrders.forEach((order) => {
            order.items.forEach((item) => {
                const key = `${item.design}-${item.color}`;
                if (!salesByDesign[key]) salesByDesign[key] = { design: item.design, color: item.color, quantity: 0, revenue: 0 };
                salesByDesign[key].quantity += item.quantity || 0;
                salesByDesign[key].revenue += (item.quantity || 0) * (item.pricePerUnit || 0);
            });
        });

        const bestSelling = Object.values(salesByDesign)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        res.json(bestSelling);
    } catch (error) {
        console.error('getBestSellingDesigns error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
  getDashboardStats,
  getSalesByChannel,
  getRevenueTrends,
  getBestSellingDesigns
};
