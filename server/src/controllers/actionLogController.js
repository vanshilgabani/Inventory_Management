const ActionLog = require('../models/ActionLog');
const Settings = require('../models/Settings');

/**
 * @desc    Log action with screenshot
 * @route   POST /api/action-logs
 * @access  Private
 */
const logAction = async (req, res) => {
  try {
    const { userId, organizationId } = req;
    const {
      sessionId,
      actionType,
      module,
      itemId,
      itemName,
      screenshotBefore,
      screenshotAfter,
      beforeData,
      afterData,
      changedFields,
      reason
    } = req.body;

    // Verify session exists
    const session = await EditSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get device info from user agent
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgent);

    // Create action log
    const actionLog = await ActionLog.create({
      organizationId,
      sessionId,
      userId,
      userName: req.user.name || req.user.email,
      userEmail: req.user.email,
      actionType,
      module,
      itemId,
      itemName,
      screenshotBefore,
      screenshotAfter,
      beforeData,
      afterData,
      changedFields,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent,
      deviceInfo,
      reason
    });

    res.json({
      success: true,
      actionLog
    });

  } catch (error) {
    console.error('Log action error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get action logs (with filters)
 * @route   GET /api/action-logs
 * @access  Private (Admin)
 */
const getActionLogs = async (req, res) => {
  try {
    const { organizationId } = req;
    const {
      userId,
      module,
      actionType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filter = { organizationId };

    if (userId) filter.userId = userId;
    if (module) filter.module = module;
    if (actionType) filter.actionType = actionType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ActionLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ActionLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get action log by ID (with full details)
 * @route   GET /api/action-logs/:id
 * @access  Private (Admin)
 */
const getActionLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const log = await ActionLog.findOne({
      _id: id,
      organizationId
    }).populate('sessionId', 'permissionLevel timeWindowMinutes');

    if (!log) {
      return res.status(404).json({ message: 'Action log not found' });
    }

    res.json({
      success: true,
      log
    });

  } catch (error) {
    console.error('Get action log error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get logs by salesperson
 * @route   GET /api/action-logs/salesperson/:userId
 * @access  Private (Admin)
 */
const getLogsBySalesperson = async (req, res) => {
  try {
    const { userId } = req.params;
    const { organizationId } = req;
    const { startDate, endDate, module } = req.query;

    const filter = { organizationId, userId };

    if (module) filter.module = module;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const logs = await ActionLog.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      totalActions: logs.length,
      edits: logs.filter(l => l.actionType === 'edit').length,
      deletes: logs.filter(l => l.actionType === 'delete').length,
      undone: logs.filter(l => l.undone).length,
      moduleBreakdown: {}
    };

    logs.forEach(log => {
      if (!stats.moduleBreakdown[log.module]) {
        stats.moduleBreakdown[log.module] = 0;
      }
      stats.moduleBreakdown[log.module]++;
    });

    res.json({
      success: true,
      logs,
      stats
    });

  } catch (error) {
    console.error('Get logs by salesperson error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Mark action as undone in log
 * @route   PUT /api/action-logs/:id/undo
 * @access  Private
 */
const markAsUndone = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const log = await ActionLog.findOne({
      _id: id,
      organizationId
    });

    if (!log) {
      return res.status(404).json({ message: 'Action log not found' });
    }

    log.undone = true;
    log.undoneAt = new Date();
    await log.save();

    res.json({
      success: true,
      message: 'Action marked as undone',
      log
    });

  } catch (error) {
    console.error('Mark as undone error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete old action logs (cleanup)
 * @route   DELETE /api/action-logs/cleanup
 * @access  Private (Admin)
 */
const cleanupOldLogs = async (req, res) => {
  try {
    const { organizationId } = req;
    
    // Get retention days from settings
    const settings = await Settings.findOne({ organizationId });
    const retentionDays = settings?.editPermissions?.screenshotRetentionDays || 90;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await ActionLog.deleteMany({
      organizationId,
      timestamp: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old action logs`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Cleanup logs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function to parse user agent
function parseUserAgent(userAgent) {
  const deviceInfo = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop'
  };

  // Detect browser
  if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
  else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
  else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';

  // Detect OS
  if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
  else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
  else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
  else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
  else if (userAgent.includes('iOS')) deviceInfo.os = 'iOS';

  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    deviceInfo.device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceInfo.device = 'Tablet';
  }

  return deviceInfo;
}

module.exports = {
  logAction,
  getActionLogs,
  getActionLogById,
  getLogsBySalesperson,
  markAsUndone,
  cleanupOldLogs
};
