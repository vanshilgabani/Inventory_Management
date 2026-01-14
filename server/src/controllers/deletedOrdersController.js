const WholesaleOrder = require('../models/WholesaleOrder');
const DirectSale = require('../models/DirectSale');
const MarketplaceSale = require('../models/MarketplaceSale');
const logger = require('../utils/logger');

// Get all deleted orders (combined from all three sources)
exports.getAllDeletedOrders = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate, type } = req.query;

    const filter = {
      organizationId,
      deletedAt: { $ne: null }
    };

    // Date filter
    if (startDate && endDate) {
      filter.deletedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let wholesaleOrders = [];
    let directSales = [];
    let marketplaceSales = [];

    // Fetch based on type filter or all
    if (!type || type === 'wholesale') {
      wholesaleOrders = await WholesaleOrder.find(filter)
        .populate('deletedBy', 'name userName email') // ✅ ADD THIS
        .populate('createdBy.userId', 'name userName') // ✅ ADD THIS
        .sort({ deletedAt: -1 })
        .lean();
      
      wholesaleOrders = wholesaleOrders.map(order => ({
        ...order,
        orderType: 'wholesale',
        displayId: order.challanNumber || order._id,
        // ✅ Format deletedBy properly
        deletedBy: order.deletedBy ? {
          userName: order.deletedBy.userName || order.deletedBy.name || 'Unknown'
        } : { userName: 'Unknown' }
      }));
    }

    if (!type || type === 'direct-sales') {
      directSales = await DirectSale.find(filter)
        .populate('deletedBy', 'name userName email') // ✅ ADD THIS
        .populate('createdBy', 'name userName') // ✅ ADD THIS
        .sort({ deletedAt: -1 })
        .lean();
      
      directSales = directSales.map(sale => ({
        ...sale,
        orderType: 'direct-sales',
        displayId: `DS-${sale._id.toString().slice(0, 8).toUpperCase()}`,
        // ✅ Format deletedBy properly
        deletedBy: sale.deletedBy ? {
          userName: sale.deletedBy.userName || sale.deletedBy.name || 'Unknown'
        } : { userName: 'Unknown' }
      }));
    }

    if (!type || type === 'marketplace-sales') {
      marketplaceSales = await MarketplaceSale.find(filter)
        .populate('deletedBy', 'name userName email') // ✅ ADD THIS
        .populate('createdByUser.userId', 'name userName') // ✅ ADD THIS
        .sort({ deletedAt: -1 })
        .lean();
      
      marketplaceSales = marketplaceSales.map(sale => ({
        ...sale,
        orderType: 'marketplace-sales',
        displayId: sale.marketplaceOrderId || sale.orderItemId,
        // ✅ Format deletedBy properly
        deletedBy: sale.deletedBy ? {
          userName: sale.deletedBy.userName || sale.deletedBy.name || 'Unknown'
        } : { userName: 'Unknown' }
      }));
    }

    // Combine all deleted orders
    const allDeletedOrders = [
      ...wholesaleOrders,
      ...directSales,
      ...marketplaceSales
    ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    // Summary stats
    const summary = {
      total: allDeletedOrders.length,
      wholesale: wholesaleOrders.length,
      directSales: directSales.length,
      marketplaceSales: marketplaceSales.length
    };

    res.json({
      success: true,
      data: allDeletedOrders,
      summary
    });
  } catch (error) {
    logger.error('Failed to fetch deleted orders', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted orders',
      error: error.message
    });
  }
};

// Get deleted wholesale orders only
exports.getDeletedWholesaleOrders = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    const orders = await WholesaleOrder.find({
      organizationId,
      deletedAt: { $ne: null }
    })
    .sort({ deletedAt: -1 })
    .lean();

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Failed to fetch deleted wholesale orders', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted wholesale orders',
      error: error.message
    });
  }
};

// Get deleted direct sales only
exports.getDeletedDirectSales = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    const sales = await DirectSale.find({
      organizationId,
      deletedAt: { $ne: null }
    })
    .sort({ deletedAt: -1 })
    .lean();

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    logger.error('Failed to fetch deleted direct sales', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted direct sales',
      error: error.message
    });
  }
};

// Get deleted marketplace sales only
exports.getDeletedMarketplaceSales = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    const sales = await MarketplaceSale.find({
      organizationId,
      deletedAt: { $ne: null }
    })
    .sort({ deletedAt: -1 })
    .lean();

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    logger.error('Failed to fetch deleted marketplace sales', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted marketplace sales',
      error: error.message
    });
  }
};

// Restore a deleted order (remove deletedAt, deletedBy, deletionReason)
exports.restoreOrder = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { organizationId } = req.user;

    let Model;
    switch (type) {
      case 'wholesale':
        Model = WholesaleOrder;
        break;
      case 'direct-sales':
        Model = DirectSale;
        break;
      case 'marketplace-sales':
        Model = MarketplaceSale;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid order type'
        });
    }

    const order = await Model.findOne({ _id: id, organizationId, deletedAt: { $ne: null } });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Deleted order not found'
      });
    }

    // Restore order
    order.deletedAt = null;
    order.deletedBy = null;
    order.deletionReason = null;
    await order.save();

    logger.info('Order restored', {
      type,
      orderId: id,
      restoredBy: req.user.name
    });

    res.json({
      success: true,
      message: 'Order restored successfully',
      data: order
    });
  } catch (error) {
    logger.error('Failed to restore order', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to restore order',
      error: error.message
    });
  }
};

// Permanently delete order (hard delete)
exports.permanentlyDeleteOrder = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { organizationId } = req.user;

    let Model;
    switch (type) {
      case 'wholesale':
        Model = WholesaleOrder;
        break;
      case 'direct-sales':
        Model = DirectSale;
        break;
      case 'marketplace-sales':
        Model = MarketplaceSale;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid order type'
        });
    }

    const result = await Model.deleteOne({ _id: id, organizationId, deletedAt: { $ne: null } });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deleted order not found'
      });
    }

    logger.info('Order permanently deleted', {
      type,
      orderId: id,
      deletedBy: req.user.name
    });

    res.json({
      success: true,
      message: 'Order permanently deleted'
    });
  } catch (error) {
    logger.error('Failed to permanently delete order', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete order',
      error: error.message
    });
  }
};
