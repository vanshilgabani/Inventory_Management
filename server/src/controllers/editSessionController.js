const EditSession = require('../models/EditSession');
const Settings = require('../models/Settings');

// @desc Start new edit session for salesperson
// @route POST /api/edit-sessions/start
// @access Private (Admin or allowed salesperson)
const startEditSession = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId;
    const user = req.user;

    // Get settings
    const settings = await Settings.findOne({ organizationId });
    
    if (!settings?.editPermissions?.enabled) {
      return res.status(403).json({ message: 'Edit permissions feature is not enabled' });
    }

    // Check if user is allowed
    const isAllowed = settings.editPermissions.allowedUsers.some(
      u => u.userId.toString() === userId.toString()
    );

    if (!isAllowed && user.role !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized for edit sessions' });
    }

    // Check if there's already an active session
    const existingSession = await EditSession.findOne({
      organizationId,
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (existingSession) {
      return res.json({ session: existingSession });
    }

    // Create new session
    const maxChanges = settings.editPermissions.maxChanges;
    const timeWindowMinutes = settings.editPermissions.timeWindowMinutes;
    const expiresAt = new Date(Date.now() + timeWindowMinutes * 60 * 1000);

    const session = await EditSession.create({
      organizationId,
      userId,
      userName: user.name || user.email,
      maxChanges,
      remainingChanges: maxChanges,
      timeWindowMinutes,
      expiresAt
    });

    res.json({ session });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get active session for current user
// @route GET /api/edit-sessions/active
// @access Private
const getActiveSession = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId;

    const session = await EditSession.findOne({
      organizationId,
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.json({ session: null });
    }

    // Check if expired
    if (new Date() > session.expiresAt || session.remainingChanges <= 0) {
      session.isActive = false;
      await session.save();
      return res.json({ session: null });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get all active sessions (admin only)
// @route GET /api/edit-sessions/all
// @access Private (Admin)
const getAllActiveSessions = async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const sessions = await EditSession.find({
      organizationId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ startTime: -1 });

    res.json({ sessions });
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Use one edit (decrement remaining changes)
// @route POST /api/edit-sessions/use
// @access Private
const useEdit = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId;
    const { action, module, itemId } = req.body; // 'edit' or 'delete'

    const session = await EditSession.findOne({
      organizationId,
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(403).json({ message: 'No active edit session found' });
    }

    if (session.remainingChanges <= 0) {
      session.isActive = false;
      await session.save();
      return res.status(403).json({ message: 'Edit limit exhausted' });
    }

    // Decrement
    session.remainingChanges -= 1;
    session.changesLog.push({
      action,
      module,
      itemId: itemId || 'unknown',
      timestamp: new Date()
    });

    // Deactivate if no changes left
    if (session.remainingChanges <= 0) {
      session.isActive = false;
    }

    await session.save();

    res.json({ 
      session,
      message: `${action} recorded. ${session.remainingChanges} changes remaining.`
    });
  } catch (error) {
    console.error('Use edit error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc End session manually (admin or user)
// @route POST /api/edit-sessions/end
// @access Private
const endSession = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.organizationId;

    const session = await EditSession.findOne({
      organizationId,
      userId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({ message: 'No active session found' });
    }

    session.isActive = false;
    await session.save();

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startEditSession,
  getActiveSession,
  getAllActiveSessions,
  useEdit,
  endSession
};
