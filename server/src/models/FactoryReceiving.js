const mongoose = require('mongoose');

const factoryReceivingSchema = new mongoose.Schema({
  design: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: null
  },
  quantities: {
    type: Map,
    of: Number,
    required: true
  },
  totalQuantity: {
    type: Number,
    required: true
  },
  batchId: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  receivedBy: {
    type: String,
    default: 'Admin'
  },
  
  // Source tracking fields
  sourceType: {
    type: String,
    enum: ['factory', 'borrowed_buyer', 'borrowed_vendor', 'return', 'transfer', 'other'],
    default: 'factory'
  },
  sourceName: {
    type: String,
    default: ''
  },
  returnDueDate: {
    type: Date
  },
  
  // Borrow/Return tracking
  borrowStatus: {
    type: String,
    enum: ['active', 'returned', 'partial', 'n/a'],
    default: function() {
      return ['borrowed_buyer', 'borrowed_vendor'].includes(this.sourceType) ? 'active' : 'n/a';
    }
  },
  returnedDate: {
    type: Date
  },
  returnedQuantity: {
    type: Number,
    default: 0
  },
  returnedQuantities: {
    type: Map,
    of: Number,
    default: {}
  },
  returnedValue: {
    type: Number,
    default: 0
  },
  totalBorrowedValue: {
    type: Number,
    default: 0
  },
  returnReceiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FactoryReceiving'
  },
  originalBorrowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FactoryReceiving'
  },
  
  // ✅ NEW: Payment tracking fields
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  paymentNotes: {
    type: String,
    default: ''
  },
  paymentDate: {
    type: Date
  },
  
  // ✅ NEW: Exchange settlement tracking
  exchangeSettlement: {
    borrowedValue: Number,
    exchangeValue: Number,
    difference: Number,
    settlementType: String
  },
  returnType: {
    type: String,
    enum: ['same', 'exchange'],
    default: 'same'
  },
  exchangeInfo: {
    originalDesign: String,
    originalColor: String,
    originalQuantities: Map,
    settlementInfo: Object
  },
  
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FactoryReceiving', factoryReceivingSchema);
