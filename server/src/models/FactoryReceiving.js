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
    receivedBy: { type: String, required: false },
    receivedDate: { type: Date, default: Date.now },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    supplierSyncId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplierSync',
      default: null
    },

    supplierTenantId: {
      type: String,
      default: null
    },

    supplierWholesaleOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesaleOrder',
      default: null
    },

    isReadOnly: {
      type: Boolean,
      default: false
      // True for supplier-synced receivings (customer can't edit)
    },

    // Metadata from supplier
    supplierMetadata: {
      challanNumber: String,
      orderDate: Date,
      supplierCompanyName: String,
      acceptedBy: String,      // ✅ ADD THIS
      acceptedAt: Date,        // ✅ ADD THIS
      isEdit: Boolean   
    },

    sourceType: {
      type: String,
      enum: ['factory', 'borrowed_buyer', 'borrowed_vendor', 'return', 'transfer', 'supplier-sync', 'other'],
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
