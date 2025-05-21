'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Stage, Layer, Rect, Image, Transformer, Text, Group } from 'react-konva';
import useImage from 'use-image';
import styles from './ProductOptions.module.css'; // Reuse styles for now, can be split later
import { useDebug } from '@/contexts/DebugContext';
import { useAuth } from '@/contexts/AuthContext';
import * as frame from '@farcaster/frame-sdk';

// Import SVG files as URLs for use-image
import trashIconUrl from '@/assets/icons/trash.svg';
import removeBgIconUrl from '@/assets/icons/remove-bg.svg';

// --- Constants (Sticker specific or shared) ---
// TODO: Define sticker-specific pricing or use product.base_price directly
const STICKER_RAW_COST = 5.00; // Example
const PLATFORM_FEE = 2.00;    // Example
const DEFAULT_STICKER_COMMISSION = 30; // Example
const ICON_SIZE = 24;
const ICON_PADDING = 10;

// --- Helper Functions (Can be shared or moved) ---
const dataURLtoBlob = (dataurl) => {
    if (!dataurl) return null;
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    } catch (e) {
        console.error("Error converting Data URL to Blob:", e);
        return null;
    }
}

export function OptionsStickerSheet({ product }) {
  const { logToOverlay } = useDebug();
  const { authToken, userFid, isAuthenticated, isAuthLoading, login } = useAuth();

  // --- State for Sticker Sheets ---
  const [userImages, setUserImages] = useState([]); // Array to hold multiple image objects { id, dataUrl, attrs, konvaImage }
  const [selectedImageId, setSelectedImageId] = useState(null); // To track which image is selected
  const [commissionRate, setCommissionRate] = useState(DEFAULT_STICKER_COMMISSION);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);
  const [isLoadingPublish, setIsLoadingPublish] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false); 
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [printAreaRect, setPrintAreaRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isOutOfBounds, setIsOutOfBounds] = useState(false); // May need to apply per image
  const [isSigningIn, setIsSigningIn] = useState(false); 
  const [signInNonce, setSignInNonce] = useState(null);
  // Icon positions might need to be managed per image or for the selected image
  const [iconPositions, setIconPositions] = useState({ 
      removeBg: { x: 0, y: 0, visible: false },
      removeImg: { x: 0, y: 0, visible: false }
  });

  // --- Refs ---
  const fileInputRef = useRef(null); // Will need to allow multiple files
  const previewContainerRef = useRef(null);
  const stageRef = useRef(null);
  // Transformer will attach to the selected image's ref (managed dynamically)
  const transformerRef = useRef(null); 

  const [trashIconImg, trashIconStatus] = useImage(trashIconUrl.src);
  const [removeBgIconImg, removeBgIconStatus] = useImage(removeBgIconUrl.src);
  
  // Sticker sheets usually have one variant, or variants are handled differently (e.g. pack size)
  // For MVP, assume the first variant (if any) or product itself defines the template.
  const mainVariant = product.variants && product.variants.length > 0 ? product.variants[0] : product;
  const templateImageUrl = mainVariant?.template_image_url;
  const [templateImg, templateStatus] = useImage(templateImageUrl || '', 'anonymous');

  // --- Price Calculation (Sticker Specific) ---
  const calculatePrice = useCallback((rate) => {
    const baseCost = mainVariant?.base_price || STICKER_RAW_COST;
    const costPlusFee = baseCost + PLATFORM_FEE;
    if (rate < 15 || rate > 50) return null; // Sticker commission range might differ
    const retail = costPlusFee / (1 - rate / 100);
    return Math.ceil(retail) - 0.01;
  }, [mainVariant]);

  useEffect(() => {
    const currentPrice = calculatePrice(commissionRate);
    if (currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      const earnings = currentPrice * (commissionRate / 100);
      setArtistEarnings(earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
    }
  }, [commissionRate, calculatePrice]);

  // --- Effect to Update Stage Size & Print Area (from product/variant template) ---
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !mainVariant?.template_width || !mainVariant?.template_height) return;

    const updateSize = () => {
        const { clientWidth } = container;
        if (clientWidth > 0) {
            const aspectRatio = mainVariant.template_height / mainVariant.template_width;
            const height = clientWidth * aspectRatio;
            setStageSize({ width: clientWidth, height });

            const scaleFactor = clientWidth / mainVariant.template_width;
            setPrintAreaRect({
                x: (mainVariant.print_area_left || 0) * scaleFactor,
                y: (mainVariant.print_area_top || 0) * scaleFactor,
                width: (mainVariant.print_area_width || mainVariant.template_width) * scaleFactor,
                height: (mainVariant.print_area_height || mainVariant.template_height) * scaleFactor,
            });
        }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [mainVariant]);

  // --- Effect to Attach/Detach Transformer to SELECTED image ---
  useEffect(() => {
    const selectedImgObj = userImages.find(img => img.id === selectedImageId);
    if (selectedImgObj && selectedImgObj.konvaRef && selectedImgObj.konvaRef.current && transformerRef.current) {
        transformerRef.current.nodes([selectedImgObj.konvaRef.current]);
        transformerRef.current.getLayer()?.batchDraw();
    } else if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedImageId, userImages, transformerRef]);

  // --- Event Handlers (Simplified for now) ---
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;
    if (e.target === stage) {
        setSelectedImageId(null); // Deselect on stage click
    }
    // Clicking an image to select it will be handled by the image's onClick
  };

  const handleFileChange = (event) => {
    logToOverlay("Sticker FileChange: Triggered");
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    logToOverlay(`Sticker FileChange: ${files.length} files selected.`);

    files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                const newImageId = `sticker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                logToOverlay(`Sticker FileChange: Adding image ${newImageId}`);
                
                // Placeholder for Konva image creation and attribute setting
                // This will need to be more sophisticated, similar to OptionsShirt
                // but adapted for an array and initial placement logic for multiple stickers.
                setUserImages(prev => [...prev, {
                    id: newImageId,
                    dataUrl: reader.result,
                    attrs: { // Initial placeholder attributes
                        id: newImageId,
                        x: printAreaRect.x + (Math.random() * printAreaRect.width * 0.5), 
                        y: printAreaRect.y + (Math.random() * printAreaRect.height * 0.5),
                        scaleX: 0.3, // Smaller initial scale for stickers
                        scaleY: 0.3,
                        rotation: 0,
                        draggable: true,
                        // offsetX, offsetY and image will be set once useImage loads it
                    },
                    konvaRef: React.createRef(), // Create a ref for each Konva.Image
                    hasBgRemoved: false,
                    // actualImage an_d useImageStatus would be managed here too
                }]);
            }
        };
        reader.readAsDataURL(file);
    });
    event.target.value = ''; // Reset file input
  };

  // --- NONCE Fetching (Identical to OptionsShirt - consider moving to a shared hook later)
  useEffect(() => {
    const fetchNonce = async () => { 
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        logToOverlay("Fetching initial nonce for stickers...");
        try {
            const nonceRes = await fetch(`${apiUrl}/api/auth/nonce`);
            if (!nonceRes.ok) {
                throw new Error(`Failed to fetch nonce: ${nonceRes.status}`);
            }
            const { nonce } = await nonceRes.json();
            if (!nonce) {
                throw new Error('Received empty nonce from server.');
            }
            logToOverlay(`Sticker initial nonce fetched: ${nonce.substring(0, 10)}...`);
            setSignInNonce(nonce);
        } catch (error) {
            logToOverlay(`Sticker error fetching initial nonce: ${error.message}`);
            console.error("Failed to fetch initial nonce for stickers:", error);
        }
    };
    fetchNonce();
  }, [logToOverlay]);

  const handlePublishClick = async () => {
    logToOverlay("Sticker Publish: Clicked");

    if (userImages.length === 0) {
      alert("Please upload at least one sticker image to publish.");
      return;
    }
    if (!mainVariant) {
      alert("Product variant information is missing. Cannot publish.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // --- Sign-In Flow (if not authenticated) ---
    if (!isAuthenticated) {
        logToOverlay("Sticker: User not authenticated. Starting SIWF flow...");
        setIsSigningIn(true);
        try {
            if (!signInNonce) {
                throw new Error('Sign-in nonce not available. Please try again later.');
            }
            logToOverlay(`Sticker: Using pre-fetched nonce: ${signInNonce.substring(0, 10)}...`);
            const signInResult = await frame.sdk.actions.signIn({ nonce: signInNonce });
            if (!signInResult || !signInResult.message || !signInResult.signature) {
                 logToOverlay("Sticker: Sign-in was cancelled or failed in Frame.");
                 setIsSigningIn(false);
                 return; 
            }
            logToOverlay("Sticker: Received signature and message from Frame SDK.");
            const backendVerifyRes = await fetch(`${apiUrl}/api/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: signInResult.message,
                    signature: signInResult.signature,
                    nonce: signInNonce
                }),
            });
            const backendVerifyData = await backendVerifyRes.json();
            if (!backendVerifyRes.ok || !backendVerifyData.success || !backendVerifyData.token || !backendVerifyData.fid) {
                throw new Error(`Sticker: Backend verification failed: ${backendVerifyData.message || 'Unknown error'}`);
            }
            logToOverlay(`Sticker: Backend verification successful. FID: ${backendVerifyData.fid}`);
            login(backendVerifyData.token, backendVerifyData.fid);
            alert("Sign-in successful! You can now publish your sticker sheet.");
        } catch (error) {
            logToOverlay(`Sticker Sign-In Error: ${error.message}`);
            console.error("Sticker Sign-In Flow Error:", error);
            alert(`Sign-in failed: ${error.message}`);
        } finally {
            setIsSigningIn(false);
        }
        return; // Return after sign-in attempt, user can click publish again
    }

    // --- Design Publishing Flow (if authenticated) ---
    logToOverlay(`Sticker: User authenticated (FID: ${userFid}). Proceeding with publish...`);
    setIsLoadingPublish(true); 
    try {
        const highResWidth = mainVariant.template_width;
        const highResHeight = mainVariant.template_height;
        if (!highResWidth || !highResHeight) {
            throw new Error("Sticker: Missing template dimensions for high-res export.");
        }

        const hiddenStage = new Konva.Stage({
            container: document.createElement('div'),
            width: highResWidth,
            height: highResHeight,
        });
        const hiddenLayer = new Konva.Layer();
        hiddenStage.add(hiddenLayer);

        const previewStage = stageRef.current;
        if (!previewStage) {
            throw new Error("Sticker: Preview stage ref is not available for scaling calculations.");
        }
        const previewScaleFactor = previewStage.width() / highResWidth;

        // Iterate over each user image and draw it on the hidden stage
        for (const imgData of userImages) {
            if (!imgData.attrs || !imgData.dataUrl) continue; // Skip if no attrs or dataUrl

            const imageToExport = await new Promise((resolve, reject) => {
                 const img = new window.Image();
                 img.onload = () => resolve(img);
                 img.onerror = reject;
                 img.src = imgData.dataUrl;
                 img.crossOrigin = 'anonymous';
            });

            // Scale transformations from preview to high-res
            const finalScaleX = (imgData.attrs.scaleX || 1) / previewScaleFactor;
            const finalScaleY = (imgData.attrs.scaleY || 1) / previewScaleFactor;
            const angle = imgData.attrs.rotation || 0;
            const centerPointHighResX = (imgData.attrs.x || 0) / previewScaleFactor;
            const centerPointHighResY = (imgData.attrs.y || 0) / previewScaleFactor;

            const konvaImage = new Konva.Image({
                image: imageToExport,
                x: centerPointHighResX,
                y: centerPointHighResY,
                scaleX: finalScaleX,
                scaleY: finalScaleY,
                rotation: angle,
                offsetX: imageToExport.width / 2,
                offsetY: imageToExport.height / 2,
            });
            hiddenLayer.add(konvaImage);
        }

        hiddenStage.draw();

        const blob = await new Promise((resolve) => {
             hiddenStage.toCanvas().toBlob(resolve, 'image/png', 1.0);
        });

        if (!blob) throw new Error("Sticker: Failed to generate composite image blob.");
        logToOverlay(`Sticker: Generated composite blob size: ${blob.size}`);

        const formData = new FormData();
        formData.append('product_id', product.id.toString());
        // For stickers, variant_id might be the same as product_id or a specific one from mainVariant
        formData.append('variant_id', mainVariant.id ? mainVariant.id.toString() : product.id.toString());
        formData.append('image', blob, `sticker_sheet-${product.id}.png`);

        if (!authToken) {
             throw new Error("Sticker: Authentication token missing unexpectedly.");
        }

        const response = await fetch(`${apiUrl}/api/designs`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown API error during sticker publish' }));
            throw new Error(errorData.error || `Sticker Publish API Error: ${response.status}`);
        }
        const result = await response.json();
        logToOverlay(`Sticker sheet published successfully: ${JSON.stringify(result)}`);
        alert(`Success! Sticker Sheet Design ID: ${result.designId}. You might need to refresh to see it in a gallery if applicable.`);
        setUserImages([]); // Clear images after successful publish
        setSelectedImageId(null);

    } catch (error) {
        logToOverlay(`Sticker Publish Error: ${error.message}`);
        console.error("Failed to publish sticker sheet:", error);
        alert(`Error publishing sticker sheet: ${error.message}`);
    } finally {
         setIsLoadingPublish(false); 
    }
  };

  // --- Action Handlers (Remove Image, Remove BG - to be adapted for selectedImageId) ---
  const handleRemoveImage = () => {
    if (!selectedImageId) return;
    logToOverlay(`Sticker: Removing image ${selectedImageId}`);
    setUserImages(prev => prev.filter(img => img.id !== selectedImageId));
    setSelectedImageId(null); // Deselect
  };

  const handleRemoveBackgroundClick = async () => {
    if (!selectedImageId) {
      logToOverlay("Sticker BG Remove: No image selected.");
      return;
    }
    const imageIndex = userImages.findIndex(img => img.id === selectedImageId);
    if (imageIndex === -1) {
      logToOverlay("Sticker BG Remove: Selected image not found in array.");
      return;
    }
    const imageToRemoveBg = userImages[imageIndex];

    if (!imageToRemoveBg.dataUrl || isRemovingBackground || imageToRemoveBg.hasBgRemoved) {
      logToOverlay("Sticker BG Remove: No data URL, already processing, or BG already removed.");
      return;
    }

    logToOverlay(`Sticker BG Remove: Starting for ${selectedImageId}`);
    setIsRemovingBackground(true);

    try {
      const imageBlob = dataURLtoBlob(imageToRemoveBg.dataUrl);
      if (!imageBlob) {
        throw new Error("Failed to convert image data URL to Blob for BG removal.");
      }
      logToOverlay(`Sticker BG Remove: Converted to Blob, size: ${imageBlob.size}, type: ${imageBlob.type}`);

      const formData = new FormData();
      const fileExtension = imageBlob.type.split('/')[1] || 'png';
      const fileName = `sticker_bg_remove_${selectedImageId}.${fileExtension}`;
      formData.append('image', imageBlob, fileName);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/image/remove-background`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorBody = 'Failed to read error response from BG remove API.';
        try {
           errorBody = await response.text(); 
        } catch(e) { /* ignore */ }
        throw new Error(`BG Remove API Error ${response.status}: ${errorBody}`);
      }

      logToOverlay("Sticker BG Remove: API call successful. Receiving result blob...");
      const resultBlob = await response.blob();
      logToOverlay(`Sticker BG Remove: Received result blob, size: ${resultBlob.size}, type: ${resultBlob.type}`);

      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          logToOverlay("Sticker BG Remove: Converted result blob to data URL. Updating state.");
          setUserImages(currentImages => 
            currentImages.map(img => 
              img.id === selectedImageId 
                ? { ...img, dataUrl: reader.result, hasBgRemoved: true, attrs: { ...img.attrs, image: null } } // Reset Konva image to force reload
                : img
            )
          );
          // The change in dataUrl should trigger UserStickerImage to reload via useImage
        } else {
          throw new Error("Failed to read the processed image blob back into a data URL (sticker bg remove).");
        }
        setIsRemovingBackground(false); 
      };
      reader.onerror = (error) => {
        logToOverlay(`Sticker BG Remove: FileReader error reading result blob: ${error}`);
        throw new Error("FileReader failed to read the processed image blob (sticker bg remove).");
      };
      reader.readAsDataURL(resultBlob);

    } catch (error) {
      logToOverlay(`Sticker BG Remove Error: ${error.message}`);
      console.error("Failed to remove background for sticker:", error);
      alert(`Error removing background for sticker: ${error.message}`);
      setIsRemovingBackground(false);
    }
  };

  // --- JSX --- 
  const selectedKonvaImage = userImages.find(img => img.id === selectedImageId);

  // --- Helper: Calculate Icon Positions (ported from OptionsShirt) ---
  const calculateIconPositions = useCallback((node) => {
      if (!node) return { removeBg: { visible: false }, removeImg: { visible: false } };

      const box = node.getClientRect({ relativeTo: node.getLayer() });
      // Position icons relative to corners, further out
      const removeBgX = box.x + box.width + ICON_PADDING;
      const removeBgY = box.y - ICON_PADDING; // Adjusted Y to align top
      const removeImgX = box.x - ICON_PADDING - ICON_SIZE;
      const removeImgY = box.y - ICON_PADDING; // Adjusted Y to align top

      return {
          removeBg: { x: removeBgX, y: removeBgY, visible: true },
          removeImg: { x: removeImgX, y: removeImgY, visible: true }
      };
  }, [ICON_PADDING, ICON_SIZE]); // Dependencies: constants used in calculation

  // --- Effect to Update Icon Positions for SELECTED image ---
  useEffect(() => {
    const node = selectedKonvaImage?.konvaRef?.current;
    if (selectedImageId && node) {
        setIconPositions(calculateIconPositions(node));
    } else {
        setIconPositions({ removeBg: { visible: false }, removeImg: { visible: false } });
    }
    // Update when selected image changes, or its attributes (size/pos) change, or the base calculation logic changes
  }, [selectedImageId, selectedKonvaImage?.attrs, calculateIconPositions]);

  // Handler to update icon positions during transform/drag of the SELECTED image
  // This needs to be called from UserStickerImage's onDragMove and onTransform
  const handleSelectedImageTransform = useCallback((konvaNode) => { 
      if (konvaNode && selectedImageId && selectedKonvaImage?.konvaRef?.current === konvaNode) {
          setIconPositions(calculateIconPositions(konvaNode));
      }
  }, [selectedImageId, selectedKonvaImage, calculateIconPositions]);

  const isLoading = isRemovingBackground || isSigningIn || isAuthLoading || templateStatus === 'loading' || trashIconStatus !== 'loaded' || removeBgIconStatus !== 'loaded';

  const publishButtonText = isSigningIn 
      ? 'Signing In...' 
      : isLoadingPublish 
      ? 'Publishing...' 
      : isAuthenticated 
      ? 'Publish Sticker Sheet' 
      : 'Sign In & Publish';

  return (
    <div className={styles.optionsContainer}>
      <div ref={previewContainerRef} className={styles.previewContainer} style={{ position: 'relative' }}>
        <Stage 
            ref={stageRef} 
            width={stageSize.width} 
            height={stageSize.height}
            onClick={handleStageClick}
            onTap={handleStageClick}
        >
          <Layer name="backgroundLayer" listening={false}>
            <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill={'#e0e0e0'} /> {/* Simple bg for stickers */}
            {templateImageUrl && templateImg && templateStatus === 'loaded' && (
                <Image image={templateImg} x={0} y={0} width={stageSize.width} height={stageSize.height} />
            )}
          </Layer>
          <Layer name="interactiveLayer">
            {printAreaRect.width > 0 ? (<Rect x={printAreaRect.x} y={printAreaRect.y} width={printAreaRect.width} height={printAreaRect.height} stroke="rgba(0,0,0,0.3)" strokeWidth={1} dash={[5, 3]} listening={false} />) : null}
            {!userImages.length && templateStatus === 'loaded' && printAreaRect.width > 0 ? (
               <Text
                  text="Click to Upload Stickers"
                  x={printAreaRect.x}
                  y={printAreaRect.y + printAreaRect.height / 2 - 10}
                  width={printAreaRect.width}
                  height={20}
                  align="center"
                  verticalAlign="middle"
                  fontSize={16}
                  fill='#555555'
               />
            ) : null}
            {userImages.map((imgData) => (
                <UserStickerImage 
                    key={imgData.id} 
                    imageData={imgData} 
                    isSelected={selectedImageId === imgData.id}
                    onSelect={() => setSelectedImageId(imgData.id)}
                    onChange={(newAttrs) => {
                        setUserImages(currentImages => 
                            currentImages.map(img => 
                                img.id === imgData.id ? { ...img, attrs: newAttrs } : img
                            )
                        );
                    }}
                    printAreaRect={printAreaRect}
                    isTransformingDisabled={isRemovingBackground}
                    onTransformLive={handleSelectedImageTransform}
                />
            ))}
            {selectedKonvaImage ? (
                <Transformer 
                    ref={transformerRef}
                    keepRatio={true}
                    boundBoxFunc={(oldBox, newBox) => newBox.width < 5 || newBox.height < 5 ? oldBox : newBox}
                    visible={!isRemovingBackground}
                />
            ) : null}
            {selectedKonvaImage && iconPositions.removeImg.visible && trashIconStatus === 'loaded' && !isRemovingBackground ? (
                <Group 
                    x={iconPositions.removeImg.x} y={iconPositions.removeImg.y} 
                    onClick={handleRemoveImage} onTap={handleRemoveImage} 
                    onMouseEnter={e => { e.target.getStage().container().style.cursor = 'pointer'; }}
                    onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}
                    width={ICON_SIZE} height={ICON_SIZE}
                >
                    <Rect width={ICON_SIZE + ICON_PADDING} height={ICON_SIZE + ICON_PADDING} fill="transparent" offsetX={(ICON_SIZE + ICON_PADDING) / 2} offsetY={(ICON_SIZE + ICON_PADDING) / 2} x={ICON_SIZE / 2} y={ICON_SIZE / 2}/>
                    <Image image={trashIconImg} width={ICON_SIZE} height={ICON_SIZE} listening={false}/>
                </Group>
            ) : null}
            {selectedKonvaImage && iconPositions.removeBg.visible && removeBgIconStatus === 'loaded' && !isRemovingBackground && !selectedKonvaImage.hasBgRemoved ? (
                <Group 
                    x={iconPositions.removeBg.x} y={iconPositions.removeBg.y}
                    onClick={handleRemoveBackgroundClick} onTap={handleRemoveBackgroundClick}
                    onMouseEnter={e => { e.target.getStage().container().style.cursor = 'pointer'; }}
                    onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}
                    width={ICON_SIZE} height={ICON_SIZE}
                >
                     <Rect width={ICON_SIZE + ICON_PADDING} height={ICON_SIZE + ICON_PADDING} fill="transparent" offsetX={(ICON_SIZE + ICON_PADDING) / 2} offsetY={(ICON_SIZE + ICON_PADDING) / 2} x={ICON_SIZE / 2} y={ICON_SIZE / 2}/>
                    <Image image={removeBgIconImg} width={ICON_SIZE} height={ICON_SIZE} listening={false}/>
                </Group>
            ) : null}
          </Layer>
        </Stage>
        
        {isLoading && (
            <div className={styles.loadingOverlay}> 
              {/* ... Loading text logic ... */}
              {isSigningIn ? 'Signing In...' : isLoadingPublish ? 'Publishing...' : isRemovingBackground ? 'Removing Background...' : 'Loading...'}
            </div>
        )}
        <input
           type="file"
           id="sticker-file-upload"
           ref={fileInputRef}
           onChange={handleFileChange}
           accept="image/png, image/jpeg, image/webp"
           multiple 
           style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}
           onClick={(e) => { e.target.value = null }}
         />
      </div>

      {isOutOfBounds && (
           <p className={styles.warningText}>Selected sticker is out of bounds and will be clipped.</p>
       )}

      <div>
        <h2 className={styles.productName}>{product.name}</h2>
        {mainVariant?.base_price !== undefined && (
          <p className={styles.basePriceDisplay}>Base Cost: <strong>${mainVariant.base_price.toFixed(2)}</strong></p>
        )}
      </div>

      {/* Button to trigger file upload - Placed before commission */}
      <div className={styles.optionSection}> 
        <button 
          onClick={() => fileInputRef.current && fileInputRef.current.click()} 
          className={styles.secondaryButton || styles.primaryButton} // Fallback style
          disabled={isRemovingBackground || isLoadingPublish || isSigningIn || isAuthLoading}
        >
          {userImages.length > 0 ? 'Add More Stickers' : 'Upload Stickers'}
        </button>
      </div>
      
      {/* Simplified Commission/Price for Stickers */}
      <div className={styles.optionSection}>
          <h3 className={styles.sectionTitle}>Set Your Commission</h3>
          <div className={styles.commissionButtons}>
              {[20, 30, 40, 50].map(rate => (
                  <button
                      key={rate}
                      className={`${styles.commissionButton} ${commissionRate === rate ? styles.selected : ''}`}
                      onClick={() => setCommissionRate(rate)}
                  >
                      {rate}%
                  </button>
              ))}
          </div>
          {estimatedPrice !== null && artistEarnings !== null && (
              <div className={styles.priceBreakdown}>
                  <p>Buyer pays: <strong>${estimatedPrice.toFixed(2)}</strong><span className={styles.shippingText}> + Shipping</span></p>
                  <p>Your Earnings: <strong>${artistEarnings.toFixed(2)}</strong></p>
              </div>
          )}
          <p className={styles.commissionNote}>Base cost ${mainVariant?.base_price?.toFixed(2) || STICKER_RAW_COST.toFixed(2)} + Platform fee ${PLATFORM_FEE.toFixed(2)}.</p>
      </div>

      {/* Publish Button Section */}
      <div className={styles.actionSection}>
         <button
           className={styles.primaryButton}
           onClick={handlePublishClick}
           disabled={
               userImages.length === 0 || 
               !estimatedPrice || 
               isLoadingPublish || 
               isRemovingBackground ||
               isSigningIn || 
               isAuthLoading || 
               (!isAuthenticated && !signInNonce)
            }
          >
             {publishButtonText}
         </button>
      </div>
    </div>
  );
}

// Helper component to render each sticker image and handle its state
function UserStickerImage({ 
    imageData, 
    isSelected, 
    onSelect, 
    onChange, 
    printAreaRect, 
    isTransformingDisabled,
    onTransformLive
}) {
    const [imageObj, imageStatus] = useImage(imageData.dataUrl, 'anonymous');
    const imageRef = imageData.konvaRef; // Use the ref passed in imageData
    const { logToOverlay } = useDebug();

    // Ensure imageData.attrs exists, providing a default if not.
    // Also ensure key properties like x, y, id are present if attrs is defined but partial.
    const baseAttrs = imageData.attrs || {};
    const attrs = {
        id: imageData.id, // Ensure id is always from imageData
        x: baseAttrs.x || 0,
        y: baseAttrs.y || 0,
        scaleX: baseAttrs.scaleX || 0.3,
        scaleY: baseAttrs.scaleY || 0.3,
        rotation: baseAttrs.rotation || 0,
        draggable: baseAttrs.draggable === undefined ? true : baseAttrs.draggable,
        image: baseAttrs.image || null, // Konva image object
        offsetX: baseAttrs.offsetX, // Will be set by effect
        offsetY: baseAttrs.offsetY, // Will be set by effect
    };

    useEffect(() => {
        if (imageStatus === 'loaded' && imageObj && !attrs.image) {
            logToOverlay(`Sticker ${imageData.id} loaded into Konva node, setting image and offset.`);
            onChange({ // This onChange should update the parent's state for this image's attrs
                ...attrs,
                image: imageObj, // This is the actual Konva image object
                offsetX: imageObj.width / 2,
                offsetY: imageObj.height / 2,
            });
        }
    // Critical: Ensure `attrs` in dependency array is stable or correctly handled.
    // If `attrs` is rebuilt on every render (as it is above), this effect might loop or behave unexpectedly.
    // A better approach might be to only include specific fields from attrs if possible,
    // or use useMemo for attrs if its construction is complex and shouldn't trigger effect unless content changes.
    // For now, let's use imageData.attrs as a proxy for deep changes, though it's not perfect.
    }, [imageStatus, imageObj, imageData.id, imageData.attrs, onChange, logToOverlay]);


    if (imageStatus === 'loading') {
      return null;
    }

    if (imageStatus === 'failed') {
        logToOverlay(`Failed to load sticker image: ${imageData.id}`);
        return <Text text="Error loading image" fill="red" x={attrs.x} y={attrs.y} />;
    }

    // At this point, imageStatus === 'loaded'
    // We must have imageObj to render an Image.
    // And imageData.attrs.image (which is attrs.image here) should have been set by the effect.
    if (!imageObj) {
        logToOverlay(`Sticker ${imageData.id}: imageStatus is '${imageStatus}' but imageObj is missing. Returning null.`);
        return null; // Or a placeholder Text
    }
    
    // If the effect hasn't populated attrs.image yet (via onChange in parent, then prop update),
    // it's not safe to render. The parent should provide the updated attrs.
    if (!attrs.image) {
        logToOverlay(`Sticker ${imageData.id}: imageObj is loaded, but attrs.image is not set in props yet. Returning null.`);
        return null; // Waiting for parent to update imageData.attrs with the image object
    }

    // Event handlers
    const handleDragEnd = (e) => {
        onChange({ ...attrs, x: e.target.x(), y: e.target.y() });
        if (isSelected && onTransformLive) { onTransformLive(e.target); }
    };

    const handleTransformEnd = (e) => {
        const node = e.target;
        const newAttrs = {
            ...attrs,
            x: node.x(),
            y: node.y(),
            scaleX: Math.max(0.01, node.scaleX()),
            scaleY: Math.max(0.01, node.scaleY()),
            rotation: node.rotation(),
        };
        onChange(newAttrs);
        if (isSelected && onTransformLive) { onTransformLive(node); }
    };

    const handleDragMove = (e) => {
        if (isSelected && onTransformLive) { onTransformLive(e.target); }
    };

    const handleTransform = (e) => {
        if (isSelected && onTransformLive) { onTransformLive(e.target); }
    };
    
    const dragBoundFunc = (pos) => {
        // Simplified, ensure printAreaRect and attrs.image are valid before calculations
        if (!imageRef.current || !attrs.image || !printAreaRect || !printAreaRect.width) return pos;
        const node = imageRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        // Use actual image dimensions from imageObj if available and attrs.image is the Konva image
        const imgWidth = attrs.image.width * scaleX;
        const imgHeight = attrs.image.height * scaleY;

        const minX = printAreaRect.x + imgWidth / 2;
        const maxX = printAreaRect.x + printAreaRect.width - imgWidth / 2;
        const minY = printAreaRect.y + imgHeight / 2;
        const maxY = printAreaRect.y + printAreaRect.height - imgHeight / 2;

        const newX = Math.max(minX, Math.min(pos.x, maxX));
        const newY = Math.max(minY, Math.min(pos.y, maxY));

        return {
            x: (imgWidth > printAreaRect.width) ? pos.x : newX,
            y: (imgHeight > printAreaRect.height) ? pos.y : newY,
        };
    };

    return (
        <Image
            ref={imageRef}
            {...attrs} // Spread the guarded and defaulted attrs
            image={attrs.image} // Crucially, use the image from attrs, which should be set by useEffect->onChange->props
            draggable={!isTransformingDisabled && attrs.draggable}
            listening={!isTransformingDisabled && attrs.image != null} // Only listen if image is loaded
            onClick={attrs.image ? onSelect : undefined} // Only allow select if image is loaded
            onTap={attrs.image ? onSelect : undefined}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onDragMove={handleDragMove}
            onTransform={handleTransform}
            dragBoundFunc={dragBoundFunc}
        />
    );
}