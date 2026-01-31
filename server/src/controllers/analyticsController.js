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

// Get top 5 products per buyer
const getTopProductsPerBuyer = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { buyerId } = req.query;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer ID required' });
    }

    const orders = await WholesaleOrder.find({
      buyerId,
      organizationId,
      deletedAt: null
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
      .slice(0, 5);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    console.error('getTopProductsPerBuyer error:', error);
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

// Get sales velocity by product
const getSalesVelocityByProduct = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Aggregate from all channels
    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            saleDate: { $gte: startDate },
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned'] }
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
            totalQuantity: { $sum: '$items.quantity' }
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
            totalQuantity: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    // Combine all channels
    const velocityMap = {};
    
    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.design}-${item._id.color}-${item._id.size}`;
      if (!velocityMap[key]) {
        velocityMap[key] = {
          design: item._id.design,
          color: item._id.color,
          size: item._id.size,
          totalQuantity: 0,
          velocityPerDay: 0
        };
      }
      velocityMap[key].totalQuantity += item.totalQuantity;
    });

    // Calculate velocity per day
    const velocity = Object.values(velocityMap).map(item => ({
      ...item,
      velocityPerDay: (item.totalQuantity / parseInt(days)).toFixed(2)
    })).sort((a, b) => b.velocityPerDay - a.velocityPerDay);

    res.json({
      success: true,
      data: velocity,
      period: `${days} days`
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
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
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
        cancelledCount: stat.cancelledCount,
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

// Get return rate by product and account
const getReturnRateByProduct = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName } = req.query;

    const matchFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null
    };

    if (accountName) {
      matchFilter.accountName = accountName;
    }

    const stats = await MarketplaceSale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            design: '$design',
            color: '$color',
            accountName: '$accountName'
          },
          totalOrders: { $sum: 1 },
          returnedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] }
          },
          wrongReturnCount: {
            $sum: { $cond: [{ $eq: ['$status', 'wrongreturn'] }, 1, 0] }
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          successfulCount: {
            $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          returnRate: {
            $multiply: [
              { $divide: ['$returnedCount', '$totalOrders'] },
              100
            ]
          },
          wrongReturnRate: {
            $multiply: [
              { $divide: ['$wrongReturnCount', '$totalOrders'] },
              100
            ]
          },
          cancellationRate: {
            $multiply: [
              { $divide: ['$cancelledCount', '$totalOrders'] },
              100
            ]
          },
          totalIssueRate: {
            $multiply: [
              {
                $divide: [
                  { $add: ['$returnedCount', '$wrongReturnCount', '$cancelledCount'] },
                  '$totalOrders'
                ]
              },
              100
            ]
          }
        }
      },
      {
        $project: {
          design: '$_id.design',
          color: '$_id.color',
          accountName: '$_id.accountName',
          totalOrders: 1,
          returnedCount: 1,
          wrongReturnCount: 1,
          cancelledCount: 1,
          successfulCount: 1,
          returnRate: { $round: ['$returnRate', 2] },
          wrongReturnRate: { $round: ['$wrongReturnRate', 2] },
          cancellationRate: { $round: ['$cancellationRate', 2] },
          totalIssueRate: { $round: ['$totalIssueRate', 2] }
        }
      },
      { $sort: { totalIssueRate: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
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
    const { startDate, endDate, limit = 20 } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null,
      status: { $nin: ['cancelled', 'returned'] }
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
          status: { $nin: ['cancelled', 'returned'] }
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

// Get stock turnover rate
const getStockTurnoverRate = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { days = 90 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get total sales for the period
    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            saleDate: { $gte: startDate },
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned'] }
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
            quantitySold: { $sum: '$items.quantity' }
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
            quantitySold: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    // Get current stock
    const products = await Product.find({ organizationId }).lean();

    const turnoverData = [];
    const salesMap = {};

    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.design}-${item._id.color}-${item._id.size}`;
      salesMap[key] = (salesMap[key] || 0) + item.quantitySold;
    });

    products.forEach(product => {
      product.colors.forEach(colorVariant => {
        colorVariant.sizes.forEach(sizeVariant => {
          const key = `${product.design}-${colorVariant.color}-${sizeVariant.size}`;
          const quantitySold = salesMap[key] || 0;
          const avgStock = ((sizeVariant.currentStock || 0) + (sizeVariant.reservedStock || 0));
          
          const turnoverRate = avgStock > 0 ? (quantitySold / avgStock).toFixed(2) : 0;
          const daysToSell = quantitySold > 0 ? Math.ceil((avgStock * parseInt(days)) / quantitySold) : Infinity;

          turnoverData.push({
            design: product.design,
            color: colorVariant.color,
            size: sizeVariant.size,
            quantitySold,
            currentStock: avgStock,
            turnoverRate: parseFloat(turnoverRate),
            daysToSell: daysToSell === Infinity ? 0 : daysToSell,
            status: turnoverRate > 2 ? 'Fast Moving' : turnoverRate > 0.5 ? 'Average' : 'Slow Moving'
          });
        });
      });
    });

    res.json({
      success: true,
      data: turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate),
      period: `${days} days`
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
        const costPrice = colorVariant.costPrice || 0;
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
            status: { $nin: ['cancelled', 'returned'] }
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

// Get color/size distribution
const getColorSizeDistribution = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { days = 90 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [marketplace, wholesale, direct] = await Promise.all([
      MarketplaceSale.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            saleDate: { $gte: startDate },
            deletedAt: null,
            status: { $nin: ['cancelled', 'returned'] }
          }
        },
        {
          $group: {
            _id: { color: '$color', size: '$size' },
            quantity: { $sum: '$quantity' }
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
            _id: { color: '$items.color', size: '$items.size' },
            quantity: { $sum: '$items.quantity' }
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
            _id: { color: '$items.color', size: '$items.size' },
            quantity: { $sum: '$items.quantity' }
          }
        }
      ])
    ]);

    const distributionMap = {};
    const colorTotals = {};
    const sizeTotals = {};
    let grandTotal = 0;

    [...marketplace, ...wholesale, ...direct].forEach(item => {
      const key = `${item._id.color}-${item._id.size}`;
      distributionMap[key] = (distributionMap[key] || 0) + item.quantity;
      colorTotals[item._id.color] = (colorTotals[item._id.color] || 0) + item.quantity;
      sizeTotals[item._id.size] = (sizeTotals[item._id.size] || 0) + item.quantity;
      grandTotal += item.quantity;
    });

    const colorDistribution = Object.entries(colorTotals)
      .map(([color, quantity]) => ({
        color,
        quantity,
        percentage: ((quantity / grandTotal) * 100).toFixed(2)
      }))
      .sort((a, b) => b.quantity - a.quantity);

    const sizeDistribution = Object.entries(sizeTotals)
      .map(([size, quantity]) => ({
        size,
        quantity,
        percentage: ((quantity / grandTotal) * 100).toFixed(2)
      }))
      .sort((a, b) => b.quantity - a.quantity);

    res.json({
      success: true,
      data: {
        colorDistribution,
        sizeDistribution,
        totalSold: grandTotal
      },
      period: `${days} days`
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
