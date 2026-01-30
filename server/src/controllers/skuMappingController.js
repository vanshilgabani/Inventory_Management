const MarketplaceSKUMapping = require('../models/MarketplaceSKUMapping');
const Product = require('../models/Product');
const { parseMarketplaceSKU, matchColor, suggestDesign } = require('../utils/skuParser');
const { convertSizeToLetter, getWaistInfo } = require('../utils/sizeMappings');

// Get all SKU mappings for tenant
exports.getAllMappings = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName } = req.query;

    // ✅ CHANGED: Always search by organizationId only
    const filter = { organizationId };

    // ✅ OPTIONAL: Filter by account if specified (for UI filtering)
    // But data is organization-wide
    
    const mappings = await MarketplaceSKUMapping.find(filter)
      .sort({ lastUsedAt: -1 })
      .lean();

    // If account filter requested, show only those used by that account
    let filteredMappings = mappings;
    if (accountName && accountName !== 'all') {
      filteredMappings = mappings.filter(m => 
        m.usedByAccounts?.some(a => a.accountName === accountName) || 
        m.accountName === accountName // For old mappings
      );
    }

    res.json({ success: true, data: filteredMappings });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch mappings' });
  }
};

// Create new SKU mapping
exports.createMapping = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { accountName, marketplaceSKU, design, color, size, mappingSource = 'manual' } = req.body;

    // ✅ CHANGED: accountName optional
    if (!marketplaceSKU || !design || !color || !size) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: marketplaceSKU, design, color, size'
      });
    }

    // Verify product exists
    const product = await Product.findOne({ design, organizationId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Design "${design}" not found in inventory`
      });
    }

    // Verify color exists in product
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) {
      return res.status(404).json({
        success: false,
        message: `Color "${color}" not found in design "${design}"`
      });
    }

    // Verify size exists
    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      return res.status(404).json({
        success: false,
        message: `Size "${size}" not found in ${design}-${color}`
      });
    }

    // ✅ CHANGED: Upsert based on organizationId + SKU only
    const mapping = await MarketplaceSKUMapping.findOneAndUpdate(
      { organizationId, marketplaceSKU },
      {
        design,
        color,
        size,
        mappingSource,
        accountName: accountName || 'default', // Track first account that created it
        createdBy: {
          userId,
          userName: req.user.name || req.user.email,
          userRole: req.user.role
        },
        lastUsedAt: new Date(),
        $inc: { usageCount: 1 },
        // ✅ NEW: Track account usage
        $addToSet: accountName ? {
          usedByAccounts: {
            accountName,
            firstUsedAt: new Date(),
            lastUsedAt: new Date(),
            usageCount: 1
          }
        } : {}
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, data: mapping });
  } catch (error) {
    console.error('Create mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to create mapping' });
  }
};

// Delete SKU mapping
exports.deleteMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    // ✅ CHANGED: Only check organizationId
    const mapping = await MarketplaceSKUMapping.findOneAndDelete({
      _id: id,
      organizationId
    });

    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Mapping not found' });
    }

    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Delete mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete mapping' });
  }
};

// Get suggestions for SKU
exports.getSuggestions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { sku, accountName } = req.query; // accountName not used anymore

    if (!sku) {
      return res.status(400).json({ success: false, message: 'SKU is required' });
    }

    // Parse SKU
    const parsed = parseMarketplaceSKU(sku);

    // Get all products for this tenant
    const products = await Product.find({ organizationId }).lean();

    // Get all available designs
    const availableDesigns = products.map(p => p.design);

    // Get all available colors (from all products)
    const allColors = new Set();
    products.forEach(p => {
      p.colors.forEach(c => allColors.add(c.color));
    });
    const availableColors = Array.from(allColors);

    // Suggest design
    const suggestedDesign = suggestDesign(sku, availableDesigns);

    // Suggest color
    const suggestedColor = parsed.color ? matchColor(parsed.color, availableColors) : null;

    // Suggest size
    const suggestedSize = parsed.size;

    res.json({
      success: true,
      data: {
        parsed,
        suggestions: {
          design: suggestedDesign,
          color: suggestedColor,
          size: suggestedSize
        },
        available: {
          designs: availableDesigns,
          colors: availableColors,
          sizes: ['S', 'M', 'L', 'XL', 'XXL']
        }
      }
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
};

// ✅ NEW: Bulk lookup (updated)
exports.bulkLookup = async (req, res) => {
  try {
    const { accountName, skus } = req.body; // accountName optional now
    const { organizationId } = req.user;

    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'SKUs array required'
      });
    }

    console.log(`🔍 Bulk lookup: ${skus.length} SKUs for organization`);

    // ✅ CHANGED: Fetch by organizationId only (no accountName)
    const mappings = await MarketplaceSKUMapping.find({
      organizationId,
      marketplaceSKU: { $in: skus }
    }).lean();

    // Convert to map: { SKU: { design, color, size } }
    const mappingMap = {};
    mappings.forEach(m => {
      mappingMap[m.marketplaceSKU] = {
        design: m.design,
        color: m.color,
        size: m.size
      };
    });

    console.log(`✅ Found ${mappings.length} organization-wide mappings`);

    res.json({
      success: true,
      mappings: mappingMap,
      count: mappings.length
    });
  } catch (error) {
    console.error('Bulk lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup mappings',
      error: error.message
    });
  }
};

module.exports = exports;
