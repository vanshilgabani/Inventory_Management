const mongoose = require('mongoose');

const factoryReceivingSchema = new mongoose.Schema(
  {
    design: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String },
    quantities: { type: Map, of: Number },
    totalQuantity: { type: Number, required: true },
    batchId: { type: String },
    notes: { type: String },
    receivedBy: { type: String, required: true },
    receivedDate: { type: Date, default: Date.now },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['factory', 'borrowed_buyer', 'borrowed_vendor', 'return', 'transfer', 'other'],
      default: 'factory',
    },
    sourceName: { type: String },
    returnDueDate: { type: Date },
    borrowStatus: {
      type: String,
      enum: ['active', 'partial', 'returned', 'na'],
      default: 'na',
    },
    returnedQuantity: { type: Number, default: 0 },
    returnedQuantities: { type: Map, of: Number },
    returnReceiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'FactoryReceiving' },
    originalBorrowId: { type: mongoose.Schema.Types.ObjectId, ref: 'FactoryReceiving' },
    returnType: { type: String, enum: ['same', 'exchange'] },
    exchangeInfo: { type: mongoose.Schema.Types.Mixed },
    totalBorrowedValue: { type: Number },
    returnedValue: { type: Number, default: 0 },
    exchangeSettlement: { type: mongoose.Schema.Types.Mixed },
    paymentStatus: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    paymentAmount: { type: Number },
    paymentNotes: { type: String },
    paymentDate: { type: Date },
    returnedDate: { type: Date },

    // ✅ ADD THESE SOFT DELETE FIELDS
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// Add index for better performance on soft delete queries
factoryReceivingSchema.index({ deletedAt: 1 });
factoryReceivingSchema.index({ organizationId: 1, deletedAt: 1 });

module.exports = mongoose.model('FactoryReceiving', factoryReceivingSchema);
