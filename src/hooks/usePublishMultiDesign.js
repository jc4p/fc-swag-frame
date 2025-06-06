'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebug } from '@/contexts/DebugContext';
import { loadImage } from '@/lib/imageUtils';
import Konva from 'konva';
import * as frame from '@farcaster/frame-sdk';
import { createClient } from "@farcaster/quick-auth";

/**
 * Custom hook for handling multi-image design publishing workflow
 * Specialized for sticker sheets with multiple images
 */
export function usePublishMultiDesign() {
  const { logToOverlay } = useDebug();
  const { authToken, userFid, isAuthenticated } = useAuth();
  
  const [isLoadingPublish, setIsLoadingPublish] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const publishMultiDesign = async (multiImageAttrs, selectedVariant, product, userImages, stageRef, commissionRate) => {
    logToOverlay("Multi-image publish button clicked.");

    // Ensure we have the essentials
    if (!multiImageAttrs || multiImageAttrs.length === 0 || !selectedVariant || !product || userImages.length === 0) {
      logToOverlay("Please upload at least one sticker image first.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // Sign-In Flow (if not authenticated)
    if (!isAuthenticated) {
      logToOverlay("User not authenticated. Starting Sign-In With Farcaster flow...");
      setIsSigningIn(true);
      try {
        logToOverlay("Calling frame.sdk.experimental.quickAuth...");
        const signInResult = await frame.sdk.experimental.quickAuth();
        logToOverlay(`quickAuth action completed.`);

        const loginToken = signInResult.token;
        const authClient = createClient();

        let appDomain;
        try {
          const url = new URL(window.location);
          appDomain = url.port ? `${url.hostname}:${url.port}` : url.hostname;
          console.log(`handleSignIn: Derived APP_DOMAIN: ${appDomain} from request URL: ${window.location}`);
        } catch (e) {
          console.error("handleSignIn: Failed to parse request URL to derive APP_DOMAIN:", e);
          throw new Error('Server configuration error (domain parsing).');
        }

        const loginPayload = await authClient.verifyJwt({ token: loginToken, domain: appDomain });

        console.log("Login Token:", loginPayload);
        logToOverlay("Login Token:", loginPayload);

        const userFid = loginPayload.sub;

        console.log("User FID:", userFid);
        logToOverlay("User FID:", userFid);

        logToOverlay("User successfully signed in and authenticated.");
        logToOverlay("Sign-in successful! You can now publish your sticker sheet.");

      } catch (error) {
        logToOverlay(`Sign-In Error: ${error.message}`);
        console.error("Sign-In Flow Error:", error);
        logToOverlay(`Sign-in failed: ${error.message}`);
      } finally {
        setIsSigningIn(false);
      }
      return;
    }

    // Multi-Design Publishing Flow (if authenticated)
    logToOverlay(`User is authenticated (FID: ${userFid}). Proceeding with multi-design publish...`);
    setIsLoadingPublish(true); 
    try {
      // Get High-Res Dimensions
      const highResWidth = selectedVariant.template_width;
      const highResHeight = selectedVariant.template_height;
      if (!highResWidth || !highResHeight) throw new Error("Missing template dimensions.");

      // Create Hidden Konva Stage
      const hiddenStage = new Konva.Stage({
        container: document.createElement('div'),
        width: highResWidth,
        height: highResHeight,
      });
      const hiddenLayer = new Konva.Layer();
      hiddenStage.add(hiddenLayer);

      // Calculate High-Res Transformations
      const previewStage = stageRef.current;
      const previewScaleFactor = previewStage.width() / highResWidth;

      console.log("Exporting multiple images...");

      // Process each image
      for (let i = 0; i < userImages.length; i++) {
        const imageDataUrl = userImages[i];
        const imageAttrs = multiImageAttrs[i];
        
        if (!imageDataUrl || !imageAttrs) continue;

        // Load image for export
        const imageToExport = await loadImage(imageDataUrl);
        
        // Calculate high-res transformations for this image
        const finalScaleX = imageAttrs.scaleX / previewScaleFactor;
        const finalScaleY = imageAttrs.scaleY / previewScaleFactor;
        const angle = imageAttrs.rotation;
        const centerPointHighResX = imageAttrs.x / previewScaleFactor;
        const centerPointHighResY = imageAttrs.y / previewScaleFactor;
        
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

      // Export Hidden Stage to Blob
      const blob = await new Promise((resolve) => {
        hiddenStage.toCanvas().toBlob(resolve, 'image/png', 1.0);
      });

      if (!blob) throw new Error("Failed to generate image blob.");
      console.log("Generated Sticker Sheet Blob size:", blob.size);

      // Create FormData
      const formData = new FormData();
      formData.append('product_id', product.id.toString());
      formData.append('variant_id', selectedVariant.id ? selectedVariant.id.toString() : product.id.toString());
      formData.append('image', blob, `sticker-sheet-${selectedVariant.id || product.id}.png`);

      // Get Auth Token
      if (!authToken) { 
        throw new Error("Authentication token missing unexpectedly.");
      }
      logToOverlay("Using auth token from context.");

      // Step 1: Create the design
      const response = await fetch(`${apiUrl}/api/designs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });

      // Handle Create Response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const result = await response.json();
      logToOverlay(`Sticker sheet design created successfully: ${JSON.stringify(result)}`);
      
      // Step 2: Publish the design with commission rate
      const designId = result.designId;
      const publishResponse = await fetch(`${apiUrl}/api/designs/${designId}/publish`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          royalty_percent: commissionRate
        }),
      });

      // Handle Publish Response
      if (!publishResponse.ok) {
        const publishErrorData = await publishResponse.json().catch(() => ({ error: 'Unknown publish API error' }));
        throw new Error(publishErrorData.error || `Publish API Error: ${publishResponse.status}`);
      }
      const publishResult = await publishResponse.json();
      logToOverlay(`Sticker sheet published successfully: ${JSON.stringify(publishResult)}`);
      logToOverlay(`Success! Sticker Sheet Design ID: ${designId}, Retail Price: $${publishResult.pricing.retail_price}`);

    } catch (error) {
      logToOverlay(`Multi-Design Publish Error: ${error.message}`);
      console.error("Failed to publish multi-design:", error);
      logToOverlay(`Error publishing sticker sheet: ${error.message}`);
    } finally {
      setIsLoadingPublish(false); 
    }
  };

  return {
    publishMultiDesign,
    isLoadingPublish,
    isSigningIn,
    canPublish: true // Quick Auth handles authentication internally
  };
}