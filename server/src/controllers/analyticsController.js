const Product = require('../models/Product');
const MarketplaceSale = require('../models/MarketplaceSale');
const WholesaleOrder = require('../models/WholesaleOrder');
const DirectSale = require('../models/DirectSale');
const Settlement = require('../models/Settlement');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const mongoose = require('mongoose');

// ==========================================
// SECTION 1: WHOLESALE & DIRECT ANALYTICS
// ==========================================

// Get top performing wholesale buyers
const getTopWholesaleBuyers = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate, limit = 10 } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchFilter = { 
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null 
    };
    
    if (startDate || endDate) {
      matchFilter.orderDate = dateFilter;
    }

    const buyerStats = await WholesaleOrder.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$buyerId',
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          totalPaid: { $sum: '$amountPaid' },
          totalDue: { $sum: '$amountDue' },
          avgOrderValue: { $avg: '$totalAmount' },
          lastOrderDate: { $max: '$orderDate' },
          firstOrderDate: { $min: '$orderDate' }
        }
      },
      {
        $lookup: {
          from: 'wholesalebuyers',
          localField: '_id',
          foreignField: '_id',
          as: 'buyer'
        }
      },
      { $unwind: '$buyer' },
      {
        $addFields: {
          paymentReliability: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: ['$totalPaid', '$totalRevenue'] }, 100] }
            ]
          },
          avgDaysToPayment: {
            $divide: [
              { $subtract: ['$lastOrderDate', '$firstOrderDate'] },
              { $multiply: ['$orderCount', 86400000] } // Convert to days
            ]
          }
        }
      },
      {
        $project: {
          buyerId: '$_id',
          buyerName: '$buyer.name',
          businessName: '$buyer.businessName',
          mobile: '$buyer.mobile',
          totalRevenue: 1,
          orderCount: 1,
          totalPaid: 1,
          totalDue: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          paymentReliability: { $round: ['$paymentReliability', 2] },
          avgDaysToPayment: { $round: ['$avgDaysToPayment', 0] },
          lastOrderDate: 1,
          firstOrderDate: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: buyerStats
    });
  } catch (error) {
    console.error('getTopWholesaleBuyers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTopProductsPerBuyer = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { buyerId, startDate, endDate, limit = 10 } = req.query;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer ID required' });
    }

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const orders = await WholesaleOrder.find({
      buyerId,
      organizationId,
      deletedAt: null,
      ...(dateFilter.$gte && { orderDate: dateFilter })
    }).select('items');

    const productStats = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.design}-${item.color}-${item.size}`;
        if (!productStats[key]) {
          productStats[key] = {
            design: item.design,
            color: item.color,
            size: item.size,
            totalQuantity: 0,
            totalRevenue: 0,
            orderCount: 0
          };
        }
        productStats[key].totalQuantity += item.quantity;
        productStats[key].totalRevenue += item.quantity * item.pricePerUnit;
        productStats[key].orderCount += 1;
      });
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error('getTopProductsPerBuyer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBuyerDesignDrilldown = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { buyerId, design, startDate, endDate } = req.query;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer ID required' });
    }

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const orders = await WholesaleOrder.find({
      buyerId,
      organizationId,
      deletedAt: null,
      ...(dateFilter.$gte && { orderDate: dateFilter })
    })
      .select('challanNumber orderDate items paymentStatus')
      .sort({ orderDate: -1 });

    // Always build designs list
    const designSet = new Set();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.design) designSet.add(item.design);
      });
    });
    const designs = Array.from(designSet).sort();

    // If no design selected, just return designs list
    if (!design) {
      return res.json({ success: true, data: { designs, sizeBreakdown: [], orderHistory: [] } });
    }

    // Build size breakdown + order history for selected design
    const colorMap = {};
    const sizeSet = new Set();
    const orderHistory = [];

    orders.forEach(order => {
      const designItems = order.items.filter(item => item.design === design);
      if (designItems.length === 0) return;

      let orderQty = 0;
      let orderRevenue = 0;

      designItems.forEach(item => {
        const color = item.color || 'Unknown';
        const size = item.size || 'Unknown';
        sizeSet.add(size);

        if (!colorMap[color]) {
          colorMap[color] = { color, quantities: {}, totalQuantity: 0, revenue: 0 };
        }
        colorMap[color].quantities[size] = (colorMap[color].quantities[size] || 0) + item.quantity;
        colorMap[color].totalQuantity += item.quantity;
        colorMap[color].revenue += item.quantity * item.pricePerUnit;
        orderQty += item.quantity;
        orderRevenue += item.quantity * item.pricePerUnit;
      });

      orderHistory.push({
        challanNumber: order.challanNumber,
        orderDate: order.orderDate,
        quantity: orderQty,
        revenue: orderRevenue,
        paymentStatus: order.paymentStatus,
        items: designItems.map(item => ({
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          subtotal: item.quantity * item.pricePerUnit
        }))
      });
    });

    // Sort sizes in standard order
    const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];
    const sizes = SIZE_ORDER.filter(s => sizeSet.has(s));

    const colorMatrix = Object.values(colorMap)
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

    res.json({
      success: true,
      data: { designs, colorMatrix, sizes, orderHistory }
    });
  } catch (error) {
    console.error('getBuyerDesignDrilldown error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get wholesale revenue trends
const getWholesaleRevenueTrends = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { period = 'month' } = req.query; // day, week, month, quarter, year

    let groupFormat;
    switch (period) {
      case 'day':
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } };
        break;
      case 'week':
        groupFormat = { $dateToString: { format: '%Y-W%V', date: '$orderDate' } };
        break;
      case 'quarter':
        groupFormat = {
          $concat: [
            { $toString: { $year: '$orderDate' } },
            '-Q',
            { $toString: { $ceil: { $divide: [{ $month: '$orderDate' }, 3] } } }
          ]
        };
        break;
      case 'year':
        groupFormat = { $dateToString: { format: '%Y', date: '$orderDate' } };
        break;
      default: // month
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$orderDate' } };
    }

    const trends = await WholesaleOrder.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          deletedAt: null
        }
      },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          paid: { $sum: '$amountPaid' },
          due: { $sum: '$amountDue' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('getWholesaleRevenueTrends error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get direct sales amount
const getDirectSalesAmount = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchFilter = { 
      organizationId,
      deletedAt: null 
    };
    
    if (startDate || endDate) {
      matchFilter.saleDate = dateFilter;
    }

    const result = await DirectSale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalTransactions: { $sum: 1 },
          avgTransaction: { $avg: '$totalAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: result[0] || { totalAmount: 0, totalTransactions: 0, avgTransaction: 0 }
    });
  } catch (error) {
    console.error('getDirectSalesAmount error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSalesVelocityByProduct = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    let days = 30; // default fallback for velocity calculation

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      dateFilter = { $gte: start, $lte: end };
      // Calculate actual number of days in range for velocity
      days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    } else {
      // alltime — no date filter, use total days from beginning
      // velocity will be calculated but may not be meaningful for alltime
      days = 1;
    }

    const matchDate = (field) => dateFilter.$gte ? { [field]: dateFilter } : {};

    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
          }
        },
        {
          $group: {
            _id: { design: '$design', color: '$color', size: '$size' },
            totalQuantity: { $sum: '$quantity' }
          }
        }
      ]),
      WholesaleOrder.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('orderDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            totalQuantity: { $sum: '$items.quantity' }
          }
        }
      ]),
      DirectSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            totalQuantity: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    const velocityMap = {};

    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.design}-${item._id.color}-${item._id.size}`;
      if (!velocityMap[key]) {
        velocityMap[key] = {
          design: item._id.design,
          color: item._id.color,
          size: item._id.size,
          totalQuantity: 0
        };
      }
      velocityMap[key].totalQuantity += item.totalQuantity;
    });

    const velocity = Object.values(velocityMap)
      .map(item => ({
        ...item,
        velocityPerDay: (item.totalQuantity / days).toFixed(2)
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    res.json({
      success: true,
      data: velocity,
      days
    });
  } catch (error) {
    console.error('getSalesVelocityByProduct error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// SECTION 2: MARKETPLACE ANALYTICS
// ==========================================

// Get order count and settlements by account
const getMarketplaceAccountStats = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const salesMatch = { 
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null 
    };
    const settlementMatch = { 
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };
    
    if (startDate || endDate) {
      salesMatch.saleDate = dateFilter;
      settlementMatch.settlementDate = dateFilter;
    }

    const [orderStats, settlementStats] = await Promise.all([
      MarketplaceSale.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: '$accountName',
            orderCount: { $sum: 1 },
            dispatchedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
            },
            returnedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] }
            },
            wrongReturnCount: {
              $sum: { $cond: [{ $eq: ['$status', 'wrongreturn'] }, 1, 0] }
            },
            RTOCount: {
              $sum: { $cond: [{ $eq: ['$status', 'RTO'] }, 1, 0] }
            },
          }
        }
      ]),
      Settlement.aggregate([
        { $match: settlementMatch },
        {
          $group: {
            _id: '$accountName',
            totalSettlement: { $sum: '$settlementAmount' },
            settlementCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // Merge both results
    const accountMap = {};
    
    orderStats.forEach(stat => {
      accountMap[stat._id] = {
        accountName: stat._id,
        orderCount: stat.orderCount,
        dispatchedCount: stat.dispatchedCount,
        returnedCount: stat.returnedCount,
        wrongReturnCount: stat.wrongReturnCount,
        RTOCount: stat.RTOCount,
        totalSettlement: 0,
        settlementCount: 0
      };
    });

    settlementStats.forEach(stat => {
      if (accountMap[stat._id]) {
        accountMap[stat._id].totalSettlement = stat.totalSettlement;
        accountMap[stat._id].settlementCount = stat.settlementCount;
      } else {
        accountMap[stat._id] = {
          accountName: stat._id,
          orderCount: 0,
          dispatchedCount: 0,
          returnedCount: 0,
          wrongReturnCount: 0,
          cancelledCount: 0,
          totalSettlement: stat.totalSettlement,
          settlementCount: stat.settlementCount
        };
      }
    });

    const result = Object.values(accountMap).sort((a, b) => b.orderCount - a.orderCount);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('getMarketplaceAccountStats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReturnRateByProduct = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName, startDate, endDate } = req.query;

    const matchFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null
    };

    if (accountName) matchFilter.accountName = accountName;

    if (startDate && endDate) {
      matchFilter.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const stats = await MarketplaceSale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            design: '$design',
            color: '$color',
            size: '$size',         // ✅ added size
            accountName: '$accountName'
          },
          totalOrders: { $sum: 1 },
          successfulCount: {
            $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
          },
          returnedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] }
          },
          wrongReturnCount: {
            $sum: { $cond: [{ $eq: ['$status', 'wrongreturn'] }, 1, 0] }
          },
          RTOCount: {                // ✅ was missing entirely
            $sum: { $cond: [{ $eq: ['$status', 'RTO'] }, 1, 0] }
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          returnRate: {
            $round: [{
              $cond: [
                { $gt: ['$totalOrders', 0] },
                {
                  $multiply: [
                    { $divide: [{ $add: ['$returnedCount', '$wrongReturnCount'] }, '$totalOrders'] },
                    100
                  ]
                },
                0
              ]
            }, 2]
          },
          rtoRate: {
            $round: [{
              $cond: [
                { $gt: ['$totalOrders', 0] },
                { $multiply: [{ $divide: ['$RTOCount', '$totalOrders'] }, 100] },
                0
              ]
            }, 2]
          },
          wrongReturnRate: {
            $round: [{
              $cond: [
                { $gt: ['$totalOrders', 0] },
                { $multiply: [{ $divide: ['$wrongReturnCount', '$totalOrders'] }, 100] },
                0
              ]
            }, 2]
          },
          totalIssueRate: {
            $round: [{
              $cond: [
                { $gt: ['$totalOrders', 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $add: ['$returnedCount', '$wrongReturnCount', '$RTOCount', '$cancelledCount'] },
                        '$totalOrders'
                      ]
                    },
                    100
                  ]
                },
                0
              ]
            }, 2]
          }
        }
      },
      {
        $project: {
          _id: 0,
          design: '$_id.design',
          color: '$_id.color',
          size: '$_id.size',
          accountName: '$_id.accountName',
          totalOrders: 1,
          successfulCount: 1,
          returnedCount: 1,
          wrongReturnCount: 1,
          RTOCount: 1,
          cancelledCount: 1,
          returnRate: 1,
          rtoRate: 1,
          wrongReturnRate: 1,
          totalIssueRate: 1
        }
      },
      { $sort: { returnRate: -1 } }  // default sort by returnRate desc
    ]);

    // Also return distinct accounts for dropdown
    const accounts = await MarketplaceSale.distinct('accountName', {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null
    });

    res.json({
      success: true,
      data: stats,
      accounts: accounts.filter(Boolean).sort()
    });
  } catch (error) {
    console.error('getReturnRateByProduct error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get best selling marketplace products (top 20)
const getBestSellingMarketplaceProducts = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate, limit = 20, accountName } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null,
      status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] },
      ...(accountName && { accountName })
    };
    
    if (startDate || endDate) {
      matchFilter.saleDate = dateFilter;
    }

    const bestSelling = await MarketplaceSale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { design: '$design', color: '$color', size: '$size' },
          totalQuantity: { $sum: '$quantity' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          design: '$_id.design',
          color: '$_id.color',
          size: '$_id.size',
          totalQuantity: 1,
          orderCount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: bestSelling
    });
  } catch (error) {
    console.error('getBestSellingMarketplaceProducts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get stock recommendations based on sales
const getStockRecommendations = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get sales data
    const salesData = await MarketplaceSale.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          saleDate: { $gte: startDate },
          deletedAt: null,
          status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
        }
      },
      {
        $group: {
          _id: { design: '$design', color: '$color', size: '$size' },
          totalSold: { $sum: '$quantity' },
          avgDailySales: { $avg: '$quantity' }
        }
      }
    ]);

    // Get current stock levels
    const products = await Product.find({ organizationId }).lean();
    
    const recommendations = [];

    salesData.forEach(sale => {
      const product = products.find(p => p.design === sale._id.design);
      if (!product) return;

      const colorVariant = product.colors.find(c => c.color === sale._id.color);
      if (!colorVariant) return;

      const sizeVariant = colorVariant.sizes.find(s => s.size === sale._id.size);
      if (!sizeVariant) return;

      const dailyVelocity = sale.totalSold / parseInt(days);
      const currentStock = (sizeVariant.currentStock || 0) + (sizeVariant.reservedStock || 0);
      const daysUntilStockout = currentStock > 0 ? Math.floor(currentStock / dailyVelocity) : 0;
      
      // Recommend reorder if stock will run out in less than 15 days
      const shouldReorder = daysUntilStockout < 15 && dailyVelocity > 0;
      const recommendedOrderQty = shouldReorder ? Math.ceil(dailyVelocity * 45) : 0; // 45 days of stock

      recommendations.push({
        design: sale._id.design,
        color: sale._id.color,
        size: sale._id.size,
        currentMainStock: sizeVariant.currentStock || 0,
        currentReservedStock: sizeVariant.reservedStock || 0,
        totalCurrentStock: currentStock,
        dailyVelocity: dailyVelocity.toFixed(2),
        daysUntilStockout,
        shouldReorder,
        recommendedOrderQty,
        priority: daysUntilStockout < 7 ? 'High' : daysUntilStockout < 15 ? 'Medium' : 'Low'
      });
    });

    // Sort by priority (High -> Medium -> Low) and days until stockout
    const sortedRecommendations = recommendations.sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.daysUntilStockout - b.daysUntilStockout;
    });

    res.json({
      success: true,
      data: sortedRecommendations,
      period: `${days} days`
    });
  } catch (error) {
    console.error('getStockRecommendations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// INVENTORY INTELLIGENCE
// ==========================================

// Get current stock levels
const getCurrentStockLevels = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { design, color, lowStockOnly } = req.query;

    const filter = { organizationId };
    if (design) filter.design = design;

    const products = await Product.find(filter).lean();

    const stockLevels = [];

    products.forEach(product => {
      product.colors.forEach(colorVariant => {
        if (color && colorVariant.color !== color) return;

        colorVariant.sizes.forEach(sizeVariant => {
          const totalStock = (sizeVariant.currentStock || 0) + (sizeVariant.reservedStock || 0);
          const isLowStock = totalStock <= (sizeVariant.reorderPoint || 0);

          if (lowStockOnly === 'true' && !isLowStock) return;

          stockLevels.push({
            design: product.design,
            color: colorVariant.color,
            size: sizeVariant.size,
            mainStock: sizeVariant.currentStock || 0,
            reservedStock: sizeVariant.reservedStock || 0,
            totalStock,
            reorderPoint: sizeVariant.reorderPoint || 0,
            isLowStock,
            costPrice: colorVariant.costPrice || 0,
            retailPrice: colorVariant.retailPrice || 0,
            stockValue: totalStock * (colorVariant.costPrice || 0)
          });
        });
      });
    });

    res.json({
      success: true,
      data: stockLevels.sort((a, b) => a.design.localeCompare(b.design))
    });
  } catch (error) {
    console.error('getCurrentStockLevels error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockTurnoverRate = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    let days = 90;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      dateFilter = { $gte: start, $lte: end };
      days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }

    const matchDate = (field) => dateFilter.$gte ? { [field]: dateFilter } : {};

    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
          }
        },
        {
          $group: {
            _id: { design: '$design', color: '$color', size: '$size' },
            quantitySold: { $sum: '$quantity' }
          }
        }
      ]),
      WholesaleOrder.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('orderDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            quantitySold: { $sum: '$items.quantity' }
          }
        }
      ]),
      DirectSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            quantitySold: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    const products = await Product.find({ organizationId }).lean();

    const salesMap = {};
    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.design}-${item._id.color}-${item._id.size}`;
      salesMap[key] = (salesMap[key] || 0) + item.quantitySold;
    });

    const turnoverData = [];

    products.forEach(product => {
      product.colors.forEach(colorVariant => {
        colorVariant.sizes.forEach(sizeVariant => {
          const key = `${product.design}-${colorVariant.color}-${sizeVariant.size}`;
          const quantitySold = salesMap[key] || 0;
          const totalStock = (sizeVariant.currentStock || 0) + (sizeVariant.reservedStock || 0);
          const turnoverRate = totalStock > 0 ? (quantitySold / totalStock).toFixed(2) : 0;
          const daysToSell = quantitySold > 0
            ? Math.ceil((totalStock * days) / quantitySold)
            : 0;

          turnoverData.push({
            design: product.design,
            color: colorVariant.color,
            size: sizeVariant.size,
            quantitySold,
            currentStock: totalStock,
            turnoverRate: parseFloat(turnoverRate),
            daysToSell,
            status: turnoverRate > 2 ? 'Fast Moving' : turnoverRate > 0.5 ? 'Average' : 'Slow Moving'
          });
        });
      });
    });

    res.json({
      success: true,
      data: turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate)
    });
  } catch (error) {
    console.error('getStockTurnoverRate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get stock value by inventory type
const getStockValueByType = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const products = await Product.find({ organizationId }).lean();

    let totalMainValue = 0;
    let totalReservedValue = 0;
    let totalMainQty = 0;
    let totalReservedQty = 0;

    products.forEach(product => {
      product.colors.forEach(colorVariant => {
        const costPrice = colorVariant.wholesalePrice || colorVariant.retailPrice || 0;
        colorVariant.sizes.forEach(sizeVariant => {
          const mainStock = sizeVariant.currentStock || 0;
          const reservedStock = sizeVariant.reservedStock || 0;
          
          totalMainValue += mainStock * costPrice;
          totalReservedValue += reservedStock * costPrice;
          totalMainQty += mainStock;
          totalReservedQty += reservedStock;
        });
      });
    });

    res.json({
      success: true,
      data: {
        main: {
          quantity: totalMainQty,
          value: totalMainValue.toFixed(2)
        },
        reserved: {
          quantity: totalReservedQty,
          value: totalReservedValue.toFixed(2)
        },
        total: {
          quantity: totalMainQty + totalReservedQty,
          value: (totalMainValue + totalReservedValue).toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('getStockValueByType error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get optimal reorder points
const getOptimalReorderPoints = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { days = 60, leadTime = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Calculate average daily sales
    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            saleDate: { $gte: startDate },
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
          }
        },
        {
          $group: {
            _id: { design: '$design', color: '$color', size: '$size' },
            totalSold: { $sum: '$quantity' }
          }
        }
      ]),
      WholesaleOrder.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            orderDate: { $gte: startDate },
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            totalSold: { $sum: '$items.quantity' }
          }
        }
      ]),
      DirectSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            saleDate: { $gte: startDate },
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              design: '$items.design',
              color: '$items.color',
              size: '$items.size'
            },
            totalSold: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    const products = await Product.find({ organizationId }).lean();
    const reorderPoints = [];
    const salesMap = {};

    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.design}-${item._id.color}-${item._id.size}`;
      salesMap[key] = (salesMap[key] || 0) + item.totalSold;
    });

    products.forEach(product => {
      product.colors.forEach(colorVariant => {
        colorVariant.sizes.forEach(sizeVariant => {
          const key = `${product.design}-${colorVariant.color}-${sizeVariant.size}`;
          const totalSold = salesMap[key] || 0;
          const avgDailySales = totalSold / parseInt(days);
          
          // Reorder Point = (Average Daily Sales × Lead Time) + Safety Stock
          const safetyStock = Math.ceil(avgDailySales * 3); // 3 days safety stock
          const optimalReorderPoint = Math.ceil((avgDailySales * parseInt(leadTime)) + safetyStock);
          const currentReorderPoint = sizeVariant.reorderPoint || 0;

          if (totalSold > 0) {
            reorderPoints.push({
              design: product.design,
              color: colorVariant.color,
              size: sizeVariant.size,
              currentReorderPoint,
              optimalReorderPoint,
              avgDailySales: avgDailySales.toFixed(2),
              needsUpdate: currentReorderPoint !== optimalReorderPoint,
              difference: optimalReorderPoint - currentReorderPoint
            });
          }
        });
      });
    });

    res.json({
      success: true,
      data: reorderPoints.filter(r => r.needsUpdate).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
      period: `${days} days`,
      leadTime: `${leadTime} days`
    });
  } catch (error) {
    console.error('getOptimalReorderPoints error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getColorSizeDistribution = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate, design } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const matchDate = (field) => dateFilter.$gte ? { [field]: dateFilter } : {};

    // Design filter — applied to all aggregations if provided
    const designFilter = (field) => design ? { [field]: design } : {};

    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            ...designFilter('design'),
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
          }
        },
        {
          $group: {
            _id: { design: '$design', color: '$color', size: '$size' },
            quantity: { $sum: '$quantity' }
          }
        }
      ]),
      WholesaleOrder.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('orderDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $match: {
            ...designFilter('items.design')
          }
        },
        {
          $group: {
            _id: { design: '$items.design', color: '$items.color', size: '$items.size' },
            quantity: { $sum: '$items.quantity' }
          }
        }
      ]),
      DirectSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            ...matchDate('saleDate'),
            deletedAt: null
          }
        },
        { $unwind: '$items' },
        {
          $match: {
            ...designFilter('items.design')
          }
        },
        {
          $group: {
            _id: { design: '$items.design', color: '$items.color', size: '$items.size' },
            quantity: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    // Collect all unique designs from this period (unfiltered)
    // We need designs list regardless of design filter for the dropdown
    let allDesigns = [];
    if (!design) {
      const designSet = new Set();
      [...marketplace, ...wholesale, ...direct].forEach(item => {
        if (item._id.design) designSet.add(item._id.design);
      });
      allDesigns = Array.from(designSet).sort();
    } else {
      // Still fetch designs list separately for dropdown (without design filter)
      const [mpDesigns, wsDesigns, dsDesigns] = await Promise.all([
        MarketplaceSale.distinct('design', {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          ...matchDate('saleDate'),
          deletedAt: null,
          status: { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
        }),
        WholesaleOrder.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              ...matchDate('orderDate'),
              deletedAt: null
            }
          },
          { $unwind: '$items' },
          { $group: { _id: '$items.design' } }
        ]),
        DirectSale.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              ...matchDate('saleDate'),
              deletedAt: null
            }
          },
          { $unwind: '$items' },
          { $group: { _id: '$items.design' } }
        ])
      ]);

      const designSet = new Set([
        ...mpDesigns,
        ...wsDesigns.map(d => d._id),
        ...dsDesigns.map(d => d._id)
      ]);
      allDesigns = Array.from(designSet).filter(Boolean).sort();
    }

    // Build colorSizeMap
    const colorSizeMap = {};
    let grandTotal = 0;

    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const color = item._id.color || 'Unknown';
      const size = item._id.size || 'Unknown';
      const qty = item.quantity;

      if (!colorSizeMap[color]) colorSizeMap[color] = {};
      colorSizeMap[color][size] = (colorSizeMap[color][size] || 0) + qty;
      grandTotal += qty;
    });

    const colorDistribution = Object.entries(colorSizeMap)
      .map(([color, sizes]) => {
        const colorTotal = Object.values(sizes).reduce((sum, q) => sum + q, 0);
        return {
          color,
          quantity: colorTotal,
          percentage: grandTotal > 0 ? ((colorTotal / grandTotal) * 100).toFixed(1) : '0',
          sizes: Object.entries(sizes)
            .map(([size, quantity]) => ({
              size,
              quantity,
              percentage: colorTotal > 0 ? ((quantity / colorTotal) * 100).toFixed(1) : '0'
            }))
            .sort((a, b) => b.quantity - a.quantity)
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

    const sizeTotals = {};
    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const size = item._id.size || 'Unknown';
      sizeTotals[size] = (sizeTotals[size] || 0) + item.quantity;
    });

    const sizeDistribution = Object.entries(sizeTotals)
      .map(([size, quantity]) => ({
        size,
        quantity,
        percentage: grandTotal > 0 ? ((quantity / grandTotal) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.quantity - a.quantity);

    res.json({
      success: true,
      data: {
        colorDistribution,
        sizeDistribution,
        totalSold: grandTotal,
        designs: allDesigns  // ✅ always return designs for dropdown
      }
    });
  } catch (error) {
    console.error('getColorSizeDistribution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GROWTH METRICS
// ==========================================

// Get growth metrics
const getGrowthMetrics = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const now = new Date();
    
    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Previous month
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Same month last year
    const lastYearMonthStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const lastYearMonthEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59);

    // Calculate revenue for each period
    const calculateRevenue = async (startDate, endDate) => {
      const [settlements, wholesale, direct] = await Promise.all([
        Settlement.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              settlementDate: { $gte: startDate, $lte: endDate }
            }
          },
          { $group: { _id: null, total: { $sum: '$settlementAmount' } } }
        ]),
        WholesaleOrder.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              orderDate: { $gte: startDate, $lte: endDate },
              deletedAt: null
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        DirectSale.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              saleDate: { $gte: startDate, $lte: endDate },
              deletedAt: null
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ])
      ]);

      return (
        (settlements[0]?.total || 0) +
        (wholesale[0]?.total || 0) +
        (direct[0]?.total || 0)
      );
    };

    const [currentMonthRevenue, prevMonthRevenue, lastYearMonthRevenue] = await Promise.all([
      calculateRevenue(currentMonthStart, currentMonthEnd),
      calculateRevenue(prevMonthStart, prevMonthEnd),
      calculateRevenue(lastYearMonthStart, lastYearMonthEnd)
    ]);

    // Calculate growth percentages
    const momGrowth = prevMonthRevenue > 0
      ? (((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(2)
      : 0;

    const yoyGrowth = lastYearMonthRevenue > 0
      ? (((currentMonthRevenue - lastYearMonthRevenue) / lastYearMonthRevenue) * 100).toFixed(2)
      : 0;

    // Get quarterly trends (last 4 quarters)
    const quarters = [];
    for (let i = 3; i >= 0; i--) {
      const quarterStart = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
      const quarterEnd = new Date(now.getFullYear(), now.getMonth() - (i * 3) + 3, 0, 23, 59, 59);
      const revenue = await calculateRevenue(quarterStart, quarterEnd);
      
      quarters.push({
        quarter: `Q${Math.floor((quarterStart.getMonth() / 3)) + 1} ${quarterStart.getFullYear()}`,
        revenue: parseFloat(revenue.toFixed(2)),
        startDate: quarterStart,
        endDate: quarterEnd
      });
    }

    // Simple linear regression for forecast
    const avgQuarterlyGrowth = quarters.length > 1
      ? ((quarters[quarters.length - 1].revenue - quarters[0].revenue) / quarters[0].revenue) / (quarters.length - 1)
      : 0;

    const nextQuarterForecast = quarters.length > 0
      ? quarters[quarters.length - 1].revenue * (1 + avgQuarterlyGrowth)
      : 0;

    res.json({
      success: true,
      data: {
        monthOverMonth: {
          current: currentMonthRevenue.toFixed(2),
          previous: prevMonthRevenue.toFixed(2),
          growth: parseFloat(momGrowth),
          isPositive: parseFloat(momGrowth) >= 0
        },
        yearOverYear: {
          current: currentMonthRevenue.toFixed(2),
          lastYear: lastYearMonthRevenue.toFixed(2),
          growth: parseFloat(yoyGrowth),
          isPositive: parseFloat(yoyGrowth) >= 0
        },
        quarterlyTrends: quarters,
        forecast: {
          nextQuarter: nextQuarterForecast.toFixed(2),
          confidence: quarters.length >= 3 ? 'Medium' : 'Low'
        }
      }
    });
  } catch (error) {
    console.error('getGrowthMetrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  
  // Section 1: Wholesale & Direct
  getTopWholesaleBuyers,
  getTopProductsPerBuyer,
  getBuyerDesignDrilldown,
  getWholesaleRevenueTrends,
  getDirectSalesAmount,
  getSalesVelocityByProduct,
  
  // Section 2: Marketplace
  getMarketplaceAccountStats,
  getReturnRateByProduct,
  getBestSellingMarketplaceProducts,
  getStockRecommendations,
  
  // Inventory Intelligence
  getCurrentStockLevels,
  getStockTurnoverRate,
  getStockValueByType,
  getOptimalReorderPoints,
  getColorSizeDistribution,
  
  // Growth Metrics
  getGrowthMetrics
};
