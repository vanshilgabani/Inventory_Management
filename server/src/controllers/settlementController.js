const Settlement = require('../models/Settlement');
const MarketplaceSale = require('../models/MarketplaceSale');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Create new settlement
exports.createSettlement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { accountName, settlementAmount, settlementDate, notes } = req.body;
    const organizationId = req.user.organizationId || req.user._id; // ✅ FIXED

    // Validation
    if (!accountName || !settlementAmount || !settlementDate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        code: 'INVALID_DATA',
        message: 'Account name, amount, and date are required'
      });
    }

    // Find last settlement for this account
    const lastSettlement = await Settlement.findOne({
      accountName,
      organizationId,
      settlementDate: { $lt: new Date(settlementDate) }
    }).sort({ settlementDate: -1 }).session(session);

    // Calculate period
    const periodStart = lastSettlement
      ? new Date(lastSettlement.settlementDate.getTime() + 24 * 60 * 60 * 1000) // Next day after last settlement
      : new Date(0); // Beginning of time if first settlement

    const periodEnd = new Date(settlementDate);
    periodEnd.setHours(23, 59, 59, 999);

    // Calculate units sold in this period
    const salesInPeriod = await MarketplaceSale.find({
      accountName,
      organizationId,
      saleDate: {
        $gte: periodStart,
        $lte: periodEnd
      }
    }).session(session);

    const unitsSold = salesInPeriod.reduce((sum, sale) => sum + sale.quantity, 0);

    // Create settlement
    const settlement = new Settlement({
      accountName,
      settlementAmount: parseFloat(settlementAmount),
      settlementDate: new Date(settlementDate),
      unitsSold,
      periodStart,
      periodEnd,
      notes: notes || '',
      organizationId
    });

    await settlement.save({ session });
    await session.commitTransaction();
    logger.info(`✅ Settlement created: ${accountName} - ₹${settlementAmount} - ${unitsSold} units`);

    res.status(201).json({
      success: true,
      data: settlement
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`❌ Settlement creation failed: ${error.message}`);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to create settlement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get all settlements
exports.getAllSettlements = async (req, res) => {
  try {
    const { accountName, startDate, endDate } = req.query;
    const organizationId = req.user.organizationId || req.user._id; // ✅ This is correct

    const filter = { organizationId };

    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    if (startDate && endDate) {
      filter.settlementDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await Settlement.find(filter)
      .sort({ settlementDate: -1 });

    // ✅ Return array directly (not wrapped)
    res.json(settlements);
  } catch (error) {
    logger.error(`❌ Get settlements failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements',
      error: error.message
    });
  }
};

// Get settlement by ID
exports.getSettlementById = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user._id; // ✅ FIXED

    const settlement = await Settlement.findOne({
      _id: req.params.id,
      organizationId
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  } catch (error) {
    logger.error(`❌ Get settlement failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlement',
      error: error.message
    });
  }
};

// Update settlement
exports.updateSettlement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { accountName, settlementAmount, settlementDate, notes } = req.body;
    const organizationId = req.user.organizationId || req.user._id; // ✅ FIXED

    const settlement = await Settlement.findOne({
      _id: req.params.id,
      organizationId
    }).session(session);

    if (!settlement) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    // Recalculate if date or account changed
    let periodStart = settlement.periodStart;
    let periodEnd = new Date(settlementDate || settlement.settlementDate);
    periodEnd.setHours(23, 59, 59, 999);

    if (settlementDate || accountName) {
      const lastSettlement = await Settlement.findOne({
        accountName: accountName || settlement.accountName,
        organizationId,
        settlementDate: { $lt: periodEnd },
        _id: { $ne: req.params.id }
      }).sort({ settlementDate: -1 }).session(session);

      periodStart = lastSettlement
        ? new Date(lastSettlement.settlementDate.getTime() + 24 * 60 * 60 * 1000)
        : new Date(0);
    }

    // Recalculate units
    const salesInPeriod = await MarketplaceSale.find({
      accountName: accountName || settlement.accountName,
      organizationId,
      saleDate: {
        $gte: periodStart,
        $lte: periodEnd
      }
    }).session(session);

    const unitsSold = salesInPeriod.reduce((sum, sale) => sum + sale.quantity, 0);

    // Update fields
    settlement.accountName = accountName || settlement.accountName;
    settlement.settlementAmount = settlementAmount !== undefined ? parseFloat(settlementAmount) : settlement.settlementAmount;
    settlement.settlementDate = settlementDate ? new Date(settlementDate) : settlement.settlementDate;
    settlement.notes = notes !== undefined ? notes : settlement.notes;
    settlement.unitsSold = unitsSold;
    settlement.periodStart = periodStart;
    settlement.periodEnd = periodEnd;

    await settlement.save({ session });
    await session.commitTransaction();
    logger.info(`✅ Settlement updated: ${settlement._id}`);

    res.json({
      success: true,
      data: settlement
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`❌ Settlement update failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update settlement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Delete settlement
exports.deleteSettlement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const organizationId = req.user.organizationId || req.user._id; // ✅ FIXED

    const settlement = await Settlement.findOneAndDelete({
      _id: req.params.id,
      organizationId
    }).session(session);

    if (!settlement) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    await session.commitTransaction();
    logger.info(`✅ Settlement deleted: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Settlement deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`❌ Settlement deletion failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete settlement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get units for settlement preview (before saving)
exports.getUnitsForPeriod = async (req, res) => {
  try {
    const { accountName, settlementDate } = req.query;
    const organizationId = req.user.organizationId || req.user._id; // ✅ FIXED

    if (!accountName || !settlementDate) {
      return res.status(400).json({
        success: false,
        message: 'Account name and settlement date are required'
      });
    }

    // Find last settlement
    const lastSettlement = await Settlement.findOne({
      accountName,
      organizationId,
      settlementDate: { $lt: new Date(settlementDate) }
    }).sort({ settlementDate: -1 });

    const periodStart = lastSettlement
      ? new Date(lastSettlement.settlementDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date(0);

    const periodEnd = new Date(settlementDate);
    periodEnd.setHours(23, 59, 59, 999);

    // Get sales in period
    const salesInPeriod = await MarketplaceSale.find({
      accountName,
      organizationId,
      saleDate: {
        $gte: periodStart,
        $lte: periodEnd
      }
    });

    const unitsSold = salesInPeriod.reduce((sum, sale) => sum + sale.quantity, 0);

    res.json({
      success: true,
      data: {
        unitsSold,
        periodStart,
        periodEnd
      }
    });
  } catch (error) {
    logger.error(`❌ Get units preview failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate units',
      error: error.message
    });
  }
};
