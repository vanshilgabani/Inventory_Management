const Settings = require('../models/Settings');

const canEditDelete = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.userId;
    const organizationId = req.organizationId;

    console.log('🔒 Edit Permission Check:', {
      userId,
      userRole: user?.role,
      method: req.method,
      path: req.path
    });

    // 1. Admin always has access
    if (user.role === 'admin') {
      console.log('✅ Admin access granted');
      req.isAdmin = true;
      return next();
    }

    // 2. Check if salesperson has active edit session
    if (user.role === 'sales') {
      // Get settings to see if feature is enabled
      const settings = await Settings.findOne({ organizationId });
      
      if (!settings?.editPermissions?.enabled) {
        console.log('❌ Edit permissions feature not enabled');
        return res.status(403).json({
          message: 'Access denied. Only admins can edit/delete.',
          code: 'ADMIN_ONLY'
        });
      }

      // Check if user is in allowed list
      const isAllowed = settings.editPermissions.salespersons.some(sp =>
        sp.userId.toString() === userId.toString() && sp.isActive
      );
      
      if (!isAllowed) {
        console.log('❌ User not in authorized salespersons list');
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
        console.log('❌ No active session found');
        return res.status(403).json({
          message: 'No active edit session. Please request access first.',
          code: 'NO_ACTIVE_SESSION'
        });
      }

      // Check remaining changes
      if (!session.isInfinite && session.remainingChanges <= 0) {
        console.log('❌ Edit limit exhausted');
        session.isActive = false;
        session.endedAt = new Date();
        session.endReason = 'limitReached';
        await session.save();
        
        return res.status(403).json({
          message: 'Edit limit exhausted. Your session has ended.',
          code: 'LIMIT_EXHAUSTED'
        });
      }

      // Check permission level (Feature 5)
      const permissionLevel = session.permissionLevel || 'level2';
      const method = req.method;
      const isBulkOperation = req.path.includes('bulk') || req.body?.orderIds;

      console.log('🔍 Permission level check:', {
        permissionLevel,
        method,
        isBulkOperation
      });

      // Level 1: Edit only (no delete, no bulk)
      if (permissionLevel === 'level1') {
        if (method === 'DELETE') {
          console.log('❌ Delete not allowed for level1');
          return res.status(403).json({
            message: 'You only have edit permission. Delete is restricted.',
            code: 'DELETE_NOT_ALLOWED'
          });
        }
        
        if (isBulkOperation) {
          console.log('❌ Bulk not allowed for level1');
          return res.status(403).json({
            message: 'Bulk operations are not allowed with your permission level.',
            code: 'BULK_NOT_ALLOWED'
          });
        }
      }

      // Level 2: Edit + Delete (no bulk)
      if (permissionLevel === 'level2') {
        if (isBulkOperation) {
          console.log('❌ Bulk not allowed for level2');
          return res.status(403).json({
            message: 'Bulk operations are not allowed with your permission level.',
            code: 'BULK_NOT_ALLOWED'
          });
        }
      }

      // Level 3: Full access (Edit + Delete + Bulk)
      // No restrictions

      // Valid session exists - grant access
      console.log('✅ Session valid - access granted');
      req.editSession = session; // Attach session to request
      req.isAdmin = false;
      return next();
    }

    // Other roles denied
    console.log('❌ Invalid role - access denied');
    return res.status(403).json({
      message: 'Access denied. Only admins can edit/delete.',
      code: 'ADMIN_ONLY'
    });

  } catch (error) {
    console.error('❌ Edit permission check error:', error);
    return res.status(500).json({ 
      message: 'Permission check failed',
      error: error.message 
    });
  }
};

module.exports = { canEditDelete };
