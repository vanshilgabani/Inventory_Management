const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  // Variant identification
  design: { type: String, required: true },
  color: { type: String, required: true },
  size: { type: String, required: true },
  
  // Transfer details
  quantity: { type: Number, required: true },
  
  // Transfer type
  type: {
    type: String,
    enum: [
      'manualrefill',        // Main → Reserved (manual)
      'manualreturn',        // Reserved → Main (manual)
      'marketplaceorder',    // Reserved stock used for marketplace sale
      'emergencyuse',        // Main → Reserved (auto during marketplace order)
      'emergencyborrow'      // Reserved → Main (auto during wholesale/direct)
    ],
    required: true
  },
  
  // Direction
  from: { type: String, enum: ['main', 'reserved'], required: true },
  to: { type: String, enum: ['main', 'reserved', 'sold'], required: true },
  
  // Stock snapshots before transfer
  mainStockBefore: { type: Number, default: 0 },
  reservedStockBefore: { type: Number, default: 0 },
  
  // Stock snapshots after transfer
  mainStockAfter: { type: Number, default: 0 },
  reservedStockAfter: { type: Number, default: 0 },
  
  // Reference to related order (if applicable)
  relatedOrderId: { type: mongoose.Schema.Types.ObjectId },
  relatedOrderType: { type: String, enum: ['marketplace', 'wholesale', 'direct'] },
  
  // User who performed the action
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Notes
  notes: { type: String },
  
  // Organization
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { 
  timestamps: true 
});

// Indexes for faster queries
transferSchema.index({ organizationId: 1, createdAt: -1 });
transferSchema.index({ design: 1, color: 1, size: 1 });
transferSchema.index({ type: 1 });

module.exports = mongoose.model('Transfer', transferSchema);
