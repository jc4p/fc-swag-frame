'use client';

import React from 'react';
import styles from './CommissionSelector.module.css';

/**
 * Reusable commission rate selector component
 * Displays commission options and pricing breakdown
 */
export function CommissionSelector({ 
  commissionRate, 
  onCommissionChange, 
  estimatedPrice, 
  artistEarnings, 
  baseCost,
  platformFee = 4.00,
  commissionOptions = [15, 20, 25, 30],
  className = '',
  title = 'Set Your Commission'
}) {
  
  const handleCommissionChange = (rate) => {
    console.log('Commission button clicked:', rate, 'Current rate:', commissionRate);
    if (onCommissionChange) {
      onCommissionChange(rate);
      console.log('onCommissionChange called with rate:', rate);
    } else {
      console.warn('onCommissionChange is not provided');
    }
  };

  return (
    <>
      <div className={`${styles.commissionSelector} ${className}`}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={styles.commissionButtons}>
          {commissionOptions.map(rate => (
            <button
              key={rate}
              className={`${styles.commissionButton} ${commissionRate === rate ? styles.selected : ''}`}
              onClick={() => handleCommissionChange(rate)}
            >
              {rate}%
            </button>
          ))}
        </div>
      </div>
      
      {/* Price breakdown section */}
      <h3 className={styles.sectionTitle}>Final Price</h3>
      <div className={styles.priceBreakdown}>
        <div className={styles.priceRow}>
          <p className={styles.priceLabel}>Raw Cost</p>
          <p className={styles.priceValue}>${baseCost?.toFixed(2) || '14.95'}</p>
        </div>
        <div className={styles.priceRow}>
          <p className={styles.priceLabel}>Platform Fee</p>
          <p className={styles.priceValue}>${platformFee.toFixed(2)}</p>
        </div>
        {estimatedPrice !== null && artistEarnings !== null && (
          <div className={styles.priceRow}>
            <p className={styles.priceLabel}>Commission</p>
            <p className={styles.priceValue}>${artistEarnings.toFixed(2)}</p>
          </div>
        )}
      </div>
      
      {/* Final price section */}
      {estimatedPrice !== null && (
        <div className={styles.finalPriceSection}>
          <p className={styles.finalPriceLabel}>Final Price</p>
          <p className={styles.finalPriceValue}>${estimatedPrice.toFixed(2)}</p>
        </div>
      )}
    </>
  );
}