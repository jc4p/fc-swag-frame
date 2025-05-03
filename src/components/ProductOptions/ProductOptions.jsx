'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Stage, Layer, Rect, Image, Transformer, Text } from 'react-konva';
import Konva from 'konva'; // Import Konva for methods like Konva.Image.fromURL if needed, though use-image is preferred
import useImage from 'use-image'; // Hook for loading images
import styles from './ProductOptions.module.css';
import { useDebug } from '@/contexts/DebugContext'; // <-- Add import

// --- Constants ---
const RAW_COST = 14.95;
const PLATFORM_FEE = 4.00;
const DEFAULT_COMMISSION = 25;

// --- Helper Functions ---

// Keep loadImage for potential use, though Fabric might handle some loading
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null); // Resolve with null if no src is provided
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

// NEW: Convert Data URL to Blob
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

// Helper to determine text color based on background luminance
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#000000'; // Default to black if no color
  try {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return '#000000'; // Basic validation
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance (WCAG formula part)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  } catch (e) {
    console.error("Error calculating contrast color:", e);
    return '#000000'; // Fallback
  }
};

/**
 * Renders interactive options, handles image upload/manipulation via Konva.js, and publishing.
 */
export function ProductOptions({ product }) {
  const { logToOverlay } = useDebug(); // <-- Get the logging function

  // --- State --- 
  const [selectedColorName, setSelectedColorName] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState(null); // Input for user image
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);
  const [isLoadingPublish, setIsLoadingPublish] = useState(false); 
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [printAreaRect, setPrintAreaRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [userImageAttrs, setUserImageAttrs] = useState(null);
  const [isUserImageSelected, setIsUserImageSelected] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false); // <-- Add state for bounds warning

  // --- Refs --- 
  const fileInputRef = useRef(null);
  const previewContainerRef = useRef(null); // For getting container size
  const stageRef = useRef(null); // Ref for Konva Stage
  const userImageRef = useRef(null); // Ref for user Image node
  const transformerRef = useRef(null); // Ref for Transformer node

  // --- Image Loading with use-image --- 
  const textureUrl = selectedVariant?.template_texture_url;
  const templateImageUrl = selectedVariant?.template_image_url;
  const userImageUrl = uploadedImageDataUrl;

  // Pass empty string if URL is null/undefined, but check status conditionally later
  const [textureImg, textureStatus] = useImage(textureUrl || '', 'anonymous');
  const [templateImg, templateStatus] = useImage(templateImageUrl || '', 'anonymous');
  const [userImg, userImgStatus] = useImage(userImageUrl || '', 'anonymous');

  // --- Effect to log userImgStatus changes ---
  useEffect(() => {
    if (userImageUrl) { // Only log if we are trying to load a user image
      logToOverlay(`useImage status for user image: ${userImgStatus}`);
      if (userImgStatus === 'failed') {
        logToOverlay('useImage failed to load the user image.');
      }
      if (userImgStatus === 'loaded' && userImg) {
        logToOverlay(`useImage loaded: ${userImg.width}x${userImg.height}`);
      }
    }
  }, [userImgStatus, userImageUrl, logToOverlay, userImg]); // Added userImg dependency

  // --- Helper: Calculate Price --- 
  const calculatePrice = useCallback((rate) => {
     if (!selectedVariant || rate < 15 || rate > 30) return null;
     const baseCost = selectedVariant.base_price || RAW_COST;
     const costPlusFee = baseCost + PLATFORM_FEE;
     if (rate >= 100) return null;
     const retail = costPlusFee / (1 - rate / 100);
     return Math.ceil(retail) - 0.01;
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
    const currentPrice = calculatePrice(commissionRate);
    if (currentPrice !== null) {
      setEstimatedPrice(currentPrice);
      const earnings = currentPrice * (commissionRate / 100);
      setArtistEarnings(earnings);
    } else {
      setEstimatedPrice(null);
      setArtistEarnings(null);
    }
  }, [selectedVariant, commissionRate, calculatePrice]);

  // --- Effect to Update Stage Size & Print Area --- 
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !selectedVariant?.template_width || !selectedVariant?.template_height) return;

    const updateSize = () => {
        const { clientWidth } = container;
        if (clientWidth > 0) {
            const aspectRatio = selectedVariant.template_height / selectedVariant.template_width;
            const height = clientWidth * aspectRatio;
            setStageSize({ width: clientWidth, height });
            console.log(`Stage dimensions set: ${clientWidth}x${height}`);

            // Calculate scaled print area based on new stage size
            const scaleFactor = clientWidth / selectedVariant.template_width;
            setPrintAreaRect({
                x: selectedVariant.print_area_left * scaleFactor,
                y: selectedVariant.print_area_top * scaleFactor,
                width: selectedVariant.print_area_width * scaleFactor,
                height: selectedVariant.print_area_height * scaleFactor,
            });
        }
    };

    updateSize(); // Initial size
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);

  }, [selectedVariant?.template_width, selectedVariant?.template_height, 
      selectedVariant?.print_area_left, selectedVariant?.print_area_top, 
      selectedVariant?.print_area_width, selectedVariant?.print_area_height]);

  // --- Effect to Initialize User Image Attributes when Loaded --- 
  useEffect(() => {
      if (userImg && userImgStatus === 'loaded' && stageSize.width > 0 && printAreaRect.width > 0) {
          const imgWidth = userImg.width;
          const imgHeight = userImg.height;
          const scale = Math.min(
              printAreaRect.width / imgWidth,
              printAreaRect.height / imgHeight,
              1 
          );
          const initialAttrs = {
              id: 'userImage', 
              x: printAreaRect.x + printAreaRect.width / 2,
              y: printAreaRect.y + printAreaRect.height / 2,
              scaleX: scale,
              scaleY: scale,
              rotation: 0,
              offsetX: imgWidth / 2,
              offsetY: imgHeight / 2,
              image: userImg,
              draggable: true,
          };
          setUserImageAttrs(initialAttrs);
          logToOverlay("User image initial attributes set."); // Keep existing log
      } else if (!uploadedImageDataUrl || userImgStatus === 'loading' || userImgStatus === 'failed') {
          // Clear attributes if image is removed/unloaded/failed
           setUserImageAttrs(null);
           // Deselection handled by the effect below now
           // Logged in the status effect now
       }
  }, [userImg, userImgStatus, stageSize.width, printAreaRect, uploadedImageDataUrl, logToOverlay]); // Added logToOverlay

  // --- Effect to Auto-Select Image When It First Loads --- 
  useEffect(() => {
      if (userImageAttrs && !isUserImageSelected) {
          // Only auto-select if we have attributes but aren't already selected
          console.log("Auto-selecting newly loaded image.");
          setIsUserImageSelected(true);
      } else if (!userImageAttrs && isUserImageSelected) {
          // Deselect if attributes are cleared (e.g., image removed)
           console.log("Deselecting image because attributes cleared.");
          setIsUserImageSelected(false);
      }
  }, [userImageAttrs, isUserImageSelected]);

  // --- Effect to Attach/Detach Transformer --- 
  useEffect(() => {
    if (isUserImageSelected && transformerRef.current && userImageRef.current) {
        console.log("Attaching transformer via selection effect...");
        transformerRef.current.nodes([userImageRef.current]);
        transformerRef.current.getLayer()?.batchDraw(); 
    } else if (transformerRef.current) {
        // Detach if not selected or refs become invalid
        if(transformerRef.current.nodes().length > 0) {
           console.log("Detaching transformer via selection effect...");
           transformerRef.current.nodes([]); 
           transformerRef.current.getLayer()?.batchDraw();
        }
    }
    // This effect runs whenever selection state changes OR when the refs might become available/invalid
  }, [isUserImageSelected, userImageRef.current, transformerRef.current]); 

   // --- Event Handlers for Konva/Interaction --- 

   // Handle click on stage to deselect OR trigger upload
   const handleStageClick = (e) => {
     const stage = e.target.getStage();
     if (!stage) return;

     // If click is on the stage background OR the placeholder text
     const isBackgroundClick = e.target === stage;
     const isPlaceholderClick = e.target.attrs.id === 'uploadPlaceholderText'; // Check ID we will add

     if (isBackgroundClick || isPlaceholderClick) {
        // If no user image is loaded, trigger file input
        if (!userImageAttrs) {
            logToOverlay("Stage/Placeholder clicked, attempting to trigger file input..."); // <-- Log before click
            fileInputRef.current?.click();
        } else {
            // If image exists, deselect it
            console.log("Stage/Placeholder clicked, deselecting image.");
            setIsUserImageSelected(false);
        }
        return;
     }
     
     // Check if the clicked target is the user image or its transformer
     const clickedOnTransformer = e.target.getParent()?.className === 'Transformer';
     if (e.target.attrs.id === 'userImage' || clickedOnTransformer) {
         console.log("User image or transformer clicked, selecting.");
         setIsUserImageSelected(true); // Ensure selected if image/transformer clicked
     } else {
          console.log("Clicked on other element, deselecting.");
          setIsUserImageSelected(false); // Clicked elsewhere (e.g. print area rect)
     }
   };

    // Update state when dragging ends
    const handleDragEnd = (e) => {
        setUserImageAttrs({
            ...userImageAttrs,
            x: e.target.x(),
            y: e.target.y(),
        });
    };

    // Update state when transforming ends (REMOVED scale clamping)
    const handleTransformEnd = (e) => {
        const node = userImageRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rotation = node.rotation();

        setUserImageAttrs({
            ...userImageAttrs,
            x: node.x(),
            y: node.y(),
            scaleX: Math.max(0.01, scaleX), // Still prevent tiny/negative scale
            scaleY: Math.max(0.01, scaleY),
            rotation,
        });
        // Bounds check handled in effect
    };

    // Restore dragBoundFunc to keep image center within print area during drag
    const dragBoundFunc = (pos) => {
        if (!userImageRef.current || !userImageAttrs || !printAreaRect) return pos;
        
        const imageNode = userImageRef.current;
        const scaleX = imageNode.scaleX();
        const scaleY = imageNode.scaleY();
        // Get the visual bounds based on image dimensions and scale
        // Note: This approximation works best for center-origin images without rotation
        const imgWidth = imageNode.width() * scaleX;
        const imgHeight = imageNode.height() * scaleY;
        // Calculate the boundaries for the image's CENTER point (pos.x, pos.y)
        const minX = printAreaRect.x + imgWidth / 2;
        const maxX = printAreaRect.x + printAreaRect.width - imgWidth / 2;
        const minY = printAreaRect.y + imgHeight / 2;
        const maxY = printAreaRect.y + printAreaRect.height - imgHeight / 2;

        // Clamp the position
        const newX = Math.max(minX, Math.min(pos.x, maxX));
        const newY = Math.max(minY, Math.min(pos.y, maxY));

        // If the image is wider/taller than the print area, allow centering
        // but don't force it fully inside if it can't fit.
        // Handle cases where image is larger than print area
        const finalX = (imgWidth > printAreaRect.width) ? pos.x : newX; 
        const finalY = (imgHeight > printAreaRect.height) ? pos.y : newY;

        return {
            x: isNaN(finalX) ? pos.x : finalX,
            y: isNaN(finalY) ? pos.y : finalY,
        };
    };

   // --- Effect to Check Image Bounds --- 
   useEffect(() => {
      const imageNode = userImageRef.current;
      if (imageNode && userImageAttrs && printAreaRect.width > 0) {
          const bounds = imageNode.getClientRect({ relativeTo: imageNode.getLayer() });
          const tolerance = 1; 
          const out = 
              bounds.x < printAreaRect.x - tolerance ||
              bounds.y < printAreaRect.y - tolerance ||
              bounds.x + bounds.width > printAreaRect.x + printAreaRect.width + tolerance ||
              bounds.y + bounds.height > printAreaRect.y + printAreaRect.height + tolerance;
          
          if (out !== isOutOfBounds) {
              setIsOutOfBounds(out);
          }
      } else if (isOutOfBounds) {
          setIsOutOfBounds(false);
      }
   }, [userImageAttrs, printAreaRect, isOutOfBounds]);

  // --- Component Handlers (File Input, Publish) ---
  const handleFileChange = (event) => {
    logToOverlay("handleFileChange triggered!"); // <-- Log entry into the function
    const file = event.target.files?.[0];
    if (file) {
      logToOverlay(`File Selected: Name=${file.name}, Type=${file.type}, Size=${file.size} bytes`); // <-- Log file details

      // Check for HEIC/HEIF specifically
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        logToOverlay("WARNING: HEIC/HEIF file selected. Browser/Canvas support might be limited.");
      }

      const reader = new FileReader();

      reader.onloadstart = () => {
        logToOverlay(`FileReader: Starting to read ${file.name}`); // <-- Log start
      };

      reader.onloadend = () => {
        logToOverlay(`FileReader: Finished reading ${file.name}. Result length: ${reader.result?.length || 0}`); // <-- Log finish
        if (reader.result) {
            setUploadedImageDataUrl(reader.result);
            logToOverlay("FileReader: Set uploadedImageDataUrl state."); // <-- Log state set
            setUserImageAttrs(null); // Reset attrs when new image uploaded
        } else {
            logToOverlay("FileReader Error: onloadend fired but reader.result is empty.");
            alert("Error reading file. The file might be corrupted or in an unsupported format.");
        }
      };

      reader.onerror = (error) => {
         logToOverlay(`FileReader Error: Failed to read ${file.name}. Error: ${error}`); // <-- Log error
         alert("Could not read the selected file. Please try a different image.");
      };

      reader.readAsDataURL(file);
    } else {
      logToOverlay("File Input: No file selected or event triggered without files.");
    }
    event.target.value = ''; // Clear input value
  };

  const handlePublishClick = async () => {
    if (!userImageAttrs || !selectedVariant || !product || !stageRef.current) {
      alert("Please select variant and upload/position an image first.");
      return;
    }
    setIsLoadingPublish(true); 

    try {
        // 1. Get High-Res Dimensions
        const highResWidth = selectedVariant.template_width;
        const highResHeight = selectedVariant.template_height;
        if (!highResWidth || !highResHeight) throw new Error("Missing template dimensions.");

        // 2. Create Hidden Konva Stage
        const hiddenStage = new Konva.Stage({
            container: document.createElement('div'), // Needs a dummy container
            width: highResWidth,
            height: highResHeight,
        });
        const hiddenLayer = new Konva.Layer();
        hiddenStage.add(hiddenLayer);

        // 3. Calculate High-Res Transformations
        const previewStage = stageRef.current;
        const previewScaleFactor = previewStage.width() / highResWidth;

        const finalScaleX = userImageAttrs.scaleX / previewScaleFactor;
        const finalScaleY = userImageAttrs.scaleY / previewScaleFactor;
        const angle = userImageAttrs.rotation;

        // Map the center point from preview coordinates to high-res coordinates
        const centerPointHighResX = userImageAttrs.x / previewScaleFactor;
        const centerPointHighResY = userImageAttrs.y / previewScaleFactor;

        console.log("Exporting image...");
        // ... (logging details)

        // 4. Add ONLY the user image to the hidden stage with calculated transforms
        // Need to load the image again for the hidden stage or pass the loaded object if possible
        const imageToExport = await new Promise((resolve, reject) => {
             const img = new window.Image();
             img.onload = () => resolve(img);
             img.onerror = reject;
             img.src = uploadedImageDataUrl; // Use the original data URL
             img.crossOrigin = 'anonymous';
        });
        
        const konvaImage = new Konva.Image({
            image: imageToExport,
            x: centerPointHighResX,
            y: centerPointHighResY,
            scaleX: finalScaleX,
            scaleY: finalScaleY,
            rotation: angle,
            offsetX: imageToExport.width / 2, // Keep same offset logic
            offsetY: imageToExport.height / 2,
        });

        hiddenLayer.add(konvaImage);
        hiddenStage.draw(); // Draw the hidden stage

        // 5. Export Hidden Stage to Blob
        const blob = await new Promise((resolve) => {
             hiddenStage.toCanvas().toBlob(resolve, 'image/png', 1.0); // Use toCanvas(), then toBlob()
        });

        if (!blob) throw new Error("Failed to generate image blob.");
        console.log("Generated Blob size:", blob.size);

        // 6. Create FormData
        const formData = new FormData();
        formData.append('product_id', product.id.toString());
        formData.append('variant_id', selectedVariant.id.toString());
        formData.append('image', blob, `design-${selectedVariant.id}.png`);

        // 7. Get Auth Token (Placeholder)
        const authToken = localStorage.getItem('fc-auth-token') || 'YOUR_PLACEHOLDER_TOKEN'; 
        if (!authToken || authToken === 'YOUR_PLACEHOLDER_TOKEN') {
             console.warn("Auth token missing/placeholder.");
        }

        // 8. Make API Call
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const response = await fetch(`${apiUrl}/designs`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
        });

        // 9. Handle Response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }
        const result = await response.json();
        console.log("Design published successfully:", result);
        alert(`Success! Design ID: ${result.designId}`);

    } catch (error) {
        console.error("Failed to publish design:", error);
        alert(`Error publishing design: ${error.message}`);
    } finally {
         setIsLoadingPublish(false); 
    }
  };

  // NEW: Handler for removing the image
  const handleRemoveImage = () => {
      setUploadedImageDataUrl(null); // This will clear userImg via useImage
      setUserImageAttrs(null);      // Clear attributes
      setIsUserImageSelected(false); // Deselect
  };

  // --- JSX Rendering ---
  const isAnyImageLoading = 
    (textureUrl && textureStatus === 'loading') ||
    (templateImageUrl && templateStatus === 'loading') ||
    (userImageUrl && userImgStatus === 'loading');

  // Calculate placeholder text color
  const placeholderFillColor = getContrastColor(selectedColor?.color_code);

  return (
    <div className={styles.optionsContainer}>

       {/* Container div for sizing */}
       <div
         ref={previewContainerRef}
         className={styles.previewContainer}
         style={{
           cursor: !userImageAttrs ? 'pointer' : 'default',
           aspectRatio: selectedVariant?.template_width && selectedVariant?.template_height ? 
             `${selectedVariant.template_width} / ${selectedVariant.template_height}` : 
             '1 / 1',
           backgroundColor: selectedColor?.color_code || '#f0f0f0',
         }}
       >
          {/* Konva Stage */}
          <Stage 
            ref={stageRef} 
            width={stageSize.width} 
            height={stageSize.height}
            onClick={handleStageClick} 
            onTap={handleStageClick} 
          >
              {/* Layer for Background Elements - Use Fragment to avoid whitespace issues */}
              <Layer name="backgroundLayer" listening={false}>
                  <Fragment>
                    {/* Background Color Rect */}
                    <Rect
                        x={0}
                        y={0}
                        width={stageSize.width}
                        height={stageSize.height}
                        fill={selectedColor?.color_code || '#f0f0f0'}
                    />
                    {/* Texture Image - Only render if loaded */}
                    {textureUrl && textureImg && textureStatus === 'loaded' && (
                        <Image
                            image={textureImg}
                            x={0}
                            y={0}
                            width={stageSize.width}
                            height={stageSize.height}
                        />
                    )}
                    {/* Template Image - Only render if loaded */}
                    {templateImageUrl && templateImg && templateStatus === 'loaded' && (
                        <Image
                            image={templateImg}
                            x={0}
                            y={0}
                            width={stageSize.width}
                            height={stageSize.height}
                        />
                    )}
                 </Fragment>
              </Layer>{/* End Background Layer */}

              {/* Layer for Interactive Elements - Use Fragment */}
              <Layer name="interactiveLayer">
                  <Fragment>
                    {/* Print Area Visualisation (Optional) */}
                    {printAreaRect.width > 0 && (
                        <Rect
                            x={printAreaRect.x}
                            y={printAreaRect.y}
                            width={printAreaRect.width}
                            height={printAreaRect.height}
                            stroke="rgba(0,0,0,0.5)"
                            strokeWidth={1}
                            dash={[5, 3]}
                            listening={false}
                        />
                    )}
                    
                    {/* User Uploaded Image - Add dragBoundFunc back */}
                    {userImageUrl && userImageAttrs && userImgStatus === 'loaded' && (
                       <Image 
                          ref={userImageRef} 
                          {...userImageAttrs} 
                          onDragEnd={handleDragEnd} 
                          onTransformEnd={handleTransformEnd} 
                          dragBoundFunc={dragBoundFunc} // <-- Apply drag bounds
                          onClick={() => setIsUserImageSelected(true)} 
                          onTap={() => setIsUserImageSelected(true)} 
                          onError={(e) => { // <-- Add onError handler
                            logToOverlay(`Konva Image Error: Failed to render user image. Error event: ${JSON.stringify(e)}`);
                            console.error("Konva Image Rendering Error:", e);
                            // Optionally clear the image state here if it fails to render
                            // setUploadedImageDataUrl(null); 
                            // setUserImageAttrs(null);
                          }}
                       />
                    )}
  
                    {/* Placeholder Text - Use calculated fill color */}
                    {!userImageUrl && templateStatus === 'loaded' && printAreaRect.width > 0 && (
                       <Text
                          id="uploadPlaceholderText"
                          text="Click to Upload Art"
                          x={printAreaRect.x}
                          y={printAreaRect.y + printAreaRect.height / 2 - 10}
                          width={printAreaRect.width}
                          height={20}
                          align="center"
                          verticalAlign="middle"
                          fontSize={16}
                          fill={placeholderFillColor} // <-- Use calculated color
                       />
                    )}

                    {/* Transformer - Set keepRatio */}
                    {isUserImageSelected && userImageAttrs && (
                        <Transformer 
                            ref={transformerRef} 
                            keepRatio={true} // <-- Enforce aspect ratio
                            // Optionally limit handles: enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                return newBox;
                            }}
                        />
                    )}
                  </Fragment>
              </Layer>{/* End Interactive Layer */}
          </Stage>

         {/* Loading Overlay - Use calculated combined loading state */}
         {isAnyImageLoading && (
            <div className={styles.loadingOverlay}>
                 Loading Images...
            </div>
         )}
         {/* Hidden File Input - Add HEIC accept type */}
         <input
           type="file"
           ref={fileInputRef}
           onChange={handleFileChange}
           accept="image/png, image/jpeg, image/webp, image/heic, image/heif" // <-- Added HEIC/HEIF
           style={{ display: 'none' }}
           onClick={(e) => { e.target.value = null }}
         />
       </div>

       {/* Out of Bounds Warning Text */}
       {isOutOfBounds && (
           <p className={styles.warningText}>Image is out of bounds and will be clipped.</p>
       )}

       {/* Add Remove Image Button */}
       {userImageAttrs && (
           <button onClick={handleRemoveImage} className={styles.secondaryButton}> 
               Remove Image
           </button>
       )}

       {/* Product Name & Base Price */}
        <div>
            <h2 className={styles.productName}>{product.name}</h2>
            {selectedVariant?.base_price !== undefined && (
            <p className={styles.basePriceDisplay}>Base Cost: <strong>${selectedVariant.base_price.toFixed(2)}</strong></p>
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

        {/* Commission Rate Selector */}
        <div className={styles.optionSection}>
            <h3 className={styles.sectionTitle}>Set Your Commission</h3>
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
            {estimatedPrice !== null && artistEarnings !== null && (
                <div className={styles.priceBreakdown}>
                    <p>Buyer pays: <strong>${estimatedPrice.toFixed(2)}</strong><span className={styles.shippingText}> + Shipping</span></p>
                    <p>Your Earnings: <strong>${artistEarnings.toFixed(2)}</strong></p>
                </div>
            )}
            <p className={styles.commissionNote}>Raw cost ${selectedVariant?.base_price?.toFixed(2) || RAW_COST.toFixed(2)} + Platform fee ${PLATFORM_FEE.toFixed(2)}.</p>
        </div>


      {/* Publish Button - Use calculated combined loading state */}
      <div className={styles.actionSection}>
         <button
           className={styles.primaryButton}
           onClick={handlePublishClick}
           // Disable if publish in progress OR if user image URL exists but hasn't loaded yet
           disabled={!selectedVariant || !userImageAttrs || !estimatedPrice || isLoadingPublish || (userImageUrl && userImgStatus !== 'loaded')}
          >
             {isLoadingPublish ? 'Publishing...' : 'Publish Design'} 
         </button>
      </div>

    </div>
  );
}