'use client';

import React from 'react';
import { ProductCardSkeleton } from '@/components/shared/LoadingSpinner';
import styles from './Create.module.css';

/**
 * Product selection component for the create page
 */
export function ProductSelection({ products, onProductSelect, isLoading, error }) {
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
          </svg>
        </div>
        <h3 className={styles.errorTitle}>Unable to load products</h3>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.productGrid}>
        {[...Array(3)].map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256">
            <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Zm-32-80a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z"></path>
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>No products available</h3>
        <p className={styles.emptyMessage}>Check back soon for new products to customize!</p>
      </div>
    );
  }

  // Map products to display format with images
  const productDisplayData = [
    {
      id: 'shirts',
      title: 'Custom T-Shirts',
      description: 'Design your own t-shirt',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBv5ftX7Nfaj6Z-etvnmdMmkC2MUKBDw1Pru-O8s4N3bIQ11CHZpN_vHx99gur2EpRG-weXZ38fBLsTR46AVlEy8WskrQWsE86I9GVTI1zjEZz0FzEwJAsRxRWD1ENIrsqg_ZPWYVm7oeAq8PaxjrJqdQAUapR-qEDYx6o8xDM-NOKhm6DOJ9mtvRibR0IXCpiKT-89vEFprp-JAWXAz-E5Qe10ayKgtOERynYkumMGhUTtwZjw7Ia5zByVmGq92cHZu803s2jnrz3',
      product: products.find(p => p.slug === 'unisex-t-shirt')
    },
    {
      id: 'sticker-sheet',
      title: 'Sticker Sheets',
      description: 'Create multi-sticker designs',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANq9YwSy7kjSdb5hfBcddQHOgztzYy2wm8KOpKqNPaEmP5KkNaoZHo27BKM6tb8TfvV114pvqpieCbkwji9-t0DrEjvvUBRrSRe7rPmb0KQvqCAas659qwewM9SPJaJdztK3g4_zu-P2TGdF2V_NcH__T8UoH0-Uyj3NzGHwu2jLSdqsijGdMF2ZadhQKH8eeYSxiWUN2pOjRZRbnwxZw0YOTXBi4IdX5pk86O_XTvKmNGh-jN5KX02yk0PpkpGaWYt2Tk89ud7iE2',
      product: products.find(p => p.slug === 'sticker-505')
    },
    {
      id: 'kiss-cut-stickers',
      title: 'Kiss-Cut Stickers',
      description: 'Individual custom stickers',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANq9YwSy7kjSdb5hfBcddQHOgztzYy2wm8KOpKqNPaEmP5KkNaoZHo27BKM6tb8TfvV114pvqpieCbkwji9-t0DrEjvvUBRrSRe7rPmb0KQvqCAas659qwewM9SPJaJdztK3g4_zu-P2TGdF2V_NcH__T8UoH0-Uyj3NzGHwu2jLSdqsijGdMF2ZadhQKH8eeYSxiWUN2pOjRZRbnwxZw0YOTXBi4IdX5pk86O_XTvKmNGh-jN5KX02yk0PpkpGaWYt2Tk89ud7iE2',
      product: products.find(p => p.slug === 'sticker-358')
    }
  ].filter(item => item.product); // Only show products that exist

  return (
    <div className={styles.productGrid}>
      {productDisplayData.map((item) => (
        <button
          key={item.id}
          className={styles.productCard}
          onClick={() => onProductSelect(item.product)}
        >
          <div 
            className={styles.productImage}
            style={{ backgroundImage: `url("${item.image}")` }}
          />
          <div className={styles.productInfo}>
            <h3 className={styles.productTitle}>{item.title}</h3>
            <p className={styles.productDescription}>{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}