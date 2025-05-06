'use client';

import React, { useState, useEffect } from 'react';
import { ProductOptionsLoader } from '@/components/ProductOptions/ProductOptionsLoader';
import styles from './ProductSelectorAndEditor.module.css'; // We'll create this CSS module later

export function ProductSelectorAndEditor({ products, error }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    // If there's only one product and no error, auto-select it.
    if (products && products.length === 1 && !error) {
      setSelectedProduct(products[0]);
    }
    // If products list changes (e.g. on a future refresh) and current selection is no longer valid, clear it.
    if (selectedProduct && products && !products.find(p => p.id === selectedProduct.id)) {
      setSelectedProduct(null);
    }
  }, [products, error, selectedProduct]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
  };

  const handleBackToSelection = () => {
    setSelectedProduct(null);
  };

  if (error) {
    return (
      <div className={styles.messageSection}>
        <p>{error}</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={styles.messageSection}>
        <p>No products currently available. Check back soon!</p>
      </div>
    );
  }

  if (!selectedProduct) {
    return (
      <div className={styles.selectorContainer}>
        <h2>Choose a Product to Customize</h2>
        <div className={styles.productList}>
          {products.map((product) => (
            <button
              key={product.id}
              className={styles.productButton}
              onClick={() => handleProductSelect(product)}
            >
              {product.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // A product is selected, show the editor
  return (
    <div>
      <button onClick={handleBackToSelection} className={styles.backButton}>
        &larr; Choose Different Product
      </button>
      <div className={styles.designerGrid}>
        <div className={styles.optionsArea}>
          <ProductOptionsLoader product={selectedProduct} />
        </div>
      </div>
    </div>
  );
} 