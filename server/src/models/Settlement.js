const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  // Account from Settings
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Settlement details
  settlementAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  settlementDate: {
    type: Date,
    required: true
  },
  
  // Auto-calculated: units sold in this period
  unitsSold: {
    type: Number,
    default: 0
  },
  
  // Date range this settlement covers
  periodStart: {
    type: Date,
    required: true
  },
  
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Optional notes
  notes: {
    type: String,
    trim: true
  },
  
  // Multi-tenant
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
  
}, { timestamps: true });

// Index for faster queries
settlementSchema.index({ accountName: 1, settlementDate: -1 });
settlementSchema.index({ organizationId: 1, accountName: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
