/**
 * Image utility functions for canvas and data manipulation
 */

/**
 * Convert Data URL to Blob
 * @param {string} dataurl - Data URL string
 * @returns {Blob|null} - Converted blob or null if conversion fails
 */
export function dataURLtoBlob(dataurl) {
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
    
    return new Blob([u8arr], {type: mime});
  } catch (e) {
    console.error("Error converting Data URL to Blob:", e);
    return null;
  }
}

/**
 * Load an image from a URL and return a Promise
 * @param {string} url - Image URL or data URL
 * @returns {Promise<HTMLImageElement>} - Promise that resolves to loaded image
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
    img.crossOrigin = 'anonymous';
  });
}

/**
 * Calculate image bounds relative to a container
 * @param {Object} imageNode - Konva image node
 * @param {Object} containerRect - Container rectangle {x, y, width, height}
 * @param {number} tolerance - Tolerance for bounds checking
 * @returns {boolean} - True if image is out of bounds
 */
export function isImageOutOfBounds(imageNode, containerRect, tolerance = 1) {
  if (!imageNode || !containerRect) return false;
  
  const bounds = imageNode.getClientRect({ relativeTo: imageNode.getLayer() });
  
  return (
    bounds.x < containerRect.x - tolerance ||
    bounds.y < containerRect.y - tolerance ||
    bounds.x + bounds.width > containerRect.x + containerRect.width + tolerance ||
    bounds.y + bounds.height > containerRect.y + containerRect.height + tolerance
  );
}

/**
 * Calculate drag boundaries to keep image within container
 * @param {Object} imageNode - Konva image node
 * @param {Object} containerRect - Container rectangle
 * @param {Object} pos - Proposed position {x, y}
 * @returns {Object} - Constrained position {x, y}
 */
export function calculateDragBounds(imageNode, containerRect, pos) {
  if (!imageNode || !containerRect) return pos;
  
  const scaleX = imageNode.scaleX();
  const scaleY = imageNode.scaleY();
  const imgWidth = imageNode.width() * scaleX;
  const imgHeight = imageNode.height() * scaleY;
  
  // Calculate boundaries for the image's CENTER point
  const minX = containerRect.x + imgWidth / 2;
  const maxX = containerRect.x + containerRect.width - imgWidth / 2;
  const minY = containerRect.y + imgHeight / 2;
  const maxY = containerRect.y + containerRect.height - imgHeight / 2;
  
  // Clamp the position
  const newX = Math.max(minX, Math.min(pos.x, maxX));
  const newY = Math.max(minY, Math.min(pos.y, maxY));
  
  // Handle cases where image is larger than container
  const finalX = (imgWidth > containerRect.width) ? pos.x : newX; 
  const finalY = (imgHeight > containerRect.height) ? pos.y : newY;
  
  return {
    x: isNaN(finalX) ? pos.x : finalX,
    y: isNaN(finalY) ? pos.y : finalY,
  };
}