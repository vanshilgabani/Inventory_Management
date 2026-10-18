const { convertSizeToLetter } = require('./sizeMappings');

// Color mapping (Flipkart → Your inventory)
const COLOR_MAPPINGS = {
  // Direct matches
  'BLACK': 'Black',
  'GREEN': 'Green',
  'KHAKI': 'Khaki',
  'KHAKHI': 'Khaki',
  
  // Light Grey variations
  'L.GREY': 'Light Grey',
  'L.GRAY': 'Light Grey',
  'LGREY': 'Light Grey',
  'LGRAY': 'Light Grey',
  'LIGHT GREY': 'Light Grey',
  'LIGHT GRAY': 'Light Grey',
  'LIGHTGREY': 'Light Grey',
  'LIGHTGRAY': 'Light Grey',
  'L GREY': 'Light Grey',
  'L GRAY': 'Light Grey',
  
  // Dark Grey variations
  'D.GREY': 'Dark Grey',
  'D.GRAY': 'Dark Grey',
  'DGREY': 'Dark Grey',
  'DGRAY': 'Dark Grey',
  'DARK GREY': 'Dark Grey',
  'DARK GRAY': 'Dark Grey',
  'DARKGREY': 'Dark Grey',
  'DARKGRAY': 'Dark Grey',
  'D GREY': 'Dark Grey',
  'D GRAY': 'Dark Grey',
  
  // Navy Blue variations
  'NAVY': 'Navy Blue',
  'NAVYBLUE': 'Navy Blue',
  'NAVY BLUE': 'Navy Blue',
  'N.BLUE': 'Navy Blue',
  
  // Additional colors
  'PISTA': 'Pista',
  'BEIGE': 'Beige',
  'CHIKOO': 'Chikoo'
};

/**
 * Parse marketplace SKU into components
 * Handles formats like: 
 *   - D11-KHAKI-XL
 *   - #D-11-KHAKI-XL
 *   - MN-D-NO-09-Khaki_32 ✅ NEW
 */
