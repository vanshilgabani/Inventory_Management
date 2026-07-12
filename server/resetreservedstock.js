require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       Reset Reserved Stock & Allocations Script      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env file. Exiting.');
    rl.close();
    process.exit(1);
  }
  console.log('✅ MongoDB URI loaded from .env\n');

  // 1. Scope — org-specific or all
  console.log('🎯 Scope of reset:');
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
    filterQuery = { organizationId: new mongoose.Types.ObjectId(orgId.trim()) };
    scopeLabel = `Organisation: ${orgId.trim()}`;
  } else if (scopeChoice.trim() === '2') {
    filterQuery = {};
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

  // 3. Preview
  const Product = mongoose.connection.collection('products');
  const totalProducts = await Product.countDocuments(filterQuery);

  if (totalProducts === 0) {
    console.log('⚠️  No products found for the given scope. Nothing to reset.');
    rl.close(); await mongoose.disconnect(); process.exit(0);
  }

  console.log('┌─────────────────────────────────────────────────┐');
  console.log(`│  Scope    : ${scopeLabel.padEnd(37)}│`);
  console.log(`│  Products : ${String(totalProducts).padEnd(37)}│`);
  console.log('│  Action   : Set reservedStock = 0               │');
  console.log('│             Clear reservedAllocations = []       │');
  console.log('└─────────────────────────────────────────────────┘');

  // 4. Confirmation
  const confirm = await ask('\n⚠️  Type YES to confirm: ');
  if (confirm.trim() !== 'YES') {
    console.log('\n🚫 Aborted. No changes made.');
    rl.close(); await mongoose.disconnect(); process.exit(0);
  }

  // 5. Execute
  console.log('\n⏳ Running reset...');
  const result = await Product.updateMany(
    filterQuery,
    [
      {
        $set: {
          colors: {
            $map: {
              input: '$colors',
              as: 'color',
              in: {
                $mergeObjects: [
                  '$$color',
                  {
                    sizes: {
                      $map: {
                        input: '$$color.sizes',
                        as: 'sizeEntry',
                        in: {
                          $mergeObjects: [
                            '$$sizeEntry',
                            { reservedStock: 0, reservedAllocations: [] },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]
  );

  // 6. Summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║               ✅ Reset Complete               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Products matched  : ${String(result.matchedCount).padEnd(23)}║`);
  console.log(`║  Products modified : ${String(result.modifiedCount).padEnd(23)}║`);
  console.log('║                                              ║');
  console.log('║  reservedStock      → 0                      ║');
  console.log('║  reservedAllocations → []                    ║');
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