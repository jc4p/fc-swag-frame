'use client';

import dynamic from 'next/dynamic';
import styles from './ProductOptions.module.css'; // Can use styles from ProductOptions or define its own

// Dynamically import the main ProductOptions component with SSR disabled
const ProductOptionsComponent = dynamic(
  () => import('./ProductOptions').then(mod => mod.ProductOptions),
  {
    ssr: false,
    // Use a simple loading placeholder within the loader
    loading: () => <div className={styles.loadingPlaceholder}>Loading Designer...</div> 
  }
);

// This loader component simply passes the props down to the dynamically loaded one
export function ProductOptionsLoader({ product }) {
  if (!product) {
    // Handle case where product might not be loaded yet by parent
    return <div className={styles.loadingPlaceholder}>Loading product data...</div>;
  }
  
  return <ProductOptionsComponent product={product} />;
} 