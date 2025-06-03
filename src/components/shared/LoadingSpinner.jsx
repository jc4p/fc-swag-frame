'use client';

import React from 'react';
import styles from './LoadingSpinner.module.css';

/**
 * Loading spinner component matching the design system
 */
export function LoadingSpinner({ size = 'medium', message = 'Loading...' }) {
  return (
    <div className={styles.container}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}

/**
 * Full page loading state
 */
export function LoadingPage({ message = 'Loading...' }) {
  return (
    <div className={styles.pageContainer}>
      <LoadingSpinner size="large" message={message} />
    </div>
  );
}

/**
 * Skeleton loader for product cards
 */
export function ProductCardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <div className={styles.imageSkeleton}></div>
      <div className={styles.textSkeleton}>
        <div className={styles.titleSkeleton}></div>
        <div className={styles.subtitleSkeleton}></div>
      </div>
    </div>
  );
}