const PendingRequest = require('../models/PendingRequest');
const DirectSale = require('../models/DirectSale');
const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const FactoryReceiving = require('../models/FactoryReceiving');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Helper to get model by module name
const getModelByModule = (module) => {
  const modelMap = {
    'direct-sales': DirectSale,
    'marketplace-sales': MarketplaceSale,
    'inventory': Product,
    'factory-receiving': FactoryReceiving,
  };
  return modelMap[module];
};

// ========================================
// CREATE REQUEST (Sales User)
// ========================================
const createRequest = async (req, res) => {
  try {
    const { module, action, recordId, recordIdentifier, oldData, newData, recordSnapshot, changesSummary } = req.body;
    const { _id: userId, name: userName, email: userEmail, organizationId } = req.user;

    // Validation
    if (!module || !action || !recordId || !recordIdentifier) {
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Module, action, recordId, and recordIdentifier are required',
      });
    }

    // Check if there's already a pending request for this record
    const existingRequest = await PendingRequest.findOne({
      module,
      recordId,
      status: 'pending',
      organizationId,
    });

    if (existingRequest) {
      return res.status(400).json({
        code: 'DUPLICATE_REQUEST',
        message: 'A pending request already exists for this record',
        existingRequestId: existingRequest._id,
      });
    }

    // Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Get current record timestamp for conflict detection
    let recordLastModifiedAt = new Date();
    if (action === 'edit') {
      try {
        const Model = getModelByModule(module);
        const record = await Model.findById(recordId);
        if (record && record.updatedAt) {
          recordLastModifiedAt = record.updatedAt;
        }
      } catch (error) {
        logger.warn('Could not fetch record timestamp', { module, recordId, error: error.message });
      }
    }

    // Create request
    const request = await PendingRequest.create({
      module,
      action,
      recordId,
      recordIdentifier,
      oldData,
      newData,
      recordSnapshot,
      changesSummary,
      requestedBy: {
        userId,
        userName,
        userEmail,
      },
      requestedAt: new Date(),
      expiresAt,
      recordLastModifiedAt,
      organizationId,
      adminNotified: false,
      salesUserNotified: false,
    });

    logger.info('Pending request created', {
      requestId: request._id,
      module,
      action,
      recordId,
      requestedBy: userName,
    });

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: request,
    });
  } catch (error) {
    logger.error('Failed to create request', { error: error.message });
    res.status(500).json({
      code: 'REQUEST_CREATION_FAILED',
      message: 'Failed to create request',
      error: error.message,
    });
  }
};

// ========================================
// GET ALL PENDING REQUESTS (Admin)
// ========================================
const getAllPendingRequests = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { status = 'pending', module } = req.query;

    const filter = { organizationId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (module) {
      filter.module = module;
    }

    const requests = await PendingRequest.find(filter)
      .populate('requestedBy.userId', 'name email')
      .populate('reviewedBy.userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Check for expired requests
    const now = new Date();
    requests.forEach((req) => {
      if (req.status === 'pending' && req.expiresAt < now) {
        req.isExpired = true;
      }
    });

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    logger.error('Failed to fetch pending requests', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch requests',
      error: error.message,
    });
  }
};

// ========================================
// GET MY REQUESTS (Sales User)
// ========================================
const getMyRequests = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const { status = 'all' } = req.query;

    const filter = { 'requestedBy.userId': userId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await PendingRequest.find(filter)
      .populate('reviewedBy.userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    logger.error('Failed to fetch my requests', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch your requests',
      error: error.message,
    });
  }
};

// ========================================
// GET REQUEST BY ID
// ========================================
const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const request = await PendingRequest.findOne({ _id: id, organizationId })
      .populate('requestedBy.userId', 'name email')
      .populate('reviewedBy.userId', 'name email')
      .lean();

    if (!request) {
      return res.status(404).json({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    logger.error('Failed to fetch request', { error: error.message, requestId: req.params.id });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch request',
      error: error.message,
    });
  }
};

// ========================================
// CHECK FOR CONFLICTS
// ========================================
const checkConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const request = await PendingRequest.findOne({ _id: id, organizationId });

    if (!request) {
      return res.status(404).json({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }

    // Only check conflict for edit actions
    if (request.action !== 'edit') {
      return res.json({
        success: true,
        hasConflict: false,
        message: 'No conflict check needed for this action',
      });
    }

    // Fetch current record
    const Model = getModelByModule(request.module);
    const currentRecord = await Model.findById(request.recordId);

    if (!currentRecord) {
      return res.status(404).json({
        code: 'RECORD_NOT_FOUND',
        message: 'Record no longer exists',
        hasConflict: true,
        conflictDetails: 'Record has been deleted',
      });
    }

    // Compare timestamps
    const recordModifiedAfterRequest = currentRecord.updatedAt > request.recordLastModifiedAt;

    if (recordModifiedAfterRequest) {
      // Update request with conflict info
      request.hasConflict = true;
      request.conflictDetails = `Record was modified on ${currentRecord.updatedAt.toLocaleString()} after this request was created`;
      await request.save();

      return res.json({
        success: true,
        hasConflict: true,
        conflictDetails: request.conflictDetails,
        currentRecordUpdatedAt: currentRecord.updatedAt,
        requestCreatedAt: request.recordLastModifiedAt,
      });
    }

    res.json({
      success: true,
      hasConflict: false,
      message: 'No conflicts detected',
    });
  } catch (error) {
    logger.error('Failed to check conflict', { error: error.message, requestId: req.params.id });
    res.status(500).json({
      code: 'CONFLICT_CHECK_FAILED',
      message: 'Failed to check for conflicts',
      error: error.message,
    });
  }
};

