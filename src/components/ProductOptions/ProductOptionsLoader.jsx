'use client';

import React, { Suspense } from 'react';
import styles from './ProductOptions.module.css'; // Assuming styles might be shared or adapted

// Dynamically import the components
const OptionsShirt = React.lazy(() => 
  import('./OptionsShirt').then(module => ({ default: module.OptionsShirt }))
);
const OptionsStickerSheet = React.lazy(() => 
  import('./OptionsStickerSheet').then(module => ({ default: module.OptionsStickerSheet }))
);

// Fallback UI for Suspense
function EditorLoadingFallback() {
  return (
    <div className={styles.loadingContainer}> {/* You might need to define this style */}
      <p>Loading Designer...</p>
      {/* You could add a spinner SVG or component here */}
    </div>
  );
}

export function ProductOptionsLoader({ product }) {
  if (!product) {
    return <p>No product selected or product data is missing.</p>;
  }

  let ComponentToLoad = null;

  // Determine component based on product type (using slug as a heuristic for now)
  // TODO: Switch to a dedicated product.product_type field if available from the API.
  if (product.slug && product.slug.toLowerCase().includes('sticker')) {
    ComponentToLoad = OptionsStickerSheet;
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
      <ComponentToLoad product={product} />
    </Suspense>
  );
} 