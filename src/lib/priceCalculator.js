/**
 * Utility functions for price calculation
 */

export const DEFAULT_CONSTANTS = {
  RAW_COST: 12.19,
  PLATFORM_FEE: 4.00,
  DEFAULT_COMMISSION: 25,
  MIN_COMMISSION: 15,
  MAX_COMMISSION: 30
};

/**
 * Calculate retail price based on commission rate
 * @param {number} commissionRate - Commission percentage (15-30)
 * @param {number} baseCost - Base cost of the product
 * @param {number} platformFee - Platform fee
 * @returns {number|null} - Calculated price or null if invalid
 */
export function calculatePrice(commissionRate, baseCost = DEFAULT_CONSTANTS.RAW_COST, platformFee = DEFAULT_CONSTANTS.PLATFORM_FEE) {
  if (!commissionRate || commissionRate < DEFAULT_CONSTANTS.MIN_COMMISSION || commissionRate > DEFAULT_CONSTANTS.MAX_COMMISSION) {
    return null;
  }

  const costPlusFee = baseCost + platformFee;
  if (commissionRate >= 100) return null;
  
  const retail = costPlusFee / (1 - commissionRate / 100);
  return Math.ceil(retail) - 0.01;
}

/**
 * Calculate artist earnings based on retail price and commission rate
 * @param {number} retailPrice - Final retail price
 * @param {number} commissionRate - Commission percentage
 * @returns {number} - Artist earnings
 */
export function calculateArtistEarnings(retailPrice, commissionRate) {
  if (!retailPrice || !commissionRate) return 0;
  return retailPrice * (commissionRate / 100);
}

/**
 * Get contrast color for text based on background
 * @param {string} hexColor - Background color in hex format
 * @returns {string} - Either '#000000' or '#FFFFFF'
 */
export function getContrastColor(hexColor) {
  if (!hexColor) return '#000000';
  
  try {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return '#000000';
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  } catch (e) {
    console.error("Error calculating contrast color:", e);
    return '#000000';
  }
}