'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebug } from '@/contexts/DebugContext';
import { ImageUploadHandler } from '@/components/shared/ImageUploadHandler';
import { KonvaImageEditor } from '@/components/shared/KonvaImageEditor';
import { CommissionSelector } from '@/components/shared/CommissionSelector';
import { PublishButton } from '@/components/shared/PublishButton';
import { usePublishDesign } from '@/hooks/usePublishDesign';
import { calculatePrice, calculateArtistEarnings, DEFAULT_CONSTANTS } from '@/lib/priceCalculator';
import styles from './ProductOptions.module.css';

/**
 * Size selector component for Kiss-Cut Stickers
 */
function SizeSelector({ variants, selectedSize, onSizeSelect, title = "Size" }) {
  if (!variants || variants.length === 0) return null;

  return (
    <div className={styles.selectorContainer}>
      <h4 className={styles.selectorTitle}>{title}</h4>
      <div className={styles.selectorOptions}>
        {variants.map((variant) => (
          <button
            key={variant.id}
            className={`${styles.selectorButton} ${selectedSize === variant.size ? styles.selected : ''}`}
            onClick={() => onSizeSelect(variant.size)}
          >
            <span className={styles.sizeLabel}>{variant.size}</span>
            <span className={styles.priceLabel}>${variant.base_price}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders Kiss-Cut Sticker options with size selection and single image editor
 */
export function OptionsKissCutSticker({ product, onBack }) {
  const { logToOverlay } = useDebug();
  const { publishDesign, isLoadingPublish, isSigningIn, canPublish } = usePublishDesign();

  // --- State --- 
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

  // Get available sizes from the first color (Kiss-Cut Stickers only have white)
  const whiteVariants = useMemo(() => {
    return product.colors && product.colors.length > 0 ? product.colors[0].variants : [];
  }, [product.colors]);
  
  const availableSizes = useMemo(() => {
    return whiteVariants.map(v => v.size);
  }, [whiteVariants]);

  // --- Helper: Calculate Price --- 
  const calculateCurrentPrice = useCallback((rate) => {
     if (!selectedVariant) return null;
     const baseCost = selectedVariant.base_price || DEFAULT_CONSTANTS.RAW_COST;
     const price = calculatePrice(rate, baseCost, DEFAULT_CONSTANTS.PLATFORM_FEE);
     console.log('Kiss-Cut calculateCurrentPrice called with rate:', rate, 'baseCost:', baseCost, 'calculated price:', price);
     return price;
  }, [selectedVariant]);

  // --- Effects for Selections & Pricing ---
  // Auto-select first size
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      // Default to middle size (4″×4″) if available, otherwise first size
      const defaultSize = availableSizes.includes('4″×4″') ? '4″×4″' : availableSizes[0];
      setSelectedSize(defaultSize);
    }
  }, [availableSizes, selectedSize]);

  // Find and store selected variant object
  useEffect(() => {
    if (selectedSize && whiteVariants.length > 0) {
      const variant = whiteVariants.find(v => v.size === selectedSize);
      setSelectedVariant(variant || null);
    } else {
      setSelectedVariant(null);
    }
  }, [selectedSize, whiteVariants]);

  // Calculate price when variant or commission changes
  useEffect(() => {
    console.log('Kiss-Cut price calculation effect triggered. Commission rate:', commissionRate, 'Selected variant:', selectedVariant);
    const currentPrice = calculateCurrentPrice(commissionRate);
    if (currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      const earnings = calculateArtistEarnings(currentPrice, commissionRate);
      setArtistEarnings(earnings);
      console.log('Kiss-Cut price updated - Estimated price:', currentPrice, 'Artist earnings:', earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
      console.log('Kiss-Cut price set to null');
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

  const handleImageUpdate = (attrs) => {
    setUserImageAttrs(attrs);
  };

  const handleBackgroundRemove = (processedDataUrl) => {
    setUploadedImageDataUrl(processedDataUrl);
    setHasBackgroundBeenRemoved(true);
  };

  const handlePublishClick = () => {
    publishDesign(userImageAttrs, selectedVariant, product, uploadedImageDataUrl, stageRef, commissionRate);
  };

  const handleCommissionRateChange = (rate) => {
    setCommissionRate(rate);
  };

  return (
    <div className={styles.optionsContainer}>
      <div>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.closeButton} onClick={onBack}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
            </svg>
          </button>
          <h2 className={styles.headerTitle}>Create Kiss-Cut Sticker</h2>
        </div>

        {/* Preview Section */}
        <div className={styles.previewContainer}>
          <ImageUploadHandler
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            uploadedImageDataUrl={uploadedImageDataUrl}
          >
            <KonvaImageEditor
              selectedVariant={selectedVariant}
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
        <SizeSelector
          variants={whiteVariants}
          selectedSize={selectedSize}
          onSizeSelect={setSelectedSize}
          title="Size"
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
          Create Sticker
        </PublishButton>
        <div className={styles.spacer}></div>
      </div>
    </div>
  );
}