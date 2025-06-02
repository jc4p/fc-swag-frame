'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react';
import { Stage, Layer, Rect, Image, Transformer, Text, Group } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useDebug } from '@/contexts/DebugContext';
import { dataURLtoBlob } from '@/lib/imageUtils';
import styles from '../shared/KonvaImageEditor.module.css';

// Import SVG files as URLs for use-image
import trashIconUrl from '@/assets/icons/trash.svg';
import removeBgIconUrl from '@/assets/icons/remove-bg.svg';

// Constants
const ICON_SIZE = 24;
const ICON_PADDING = 10;

/**
 * Multi-image Konva editor for sticker sheets
 * Handles multiple images with individual selection and transformation
 */
export function KonvaMultiImageEditor({
  selectedVariant,
  userImages = [],
  onMultiImageUpdate,
  onImageRemove,
  onBackgroundRemove,
  onImageUpload,
  isRemovingBackground = false,
  className = '',
  stageRef: externalStageRef
}) {
  const { logToOverlay } = useDebug();
  
  // State
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [printAreaRect, setPrintAreaRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [imageAttrs, setImageAttrs] = useState([]); // Array of image attributes
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [iconPositions, setIconPositions] = useState({
    removeBg: { x: 0, y: 0, visible: false },
    removeImg: { x: 0, y: 0, visible: false }
  });

  // Refs
  const previewContainerRef = useRef(null);
  const stageRef = externalStageRef || useRef(null);
  const imageRefs = useRef([]); // Array of refs for each image
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Template image loading
  const templateImageUrl = selectedVariant?.template_image_url;
  const [templateImg, templateStatus] = useImage(templateImageUrl || '', 'anonymous');
  const [trashIconImg, trashIconStatus] = useImage(trashIconUrl.src);
  const [removeBgIconImg, removeBgIconStatus] = useImage(removeBgIconUrl.src);

  // Add fallback dimensions for sticker sheets if variant is missing template dimensions
  const effectiveVariant = useMemo(() => {
    if (!selectedVariant) return null;
    
    const fallbackWidth = 400;
    const fallbackHeight = 400;
    
    return {
      ...selectedVariant,
      template_width: selectedVariant.template_width || fallbackWidth,
      template_height: selectedVariant.template_height || fallbackHeight,
      print_area_left: selectedVariant.print_area_left || 0,
      print_area_top: selectedVariant.print_area_top || 0,
      print_area_width: selectedVariant.print_area_width || selectedVariant.template_width || fallbackWidth,
      print_area_height: selectedVariant.print_area_height || selectedVariant.template_height || fallbackHeight,
    };
  }, [selectedVariant]);

  // Effect to update stage size & print area
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !effectiveVariant) {
      return;
    }

    const updateSize = () => {
      const { clientWidth } = container;
      
      if (clientWidth > 0) {
        // Account for borders (2px total: 1px on each side)
        const borderWidth = 2;
        const availableWidth = clientWidth - borderWidth;
        
        const aspectRatio = effectiveVariant.template_height / effectiveVariant.template_width;
        const height = availableWidth * aspectRatio;
        
        setStageSize({ width: availableWidth, height });

        // Calculate scaled print area based on new stage size
        const scaleFactor = availableWidth / effectiveVariant.template_width;
        const newPrintArea = {
          x: effectiveVariant.print_area_left * scaleFactor,
          y: effectiveVariant.print_area_top * scaleFactor,
          width: effectiveVariant.print_area_width * scaleFactor,
          height: effectiveVariant.print_area_height * scaleFactor,
        };
        
        setPrintAreaRect(newPrintArea);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [effectiveVariant]);

  // Initialize image attributes when userImages change or stage is ready
  useEffect(() => {
    if (userImages.length === 0) {
      setImageAttrs([]);
      onMultiImageUpdate?.([]);
      return;
    }

    // Only proceed if stage and print area are properly initialized
    if (stageSize.width <= 0 || printAreaRect.width <= 0) {
      return;
    }

    // Check if we need to add attributes for new images
    const needsNewAttrs = userImages.length > imageAttrs.length;
    
    if (!needsNewAttrs) {
      return; // No new images to process
    }

    const newAttrs = [...imageAttrs]; // Keep existing attrs
    
    // Only add attrs for new images
    for (let index = imageAttrs.length; index < userImages.length; index++) {
      const cols = Math.ceil(Math.sqrt(userImages.length));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const cellWidth = printAreaRect.width / cols;
      const cellHeight = printAreaRect.height / Math.ceil(userImages.length / cols);
      
      newAttrs[index] = {
        id: `stickerImage-${index}`,
        x: printAreaRect.x + col * cellWidth + cellWidth / 2,
        y: printAreaRect.y + row * cellHeight + cellHeight / 2,
        scaleX: 0.3,
        scaleY: 0.3,
        rotation: 0,
        draggable: true,
        // image and offset will be set by the individual components
      };
    }

    setImageAttrs(newAttrs);
    onMultiImageUpdate?.(newAttrs);
  }, [userImages.length, stageSize.width, printAreaRect.width, printAreaRect.height, imageAttrs.length]);

  // Update imageRefs array when userImages length changes
  useEffect(() => {
    imageRefs.current = userImages.map((_, index) => imageRefs.current[index] || React.createRef());
  }, [userImages.length]);

  // Effect to attach/detach transformer
  useEffect(() => {
    if (selectedImageIndex !== null && transformerRef.current && imageRefs.current[selectedImageIndex]?.current) {
      transformerRef.current.nodes([imageRefs.current[selectedImageIndex].current]);
      transformerRef.current.getLayer()?.batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedImageIndex]);

  // Helper: Calculate Icon Positions
  const calculateIconPositions = useCallback((node) => {
    if (!node) return { removeBg: { visible: false }, removeImg: { visible: false } };

    const box = node.getClientRect({ relativeTo: node.getLayer() });
    const removeBgX = box.x + box.width + ICON_PADDING;
    const removeBgY = box.y - ICON_PADDING;
    const removeImgX = box.x - ICON_PADDING - ICON_SIZE;
    const removeImgY = box.y - ICON_PADDING;

    return {
      removeBg: { x: removeBgX, y: removeBgY, visible: true },
      removeImg: { x: removeImgX, y: removeImgY, visible: true }
    };
  }, []);

  // Effect to update icon positions
  useEffect(() => {
    const node = selectedImageIndex !== null ? imageRefs.current[selectedImageIndex]?.current : null;
    if (selectedImageIndex !== null && node) {
      setIconPositions(calculateIconPositions(node));
    } else {
      setIconPositions({ removeBg: { visible: false }, removeImg: { visible: false } });
    }
  }, [selectedImageIndex, calculateIconPositions]);

  const handleImageTransform = useCallback((node, imageIndex) => {
    if (node && selectedImageIndex !== null && imageIndex === selectedImageIndex) {
      setIconPositions(calculateIconPositions(node));
    }
  }, [calculateIconPositions, selectedImageIndex]);

  // Create a memoized attrs update handler
  const createAttrsUpdateHandler = useCallback((index) => {
    return (newAttrs) => {
      setImageAttrs(prev => {
        const updatedAttrs = [...prev];
        updatedAttrs[index] = newAttrs;
        onMultiImageUpdate?.(updatedAttrs);
        return updatedAttrs;
      });
    };
  }, [onMultiImageUpdate]);

  // Event Handlers
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // Check if clicked on placeholder text
    if (e.target.attrs.id === 'uploadPlaceholderText') {
      fileInputRef.current?.click();
      return;
    }

    if (e.target === stage) {
      setSelectedImageIndex(null);
      return;
    }
    
    // Check if clicked on an image
    const clickedImageIndex = imageAttrs.findIndex(attr => 
      attr && e.target.attrs.id === attr.id
    );
    
    if (clickedImageIndex !== -1) {
      setSelectedImageIndex(clickedImageIndex);
    } else {
      setSelectedImageIndex(null);
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && onImageUpload) {
          onImageUpload(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = ''; // Reset file input
  };

  const handleDragEnd = (imageIndex) => (e) => {
    const newAttrs = [...imageAttrs];
    newAttrs[imageIndex] = {
      ...newAttrs[imageIndex],
      x: e.target.x(),
      y: e.target.y(),
    };
    setImageAttrs(newAttrs);
    onMultiImageUpdate?.(newAttrs);
    handleImageTransform(e.target, imageIndex);
  };

  const handleTransformEnd = (imageIndex) => (e) => {
    const node = imageRefs.current[imageIndex]?.current;
    if (!node) return;
    
    const newAttrs = [...imageAttrs];
    newAttrs[imageIndex] = {
      ...newAttrs[imageIndex],
      x: node.x(),
      y: node.y(),
      scaleX: Math.max(0.01, node.scaleX()),
      scaleY: Math.max(0.01, node.scaleY()),
      rotation: node.rotation(),
    };
    setImageAttrs(newAttrs);
    onMultiImageUpdate?.(newAttrs);
    handleImageTransform(node, imageIndex);
  };

  const dragBoundFunc = (pos) => {
    // Basic bounds checking - can be enhanced
    return pos;
  };

  const handleRemoveImage = () => {
    if (selectedImageIndex !== null) {
      onImageRemove?.(selectedImageIndex);
      setSelectedImageIndex(null);
    }
  };

  const handleRemoveBackgroundClick = async () => {
    if (selectedImageIndex === null || !userImages[selectedImageIndex] || isRemovingBackground) {
      return;
    }
    
    try {
      const imageBlob = dataURLtoBlob(userImages[selectedImageIndex]);
      if (!imageBlob) {
        throw new Error("Failed to convert image data URL to Blob.");
      }

      const formData = new FormData();
      const fileExtension = imageBlob.type.split('/')[1] || 'png';
      const fileName = `sticker_${selectedImageIndex}.${fileExtension}`;
      formData.append('image', imageBlob, fileName);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/image/remove-background`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorBody = 'Failed to read error response.';
        try {
          errorBody = await response.text(); 
        } catch(e) { /* ignore */ }
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

      const resultBlob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = () => {
        if (reader.result) {
          onBackgroundRemove?.(reader.result, selectedImageIndex);
        }
      };
      
      reader.readAsDataURL(resultBlob);
    } catch (error) {
      console.error("Failed to remove background:", error);
      alert(`Error removing background: ${error.message}`);
    }
  };

  // Loading states
  const isAnyImageLoading = 
    (templateImageUrl && templateStatus === 'loading') ||
    isRemovingBackground || 
    trashIconStatus !== 'loaded' ||
    removeBgIconStatus !== 'loaded';

  return (
    <div className={`${styles.konvaEditor} ${className}`}>
      <div
        ref={previewContainerRef}
        className={styles.previewContainer}
        style={{ 
          position: 'relative', 
          minHeight: '300px', 
          border: '1px solid #ddd',
          boxSizing: 'border-box',
          padding: '1px'
        }}
      >
        <Stage 
          ref={stageRef} 
          width={stageSize.width} 
          height={stageSize.height}
          onClick={handleStageClick} 
          onTap={handleStageClick}
          style={{ 
            border: '1px solid #ccc',
            display: 'block'
          }}
        >
          {/* Background Layer */}
          <Layer name="backgroundLayer" listening={false}>
            <Rect
              x={0}
              y={0}
              width={stageSize.width}
              height={stageSize.height}
              fill="#f0f0f0"
            />
            {templateImageUrl && templateImg && templateStatus === 'loaded' && (
              <Image
                image={templateImg}
                x={0}
                y={0}
                width={stageSize.width}
                height={stageSize.height}
              />
            )}
          </Layer>

          {/* Interactive Layer */}
          <Layer name="interactiveLayer">
            {/* Print Area Visualization */}
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
            
            {/* User Uploaded Images */}
            {userImages.map((dataUrl, index) => {
              const attrs = imageAttrs[index];
              
              if (!attrs || !dataUrl) {
                return null;
              }

              return (
                <StickerImage
                  key={`sticker-${index}`}
                  ref={imageRefs.current[index]}
                  dataUrl={dataUrl}
                  attrs={attrs}
                  index={index}
                  onDragEnd={handleDragEnd(index)}
                  onTransformEnd={handleTransformEnd(index)}
                  onImageTransform={handleImageTransform}
                  onSelect={() => setSelectedImageIndex(index)}
                  onAttrsUpdate={createAttrsUpdateHandler(index)}
                  isSelected={selectedImageIndex === index}
                  isRemovingBackground={isRemovingBackground}
                  dragBoundFunc={dragBoundFunc}
                />
              );
            })}

            {/* Placeholder Text */}
            {userImages.length === 0 && (templateStatus === 'loaded' || !templateImageUrl) && printAreaRect.width > 0 && (
              <Text
                id="uploadPlaceholderText"
                text="Click to Upload Stickers"
                x={printAreaRect.x}
                y={printAreaRect.y + printAreaRect.height / 2 - 10}
                width={printAreaRect.width}
                height={20}
                align="center"
                verticalAlign="middle"
                fontSize={16}
                fill="#555555"
                listening={true}
              />
            )}

            {/* Transformer */} 
            {selectedImageIndex !== null && imageAttrs[selectedImageIndex] && (
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

            {/* Action Icons */} 
            {selectedImageIndex !== null && imageAttrs[selectedImageIndex] && iconPositions.removeImg.visible && (
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
                      image={trashIconImg}
                      width={ICON_SIZE}
                      height={ICON_SIZE}
                      listening={false}
                    />
                  </Group>
                )}

                {/* Remove Background Icon */} 
                {removeBgIconStatus === 'loaded' && !isRemovingBackground && (
                  <Group
                    x={iconPositions.removeBg.x}
                    y={iconPositions.removeBg.y}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    onClick={handleRemoveBackgroundClick}
                    onTap={handleRemoveBackgroundClick}
                    onMouseEnter={e => { e.target.getStage().container().style.cursor = 'pointer'; }}
                    onMouseLeave={e => { e.target.getStage().container().style.cursor = 'default'; }}
                  >
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
                      listening={false}
                    />
                  </Group>
                )}
              </Fragment>
            )}
          </Layer>
        </Stage>

        {/* Loading Overlay */} 
        {isAnyImageLoading && (
          <div className={styles.loadingOverlay}>
            {isRemovingBackground ? 'Removing Background...' : 'Loading...'}
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp"
          multiple
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            opacity: 0,
          }}
        />
      </div>
    </div>
  );
}

// Individual sticker image component to handle useImage hook properly
const StickerImage = React.forwardRef(({ 
  dataUrl, 
  attrs, 
  index, 
  onDragEnd, 
  onTransformEnd, 
  onImageTransform,
  onSelect, 
  onAttrsUpdate,
  isSelected,
  isRemovingBackground,
  dragBoundFunc 
}, ref) => {
  const [img, status] = useImage(dataUrl, 'anonymous');

  // Update attrs when image loads
  useEffect(() => {
    if (status === 'loaded' && img && attrs && !attrs.image) {
      const updatedAttrs = {
        ...attrs,
        image: img,
        offsetX: img.width / 2,
        offsetY: img.height / 2,
      };
      onAttrsUpdate(updatedAttrs);
    }
  }, [status, img, attrs, onAttrsUpdate]);

  if (status === 'loading' || !attrs || !attrs.image) return null;
  if (status === 'failed') return null;

  return (
    <Image 
      ref={ref}
      {...attrs}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      dragBoundFunc={dragBoundFunc}
      onClick={onSelect}
      onTap={onSelect}
      draggable={!isRemovingBackground && attrs.draggable}
      listening={!isRemovingBackground}
      onDragMove={(e) => onImageTransform(e.target, index)}
      onTransform={(e) => onImageTransform(e.target, index)}
    />
  );
});

StickerImage.displayName = 'StickerImage';