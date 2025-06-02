'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDebug } from '@/contexts/DebugContext';
import { ImageUploadHandler } from '@/components/shared/ImageUploadHandler';
import { CommissionSelector } from '@/components/shared/CommissionSelector';
import { PublishButton } from '@/components/shared/PublishButton';
import { usePublishMultiDesign } from '@/hooks/usePublishMultiDesign';
import { KonvaMultiImageEditor } from './KonvaMultiImageEditor';
import { calculatePrice, calculateArtistEarnings, DEFAULT_CONSTANTS } from '@/lib/priceCalculator';
import styles from './ProductOptions.module.css';

// Constants for sticker sheets
const DEFAULT_STICKER_COMMISSION = 30;

/**
 * Renders sticker sheet options with multi-image support
 * Uses the new unified component architecture
 */
export function OptionsStickerSheet({ product }) {
  const { logToOverlay } = useDebug();
  const { publishMultiDesign, isLoadingPublish, isSigningIn, canPublish } = usePublishMultiDesign();

  // --- State for Sticker Sheets ---
  const [userImages, setUserImages] = useState([]); // Array of image data URLs
  const [commissionRate, setCommissionRate] = useState(DEFAULT_STICKER_COMMISSION);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [multiImageAttrs, setMultiImageAttrs] = useState(null); // Will store all image positions
  
  // Refs
  const stageRef = useRef(null);
  
  // Get the main variant for sticker sheets
  const mainVariant = product.variants && product.variants.length > 0 ? product.variants[0] : product;

  // --- Price Calculation ---
  const calculateCurrentPrice = useCallback((rate) => {
    if (!mainVariant) return null;
    const baseCost = mainVariant.base_price || DEFAULT_CONSTANTS.RAW_COST;
    const price = calculatePrice(rate, baseCost, DEFAULT_CONSTANTS.PLATFORM_FEE);
    return price;
  }, [mainVariant]);

  useEffect(() => {
    const currentPrice = calculateCurrentPrice(commissionRate);
    if (currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      const earnings = calculateArtistEarnings(currentPrice, commissionRate);
      setArtistEarnings(earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
    }
  }, [commissionRate, calculateCurrentPrice]);

  // --- Event Handlers ---
  const handleImageUpload = (dataUrl) => {
    console.log(`Sticker: Adding new image, dataUrl length: ${dataUrl?.length}`);
    setUserImages(prev => {
      const newImages = [...prev, dataUrl];
      console.log(`New userImages array length: ${newImages.length}`);
      return newImages;
    });
  };

  const handleImageRemove = (indexToRemove) => {
    console.log(`Sticker: Removing image at index ${indexToRemove}`);
    setUserImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleMultiImageUpdate = (attrs) => {
    setMultiImageAttrs(attrs);
  };

  const handleBackgroundRemove = (processedDataUrl, imageIndex) => {
    console.log(`Sticker: Background removed for image ${imageIndex}`);
    setUserImages(prev => prev.map((img, index) => 
      index === imageIndex ? processedDataUrl : img
    ));
  };

  const handlePublishClick = () => {
    // For sticker sheets, we use the multi-image publish logic
    publishMultiDesign(multiImageAttrs, mainVariant, product, userImages, stageRef);
  };

  const handleCommissionRateChange = (rate) => {
    setCommissionRate(rate);
  };

  return (
    <div className={styles.optionsContainer}>
      <div>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.closeButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
            </svg>
          </div>
          <h2 className={styles.headerTitle}>Create Sticker Sheet</h2>
        </div>

        {/* Preview Section */}
        <div className={styles.previewContainer}>
          <KonvaMultiImageEditor
            selectedVariant={mainVariant}
            userImages={userImages}
            onMultiImageUpdate={handleMultiImageUpdate}
            onImageRemove={handleImageRemove}
            onBackgroundRemove={handleBackgroundRemove}
            onImageUpload={handleImageUpload}
            isRemovingBackground={isRemovingBackground}
            stageRef={stageRef}
            className={styles.editorContainer}
          />
        </div>

        {/* Upload Button */}
        <div className={styles.uploadSection}>
          <ImageUploadHandler
            onImageUpload={handleImageUpload}
            acceptedTypes="image/png, image/jpeg, image/webp"
          >
            <button className={styles.uploadButton}>
              <span>{userImages.length > 0 ? 'Add More Stickers' : 'Upload Stickers'}</span>
            </button>
          </ImageUploadHandler>
        </div>

        {/* Commission Section */}
        <CommissionSelector
          commissionRate={commissionRate}
          onCommissionChange={handleCommissionRateChange}
          estimatedPrice={estimatedPrice}
          artistEarnings={artistEarnings}
          baseCost={mainVariant?.base_price}
          title="Set Commission"
        />
      </div>

      {/* Bottom Section */}
      <div>
        <PublishButton
          onPublish={handlePublishClick}
          disabled={
            userImages.length === 0 || 
            !multiImageAttrs || 
            !estimatedPrice || 
            isRemovingBackground ||
            !canPublish
          }
          isLoading={isLoadingPublish}
          isSigningIn={isSigningIn}
        >
          Create Sticker Sheet
        </PublishButton>
        <div className={styles.spacer}></div>
      </div>
    </div>
  );
}