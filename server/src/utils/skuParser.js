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
    return { design: null, color: null, size: null, rawSize: null };
  }

  // Remove # and commas, trim
  const cleaned = sku.replace(/#/g, '').replace(/,/g, '').trim();

  // ✅ CHECK FOR UNDERSCORE (Color_Size format)
  if (cleaned.includes('_')) {
    // Format: XXX-XXX-XXX-Color_Size
    const parts = cleaned.split('-');
    
    if (parts.length < 2) {
      return { design: null, color: null, size: null, rawSize: null };
    }

    // Last part contains Color_Size
    const lastPart = parts[parts.length - 1];
    
    if (lastPart.includes('_')) {
      const [colorPart, sizePart] = lastPart.split('_');
      
      // Design is everything except the last part
      const design = parts.slice(0, -1).join('-');
      const color = colorPart.trim();
      const rawSize = sizePart.trim();
      
      // Convert numeric size to letter (30 -> M, 32 -> L, etc.)
      const size = convertSizeToLetter(rawSize) || (rawSize?.length <= 3 ? rawSize : null);
      
      return {
        design: design || null,
        color: color || null,
        size: size || null,
        rawSize: rawSize || null
      };
    }
  }

  // ✅ STANDARD DASH FORMAT (existing logic)
  const parts = cleaned.split('-');

  if (parts.length < 3) {
    return { design: null, color: null, size: null, rawSize: null };
  }

  let design, color, rawSize;

  // Pattern 1: D-11-KHAKHI-XL (D and number separate)
  if (parts[0] === 'D' && !isNaN(parts[1])) {
    design = `D${parts[1]}`;
    color = parts.slice(2, -1).join('-');
    rawSize = parts[parts.length - 1];
  }
  // Pattern 2: D9-L.GREY-L (D and number together)
  else if (parts[0].match(/^D\d+$/)) {
    design = parts[0];
    color = parts.slice(1, -1).join('-');
    rawSize = parts[parts.length - 1];
  }
  // Pattern 3: MN-D-NO-09-Khaki (multi-part design)
  else {
    // Look for numeric size at the end
    const lastPart = parts[parts.length - 1];
    
    // Check if last part is a number or size (M, L, XL, etc.)
    rawSize = lastPart;
    color = parts[parts.length - 2];
    design = parts.slice(0, -2).join('-');
  }

  // Clean color (remove dots, underscores)
  if (color) {
    color = color.replace(/[._]/g, ' ').trim();
  }

  // Convert size
  const size = convertSizeToLetter(rawSize) || (rawSize?.length <= 3 ? rawSize : null);

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
