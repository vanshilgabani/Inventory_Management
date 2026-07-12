require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Delete Old Factory Receivings Script             ║');
  console.log('║     (Keeps today\'s records, deletes the rest)        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env file. Exiting.');
    rl.close(); process.exit(1);
  }
  console.log('✅ MongoDB URI loaded from .env\n');

  // 1. Scope
  console.log('🎯 Scope of deletion:');
  console.log('   [1] Specific organisation only');
  console.log('   [2] ALL organisations (entire database)\n');
  const scopeChoice = await ask('Enter choice (1 or 2): ');

  let filterQuery = {};
  let scopeLabel = '';

  if (scopeChoice.trim() === '1') {
    const orgId = await ask('\n🏢 Enter Organisation ID: ');
    if (!orgId.trim()) {
      console.error('❌ Organisation ID is required. Exiting.');
      rl.close(); process.exit(1);
    }
    if (!mongoose.Types.ObjectId.isValid(orgId.trim())) {
      console.error('❌ Invalid Organisation ID format. Exiting.');
      rl.close(); process.exit(1);
    }
    filterQuery.organizationId = new mongoose.Types.ObjectId(orgId.trim());
    scopeLabel = `Organisation: ${orgId.trim()}`;
  } else if (scopeChoice.trim() === '2') {
    scopeLabel = 'ALL organisations';
  } else {
    console.error('❌ Invalid choice. Exiting.');
    rl.close(); process.exit(1);
  }

  // 2. Connect
  console.log('\n🔌 Connecting to MongoDB...');
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully.\n');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    rl.close(); process.exit(1);
  }

  const FactoryReceiving = mongoose.connection.collection('factoryreceivings');

  // 3. Build today's date range (midnight to midnight in local time)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  console.log(`📅 Today's range : ${todayStart.toISOString()} → ${todayEnd.toISOString()}`);

  // Delete query = scope filter + receivedDate NOT in today's range
  const deleteQuery = {
    ...filterQuery,
    receivedDate: { $lt: todayStart }   // anything before today
  };

  // Keep query = scope filter + receivedDate in today's range (for preview)
  const keepQuery = {
    ...filterQuery,
    receivedDate: { $gte: todayStart, $lte: todayEnd }
  };

  // 4. Preview counts
  const toDeleteCount = await FactoryReceiving.countDocuments(deleteQuery);
  const toKeepCount   = await FactoryReceiving.countDocuments(keepQuery);
  const totalCount    = await FactoryReceiving.countDocuments(filterQuery);

  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log(`│  Scope          : ${scopeLabel.padEnd(31)}│`);
  console.log(`│  Total records  : ${String(totalCount).padEnd(31)}│`);
  console.log(`│  Keeping today  : ${String(toKeepCount).padEnd(31)}│`);
  console.log(`│  TO BE DELETED  : ${String(toDeleteCount).padEnd(31)}│`);
  console.log('└─────────────────────────────────────────────────┘');

  if (toDeleteCount === 0) {
    console.log('\n✅ Nothing to delete. All records are from today.');
    rl.close(); await mongoose.disconnect(); process.exit(0);
  }

  // 5. Confirmation
  console.log('\n⚠️  This is a PERMANENT hard delete. Records cannot be recovered.');
  const confirm = await ask('Type YES to confirm: ');
  if (confirm.trim() !== 'YES') {
    console.log('\n🚫 Aborted. No changes made.');
    rl.close(); await mongoose.disconnect(); process.exit(0);
  }

  // 6. Execute deletion
  console.log('\n⏳ Deleting old records...');
  const result = await FactoryReceiving.deleteMany(deleteQuery);

  // 7. Summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║               ✅ Deletion Complete            ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Records deleted  : ${String(result.deletedCount).padEnd(24)}║`);
  console.log(`║  Records kept     : ${String(toKeepCount).padEnd(24)}║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  rl.close();
  await mongoose.disconnect();
  console.log('🔌 Disconnected. Done.\n');
}

main().catch(async (err) => {
  console.error('\n❌ Unexpected error:', err.message);
  rl.close();
  await mongoose.disconnect();
  process.exit(1);
});