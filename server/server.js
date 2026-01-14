const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { startNotificationCron } = require('./src/utils/checkNotifications');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ✅ ADD THIS DEBUG MIDDLEWARE
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const salesRoutes = require('./src/routes/salesRoutes');
const wholesaleRoutes = require('./src/routes/wholesaleRoutes');
const directSalesRoutes = require('./src/routes/directSalesRoutes');
const factoryRoutes = require('./src/routes/factoryRoutes');
const predictionRoutes = require('./src/routes/predictionRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes'); // NEW
const productPricingRoutes = require('./src/routes/productPricingRoutes');
const settlementRoutes = require('./src/routes/settlementRoutes');
const transferRoutes = require('./src/routes/transferRoutes');
const monthlyBillRoutes = require('./src/routes/monthlyBillRoutes');
const initCronJobs = require('./src/utils/cronJobs');
const actionLogRoutes = require('./src/routes/actionLogRoutes');
const pendingRequestRoutes = require('./src/routes/pendingRequestRoutes');
const deletedOrdersRoutes = require('./src/routes/deletedOrdersRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/wholesale', wholesaleRoutes);
app.use('/api/direct-sales', directSalesRoutes);
app.use('/api/factory', factoryRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/product-pricing', productPricingRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/monthly-bills', monthlyBillRoutes);
app.use('/api/action-logs', actionLogRoutes);
app.use('/api/pending-requests', pendingRequestRoutes);
app.use('/api/deleted-orders', deletedOrdersRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Cargo Inventory API is running!' });
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

initCronJobs();

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // Start notification cron job
    startNotificationCron();
    console.log('🔔 Notification system initialized');
  });
});
