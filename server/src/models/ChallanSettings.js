const mongoose = require('mongoose');

const challanSettingsSchema = new mongoose.Schema({
  // ✅ ADD: Multi-tenant field
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Seller/Business Details (NO defaults)
  businessName: {
    type: String,
    default: ''  // ✅ CHANGED: Empty default
  },
  address: {
    type: String,
    default: ''  // ✅ CHANGED: Empty default
  },
  email: {
    type: String,
    default: ''  // ✅ CHANGED: Empty default
  },
  mobile: {
    type: String,
    default: ''  // ✅ CHANGED: Empty default
  },
  gstNumber: {
    type: String,
    default: ''  // ✅ CHANGED: Empty default
  },
  // Footer Terms & Conditions
  termsConditions: [{
    type: String
  }],
  // Signature
  signatureText: {
    type: String,
    default: 'Authorized Signatory'
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('ChallanSettings', challanSettingsSchema);
