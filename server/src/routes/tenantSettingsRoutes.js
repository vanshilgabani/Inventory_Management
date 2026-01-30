// routes/tenantSettingsRoutes.js
const express = require('express');
const router = express.Router();
const tenantSettingsController = require('../controllers/tenantSettingsController');
const { protect } = require('../middleware/auth');

// Tenant settings
router.get('/', protect, tenantSettingsController.getSettings);
router.put('/inventory-mode', protect, tenantSettingsController.updateInventoryMode);
router.post('/feature-request', protect, tenantSettingsController.requestFeatureAccess);
router.put('/feature-access', protect, tenantSettingsController.updateFeatureAccess);

router.get('/my-settings', protect, tenantSettingsController.getMySettings);

// Admin functions
router.get('/admin/tenants', protect, tenantSettingsController.getAllTenants);
router.put('/admin/tenants/:tenantUserId/feature', protect, tenantSettingsController.toggleFeatureForTenant);
router.post('/admin/tenants/:tenantUserId/link', protect, tenantSettingsController.linkTenantToSupplier);

module.exports = router;
