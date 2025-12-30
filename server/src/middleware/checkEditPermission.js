const EditSession = require('../models/EditSession');
const Settings = require('../models/Settings');

const canEditDelete = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.userId;
    const organizationId = req.organizationId;

    // ✅ 1. Admin always has access
    if (user.role === 'admin') {
      req.isAdmin = true;
      return next();
    }

    // ✅ 2. Check if salesperson has active edit session
    if (user.role === 'salesperson') {
      // Get settings to see if feature is enabled
      const settings = await Settings.findOne({ organizationId });
      
      if (!settings?.editPermissions?.enabled) {
        return res.status(403).json({ 
          message: 'Access denied. Only admins can edit/delete.',
          code: 'ADMIN_ONLY'
        });
      }

      // Check if this salesperson is in allowed list
      const isAllowed = settings.editPermissions.allowedUsers.some(
        u => u.userId.toString() === userId.toString()
      );

      if (!isAllowed) {
        return res.status(403).json({ 
          message: 'Access denied. You are not authorized for edit/delete operations.',
          code: 'NOT_AUTHORIZED'
        });
      }

      // Check for active session
      const session = await EditSession.findOne({
        organizationId,
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        return res.status(403).json({ 
          message: 'No active edit session. Please start a session first.',
          code: 'NO_ACTIVE_SESSION'
        });
      }

      if (session.remainingChanges <= 0) {
        session.isActive = false;
        await session.save();
        return res.status(403).json({ 
          message: 'Edit limit exhausted. Your session has ended.',
          code: 'LIMIT_EXHAUSTED'
        });
      }

      // ✅ Valid session exists
      req.editSession = session; // Attach session to request
      req.isAdmin = false;
      return next();
    }

    // ❌ Other roles denied
    return res.status(403).json({ 
      message: 'Access denied. Only admins can edit/delete.',
      code: 'ADMIN_ONLY'
    });

  } catch (error) {
    console.error('Edit permission check error:', error);
    return res.status(500).json({ message: 'Permission check failed' });
  }
};

module.exports = { canEditDelete };
