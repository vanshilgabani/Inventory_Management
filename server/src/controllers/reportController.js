// controllers/reportController.js
const MarketplaceSale = require('../models/MarketplaceSale');
// If your model path is different, adjust the require accordingly.

/**
 * Helper: build base filter for marketplace sales
 * Mirrors getAllSales but without search/cursor.
 */
function buildMarketplaceFilter(req, { applyDefaultStatus = true } = {}) {
  const { organizationId } = req.user;
  const {
    status,
    accountName,
    startDate,
    endDate,
    design,
  } = req.query;

  const filter = { organizationId, deletedAt: null };

  // Status filter
  if (status && status !== 'all') {
    const statuses = status.split(',').map(s => s.trim());
    filter.status = { $in: statuses };
  } else if (applyDefaultStatus) {
    // Default: only successful sales
    filter.status = { $in: ['dispatched'] };
  }

  // Account filter
  if (accountName && accountName !== 'all') {
    filter.accountName = accountName;
  }

  // Optional design filter (for MATRIX ONLY)
  if (design && design.trim()) {
    filter.design = design.trim();
  }

  // Date range filter
  if (startDate || endDate) {
    filter.saleDate = {};
    if (startDate) filter.saleDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.saleDate.$lte = end;
    }
  }

  return filter;
}

/**
 * GET /reports/marketplace/sales-matrix
 * Returns color × size quantity map
 */
exports.getMarketplaceSalesMatrix = async (req, res) => {
  try {
    const filter = buildMarketplaceFilter(req);

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: { color: '$color', size: '$size' },
          totalQty: { $sum: '$quantity' },
        },
      },
    ];

    const results = await MarketplaceSale.aggregate(pipeline).allowDiskUse(true);

    const matrix = {};
    let totalQty = 0;

    for (const row of results) {
      const { color, size } = row._id;
      const qty = row.totalQty || 0;
      matrix[`${color}||${size}`] = qty;
      totalQty += qty;
    }

    res.json({
      success: true,
      data: {
        matrix,
        totals: { totalQty },
      },
    });
  } catch (error) {
    console.error('getMarketplaceSalesMatrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to build marketplace sales matrix',
      error: error.message,
    });
  }
};

/**
 * GET /reports/marketplace/sales-detail
 * Paginated detail list for UI table
 * Query: accountName, startDate, endDate, status, page, limit
 */
exports.getMarketplaceSalesDetail = async (req, res) => {
  try {
    const filter = buildMarketplaceFilter(req);
    const {
      page = 1,
      limit = 200,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 200;
    const skip = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      MarketplaceSale.find(filter)
        .sort({ saleDate: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v -editHistory') // keep payload light
        .lean()
        .maxTimeMS(8000),
      MarketplaceSale.countDocuments(filter),
    ]);

    const hasMore = skip + rows.length < total;

    res.json({
      success: true,
      data: {
        rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('getMarketplaceSalesDetail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch marketplace sales detail',
      error: error.message,
    });
  }
};

/**
 * GET /reports/marketplace/sales-detail/export
 * Full detail list for CSV export (no pagination)
 * Use with care for huge date ranges, but this is what you want for "no limit".
 */
exports.exportMarketplaceSalesDetail = async (req, res) => {
  try {
    const filter = buildMarketplaceFilter(req);

    const rows = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1, _id: -1 })
      .select('-__v -editHistory')
      .lean()
      .maxTimeMS(15000);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('exportMarketplaceSalesDetail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export marketplace sales detail',
      error: error.message,
    });
  }
};

/**
 * GET /reports/marketplace/sales-matrix-export
 * Returns overall matrix + per-design matrices for CSV export
 */
exports.getMarketplaceSalesMatrixExport = async (req, res) => {
  try {
    // For export we ignore design filter; we want ALL designs.
    // But we still apply org, accountName, date, status.
    const filter = buildMarketplaceFilter(req);

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: { design: '$design', color: '$color', size: '$size' },
          totalQty: { $sum: '$quantity' },
        },
      },
    ];

    const results = await MarketplaceSale.aggregate(pipeline).allowDiskUse(true);

    const designsMap = new Map(); // design -> { matrix, totalQty }
    const overallMatrix = {};
    let overallTotalQty = 0;

    for (const row of results) {
      const { design, color, size } = row._id;
      const qty = row.totalQty || 0;
      const key = `${color}||${size}`;

      // Per-design matrix
      if (!designsMap.has(design)) {
        designsMap.set(design, { design, matrix: {}, totalQty: 0 });
      }
      const dEntry = designsMap.get(design);
      dEntry.matrix[key] = (dEntry.matrix[key] || 0) + qty;
      dEntry.totalQty += qty;

      // Overall matrix
      overallMatrix[key] = (overallMatrix[key] || 0) + qty;
      overallTotalQty += qty;
    }

    const designs = Array.from(designsMap.values()).sort(
      (a, b) => b.totalQty - a.totalQty
    );

    res.json({
      success: true,
      data: {
        designs,
        overall: {
          matrix: overallMatrix,
          totalQty: overallTotalQty,
        },
      },
    });
  } catch (error) {
    console.error('getMarketplaceSalesMatrixExport error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export marketplace sales matrix',
      error: error.message,
    });
  }
};