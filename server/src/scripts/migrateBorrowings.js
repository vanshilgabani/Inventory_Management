require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const FactoryReceiving = require('../models/FactoryReceiving');

const convertOldBorrowings = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoURI) {
      console.error('❌ ERROR: MONGODB_URI not found in .env file');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Find all receivings with "FROM" in notes (your old borrowed stock)
    const oldBorrowings = await FactoryReceiving.find({
      notes: { $regex: /FROM\s+\w+/i }  // Matches "FROM POOJAN", "FROM RAM", etc.
    });

    console.log(`📦 Found ${oldBorrowings.length} old borrowing records with "FROM" in notes`);

    if (oldBorrowings.length === 0) {
      console.log('✅ No old borrowings found. All done!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Convert each one
    let converted = 0;
    for (const receiving of oldBorrowings) {
      // Extract name from notes like "FROM POOJAN"
      const match = receiving.notes.match(/FROM\s+(\w+)/i);
      const borrowedFrom = match ? match[1] : 'Unknown';

      // Update fields
      receiving.sourceType = 'borrowed_buyer';
      receiving.sourceName = borrowedFrom;
      receiving.borrowStatus = 'active';  // Set as active borrow
      receiving.returnedQuantity = 0;
      receiving.returnedQuantities = {};
      
      // Keep original notes, or clean them up
      receiving.notes = receiving.notes.replace(/FROM\s+\w+/i, '').trim();
      
      await receiving.save();
      converted++;
      
      console.log(`✅ [${converted}/${oldBorrowings.length}] Converted: ${receiving.design} - FROM ${borrowedFrom}`);
    }

    console.log(`\n✅ Successfully converted ${converted} old borrowings!`);
    console.log('📋 Summary:');
    console.log(`   - Source Type: borrowed_buyer`);
    console.log(`   - Borrow Status: active`);
    console.log(`   - Can now use "Return Stock" button`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Conversion error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

convertOldBorrowings();
