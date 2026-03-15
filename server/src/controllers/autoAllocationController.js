const mongoose = require('mongoose');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const MarketplaceSale = require('../models/MarketplaceSale');
const AllocationChange = require('../models/AllocationChange');
const AllocationNotification = require('../models/AllocationNotification');
const Transfer = require('../models/Transfer');

// ─────────────────────────────────────────────────────────────────────────────
// CORE ALGORITHM
// Exported as a utility so salesController + transferController can call it
// directly without going through HTTP.
//
// @param organizationId  — org's ObjectId or string
// @param design          — product design string
// @param color           — color string
// @param size            — size string
// @param triggeredBy     — 'account_empty' | 'transfer' | 'manual'
// @param triggeredByAccount — account name that hit 0 (null for transfer/manual)
// @param systemUserId    — userId to stamp on AllocationChange logs
// ─────────────────────────────────────────────────────────────────────────────
const runAutoAllocation = async (
  organizationId,
  design,
  color,
  size,
  triggeredBy = 'manual',
  triggeredByAccount = null,
  systemUserId = null
) => {
  const orgId = new mongoose.Types.ObjectId(organizationId);

  // ── 1. LOAD SETTINGS ──────────────────────────────────────────────────────
  const settings = await Settings.findOne({ organizationId: orgId });
  if (!settings) return { skipped: true, reason: 'Settings not found' };

  const autoConfig = settings.autoAllocation || {};
  if (!autoConfig.enabled) return { skipped: true, reason: 'Auto allocation is disabled' };

  const periodDays = autoConfig.periodDays            || 7;
  const newAccountInitialStock = autoConfig.newAccountInitialStock || 10;
  const rateLimitMinutes = autoConfig.rateLimitMinutes      || 60;
  const eligibilityDays = autoConfig.eligibilityDays        || 90;

  // ── 2. RATE LIMIT CHECK ───────────────────────────────────────────────────
  // Use last AllocationNotification for this exact variant to enforce rate limit.
  // This avoids needing to add a field to the Product schema.
  const rateLimitMs = rateLimitMinutes * 60 * 1000;
  const lastNotif = await AllocationNotification.findOne({
    organizationId: orgId,
    'variants.design': design,
    'variants.color':  color,
    'variants.size':   size
  }).sort({ createdAt: -1 }).lean();

  if (lastNotif) {
    const elapsed = Date.now() - new Date(lastNotif.createdAt).getTime();
    if (elapsed < rateLimitMs) {
      const minutesLeft = Math.ceil((rateLimitMs - elapsed) / 60000);
      return {
        skipped: true,
        reason: `Rate limited. Next run allowed in ${minutesLeft} minute(s).`
      };
    }
  }

  // ── 3. LOAD PRODUCT ───────────────────────────────────────────────────────
  const product = await Product.findOne({ design, organizationId: orgId });
  if (!product) return { skipped: true, reason: `Product ${design} not found` };

  const colorVariant = product.colors.find(c => c.color === color);
  if (!colorVariant) return { skipped: true, reason: `Color ${color} not found on ${design}` };

  const svIndex = colorVariant.sizes.findIndex(s => s.size === size);
  if (svIndex === -1) return { skipped: true, reason: `Size ${size} not found` };

  const sizeVariant        = colorVariant.sizes[svIndex];
  const totalReservedStock = sizeVariant.reservedStock || 0;

  if (totalReservedStock <= 0) {
    return { skipped: true, reason: 'Reserved stock is 0, nothing to allocate' };
  }

  // ── 4. LOAD ACTIVE ACCOUNTS ───────────────────────────────────────────────
  const activeAccounts = (settings.marketplaceAccounts || []).filter(a => a.isActive);
  if (activeAccounts.length === 0) {
    return { skipped: true, reason: 'No active marketplace accounts found' };
  }

  // ── 5. FETCH SALES PER ACCOUNT FOR THIS VARIANT ───────────────────────────
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  startDate.setHours(0, 0, 0, 0);

  const salesData = await MarketplaceSale.aggregate([
    {
      $match: {
        organizationId: orgId,
        design,
        color,
        size,
        saleDate:  { $gte: startDate },
        deletedAt: null,
        status:    { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
      }
    },
    {
      $group: {
        _id: '$accountName',
        totalQty: { $sum: '$quantity' }
      }
    }
  ]);

  const salesMap = {};
  salesData.forEach(s => { salesMap[s._id] = s.totalQty; });

// ── 5.5 ELIGIBILITY CHECK ─────────────────────────────────────────────────
const eligibilityStartDate = new Date();
eligibilityStartDate.setDate(eligibilityStartDate.getDate() - eligibilityDays);
eligibilityStartDate.setHours(0, 0, 0, 0);

const allTimeSalesData = await MarketplaceSale.aggregate([
  {
    $match: {
      organizationId: orgId,
      design, color, size,
      saleDate:  { $gte: eligibilityStartDate },
      deletedAt: null,
      status:    { $nin: ['cancelled', 'returned', 'wrongreturn', 'RTO'] }
    }
  },
  { $group: { _id: '$accountName', totalEverSold: { $sum: '$quantity' } } }
]);

const everSoldSet = new Set(allTimeSalesData.map(s => s._id));

// Build exclusion sets — BOTH levels
const designExcluded  = new Set(product.excludedAccounts || []);
const variantExcluded = new Set(sizeVariant.excludedFromAutoAllocation || []);

const eligibleAccounts = activeAccounts.filter(acc =>
  everSoldSet.has(acc.accountName) &&
  !designExcluded.has(acc.accountName) &&   // not design-excluded
  !variantExcluded.has(acc.accountName)     // not variant-excluded
);

if (eligibleAccounts.length === 0) {
  return {
    skipped: true,
    reason: `No eligible accounts for ${design}-${color}-${size}.`
  };
}
// ─────────────────────────────────────────────────────────────────────────────

  // ── 6. SPLIT ACCOUNTS: NEW vs EXISTING ────────────────────────────────────
  const newAccounts      = []; // 0 sales history → gets newAccountInitialStock
  const existingAccounts = []; // has sales → gets proportional share

  eligibleAccounts.forEach(acc => {
    const sales = salesMap[acc.accountName] || 0;
    if (sales === 0) {
      newAccounts.push({ accountName: acc.accountName, sales: 0 });
    } else {
      existingAccounts.push({ accountName: acc.accountName, sales });
    }
  });

  // ── 7. GIVE NEW ACCOUNTS THEIR INITIAL STOCK FIRST ────────────────────────
  let remainingStock = totalReservedStock;
  const finalAllocations = {}; // accountName → integer units

  for (const acc of newAccounts) {
    if (remainingStock <= 0) break;
    const give = Math.min(newAccountInitialStock, remainingStock);
    finalAllocations[acc.accountName] = give;
    remainingStock -= give;
  }

  // ── 8. PROPORTIONAL SPLIT (LARGEST REMAINDER METHOD) ─────────────────────
  if (existingAccounts.length > 0 && remainingStock > 0) {
    const totalSales = existingAccounts.reduce((sum, a) => sum + a.sales, 0);

    if (totalSales === 0) {
      // Fallback: equal split (defensive — existingAccounts always have sales > 0)
      const equalShare  = Math.floor(remainingStock / existingAccounts.length);
      let   leftover    = remainingStock - equalShare * existingAccounts.length;
      existingAccounts.forEach((acc, i) => {
        finalAllocations[acc.accountName] = equalShare + (i < leftover ? 1 : 0);
      });
    } else {
      // Step A: raw decimal shares
      const rawShares = existingAccounts.map(acc => ({
        accountName: acc.accountName,
        raw: (acc.sales / totalSales) * remainingStock
      }));

      // Step B: floor every share, track remainder
      let distributed = 0;
      const withRemainders = rawShares.map(a => {
        const floored = Math.floor(a.raw);
        distributed  += floored;
        return { accountName: a.accountName, floored, remainder: a.raw - floored };
      });

      // Step C: give leftover units 1-by-1 to accounts with largest remainders
      let leftover = remainingStock - distributed; // always 0 ≤ leftover < existingAccounts.length
      withRemainders
        .sort((a, b) => b.remainder - a.remainder)
        .forEach((a, i) => {
          finalAllocations[a.accountName] = a.floored + (i < leftover ? 1 : 0);
        });
    }

    remainingStock = 0; // fully distributed
  }

  // ── 9. SAFETY NET: any leftover goes to account with most sales ───────────
  // Covers edge: only new accounts exist AND newAccountInitialStock * count < total
  if (remainingStock > 0) {
    const topAccount = existingAccounts.length > 0
      ? existingAccounts.reduce((max, a) => a.sales > max.sales ? a : max)
      : newAccounts[0];

    if (topAccount) {
      finalAllocations[topAccount.accountName] =
        (finalAllocations[topAccount.accountName] || 0) + remainingStock;
      remainingStock = 0;
    }
  }

  // ── 10. SNAPSHOT BEFORE STATE ─────────────────────────────────────────────
  const beforeMap = {};
  (sizeVariant.reservedAllocations || []).forEach(a => {
    beforeMap[a.accountName] = a.quantity || 0;
  });

  // ── 11. APPLY TO PRODUCT ──────────────────────────────────────────────────
  // Keep allocations for inactive accounts untouched; overwrite active ones
  const inactiveAllocs = (sizeVariant.reservedAllocations || []).filter(a =>
    !activeAccounts.some(acc => acc.accountName === a.accountName)
  );

  colorVariant.sizes[svIndex].reservedAllocations = [
    ...inactiveAllocs,
    ...Object.entries(finalAllocations).map(([accountName, quantity]) => ({
      accountName,
      quantity
    }))
  ];

  product.markModified('colors');
  await product.save();

  // ── 12. LOG AllocationChange PER ACCOUNT ──────────────────────────────────
  const logUserId = systemUserId
    ? new mongoose.Types.ObjectId(systemUserId)
    : orgId;

  const changeLogs = Object.entries(finalAllocations).map(([accountName, newQty]) => ({
    productId:      product._id,
    design,
    color,
    size,
    accountName,
    quantityBefore: beforeMap[accountName] || 0,
    quantityAfter:  newQty,
    amountChanged:  newQty - (beforeMap[accountName] || 0),
    changeType:     'autoallocation',
    changedBy:      logUserId,
    notes:          `Auto-allocated. Trigger: ${triggeredBy}. Period: ${periodDays}d.`,
    organizationId: orgId
  }));

  if (changeLogs.length > 0) {
    await AllocationChange.insertMany(changeLogs);
  }

  // ── Create one Transfer record for this allocation run ─────────────────────
const accountBreakdown = Object.entries(finalAllocations)
  .map(([name, qty]) => `${name}:${qty}`)
  .join(', ');

await Transfer.create({
  design,
  color,
  size,
  quantity:            totalReservedStock, // total stock being redistributed
  type:                'autoallocation',
  from:                'reserved-pool',
  to:                  'reserved-accounts',
  mainStockBefore:     sizeVariant.currentStock || 0,
  reservedStockBefore: totalReservedStock,
  mainStockAfter:      sizeVariant.currentStock || 0,  // unchanged
  reservedStockAfter:  totalReservedStock,             // unchanged — only distribution changed
  performedBy:         logUserId,
  notes:               `Auto allocation. Trigger: ${triggeredBy}${triggeredByAccount ? ` (${triggeredByAccount})` : ''}. Period: ${periodDays}d. Breakdown → ${accountBreakdown}`,
  organizationId:      orgId
});
// ───────────────────────────────────────────────────────────────────────────

  // ── 13. CREATE AllocationNotification ─────────────────────────────────────
  const notificationAccounts = Object.entries(finalAllocations).map(([accountName, newQty]) => ({
    accountName,
    previousAllocation: beforeMap[accountName] || 0,
    newAllocation:      newQty,
    isNewAccount:       newAccounts.some(a => a.accountName === accountName)
  }));

  const notification = await AllocationNotification.create({
    organizationId:     orgId,
    triggeredBy,
    triggeredByAccount: triggeredByAccount || null,
    variants: [{
      design,
      color,
      size,
      totalReservedStock,
      accounts: notificationAccounts
    }],
    dismissed:     false,
    periodDaysUsed: periodDays
  });

  return { skipped: false, notification };
};


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auto-allocation/run
 * Body: { design, color, size }  → single variant
 * Body: {}                       → all variants with reserved stock > 0
 */
const triggerManualAllocation = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const systemUserId   = req.user.id;
    const { design, color, size } = req.body || {};

    // ── Single variant ────────────────────────────────────────────────────
    if (design && color && size) {
      const result = await runAutoAllocation(
        organizationId, design, color, size,
        'manual', null, systemUserId
      );
      if (result.skipped) {
        return res.status(200).json({
          success: false,
          skipped: true,
          reason:  result.reason
        });
      }
      return res.status(200).json({ success: true, data: result.notification });
    }

    // ── Full run — every variant with reserved stock > 0 ─────────────────
    const products = await Product.find({ organizationId }).lean();
    const ran      = [];
    const skipped  = [];
    const errors   = [];

    for (const product of products) {
      for (const cv of (product.colors || [])) {
        for (const sv of (cv.sizes || [])) {
          if ((sv.reservedStock || 0) <= 0) continue;
          try {
            const result = await runAutoAllocation(
              organizationId,
              product.design,
              cv.color,
              sv.size,
              'manual',
              null,
              systemUserId
            );
            const entry = { design: product.design, color: cv.color, size: sv.size };
            result.skipped ? skipped.push({ ...entry, reason: result.reason })
                           : ran.push(entry);
          } catch (err) {
            errors.push({ design: product.design, color: cv.color, size: sv.size, error: err.message });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      summary: { total: ran.length + skipped.length + errors.length, ran: ran.length, skipped: skipped.length, errors: errors.length },
      ran,
      skipped,
      errors
    });

  } catch (error) {
    console.error('triggerManualAllocation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/auto-allocation/notifications
 * Query: ?dismissed=false (default) | ?dismissed=true (history)
 */
const getNotifications = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const showDismissed  = req.query.dismissed === 'true';

    const notifications = await AllocationNotification.find({
      organizationId,
      dismissed: showDismissed
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/auto-allocation/notifications/:id/dismiss
 * User clicks ✕ on a single banner pill
 */
const dismissNotification = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const { id }         = req.params;

    const notif = await AllocationNotification.findOneAndUpdate(
      { _id: id, organizationId },
      { dismissed: true, dismissedAt: new Date() },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, data: notif });
  } catch (error) {
    console.error('dismissNotification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/auto-allocation/notifications/dismiss-all
 * User dismisses all active banners at once
 */
const dismissAllNotifications = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    await AllocationNotification.updateMany(
      { organizationId, dismissed: false },
      { dismissed: true, dismissedAt: new Date() }
    );
    res.status(200).json({ success: true, message: 'All notifications dismissed' });
  } catch (error) {
    console.error('dismissAllNotifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  runAutoAllocation,         // utility — imported by salesController & transferController
  triggerManualAllocation,
  getNotifications,
  dismissNotification,
  dismissAllNotifications
};
