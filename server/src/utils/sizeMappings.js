// Hardcoded size mappings (waist in inches → letter size)
const SIZE_MAPPINGS = {
  '28': 'S',
  '30': 'M',
  '32': 'L',
  '34': 'XL',
  '36': 'XXL'
};

// Reverse mapping (letter → inches)
const REVERSE_SIZE_MAPPINGS = {
  'S': '28',
  'M': '30',
  'L': '32',
  'XL': '34',
  'XXL': '36'
};

// Convert numeric size to letter size
const convertSizeToLetter = (numericSize) => {
  const cleaned = String(numericSize).trim();
  return SIZE_MAPPINGS[cleaned] || null;
};

// Convert letter size to numeric
const convertSizeToNumeric = (letterSize) => {
  const cleaned = String(letterSize).trim().toUpperCase();
  return REVERSE_SIZE_MAPPINGS[cleaned] || null;
};

// Get all valid sizes
const getAllLetterSizes = () => {
  return ['S', 'M', 'L', 'XL', 'XXL'];
};

// Get waist info for size
const getWaistInfo = (letterSize) => {
  const waistMap = {
    'S': '28',
    'M': '30',
    'L': '32',
    'XL': '34',
    'XXL': '36',
    'XXXL': '38',
    'XXXL': '40',
  };
  return waistMap[letterSize] || '';
};

module.exports = {
  SIZE_MAPPINGS,
  REVERSE_SIZE_MAPPINGS,
  convertSizeToLetter,
  convertSizeToNumeric,
  getAllLetterSizes,
  getWaistInfo
};
