'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Stage, Layer, Rect, Image, Transformer, Text, Circle, Group } from 'react-konva';
import Konva from 'konva'; // Import Konva for methods like Konva.Image.fromURL if needed, though use-image is preferred
import useImage from 'use-image'; // Hook for loading images
import styles from './ProductOptions.module.css';
import { useDebug } from '@/contexts/DebugContext'; // <-- Add import
import { useAuth } from '@/contexts/AuthContext'; // <-- Import Auth context hook
import * as frame from '@farcaster/frame-sdk'; // <-- Import Frame SDK

// Import SVG files as URLs for use-image
import trashIconUrl from '@/assets/icons/trash.svg';
import removeBgIconUrl from '@/assets/icons/remove-bg.svg';

// --- Constants ---
const RAW_COST = 14.95;
const PLATFORM_FEE = 4.00;
const DEFAULT_COMMISSION = 25;
const ICON_SIZE = 24; // Increased size
const ICON_PADDING = 10; // Increased padding
const ICON_BG_RADIUS = 15; // Radius for the background circle

// --- Helper Functions ---

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
export function OptionsShirt({ product }) {
  const { logToOverlay } = useDebug(); // <-- Get the logging function
  const { authToken, userFid, isAuthenticated, isAuthLoading, login } = useAuth(); // <-- Use Auth context

  // --- State --- 
  const [selectedColorName, setSelectedColorName] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState(null); // Input for user image
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [artistEarnings, setArtistEarnings] = useState(null);
  const [isLoadingPublish, setIsLoadingPublish] = useState(false); 
  const [isRemovingBackground, setIsRemovingBackground] = useState(false); // <-- Add state
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [printAreaRect, setPrintAreaRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [userImageAttrs, setUserImageAttrs] = useState(null);
  const [isUserImageSelected, setIsUserImageSelected] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false); // <-- Add state for bounds warning
  const [hasBackgroundBeenRemoved, setHasBackgroundBeenRemoved] = useState(false); // <-- New state
  const [isSigningIn, setIsSigningIn] = useState(false); 
  const [signInNonce, setSignInNonce] = useState(null); // <-- State for storing nonce
  const [iconPositions, setIconPositions] = useState({ // <-- State for icon positions
      removeBg: { x: 0, y: 0, visible: false },
      removeImg: { x: 0, y: 0, visible: false }
  });

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

  const [textureImg, textureStatus] = useImage(textureUrl || '', 'anonymous');
  const [templateImg, templateStatus] = useImage(templateImageUrl || '', 'anonymous');
  const [userImg, userImgStatus] = useImage(userImageUrl || '', 'anonymous');
  const [trashIconImg, trashIconStatus] = useImage(trashIconUrl.src);
  const [removeBgIconImg, removeBgIconStatus] = useImage(removeBgIconUrl.src);

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

   const handleStageClick = (e) => {
     const stage = e.target.getStage();
     if (!stage) return;

     const target = e.target;

     // If click is on the stage background
     if (target === stage) {
         if (userImageAttrs) { 
             console.log("Stage background clicked, deselecting image.");
             setIsUserImageSelected(false);
         }
         return;
     }
     
     // If click is on the placeholder text itself, let the label handle the upload trigger.
     if (target.attrs.id === 'uploadPlaceholderText') {
       console.log("Placeholder text clicked, deferring to label for upload.");
       return; 
     }

     // Check if the clicked target is the user image or its transformer
     let clickedOnUserImage = target.attrs.id === 'userImage';
     let parentNode = target.getParent();
     let clickedOnTransformer = false;

     // Traverse up to two levels for transformer parts, as transformer itself is a Group
     if (parentNode) {
        if (parentNode.className === 'Transformer') {
            clickedOnTransformer = true;
        } else {
            const grandparentNode = parentNode.getParent();
            if (grandparentNode && grandparentNode.className === 'Transformer') {
                clickedOnTransformer = true;
            }
        }
     }

     if (clickedOnUserImage || clickedOnTransformer) {
         console.log("User image or transformer clicked, selecting.");
         setIsUserImageSelected(true);
     } else {
          // If not the background, not placeholder, not user image/transformer
          // This could be the print area rect or another element. Deselect if an image is present.
          if (userImageAttrs) { 
             console.log("Clicked on other interactive element, deselecting user image.");
             setIsUserImageSelected(false);
          }
     }
   };

    // Update state when dragging ends
    const handleDragEnd = (e) => {
        setUserImageAttrs({
            ...userImageAttrs,
            x: e.target.x(),
            y: e.target.y(),
        });
        handleUserImageTransform(e.target); // Recalculate icons on drag end
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
        handleUserImageTransform(node); // Recalculate icons on transform end
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

  // --- Helper: Calculate Icon Positions ---
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
  }, []); // Dependencies managed via usage

  // --- Effect to Update Icon Positions on Selection/Transform --- 
  useEffect(() => {
    const node = userImageRef.current;
    if (isUserImageSelected && node) {
        setIconPositions(calculateIconPositions(node));
    } else {
        setIconPositions({ removeBg: { visible: false }, removeImg: { visible: false } });
    }
  }, [isUserImageSelected, userImageAttrs, calculateIconPositions]); // Update when selection or attrs change

  const handleUserImageTransform = useCallback((node) => { // Called during transform/drag
      if (node) {
          setIconPositions(calculateIconPositions(node));
      }
  }, [calculateIconPositions]);

  // --- Component Handlers (File Input, Publish, Remove Background, Remove Image) ---
  const handleFileChange = (event) => {
    logToOverlay("handleFileChange triggered!");
    const file = event.target.files?.[0];
    if (file) {
      logToOverlay(`File Selected: Name=${file.name}, Type=${file.type}, Size=${file.size} bytes`);

      // Check for HEIC/HEIF specifically
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        logToOverlay("WARNING: HEIC/HEIF file selected. Browser/Canvas support might be limited.");
      }

      const reader = new FileReader();

      reader.onloadstart = () => {
        logToOverlay(`FileReader: Starting to read ${file.name}`);
      };

      reader.onloadend = () => {
        logToOverlay(`FileReader: Finished reading ${file.name}. Result length: ${reader.result?.length || 0}`);
        if (reader.result) {
            setUploadedImageDataUrl(reader.result);
            logToOverlay("FileReader: Set uploadedImageDataUrl state.");
            setUserImageAttrs(null); // Reset attrs
            setHasBackgroundBeenRemoved(false); // <-- Reset on new file upload
        } else {
            logToOverlay("FileReader Error: onloadend fired but reader.result is empty.");
            alert("Error reading file. The file might be corrupted or in an unsupported format.");
        }
      };

      reader.onerror = (error) => {
         logToOverlay(`FileReader Error: Failed to read ${file.name}. Error: ${error}`);
         alert("Could not read the selected file. Please try a different image.");
      };

      reader.readAsDataURL(file);
    } else {
      logToOverlay("File Input: No file selected or event triggered without files.");
    }
    event.target.value = '';
  };

  useEffect(() => {
    const fetchNonce = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        logToOverlay("Fetching initial nonce...");
        try {
            const nonceRes = await fetch(`${apiUrl}/api/auth/nonce`);
            if (!nonceRes.ok) {
                throw new Error(`Failed to fetch nonce: ${nonceRes.status}`);
            }
            const { nonce } = await nonceRes.json();
            if (!nonce) {
                throw new Error('Received empty nonce from server.');
            }
            logToOverlay(`Initial nonce fetched: ${nonce.substring(0, 10)}...`);
            setSignInNonce(nonce);
        } catch (error) {
            logToOverlay(`Error fetching initial nonce: ${error.message}`);
            console.error("Failed to fetch initial nonce:", error);
            // Handle error - maybe disable sign-in button or show message?
            // For now, nonce will remain null, preventing sign-in.
        }
    };

    fetchNonce();
  }, [logToOverlay]); // Runs once on mount

  // Refactored Publish Click handler
  const handlePublishClick = async () => {
    logToOverlay("Publish button clicked.");

    // Ensure we have the essentials even before checking auth
    if (!userImageAttrs || !selectedVariant || !product) {
      alert("Please select variant and upload/position an image first.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // --- Sign-In Flow (if not authenticated) ---
    if (!isAuthenticated) {
        logToOverlay("User not authenticated. Starting Sign-In With Farcaster flow...");
        setIsSigningIn(true);
        try {
            // 1. Check if Nonce is loaded
            if (!signInNonce) {
                throw new Error('Sign-in nonce not available. Please try again later.');
            }
            logToOverlay(`Using pre-fetched nonce: ${signInNonce.substring(0, 10)}...`);

            // 2. Trigger Frame SDK Sign-In
            logToOverlay("Calling sdk.actions.signIn...");
            // const signInResult = await frame.sdk.actions.signIn({ nonce: signInNonce });
            const signInResult = await frame.sdk.experimental.quickAuth();
            logToOverlay(`signIn action completed.`);

            const loginToken = signInResult.token

            console.log("Login Token:", loginToken);
            logToOverlay("Login Token:", loginToken);

            const userFid = loginToken.sub

            console.log("User FID:", userFid);
            logToOverlay("User FID:", userFid);

            // 4. Update Auth Context
            login(userFid, backendVerifyData.fid);
            logToOverlay("User successfully signed in and authenticated.");
            alert("Sign-in successful! You can now publish your design."); // Inform user

        } catch (error) {
            logToOverlay(`Sign-In Error: ${error.message}`);
            console.error("Sign-In Flow Error:", error);
            alert(`Sign-in failed: ${error.message}`);
        } finally {
            setIsSigningIn(false);
        }
        return;
    }

    // --- Design Publishing Flow (if authenticated) ---
    logToOverlay(`User is authenticated (FID: ${userFid}). Proceeding with design publish...`);
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

        // 7. Get Auth Token (Now from context)
        if (!authToken) { 
             // This case shouldn't happen if isAuthenticated is true, but check anyway
             throw new Error("Authentication token missing unexpectedly.");
        }
        logToOverlay("Using auth token from context.");

        // 8. Make API Call (Now using context token)
        const response = await fetch(`${apiUrl}/api/designs`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }, // <-- Use token from context
            body: formData,
        });

        // 9. Handle Response (Existing)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }
        const result = await response.json();
        logToOverlay(`Design published successfully: ${JSON.stringify(result)}`);
        alert(`Success! Design ID: ${result.designId}`); // TODO: Show success state differently?

    } catch (error) {
        logToOverlay(`Design Publish Error: ${error.message}`);
        console.error("Failed to publish design:", error);
        alert(`Error publishing design: ${error.message}`);
    } finally {
         setIsLoadingPublish(false); 
    }
  };

  // NEW: Handler for removing the background
  const handleRemoveBackgroundClick = async () => {
    if (!uploadedImageDataUrl || isRemovingBackground) {
      logToOverlay("Remove Background: No image data URL or already processing.");
      return;
    }
    logToOverlay("Remove Background: Starting...");
    setIsRemovingBackground(true);

    try {
      // 1. Convert Data URL to Blob
      const imageBlob = dataURLtoBlob(uploadedImageDataUrl);
      if (!imageBlob) {
        throw new Error("Failed to convert image data URL to Blob.");
      }
      logToOverlay(`Remove Background: Converted to Blob, size: ${imageBlob.size}, type: ${imageBlob.type}`);

      // 2. Create FormData
      const formData = new FormData();
      // Try to determine a reasonable filename
      const fileExtension = imageBlob.type.split('/')[1] || 'png';
      const fileName = `image_to_process.${fileExtension}`;
      formData.append('image', imageBlob, fileName);

      // 3. Call the API endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''; // Use empty string for relative path
      const response = await fetch(`${apiUrl}/api/image/remove-background`, {
        method: 'POST',
        body: formData,
        // No Auth header needed as it's public
      });

      // 4. Handle Response
      if (!response.ok) {
        let errorBody = 'Failed to read error response.';
        try {
           errorBody = await response.text(); 
        } catch(e) { /* ignore */ }
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

      logToOverlay("Remove Background: API call successful. Receiving result blob...");
      const resultBlob = await response.blob();
      logToOverlay(`Remove Background: Received result blob, size: ${resultBlob.size}, type: ${resultBlob.type}`);

      // 5. Convert result Blob back to Data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          logToOverlay("Remove Background: Converted result blob to data URL. Updating state.");
          setUploadedImageDataUrl(reader.result);
          setHasBackgroundBeenRemoved(true); // <-- Set state to true
          // NOTE: Transformer bounds are NOT automatically adjusted after background removal.
          // The user may need to resize the transformer manually as its boundary 
          // still corresponds to the original image dimensions, not the new visible content.
          // Auto-detecting new visual bounds is complex.
        } else {
          throw new Error("Failed to read the processed image blob back into a data URL.");
        }
        setIsRemovingBackground(false); 
      };
      reader.onerror = (error) => {
        logToOverlay(`Remove Background: FileReader error reading result blob: ${error}`);
        throw new Error("FileReader failed to read the processed image blob.");
      };
      reader.readAsDataURL(resultBlob);

    } catch (error) {
      logToOverlay(`Remove Background Error: ${error.message}`);
      console.error("Failed to remove background:", error);
      alert(`Error removing background: ${error.message}`);
      setIsRemovingBackground(false);
    }
  };

  // Handler for removing the image (now triggered by icon)
  const handleRemoveImage = () => {
      logToOverlay("Remove Image icon clicked.");
      setUploadedImageDataUrl(null);
      setUserImageAttrs(null);
      setIsUserImageSelected(false);
      setHasBackgroundBeenRemoved(false); // <-- Reset on image removal
  };

  // --- JSX Rendering ---
  const isAnyImageLoading = 
    (textureUrl && textureStatus === 'loading') ||
    (templateImageUrl && templateStatus === 'loading') ||
    (userImageUrl && userImgStatus === 'loading') ||
    isRemovingBackground || 
    trashIconStatus !== 'loaded' || // Add icon loading states
    removeBgIconStatus !== 'loaded' ||
    isSigningIn || // <-- Add sign-in loading state
    isAuthLoading; // <-- Add auth loading state

  // Calculate placeholder text color
  const placeholderFillColor = getContrastColor(selectedColor?.color_code);

  const publishButtonText = isSigningIn 
      ? 'Signing In...' 
      : isLoadingPublish 
      ? 'Publishing...' 
      : isAuthenticated 
      ? 'Publish Design' 
      : 'Sign In & Publish';

  return (
    <div className={styles.optionsContainer}>

       {/* Container div for sizing */}
       <div
         ref={previewContainerRef}
         className={styles.previewContainer}
         style={{ position: 'relative' }}
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
                    
                    {/* User Uploaded Image - Add onTransform and onDragMove */}
                    {userImageUrl && userImageAttrs && userImgStatus === 'loaded' && (
                       <Image 
                          ref={userImageRef}
                          {...userImageAttrs}
                          onDragEnd={handleDragEnd}
                          onTransformEnd={handleTransformEnd}
                          dragBoundFunc={dragBoundFunc}
                          onClick={() => setIsUserImageSelected(true)}
                          onTap={() => setIsUserImageSelected(true)}
                          onError={(e) => {
                            logToOverlay(`Konva Image Error: Failed to render user image. Error event: ${JSON.stringify(e)}`);
                            console.error("Konva Image Rendering Error:", e);
                          }}
                          draggable={!isRemovingBackground && userImageAttrs.draggable}
                          listening={!isRemovingBackground}
                          // Update icon positions LIVE during drag/transform
                          onDragMove={(e) => handleUserImageTransform(e.target)}
                          onTransform={(e) => handleUserImageTransform(e.target)}
                       />
                    )}
  
                    {/* Placeholder Text - Rendered by Konva */}
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

                    {/* Transformer */} 
                    {isUserImageSelected && userImageAttrs && (
                        <Transformer 
                            ref={transformerRef}
                            keepRatio={true}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                return newBox;
                            }}
                            visible={!isRemovingBackground}
                        />
                    )}

                    {/* Action Icons - Group for easier management */} 
                    {isUserImageSelected && userImageAttrs && iconPositions.removeImg.visible && (
                         <Fragment>
                            {/* Remove Image Icon */} 
                            {trashIconStatus === 'loaded' && !isRemovingBackground && (
                                <Group
                                   x={iconPositions.removeImg.x}
                                   y={iconPositions.removeImg.y}
                                   width={ICON_SIZE}
                                   height={ICON_SIZE}
                                   onClick={handleRemoveImage}
                                   onTap={handleRemoveImage}
                                   onMouseEnter={e => { e.target.getStage().container().style.cursor = 'pointer'; }}
                                   onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}
                                >
                                   {/* Invisible Rect for Hit Detection */} 
                                   <Rect 
                                      width={ICON_SIZE + ICON_PADDING} // Make hit area slightly larger than icon
                                      height={ICON_SIZE + ICON_PADDING}
                                      fill="transparent" // Invisible
                                      offsetX={(ICON_SIZE + ICON_PADDING) / 2} // Center hit rect in group
                                      offsetY={(ICON_SIZE + ICON_PADDING) / 2}
                                      x={ICON_SIZE / 2} // Position rect at group center
                                      y={ICON_SIZE / 2}
                                   />
                                   <Image 
                                        image={trashIconImg}
                                        width={ICON_SIZE}
                                        height={ICON_SIZE}
                                        // Icon is still positioned relative to group origin (0,0)
                                        listening={false} // Click handled by group
                                   />
                                </Group>
                             )}

                            {/* Remove Background Icon - Conditionally render */} 
                            {removeBgIconStatus === 'loaded' && !isRemovingBackground && !hasBackgroundBeenRemoved && (
                                <Group
                                    x={iconPositions.removeBg.x}
                                    y={iconPositions.removeBg.y}
                                    width={ICON_SIZE}
                                    height={ICON_SIZE}
                                    // No offset needed
                                    onClick={handleRemoveBackgroundClick}
                                    onTap={handleRemoveBackgroundClick}
                                    onMouseEnter={e => { e.target.getStage().container().style.cursor = 'pointer'; }}
                                    onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}
                                >
                                    {/* Invisible Rect for Hit Detection */} 
                                    <Rect 
                                        width={ICON_SIZE + ICON_PADDING}
                                        height={ICON_SIZE + ICON_PADDING}
                                        fill="transparent"
                                        offsetX={(ICON_SIZE + ICON_PADDING) / 2}
                                        offsetY={(ICON_SIZE + ICON_PADDING) / 2}
                                        x={ICON_SIZE / 2}
                                        y={ICON_SIZE / 2}
                                    />
                                    <Image 
                                        image={removeBgIconImg}
                                        width={ICON_SIZE}
                                        height={ICON_SIZE}
                                        // Icon is still positioned relative to group origin (0,0)
                                        listening={false}
                                    />
                                </Group>
                             )}
                         </Fragment>
                    )}

                  </Fragment>
              </Layer>{/* End Interactive Layer */}
          </Stage>

          {/* Label OVER the stage, linked to the input, only shown when no image */} 
          {!userImageAttrs && (
            <label 
              htmlFor="file-upload-input" 
              className={styles.uploadLabel} // Add styling for the label
              style={{ 
                 position: 'absolute', 
                 top: 0, 
                 left: 0, 
                 width: '100%', 
                 height: '100%', 
                 cursor: 'pointer', 
                 zIndex: 10 // Ensure it's above Konva canvas but below loading overlay
              }}
            >
              {/* Screen reader text or visually hidden content if needed */}
              <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
                Upload your artwork
              </span>
            </label>
          )}

         {/* Loading Overlay - Updated text */} 
         {isAnyImageLoading && (
            <div className={styles.loadingOverlay}>
                {isSigningIn
                    ? 'Waiting for Sign-In...'
                    : isRemovingBackground 
                    ? 'Removing Background...' 
                    : isLoadingPublish
                    ? 'Publishing Design...'
                    : isAuthLoading 
                    ? 'Checking Auth...'
                    : 'Loading...' // General loading for images/icons
                }
            </div>
         )}
         {/* Hidden File Input - Still keep off-screen */}
         <input
           type="file"
           id="file-upload-input" // <-- Added ID
           ref={fileInputRef}
           onChange={handleFileChange}
           accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
           style={{ // Use positioning to hide instead of display:none
             position: 'absolute',
             left: '-9999px',
             top: '-9999px',
             opacity: 0, // Also make invisible just in case
           }}
           onClick={(e) => { e.target.value = null }}
         />
       </div>

       {/* Out of Bounds Warning Text */}
       {isOutOfBounds && (
           <p className={styles.warningText}>Image is out of bounds and will be clipped.</p>
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


      {/* Publish Button - Updated text and disable logic */} 
      <div className={styles.actionSection}>
         <button
           className={styles.primaryButton}
           onClick={handlePublishClick}
           disabled={
               !selectedVariant || 
               !userImageAttrs || 
               !estimatedPrice || 
               isLoadingPublish || 
               isRemovingBackground ||
               isSigningIn || // Disable during sign-in
               isAuthLoading || // Disable while checking auth
               (userImageUrl && userImgStatus !== 'loaded') ||
               (!isAuthenticated && !signInNonce) // Disable if not logged in AND nonce isn't ready
            }
          >
             {publishButtonText} 
         </button>
      </div>

    </div>
  );
}