function parseMarketplaceSKU(sku) {
  if (!sku) {
    return {
      design: null,
      color: null,
      size: null,
      rawSize: null
    };
  }

  // ---------------------------------------------------------
  // BASIC CLEANUP
  // ---------------------------------------------------------
  let cleaned = String(sku)
    .replace(/#/g, '')
    .replace(/,/g, '')
    .trim();

  // ---------------------------------------------------------
  // NEW: REMOVE PREFIX BEFORE A D<number> DESIGN
  //
  // HR_D9-D.GREY-XL       -> D9-D.GREY-XL
  // AMZ_D13-BLACK-L       -> D13-BLACK-L
  // FK_D11-KHAKI-M        -> D11-KHAKI-M
  // MYN_D22-L.GREY-XXL    -> D22-L.GREY-XXL
  //
  // Existing formats remain unchanged:
  // D9-D.GREY-XL
  // D13-BLACK-L
  // MN-D-NO-09-Khaki_32
  // ---------------------------------------------------------
  const prefixedDesignMatch = cleaned.match(
    /(?:^|_)(D\d+)(?=-|_|$)/i
  );

  if (prefixedDesignMatch) {
    const design = prefixedDesignMatch[1];

    // Only normalize when something exists BEFORE the design
    const designIndex = cleaned
      .toUpperCase()
      .indexOf(design.toUpperCase());

    if (designIndex > 0) {
      cleaned = cleaned.substring(designIndex);
    }
  }

  // ---------------------------------------------------------
  // UNDERSCORE FORMAT
  //
  // Example:
  // MN-D-NO-09-Khaki_32
  // ---------------------------------------------------------
  if (cleaned.includes('_')) {
    const parts = cleaned.split('-');

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];

      if (lastPart.includes('_')) {
        const underscoreParts = lastPart.split('_');

        if (underscoreParts.length >= 2) {
          const sizePart = underscoreParts.pop();
          const colorPart = underscoreParts.join('_');

          const design = parts
            .slice(0, -1)
            .join('-')
            .trim();

          const color = colorPart
            .replace(/[._]/g, ' ')
            .trim();

          const rawSize = String(sizePart).trim();

          const convertedSize = convertSizeToLetter(rawSize);

          const size =
            convertedSize ||
            (/^(S|M|L|XL|XXL|XXXL|3XL|4XL|5XL)$/i.test(rawSize)
              ? rawSize.toUpperCase()
              : null);

          return {
            design: design || null,
            color: color || null,
            size: size || null,
            rawSize: rawSize || null
          };
        }
      }
    }
  }

  // ---------------------------------------------------------
  // STANDARD DASH FORMAT
  // ---------------------------------------------------------
  const parts = cleaned
    .split('-')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return {
      design: null,
      color: null,
      size: null,
      rawSize: null
    };
  }

  let design;
  let color;
  let rawSize;

  // ---------------------------------------------------------
  // FORMAT:
  // D-11-KHAKHI-XL
  // ---------------------------------------------------------
  if (
    parts[0].toUpperCase() === 'D' &&
    /^\d+$/.test(parts[1])
  ) {
    design = `D${parts[1]}`;

    color = parts
      .slice(2, -1)
      .join('-');

    rawSize = parts[parts.length - 1];
  }

  // ---------------------------------------------------------
  // FORMAT:
  // D9-D.GREY-XL
  // D13-LIGHT-GREY-L
  // D22-BLACK-32
  //
  // This also handles normalized:
  // HR_D9-D.GREY-XL
  //      ↓
  // D9-D.GREY-XL
  // ---------------------------------------------------------
  else if (/^D\d+$/i.test(parts[0])) {
    design = parts[0].toUpperCase();

    color = parts
      .slice(1, -1)
      .join('-');

    rawSize = parts[parts.length - 1];
  }

  // ---------------------------------------------------------
  // GENERIC / MULTI-PART DESIGN
  //
  // Example:
  // MN-D-NO-09-KHAKI-XL
  // ---------------------------------------------------------
  else {
    rawSize = parts[parts.length - 1];

    color = parts[parts.length - 2];

    design = parts
      .slice(0, -2)
      .join('-');
  }

  // ---------------------------------------------------------
  // CLEAN COLOR
  // ---------------------------------------------------------
  if (color) {
    color = color
      .replace(/[._]/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------
  // NORMALIZE SIZE
  // ---------------------------------------------------------
  rawSize = rawSize
    ? String(rawSize).trim()
    : null;

  let size = null;

  if (rawSize) {
    // Numeric:
    // 28 -> S
    // 30 -> M
    // 32 -> L
    // 34 -> XL
    // 36 -> XXL
    const convertedSize = convertSizeToLetter(rawSize);

    if (convertedSize) {
      size = convertedSize;
    }

    // Letter sizes
    else if (
      /^(S|M|L|XL|XXL|XXXL|3XL|4XL|5XL)$/i.test(rawSize)
    ) {
      size = rawSize.toUpperCase();
    }
  }

  return {
    design: design || null,
    color: color || null,
    size: size || null,
    rawSize: rawSize || null
  };
}

/**
 * Match color from SKU to inventory color
 */
function matchColor(skuColor, inventoryColors) {
  if (!skuColor) return null;

  const upperSKU = skuColor.toUpperCase().trim();

  // Step 1: Check exact mapping
  if (COLOR_MAPPINGS[upperSKU]) {
    const mapped = COLOR_MAPPINGS[upperSKU];
    const found = inventoryColors.find(c => c.toUpperCase() === mapped.toUpperCase());
    if (found) return found;
  }

  // Step 2: Case-insensitive exact match
  const exact = inventoryColors.find(c => c.toUpperCase() === upperSKU);
  if (exact) return exact;

  // Step 3: Fuzzy match (remove spaces, dots, dashes)
  const cleaned = upperSKU.replace(/[\s._-]/g, '');
  const fuzzy = inventoryColors.find(c =>
    c.toUpperCase().replace(/[\s._-]/g, '') === cleaned
  );
  if (fuzzy) return fuzzy;

  // Step 4: Partial match
  const partial = inventoryColors.find(c =>
    c.toUpperCase().includes(upperSKU) || upperSKU.includes(c.toUpperCase())
  );
  if (partial) return partial;

  return null;
}

/**
 * Suggest design from SKU - IMPROVED VERSION
 */
function suggestDesign(sku, availableDesigns) {
  if (!sku || !availableDesigns) return null;

  const parsed = parseMarketplaceSKU(sku);
  if (!parsed.design) return null;

  // ✅ IMPROVED: Extract design number more intelligently
  // For "MN-D-NO-09-Khaki_32", we want "09", not "32"
  
  // Strategy 1: Look for pattern like "D-NO-09" or "D09" or "D-09"
  const designMatch = parsed.design.match(/D[-]?(?:NO[-]?)?(\d+)/i);
  if (designMatch) {
    const designNumber = designMatch[1];
    
    // Find exact match first (D9, D09)
    const exactMatch = availableDesigns.find(d => 
      d === `D${designNumber}` || d === `D${designNumber.padStart(2, '0')}`
    );
    if (exactMatch) return exactMatch;
  }

  // Strategy 2: Extract ALL numbers from design part ONLY (not size)
  const numbers = parsed.design.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  // Take the FIRST meaningful number (usually the design number)
  for (const number of numbers) {
    // Try exact match
    const suggestions = availableDesigns.filter(d => {
      const dNumbers = d.match(/\d+/g);
      return dNumbers && dNumbers.some(n => 
        n === number || n === number.padStart(2, '0')
      );
    });
    
    if (suggestions.length > 0) {
      return suggestions[0];
    }
  }

  return null;
}

module.exports = {
  parseMarketplaceSKU,
  matchColor,
  suggestDesign,
  COLOR_MAPPINGS
};
