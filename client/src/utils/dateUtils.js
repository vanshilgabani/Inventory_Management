import { format } from 'date-fns';

/**
 * Format date consistently across the app
 * @param {Date|string} date - Date to format
 * @param {string} formatStr - Format string (default: 'dd MMM yyyy')
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatStr = 'dd MMM yyyy') => {
  if (!date) return '';
  try {
    return format(new Date(date), formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

/**
 * Format date for display in tables
 */
export const formatTableDate = (date) => {
  return formatDate(date, 'dd MMM yyyy');
};

/**
 * Format date with time
 */
export const formatDateTime = (date) => {
  return formatDate(date, 'dd MMM yyyy, hh:mm a');
};

// ✅ NEW: Format date as dd/mm/yyyy
export const formatDateDMY = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

// ✅ NEW: Format date as dd Month yyyy (e.g., 12 December 2025)
export const formatDateFull = (date) => {
  return formatDate(date, 'dd MMMM yyyy');
};

// ✅ NEW: Get return date from status history
export const getReturnDate = (sale) => {
  if (!sale.statusHistory || sale.statusHistory.length === 0) return null;
  
  // Find the most recent 'returned' status change
  const returnEntry = [...sale.statusHistory]
    .reverse()
    .find(entry => entry.newStatus === 'returned');
  
  return returnEntry ? returnEntry.changedAt : null;
};

/**
 * Calculate days difference from now
 */
export const getDaysFromNow = (date) => {
  if (!date) return 0;
  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = now - targetDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if date is overdue
 */
export const isOverdue = (date, daysThreshold = 0) => {
  return getDaysFromNow(date) > daysThreshold;
};

/**
 * Format currency in Indian format
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Format currency without decimals
 */
export const formatCurrencyShort = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};
