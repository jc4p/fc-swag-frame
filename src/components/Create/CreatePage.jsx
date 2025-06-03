'use client';

import React, { useState, useEffect } from 'react';
import { CreateHeader } from './CreateHeader';
import { ProductSelection } from './ProductSelection';
import { ProductOptionsLoader } from '@/components/ProductOptions/ProductOptionsLoader';

/**
 * Main create page component with redesigned UI
 */
export function CreatePage({ products, error }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state for better UX
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // If there's only one product and no error, auto-select it
    if (products && products.length === 1 && !error && !isLoading) {
      setSelectedProduct(products[0]);
    }
    // If products list changes and current selection is no longer valid, clear it
    if (selectedProduct && products && !products.find(p => p.id === selectedProduct.id)) {
      setSelectedProduct(null);
    }
  }, [products, error, selectedProduct, isLoading]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
  };

  const handleBackToSelection = () => {
    setSelectedProduct(null);
  };

  // If a product is selected, show the editor
  if (selectedProduct) {
    return (
      <ProductOptionsLoader 
        product={selectedProduct} 
        onBack={handleBackToSelection} 
      />
    );
  }

  // Show the product selection screen
  return (
    <div className="create-page">
      <CreateHeader />
      <ProductSelection
        products={products}
        onProductSelect={handleProductSelect}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}