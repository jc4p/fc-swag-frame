'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebug } from '@/contexts/DebugContext';
import { ImageUploadHandler } from '@/components/shared/ImageUploadHandler';
import { KonvaImageEditor } from '@/components/shared/KonvaImageEditor';
import { ColorSelector } from '@/components/shared/ColorSelector';
import { CommissionSelector } from '@/components/shared/CommissionSelector';
import { PublishButton } from '@/components/shared/PublishButton';
import { usePublishDesign } from '@/hooks/usePublishDesign';
import { calculatePrice, calculateArtistEarnings, DEFAULT_CONSTANTS } from '@/lib/priceCalculator';
import styles from './ProductOptions.module.css';

/**
 * Renders interactive options, handles image upload/manipulation via Konva.js, and publishing.
 */
export function OptionsShirt({ product }) {
  const { logToOverlay } = useDebug();
  const { publishDesign, isLoadingPublish, isSigningIn, canPublish } = usePublishDesign();

  // --- State --- 
  const [selectedColorName, setSelectedColorName] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState(null);
  const [commissionRate, setCommissionRate] = useState(DEFAULT_CONSTANTS.DEFAULT_COMMISSION);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [userImageAttrs, setUserImageAttrs] = useState(null);
  const [hasBackgroundBeenRemoved, setHasBackgroundBeenRemoved] = useState(false);

  // Ref for stage (needed for publishing)
  const stageRef = useRef(null);

  // --- Helper: Calculate Price --- 
  const calculateCurrentPrice = useCallback((rate) => {
     if (!selectedVariant) return null;
     const baseCost = selectedVariant.base_price || DEFAULT_CONSTANTS.RAW_COST;
     const price = calculatePrice(rate, baseCost, DEFAULT_CONSTANTS.PLATFORM_FEE);
     console.log('calculateCurrentPrice called with rate:', rate, 'baseCost:', baseCost, 'calculated price:', price);
     return price;
  }, [selectedVariant]);

  // --- Effects for Selections & Pricing ---
  // Initial color selection
  useEffect(() => {
    if (product.colors && product.colors.length > 0 && !selectedColorName) {
      setSelectedColorName(product.colors[0].color_name);
    }
  }, [product.colors, selectedColorName]);

  const selectedColor = product.colors.find(c => c.color_name === selectedColorName);
  const availableSizes = selectedColor ? selectedColor.variants.map(v => v.size) : [];

  // Auto-select size
  useEffect(() => {
    if (selectedColor && availableSizes.length > 0) {
      const defaultSize = availableSizes.includes('M') ? 'M' : availableSizes[0];
      if (selectedSize !== defaultSize) {
        setSelectedSize(defaultSize);
      }
    } else {
      setSelectedSize(null);
    }
  }, [selectedColor, availableSizes, selectedSize]);

  // Find and store selected variant object
  useEffect(() => {
    if (selectedColor && selectedSize) {
      const variant = selectedColor.variants.find(v => v.size === selectedSize);
      setSelectedVariant(variant || null);
    } else {
      setSelectedVariant(null);
    }
  }, [selectedColor, selectedSize]);

  // Calculate price when variant or commission changes
  useEffect(() => {
    console.log('Price calculation effect triggered. Commission rate:', commissionRate, 'Selected variant:', selectedVariant);
    const currentPrice = calculateCurrentPrice(commissionRate);
    if (currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      const earnings = calculateArtistEarnings(currentPrice, commissionRate);
      setArtistEarnings(earnings);
      console.log('Price updated - Estimated price:', currentPrice, 'Artist earnings:', earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
      console.log('Price set to null');
    }
  }, [selectedVariant, commissionRate, calculateCurrentPrice]);

  // --- Component Handlers ---
  const handleImageUpload = (dataUrl) => {
    setUploadedImageDataUrl(dataUrl);
    setUserImageAttrs(null);
    setHasBackgroundBeenRemoved(false);
  };

  const handleImageRemove = () => {
    setUploadedImageDataUrl(null);
    setUserImageAttrs(null);
    setHasBackgroundBeenRemoved(false);
  };

  const handleBackgroundRemove = (processedDataUrl) => {
    setUploadedImageDataUrl(processedDataUrl);
    setHasBackgroundBeenRemoved(true);
  };

  const handleImageUpdate = (attrs) => {
    setUserImageAttrs(attrs);
  };


  const handlePublishClick = () => {
    publishDesign(userImageAttrs, selectedVariant, product, uploadedImageDataUrl, stageRef);
  };

  const handleCommissionRateChange = (rate) => {
    console.log('Commission rate change handler called with rate:', rate, 'Previous rate:', commissionRate);
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
          <h2 className={styles.headerTitle}>Create Listing</h2>
        </div>

        {/* Preview Section */}
        <div className={styles.previewContainer}>
          <ImageUploadHandler
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            uploadedImageDataUrl={uploadedImageDataUrl}
            className={styles.previewWrapper}
          >
            <KonvaImageEditor
              selectedVariant={selectedVariant}
              selectedColor={selectedColor}
              uploadedImageDataUrl={uploadedImageDataUrl}
              onImageUpdate={handleImageUpdate}
              onImageRemove={handleImageRemove}
              onBackgroundRemove={handleBackgroundRemove}
              isRemovingBackground={isRemovingBackground}
              hasBackgroundBeenRemoved={hasBackgroundBeenRemoved}
              stageRef={stageRef}
              className={styles.editorContainer}
            />
          </ImageUploadHandler>
        </div>

        {/* Upload Button */}
        {!uploadedImageDataUrl && (
          <div className={styles.uploadSection}>
            <ImageUploadHandler
              onImageUpload={handleImageUpload}
              onImageRemove={handleImageRemove}
              uploadedImageDataUrl={uploadedImageDataUrl}
            >
              <button className={styles.uploadButton}>
                <span>Upload Image</span>
              </button>
            </ImageUploadHandler>
          </div>
        )}

        {/* Customize Section */}
        <h3 className={styles.sectionHeader}>Customize</h3>
        <ColorSelector
          colors={product.colors}
          selectedColorName={selectedColorName}
          onColorSelect={setSelectedColorName}
          title=""
        />

        {/* Commission Section */}
        <CommissionSelector
          commissionRate={commissionRate}
          onCommissionChange={handleCommissionRateChange}
          estimatedPrice={estimatedPrice}
          artistEarnings={artistEarnings}
          baseCost={selectedVariant?.base_price}
          title="Set Commission"
        />
      </div>

      {/* Bottom Section */}
      <div>
        <PublishButton
          onPublish={handlePublishClick}
          disabled={
            !selectedVariant || 
            !userImageAttrs || 
            !estimatedPrice || 
            isRemovingBackground ||
            !canPublish
          }
          isLoading={isLoadingPublish}
          isSigningIn={isSigningIn}
        >
          Create Listing
        </PublishButton>
        <div className={styles.spacer}></div>
      </div>
    </div>
  );
}