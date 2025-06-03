# Poster Implementation Guide

## Overview

Posters in our system support two types:
- **Matte Poster** (Product ID: 1) - Enhanced Matte Paper
- **Glossy Poster** (Product ID: 171) - Premium Luster Photo Paper

Both types offer similar size options with various aspect ratios.

## Available Sizes by Aspect Ratio

### Square (1:1)
- 10″×10″
- 12″×12″
- 14″×14″
- 16″×16″
- 18″×18″

### Portrait 2:3 (0.667)
- 12″×18″
- 20″×30″
- 24″×36″

### Portrait 3:4 (0.75)
- 12″×16″
- 18″×24″

### Portrait 4:5 (0.8)
- 8″×10″
- 16″×20″

### Other Portrait Sizes
- 5″×7″ (0.714)
- 11″×14″ (0.786)
- A1: 23.3″×33.1″ (0.706) - Matte only
- A2: 16.5″×23.3″ (1.414) - Matte only, landscape

## Frontend Implementation Strategy

When a user uploads an image for a poster:

1. **Calculate the image aspect ratio**
   ```javascript
   const aspectRatio = imageWidth / imageHeight;
   ```

2. **Determine available sizes based on aspect ratio**
   - For square images (ratio ~1.0): Show square sizes
   - For portrait images: Match to closest aspect ratio group
   - For landscape images: Either rotate to portrait or limit options

3. **Aspect Ratio Matching Logic**
   ```javascript
   function getAvailableSizes(imageAspectRatio) {
     const tolerance = 0.05; // 5% tolerance
     
     // Define size groups
     const sizeGroups = {
       square: { ratio: 1.0, sizes: ['10×10', '12×12', '14×14', '16×16', '18×18'] },
       portrait_2_3: { ratio: 0.667, sizes: ['12×18', '20×30', '24×36'] },
       portrait_3_4: { ratio: 0.75, sizes: ['12×16', '18×24'] },
       portrait_4_5: { ratio: 0.8, sizes: ['8×10', '16×20'] }
     };
     
     // Find matching groups
     const matches = Object.values(sizeGroups).filter(group => 
       Math.abs(group.ratio - imageAspectRatio) <= tolerance
     );
     
     return matches.flatMap(group => group.sizes);
   }
   ```

## Database Considerations

Posters use dynamic dimension calculation:
- No margins (full bleed printing)
- Template dimensions = print dimensions
- Each variant stores its own dimensions in pixels (300 DPI)

## API Response Example

When fetching poster products, the API returns:
```json
{
  "id": 1,
  "name": "Enhanced Matte Paper Poster",
  "image_url": "https://fc-swag-images.kasra.codes/products/product_1_main.jpg",
  "colors": [{
    "color_name": "White",
    "variants": [
      {
        "size": "12″×18″",
        "template_width": 3600,
        "template_height": 5400,
        "print_area_width": 3600,
        "print_area_height": 5400
      }
    ]
  }]
}
```

## Import Considerations

When importing posters:
1. All variants are imported (no color filtering)
2. Dimensions are calculated from placement_dimensions
3. No template overlays needed (unlike t-shirts)
4. Product image is downloaded and hosted on R2

## Recommended Frontend Flow

1. User selects "Create Poster"
2. User uploads image
3. System calculates image aspect ratio
4. System shows only compatible poster sizes
5. User selects size and poster type (matte/glossy)
6. Design editor shows exact dimensions
7. User positions/scales image to fit
8. System generates mockup and publishes

## Notes

- Posters are portrait-oriented (except A2)
- For landscape images, consider auto-rotating or warning users
- Minimum resolution recommendations:
  - Small sizes (8×10): 2400×3000px minimum
  - Medium sizes (18×24): 5400×7200px minimum
  - Large sizes (24×36): 7200×10800px minimum