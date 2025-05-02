# T-Shirt Designer Tool: Implementation Specification

## Project Overview
We're building a mobile-friendly web application that allows users to upload images, position them on a t-shirt template, and generate a high-quality mockup that integrates with our print-on-demand API. The interface needs to be intuitive, with direct manipulation controls rather than form inputs.

## Technical Goals
1. Allow users to upload images and directly manipulate them on a t-shirt template
2. Support high-resolution outputs (minimum 150 DPI for print quality)
3. Enable users to place, scale, rotate, and position images within a designated safe area
4. Provide an optional background removal feature
5. Generate high-quality mockups via our existing mockup generator API
6. Maintain compatibility with our current Cloudflare Workers/D1/Durable Objects backend

## Technical Approach
We'll implement a dual-canvas system:
- **Editor Canvas**: Visible, optimized for performance and interaction
- **Export Canvas**: Hidden, high-resolution for final output generation

This approach keeps our backend simple while still delivering print-quality outputs.

## Implementation Steps

### 1. Canvas Setup & Template
- Create two canvas elements in the DOM (one visible, one hidden)
- Implement t-shirt template rendering with a clearly defined safe area
- Set appropriate aspect ratios and dimensions for both canvases

### 2. Image Upload System
- Implement file upload via input or drag-and-drop
- Store original high-resolution image in memory
- Display a scaled version on the editor canvas
- Add validation for minimum dimensions relative to print requirements

### 3. Direct Manipulation Interface
- Implement pointer event listeners for cross-device compatibility
- Create an interaction state machine (Idle, Moving, Scaling, Rotating)
- Add visual manipulation handles for intuitive control:
  - Draggable image body for repositioning
  - Corner handles for scaling
  - Rotation handle extending from center
- Implement touch gestures (pinch-zoom, two-finger rotation)

### 4. Transformation Engine
- Track all transformations in a unified transformation matrix
- Apply transformations to the canvas context during rendering
- Implement efficient hit detection accounting for transformations

### 5. High-Resolution Export
- When design is finalized, create hidden high-res canvas
- Apply same transformations to original image at full resolution
- Export as PNG and transmit to backend API

### 6. Backend Integration
- Send final image data to existing Cloudflare Workers endpoint
- Store design metadata in D1
- Generate and return mockup URL from the API

## Technical Rationale

### Why Client-Side Processing?
- **Reduces Backend Load**: Offloads image manipulation to client devices
- **Lower Latency**: No waiting for server processing during design phase
- **Simplified Infrastructure**: Works with our existing Cloudflare stack without modifications
- **Better UX**: Real-time feedback without server round-trips

### Why Direct Manipulation vs. Form Controls?
- **Intuitive Experience**: Users can directly interact with their design
- **Mobile-Friendly**: Touch gestures map naturally to transformations
- **Reduced Cognitive Load**: No need to understand numeric values for positioning
- **WYSIWYG**: What users see is directly what they'll get in the final product

### Why Dual Canvas Approach?
- **Performance**: Editor canvas can be optimized for smooth interaction
- **Print Quality**: Export canvas maintains full resolution for 150+ DPI printing
- **Memory Efficiency**: Only create high-res canvas during final export

## Technical Considerations

### Performance Optimizations
- Use `requestAnimationFrame` for smooth canvas rendering
- Implement efficient hit testing algorithms
- Optimize image scaling during design phase

### Memory Management
- Revoke object URLs when no longer needed
- Clear resources from memory appropriately
- Handle large image uploads responsibly

### Validation Requirements
- Minimum image dimensions based on print area and DPI
- File format and size limitations
- Visual feedback for design constraints

### Browser Compatibility
- Focus on modern browsers with good canvas support
- Implement fallbacks for pointer events if needed
- Test thoroughly on both desktop and mobile browsers

## Timeline Estimates
- Canvas setup and image upload: 2-3 days
- Direct manipulation implementation: 3-5 days
- High-res export system: 1-2 days
- Backend integration: 1-2 days
- Testing and refinement: 2-3 days

## Next Steps
1. Create basic prototype with canvas rendering
2. Implement image upload and basic positioning
3. Build out direct manipulation controls
4. Add high-resolution export functionality
5. Integrate with backend API
6. Test with various image sizes and devices
