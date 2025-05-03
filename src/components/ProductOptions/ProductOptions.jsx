'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './ProductOptions.module.css';

/**
 * Renders interactive options (color, size, commission) and handles image upload/preview.
 * @param {object} props
 * @param {object} props.product - The product data containing options and colors.
 */
export function ProductOptions({ product }) {
  const [selectedColorName, setSelectedColorName] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null); // Store the uploaded image URL/object
  const [mockupImageUrl, setMockupImageUrl] = useState(null); // Store the generated mockup URL
  const [commissionRate, setCommissionRate] = useState(25); // Default 25%
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);

  const fileInputRef = useRef(null);

  // --- Pricing Constants (from API_OVERVIEW_PLAN.md) ---
  const RAW_COST = 14.95;
  const PLATFORM_FEE = 4.00;

  // --- Pricing Helper Functions ---
  const calculatePrice = (rate) => {
    if (rate < 15 || rate > 30) return null;
    const costPlusFee = RAW_COST + PLATFORM_FEE;
    // Prevent division by zero or negative numbers if rate is 100 or more (though slider prevents this)
    if (rate >= 100) return null; 
    const retail = costPlusFee / (1 - rate / 100);
    // Round up to nearest .99
    return Math.ceil(retail) - 0.01;
  };

  // Find the currently selected color object
  const selectedColor = product.colors.find(c => c.color_name === selectedColorName);

  // Extract available sizes for the selected color
  const availableSizes = selectedColor ? selectedColor.variants.map(v => v.size) : [];

  // --- Effects for managing selection state --- 
  useEffect(() => {
    if (product.colors && product.colors.length > 0 && !selectedColorName) {
      setSelectedColorName(product.colors[0].color_name);
    }
  }, [product.colors, selectedColorName]);

  useEffect(() => {
    if (selectedColor && availableSizes.length > 0) {
      // Prefer 'M' if available, otherwise take the first size
      const defaultSize = availableSizes.includes('M') ? 'M' : availableSizes[0];
      setSelectedSize(defaultSize);
      console.log(`Color changed to ${selectedColorName}, auto-selected size: ${defaultSize}`);
    } else {
      setSelectedSize(null); // No color or no sizes available
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColorName]);

  useEffect(() => {
    if (selectedColor && selectedSize) {
      const variant = selectedColor.variants.find(v => v.size === selectedSize);
      if (variant) {
        const variantDetails = {
          productId: product.id,
          variantId: variant.id,
          colorName: selectedColor.color_name,
          colorCode: selectedColor.color_code,
          size: variant.size,
          basePrice: variant.base_price,
          inventory: variant.inventory_count
        };
        setSelectedVariant(variantDetails);
        console.log('Variant auto-selected:', variantDetails);
      } else {
        setSelectedVariant(null);
      }
    } else {
      setSelectedVariant(null);
    }
  }, [selectedColor, selectedSize, product.id]);

  // --- Effect for Price Calculation (Simplified) ---
  useEffect(() => {
    // Calculate price based directly on the selected commissionRate
    const currentPrice = calculatePrice(commissionRate);
    
    if (selectedVariant && currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      // Calculate artist earnings based on the selected rate
      const earnings = currentPrice * (commissionRate / 100);
      setArtistEarnings(earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
    }
  // Depend only on the selected variant and the chosen commission rate
  }, [selectedVariant, commissionRate]); 

  // --- Handlers --- 
  const handlePreviewClick = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Display the selected image temporarily
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        // TODO: Trigger actual mockup generation API call here
        console.log("File selected, triggering mockup generation (stubbed)", { variant: selectedVariant, file: file.name });
        // For now, simulate mockup generation with a placeholder
        setMockupImageUrl(`https://placehold.co/400x400/${selectedColor?.color_code.substring(1) || 'cccccc'}/ffffff.png?text=Mockup+for+${encodeURIComponent(file.name)}`);
        alert('Generating mockup (stub)... Check console.');
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so the same file can be selected again
    event.target.value = '';
  };

  const handlePublishClick = () => {
      if (!selectedVariant || !uploadedImage || !mockupImageUrl || !estimatedPrice) {
          alert("Please select variant, upload image, and set commission first.");
          return;
      }
      console.log("Publishing Design (stubbed):", {
          variant: selectedVariant,
          commissionRate: commissionRate, // Use the selected rate
          estimatedPrice,
          artistEarnings,
          // Include image data/reference and mockup URL in actual call
      });
      alert("Publishing... (stub - check console)");
      // TODO: Call POST /api/designs/:id/publish here
  };


  // --- JSX Rendering --- 
  return (
    <div className={styles.optionsContainer}>

       {/* Integrated Preview/Upload Area - Placed first on mobile */}
      <div className={styles.previewUploadSection} onClick={handlePreviewClick}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp" // Specify acceptable file types
          style={{ display: 'none' }} // Hide the actual input
        />
        {mockupImageUrl ? (
          <img src={mockupImageUrl} alt="T-shirt mockup" className={styles.previewImage} />
        ) : uploadedImage ? (
           <img src={uploadedImage} alt="Uploaded design preview" className={styles.previewImage} />
        ) : (
          <div className={styles.uploadPlaceholder}>
            <span className={styles.uploadIcon}>🖼️</span> {/* Placeholder icon */} 
            <span>Click to Upload Art</span>
          </div>
        )}
      </div>

      {/* Product Name & Base Price */}
      <div>
        <h2 className={styles.productName}>{product.name}</h2>
        {selectedColor && selectedColor.base_price !== undefined && (
          <p className={styles.basePriceDisplay}>Base Price: <strong>${selectedColor.base_price.toFixed(2)}</strong></p>
        )}
      </div>

      {/* Color Selector */}
      <div className={`${styles.optionSection} ${styles.colorSelector}`}>
        <h3 className={styles.sectionTitle}>Color</h3>
        <div className={styles.colorSwatches}>
          {product.colors.map(color => (
            <button
              key={color.color_name}
              title={color.color_name}
              className={`${styles.swatch} ${selectedColorName === color.color_name ? styles.selected : ''}`}
              style={{ backgroundColor: color.color_code }}
              onClick={() => setSelectedColorName(color.color_name)}
              aria-label={`Select color ${color.color_name}`}
            />
          ))}
        </div>
      </div>

      {/* Size Selector REMOVED FROM UI */}

      {/* Commission Rate Selector Buttons */}
      <div className={styles.optionSection}>
          <h3 className={styles.sectionTitle}>Set Your Commission</h3>
          {/* Button Group */}
          <div className={styles.commissionButtons}>
              {[15, 20, 25, 30].map(rate => (
                  <button
                      key={rate}
                      className={`${styles.commissionButton} ${commissionRate === rate ? styles.selected : ''}`}
                      onClick={() => setCommissionRate(rate)}
                  >
                      {rate}%
                  </button>
              ))}
          </div>
          {/* Price Breakdown Display */}
          {estimatedPrice !== null && artistEarnings !== null && (
             <div className={styles.priceBreakdown}>
                <p>Buyer pays: <strong>${estimatedPrice.toFixed(2)}</strong><span className={styles.shippingText}> + Shipping</span></p>
                <p>Your Earnings: <strong>${artistEarnings.toFixed(2)}</strong></p>
             </div>
          )}
           <p className={styles.commissionNote}>Platform takes a flat $4.00 fee.</p>
      </div>

      {/* Publish Button - Replaces Upload/Mockup */}
      <div className={styles.actionSection}>
         <button
           className={styles.primaryButton}
           onClick={handlePublishClick} // Renamed action
           disabled={!selectedVariant || !uploadedImage || !mockupImageUrl || !estimatedPrice} // More comprehensive check
          >
             Publish Design
         </button>
      </div>

    </div>
  );
} 