// ========================================
// APPROVE REQUEST (Admin)
// ========================================
const approveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { _id: adminId, name: adminName, email: adminEmail, organizationId } = req.user;

    const request = await PendingRequest.findOne({ _id: id, organizationId }).session(session);

    if (!request) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'REQUEST_ALREADY_PROCESSED',
        message: `Request is already ${request.status}`,
      });
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      request.status = 'expired';
      await request.save({ session });
      await session.commitTransaction();
      
      return res.status(400).json({
        code: 'REQUEST_EXPIRED',
        message: 'Request has expired',
      });
    }

    const Model = getModelByModule(request.module);

    // Execute the action
    if (request.action === 'edit') {
      // UPDATE RECORD
      const recordIds = request.recordId.split(',');
      
      for (const recordId of recordIds) {
        await Model.findByIdAndUpdate(
          recordId.trim(),
          { 
            ...request.newData,
            lastModifiedBy: `${adminName} (approved request from ${request.requestedBy.userName})`,
            lastModifiedAt: new Date(),
          },
          { session }
        );
      }

      logger.info('Record(s) updated via approval', {
        requestId: id,
        module: request.module,
        recordIds,
        approvedBy: adminName,
      });

    } else if (request.action === 'delete' || request.action === 'bulk-delete') {
      // DELETE RECORD(S)
      const recordIds = request.recordId.split(',');
      
      for (const recordId of recordIds) {
        await Model.findByIdAndDelete(recordId.trim(), { session });
      }

      logger.info('Record(s) deleted via approval', {
        requestId: id,
        module: request.module,
        recordIds,
        approvedBy: adminName,
      });
    }

    // Update request status
    request.status = 'approved';
    request.reviewedBy = {
      userId: adminId,
      userName: adminName,
      userEmail: adminEmail,
    };
    request.reviewedAt = new Date();
    await request.save({ session });

    await session.commitTransaction();

    logger.info('Request approved', {
      requestId: id,
      module: request.module,
      action: request.action,
      approvedBy: adminName,
    });

    res.json({
      success: true,
      message: 'Request approved and changes applied',
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to approve request', { error: error.message, requestId: req.params.id });
    res.status(500).json({
      code: 'APPROVAL_FAILED',
      message: 'Failed to approve request',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ========================================
// REJECT REQUEST (Admin)
// ========================================
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const { _id: adminId, name: adminName, email: adminEmail, organizationId } = req.user;

    const request = await PendingRequest.findOne({ _id: id, organizationId });

    if (!request) {
      return res.status(404).json({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        code: 'REQUEST_ALREADY_PROCESSED',
        message: `Request is already ${request.status}`,
      });
    }

    // Update request
    request.status = 'rejected';
    request.reviewedBy = {
      userId: adminId,
      userName: adminName,
      userEmail: adminEmail,
    };
    request.reviewedAt = new Date();
    request.rejectionReason = reason || 'other';
    request.rejectionNote = note || '';

    await request.save();

    logger.info('Request rejected', {
      requestId: id,
      reason,
      rejectedBy: adminName,
    });

    res.json({
      success: true,
      message: 'Request rejected',
      data: request,
    });
  } catch (error) {
    logger.error('Failed to reject request', { error: error.message, requestId: req.params.id });
    res.status(500).json({
      code: 'REJECTION_FAILED',
      message: 'Failed to reject request',
      error: error.message,
    });
  }
};

// ========================================
// CANCEL REQUEST (Sales User)
// ========================================
const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user;

    const request = await PendingRequest.findOne({
      _id: id,
      'requestedBy.userId': userId,
    });

    if (!request) {
      return res.status(404).json({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found or you do not have permission to cancel it',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        code: 'REQUEST_ALREADY_PROCESSED',
        message: `Request is already ${request.status}`,
      });
    }

    request.status = 'cancelled';
    await request.save();

    logger.info('Request cancelled by user', {
      requestId: id,
      userId,
    });

    res.json({
      success: true,
      message: 'Request cancelled successfully',
      data: request,
    });
  } catch (error) {
    logger.error('Failed to cancel request', { error: error.message, requestId: req.params.id });
    res.status(500).json({
      code: 'CANCELLATION_FAILED',
      message: 'Failed to cancel request',
      error: error.message,
    });
  }
};

// ========================================
// GET PENDING COUNT (For notification badge)
// ========================================
const getPendingCount = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const count = await PendingRequest.countDocuments({
      organizationId,
      status: 'pending',
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    logger.error('Failed to get pending count', { error: error.message });
    res.status(500).json({
      code: 'COUNT_FAILED',
      message: 'Failed to get pending count',
      error: error.message,
    });
  }
};

// ========================================
// AUTO-EXPIRE OLD REQUESTS (Cron Job)
// ========================================
const expireOldRequests = async () => {
  try {
    const now = new Date();

    const result = await PendingRequest.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: now },
      },
      {
        $set: {
          status: 'expired',
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Expired ${result.modifiedCount} old pending requests`);
    }

    return result.modifiedCount;
  } catch (error) {
    logger.error('Failed to expire old requests', { error: error.message });
    throw error;
  }
};

module.exports = {
  createRequest,
  getAllPendingRequests,
  getMyRequests,
  getRequestById,
  checkConflict,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getPendingCount,
  expireOldRequests,
};
