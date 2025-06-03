'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Stage, Layer, Rect, Image, Transformer, Text, Group } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useDebug } from '@/contexts/DebugContext';
import { dataURLtoBlob, loadImage, isImageOutOfBounds, calculateDragBounds } from '@/lib/imageUtils';
import { getContrastColor } from '@/lib/priceCalculator';
import styles from './KonvaImageEditor.module.css';

// Import SVG files as URLs for use-image
import trashIconUrl from '@/assets/icons/trash.svg';
import removeBgIconUrl from '@/assets/icons/remove-bg.svg';

// Constants
const ICON_SIZE = 24;
const ICON_PADDING = 10;

/**
 * Reusable Konva-based image editor component
 * Handles image manipulation, transformation, and background removal
 */
export function KonvaImageEditor({
  selectedVariant,
  selectedColor,
  uploadedImageDataUrl,
  onImageUpdate,
  onImageRemove,
  onBackgroundRemove,
  isRemovingBackground = false,
  hasBackgroundBeenRemoved = false,
  className = '',
  stageRef: externalStageRef
}) {
  const { logToOverlay } = useDebug();
  
  // State
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [printAreaRect, setPrintAreaRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [userImageAttrs, setUserImageAttrs] = useState(null);
  const [isUserImageSelected, setIsUserImageSelected] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [iconPositions, setIconPositions] = useState({
    removeBg: { x: 0, y: 0, visible: false },
    removeImg: { x: 0, y: 0, visible: false }
  });

  // Refs
  const previewContainerRef = useRef(null);
  const stageRef = externalStageRef || useRef(null);
  const userImageRef = useRef(null);
  const transformerRef = useRef(null);

  // Image loading with use-image
  const textureUrl = selectedVariant?.template_texture_url;
  const templateImageUrl = selectedVariant?.template_image_url;
  const userImageUrl = uploadedImageDataUrl;

  const [textureImg, textureStatus] = useImage(textureUrl || '', 'anonymous');
  const [templateImg, templateStatus] = useImage(templateImageUrl || '', 'anonymous');
  const [userImg, userImgStatus] = useImage(userImageUrl || '', 'anonymous');
  const [trashIconImg, trashIconStatus] = useImage(trashIconUrl.src);
  const [removeBgIconImg, removeBgIconStatus] = useImage(removeBgIconUrl.src);

  // Effect to log userImgStatus changes
  useEffect(() => {
    if (userImageUrl) {
      logToOverlay(`useImage status for user image: ${userImgStatus}`);
      if (userImgStatus === 'failed') {
        logToOverlay('useImage failed to load the user image.');
      }
      if (userImgStatus === 'loaded' && userImg) {
        logToOverlay(`useImage loaded: ${userImg.width}x${userImg.height}`);
      }
    }
  }, [userImgStatus, userImageUrl, logToOverlay, userImg]);

  // Effect to update stage size & print area
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !selectedVariant?.template_width || !selectedVariant?.template_height) return;

    const updateSize = () => {
      const { clientWidth } = container;
      if (clientWidth > 0) {
        const aspectRatio = selectedVariant.template_height / selectedVariant.template_width;
        const height = clientWidth * aspectRatio;
        setStageSize({ width: clientWidth, height });

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

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [selectedVariant]);

  // Effect to initialize user image attributes when loaded
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
      onImageUpdate?.(initialAttrs);
      logToOverlay("User image initial attributes set.");
    } else if (!uploadedImageDataUrl || userImgStatus === 'loading' || userImgStatus === 'failed') {
      setUserImageAttrs(null);
      onImageUpdate?.(null);
    }
  }, [userImg, userImgStatus, stageSize.width, printAreaRect, uploadedImageDataUrl, logToOverlay, onImageUpdate]);

  // Effect to auto-select image when it first loads
  useEffect(() => {
    if (userImageAttrs && !isUserImageSelected) {
      setIsUserImageSelected(true);
    } else if (!userImageAttrs && isUserImageSelected) {
      setIsUserImageSelected(false);
    }
  }, [userImageAttrs, isUserImageSelected]);

  // Effect to attach/detach transformer
  useEffect(() => {
    if (isUserImageSelected && transformerRef.current && userImageRef.current) {
      transformerRef.current.nodes([userImageRef.current]);
      transformerRef.current.getLayer()?.batchDraw(); 
    } else if (transformerRef.current) {
      if(transformerRef.current.nodes().length > 0) {
        transformerRef.current.nodes([]); 
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [isUserImageSelected]);

  // Effect to check image bounds
  useEffect(() => {
    const imageNode = userImageRef.current;
    if (imageNode && userImageAttrs && printAreaRect.width > 0) {
      const outOfBounds = isImageOutOfBounds(imageNode, printAreaRect, 1);
      if (outOfBounds !== isOutOfBounds) {
        setIsOutOfBounds(outOfBounds);
      }
    } else if (isOutOfBounds) {
      setIsOutOfBounds(false);
    }
  }, [userImageAttrs, printAreaRect, isOutOfBounds]);

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

  // Effect to update icon positions on selection/transform
  useEffect(() => {
    const node = userImageRef.current;
    if (isUserImageSelected && node) {
      setIconPositions(calculateIconPositions(node));
    } else {
      setIconPositions({ removeBg: { visible: false }, removeImg: { visible: false } });
    }
  }, [isUserImageSelected, userImageAttrs, calculateIconPositions]);

  const handleUserImageTransform = useCallback((node) => {
    if (node) {
      setIconPositions(calculateIconPositions(node));
    }
  }, [calculateIconPositions]);

  // Event Handlers
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const target = e.target;

    if (target === stage) {
      if (userImageAttrs) { 
        setIsUserImageSelected(false);
      }
      return;
    }
    
    if (target.attrs.id === 'uploadPlaceholderText') {
      return; 
    }

    let clickedOnUserImage = target.attrs.id === 'userImage';
    let parentNode = target.getParent();
    let clickedOnTransformer = false;

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
      setIsUserImageSelected(true);
    } else {
      if (userImageAttrs) { 
        setIsUserImageSelected(false);
      }
    }
  };

  const handleDragEnd = (e) => {
    const newAttrs = {
      ...userImageAttrs,
      x: e.target.x(),
      y: e.target.y(),
    };
    setUserImageAttrs(newAttrs);
    onImageUpdate?.(newAttrs);
    handleUserImageTransform(e.target);
  };

  const handleTransformEnd = (e) => {
    const node = userImageRef.current;
    if (!node) return;
    
    const newAttrs = {
      ...userImageAttrs,
      x: node.x(),
      y: node.y(),
      scaleX: Math.max(0.01, node.scaleX()),
      scaleY: Math.max(0.01, node.scaleY()),
      rotation: node.rotation(),
    };
    setUserImageAttrs(newAttrs);
    onImageUpdate?.(newAttrs);
    handleUserImageTransform(node);
  };

  const dragBoundFunc = (pos) => {
    if (!userImageRef.current || !userImageAttrs || !printAreaRect) return pos;
    return calculateDragBounds(userImageRef.current, printAreaRect, pos);
  };

  const handleRemoveImage = () => {
    logToOverlay("Remove Image icon clicked.");
    setUserImageAttrs(null);
    setIsUserImageSelected(false);
    onImageRemove?.();
  };

  const handleRemoveBackgroundClick = async () => {
    if (!uploadedImageDataUrl || isRemovingBackground) {
      logToOverlay("Remove Background: No image data URL or already processing.");
      return;
    }
    
    try {
      const imageBlob = dataURLtoBlob(uploadedImageDataUrl);
      if (!imageBlob) {
        throw new Error("Failed to convert image data URL to Blob.");
      }

      const formData = new FormData();
      const fileExtension = imageBlob.type.split('/')[1] || 'png';
      const fileName = `image_to_process.${fileExtension}`;
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
          onBackgroundRemove?.(reader.result);
        }
      };
      
      reader.readAsDataURL(resultBlob);
    } catch (error) {
      logToOverlay(`Remove Background Error: ${error.message}`);
      console.error("Failed to remove background:", error);
    }
  };

  // Loading states
  const isAnyImageLoading = 
    (textureUrl && textureStatus === 'loading') ||
    (templateImageUrl && templateStatus === 'loading') ||
    (userImageUrl && userImgStatus === 'loading') ||
    isRemovingBackground || 
    trashIconStatus !== 'loaded' ||
    removeBgIconStatus !== 'loaded';

  // Calculate placeholder text color
  const placeholderFillColor = getContrastColor(selectedColor?.color_code);

  return (
    <div className={`${styles.konvaEditor} ${className}`}>
      <div
        ref={previewContainerRef}
        className={styles.previewContainer}
        style={{ position: 'relative' }}
      >
        <Stage 
          ref={stageRef} 
          width={stageSize.width} 
          height={stageSize.height}
          onClick={handleStageClick} 
          onTap={handleStageClick} 
        >
          {/* Background Layer */}
          <Layer name="backgroundLayer" listening={false}>
            <Rect
              x={0}
              y={0}
              width={stageSize.width}
              height={stageSize.height}
              fill={selectedColor?.color_code || '#f0f0f0'}
            />
            {textureUrl && textureImg && textureStatus === 'loaded' && (
              <Image
                image={textureImg}
                x={0}
                y={0}
                width={stageSize.width}
                height={stageSize.height}
              />
            )}
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
            <Fragment>
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
              
              {/* User Uploaded Image */}
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
                    logToOverlay(`Konva Image Error: Failed to render user image.`);
                    console.error("Konva Image Rendering Error:", e);
                  }}
                  draggable={!isRemovingBackground && userImageAttrs.draggable}
                  listening={!isRemovingBackground}
                  onDragMove={(e) => handleUserImageTransform(e.target)}
                  onTransform={(e) => handleUserImageTransform(e.target)}
                />
              )}

              {/* Placeholder Text */}
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
                  fill={placeholderFillColor}
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

              {/* Action Icons */} 
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
                  {removeBgIconStatus === 'loaded' && !isRemovingBackground && !hasBackgroundBeenRemoved && (
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
            </Fragment>
          </Layer>
        </Stage>

        {/* Loading Overlay */} 
        {isAnyImageLoading && (
          <div className={styles.loadingOverlay}>
            {isRemovingBackground ? 'Removing Background...' : 'Loading...'}
          </div>
        )}
      </div>

      {/* Out of Bounds Warning */}
      {isOutOfBounds && (
        <p className={styles.warningText}>Image is out of bounds and will be clipped.</p>
      )}
    </div>
  );
}