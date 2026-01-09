const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  design: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: true,
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
  },
});

const paymentHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  paymentMethod: {
    type: String,
    default: 'Not Specified',
  },
  notes: {
    type: String,
  },
  recordedBy: {
    type: String,
  },
});

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
  },
  changedBy: {
    type: String,
  },
});

const wholesaleOrderSchema = new mongoose.Schema({
  challanNumber: {
    type: String,
    sparse: true,
    unique: true,
  },
  buyerName: {
    type: String,
    required: [true, 'Buyer name is required'],
    trim: true,
  },
  buyerContact: {
    type: String,
    required: [true, 'Contact number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number'],
  },
  buyerEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  buyerAddress: {
    type: String,
    trim: true,
  },
  businessName: {
    type: String,
    trim: true,
  },
  gstNumber: {
    type: String,
    trim: true,
  },
  items: [orderItemSchema],
  discountType: {
    type: String,
    enum: ['none', 'percentage', 'fixed'],
    default: 'none',
  },
  discountValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  subtotalAmount: {
    type: Number,
    default: 0,
  },
  // ✅ GST Fields
  gstEnabled: {
    type: Boolean,
    default: true
  },
  gstPercentage: {  // ⭐ NEW FIELD - Store which % was used
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  cgst: {
    type: Number,
    default: 0
  },
  sgst: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  amountPaid: {
    type: Number,
    default: 0,
  },
  amountDue: {
    type: Number,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid'],
    default: 'Pending',
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Delivered',
  },
  fulfillmentType: {
    type: String,
    enum: ['warehouse', 'factory_direct'],
    default: 'warehouse'
  },
  paymentHistory: [paymentHistorySchema],
  statusHistory: [statusHistorySchema],
  deliveryDate: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleBuyer',
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

wholesaleOrderSchema.pre('save', async function(next) {
  if (!this.challanNumber && this.isNew) {
    try {
      const businessName = (this.businessName || this.buyerName || 'Order').replace(/\s+/g, '_');
      const buyer = await this.constructor.model('WholesaleBuyer').findOne({ mobile: this.buyerContact });
      let orderNumber = 1;
      if (buyer) {
        const existingOrders = await this.constructor.find({ buyerId: buyer._id });
        orderNumber = existingOrders.length + 1;
      }
      this.challanNumber = `${businessName}_${String(orderNumber).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error generating challan number:', error);
    }
  }
  next();
});

wholesaleOrderSchema.pre('validate', function(next) {
  // Calculate item subtotals
  this.items.forEach(item => {
    item.subtotal = item.quantity * item.pricePerUnit;
  });

  // Calculate subtotal amount
  const subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.subtotalAmount = subtotal;

  // Calculate discount
  let discountAmount = 0;
  if (this.discountType === 'percentage') {
    discountAmount = (subtotal * this.discountValue) / 100;
  } else if (this.discountType === 'fixed') {
    discountAmount = this.discountValue;
  }

  if (discountAmount > subtotal) {
    discountAmount = subtotal;
  }

  this.discountAmount = discountAmount;

  // ✅ Calculate subtotal after discount (before GST)
  const subtotalAfterDiscount = subtotal - discountAmount;

  // ✅ Calculate GST if enabled
  if (this.gstEnabled && this.gstAmount > 0) {
    this.cgst = this.gstAmount / 2;
    this.sgst = this.gstAmount / 2;
    this.totalAmount = subtotalAfterDiscount + this.gstAmount;
  } else {
    this.gstAmount = 0;
    this.cgst = 0;
    this.sgst = 0;
    this.totalAmount = subtotalAfterDiscount;
  }

  // Calculate amount due
  this.amountDue = this.totalAmount - (this.amountPaid || 0);

  // Update payment status
  if (this.amountDue <= 0) {
    this.paymentStatus = 'Paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'Partial';
  } else {
    this.paymentStatus = 'Pending';
  }

  next();
});

wholesaleOrderSchema.index({ challanNumber: 1, organizationId: 1 }, { unique: true, sparse: true });
wholesaleOrderSchema.index({ organizationId: 1, orderDate: -1 });
wholesaleOrderSchema.index({ buyerId: 1, orderDate: -1 });

module.exports = mongoose.model('WholesaleOrder', wholesaleOrderSchema);
