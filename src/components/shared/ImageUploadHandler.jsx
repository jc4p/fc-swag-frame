'use client';

import React, { useRef, useCallback } from 'react';
import { useDebug } from '@/contexts/DebugContext';

/**
 * Reusable image upload handler component
 * Handles file selection, validation, and conversion to data URL
 */
export function ImageUploadHandler({ 
  onImageUpload, 
  onImageRemove, 
  acceptedTypes = "image/png, image/jpeg, image/webp, image/heic, image/heif",
  className,
  children,
  uploadedImageDataUrl
}) {
  const { logToOverlay } = useDebug();
  const fileInputRef = useRef(null);

  const handleFileChange = useCallback((event) => {
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
          onImageUpload?.(reader.result);
          logToOverlay("FileReader: Triggered onImageUpload callback.");
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
  }, [onImageUpload, logToOverlay]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveImage = useCallback(() => {
    logToOverlay("Remove Image triggered.");
    onImageRemove?.();
  }, [onImageRemove, logToOverlay]);

  return (
    <>
      {/* Always render children, but only add click handler when no image */}
      {children && !uploadedImageDataUrl && (
        <div onClick={triggerFileInput} className={className}>
          {children}
        </div>
      )}
      
      {/* Render children without click handler when image exists */}
      {children && uploadedImageDataUrl && (
        <div className={className}>
          {children}
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={acceptedTypes}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
        }}
        onClick={(e) => { e.target.value = null }}
      />
    </>
  );
}