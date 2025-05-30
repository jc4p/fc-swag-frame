'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebug } from '@/contexts/DebugContext';
import { loadImage } from '@/lib/imageUtils';
import Konva from 'konva';
import * as frame from '@farcaster/frame-sdk';
import { createClient } from "@farcaster/quick-auth";

/**
 * Custom hook for handling design publishing workflow
 * Includes authentication and high-resolution export
 */
export function usePublishDesign() {
  const { logToOverlay } = useDebug();
  const { authToken, userFid, isAuthenticated, login } = useAuth();
  
  const [isLoadingPublish, setIsLoadingPublish] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const publishDesign = async (userImageAttrs, selectedVariant, product, uploadedImageDataUrl, stageRef) => {
    logToOverlay("Publish button clicked.");

    // Ensure we have the essentials
    if (!userImageAttrs || !selectedVariant || !product) {
      alert("Please select variant and upload/position an image first.");
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
        alert("Sign-in successful! You can now publish your design.");

      } catch (error) {
        logToOverlay(`Sign-In Error: ${error.message}`);
        console.error("Sign-In Flow Error:", error);
        alert(`Sign-in failed: ${error.message}`);
      } finally {
        setIsSigningIn(false);
      }
      return;
    }

    // Design Publishing Flow (if authenticated)
    logToOverlay(`User is authenticated (FID: ${userFid}). Proceeding with design publish...`);
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

      const finalScaleX = userImageAttrs.scaleX / previewScaleFactor;
      const finalScaleY = userImageAttrs.scaleY / previewScaleFactor;
      const angle = userImageAttrs.rotation;

      const centerPointHighResX = userImageAttrs.x / previewScaleFactor;
      const centerPointHighResY = userImageAttrs.y / previewScaleFactor;

      console.log("Exporting image...");

      // Load image for export
      const imageToExport = await loadImage(uploadedImageDataUrl);
      
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
      hiddenStage.draw();

      // Export Hidden Stage to Blob
      const blob = await new Promise((resolve) => {
        hiddenStage.toCanvas().toBlob(resolve, 'image/png', 1.0);
      });

      if (!blob) throw new Error("Failed to generate image blob.");
      console.log("Generated Blob size:", blob.size);

      // Create FormData
      const formData = new FormData();
      formData.append('product_id', product.id.toString());
      formData.append('variant_id', selectedVariant.id.toString());
      formData.append('image', blob, `design-${selectedVariant.id}.png`);

      // Get Auth Token
      if (!authToken) { 
        throw new Error("Authentication token missing unexpectedly.");
      }
      logToOverlay("Using auth token from context.");

      // Make API Call
      const response = await fetch(`${apiUrl}/api/designs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });

      // Handle Response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const result = await response.json();
      logToOverlay(`Design published successfully: ${JSON.stringify(result)}`);
      alert(`Success! Design ID: ${result.designId}`);

    } catch (error) {
      logToOverlay(`Design Publish Error: ${error.message}`);
      console.error("Failed to publish design:", error);
      alert(`Error publishing design: ${error.message}`);
    } finally {
      setIsLoadingPublish(false); 
    }
  };

  return {
    publishDesign,
    isLoadingPublish,
    isSigningIn,
    canPublish: true // Quick Auth handles authentication internally
  };
}