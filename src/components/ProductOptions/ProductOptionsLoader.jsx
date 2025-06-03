'use client';

import React, { Suspense } from 'react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import styles from './ProductOptions.module.css';

// Dynamically import the components
const OptionsShirt = React.lazy(() => 
  import('./OptionsShirt').then(module => ({ default: module.OptionsShirt }))
);
const OptionsStickerSheet = React.lazy(() => 
  import('./OptionsStickerSheet').then(module => ({ default: module.OptionsStickerSheet }))
);
const OptionsKissCutSticker = React.lazy(() => 
  import('./OptionsKissCutSticker').then(module => ({ default: module.OptionsKissCutSticker }))
);

// Fallback UI for Suspense
function EditorLoadingFallback() {
  return (
    <div className={styles.loadingContainer}>
      <LoadingSpinner size="large" message="Loading Designer..." />
    </div>
  );
}

export function ProductOptionsLoader({ product, onBack }) {
  if (!product) {
    return <p>No product selected or product data is missing.</p>;
  }

  let ComponentToLoad = null;

  // Determine component based on product type (using slug as a heuristic for now)
  // TODO: Switch to a dedicated product.product_type field if available from the API.
  if (product.slug && product.slug.toLowerCase().includes('sticker')) {
    // Check if it's Kiss-Cut Stickers (product 358) vs Sticker Sheet (product 505)
    if (product.slug === 'sticker-358') {
      ComponentToLoad = OptionsKissCutSticker;
    } else {
      ComponentToLoad = OptionsStickerSheet;
    }
  } else {
    // Default to OptionsShirt for t-shirts or other types not explicitly handled
    ComponentToLoad = OptionsShirt;
  }

  if (!ComponentToLoad) {
    // This case should ideally not be reached if the logic above is sound
    return <p>Could not determine the correct editor for this product type.</p>;
  }
  
  return (
    <Suspense fallback={<EditorLoadingFallback />}>
      <ComponentToLoad product={product} onBack={onBack} />
    </Suspense>
  );
} 