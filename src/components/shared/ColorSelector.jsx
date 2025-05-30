'use client';

import React from 'react';
import styles from './ColorSelector.module.css';

/**
 * Reusable color selector component
 * Displays color swatches and handles selection
 */
export function ColorSelector({ 
  colors = [], 
  selectedColorName, 
  onColorSelect, 
  className = '',
  title = 'Color'
}) {
  if (!colors || colors.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.colorSelector} ${className}`}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      <div className={styles.colorSwatches}>
        {colors.map(color => (
          <button
            key={color.color_name}
            title={color.color_name}
            className={`${styles.swatch} ${selectedColorName === color.color_name ? styles.selected : ''}`}
            style={{ backgroundColor: color.color_code }}
            onClick={() => onColorSelect?.(color.color_name)}
            aria-label={`Select color ${color.color_name}`}
          />
        ))}
      </div>
    </div>
  );
}