require('dotenv').config();
const mongoose = require('mongoose');
const { migrateToMultiTenant } = require('./src/utils/migrateToMultiTenant');

const runMigration = async () => {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...\n');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected\n');

    // Run migration
    await migrateToMultiTenant();

    // Disconnect
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
