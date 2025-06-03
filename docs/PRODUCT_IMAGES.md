# Product Images from Printful API

## Overview

Printful provides product images through multiple endpoints. Here's how to access them:

## Image Sources

### 1. Main Product Image
Each product has a main image available in the product data:
- **Endpoint**: `GET /v2/catalog-products/{id}`
- **Field**: `data.image`
- **Example**: `https://files.cdn.printful.com/upload/product-catalog-img/6d/6d7501c1e4b984392a258054bf0cd145_l`

### 2. Variant-Specific Images
Each variant (color/size combination) has its own product photo:
- **Endpoint**: `GET /v2/catalog-products/{id}/catalog-variants`
- **Field**: `data[].image`
- **Example**: `https://files.cdn.printful.com/products/586/15118_1731495529.jpg`

### 3. Model/Lifestyle Images
Model wearing the product in different angles and poses:
- **Endpoint**: `GET /v2/catalog-products/{id}/images`
- **Structure**: Array of colors, each with multiple placement images
- **Example**: `https://files.cdn.printful.com/m/comfortcolors_1717/medium/mens/front/05_cc1717_onman_front_base_whitebg.png`

## Current Product Images

### T-Shirt (ID: 586)
- **Main Image**: https://files.cdn.printful.com/upload/product-catalog-img/6d/6d7501c1e4b984392a258054bf0cd145_l
- **Variant Images** (examples):
  - Berry: https://files.cdn.printful.com/products/586/15160_1652871214.jpg
  - Black: https://files.cdn.printful.com/products/586/15118_1731495529.jpg
  - Blue Jean: (fetch from API)
  - Brick: (fetch from API)
  - Grey: (fetch from API)
  - Moss: (fetch from API)
  - True Navy: (fetch from API)
  - White: (fetch from API)

### Sticker Sheet (ID: 505)
- **Main Image**: https://files.cdn.printful.com/upload/product-catalog-img/76/7658fa12bc07c99e823fbc140595bc24_l
- **Variant Image**: https://files.cdn.printful.com/products/505/12917_1629116996.jpg

### Kiss-Cut Stickers (ID: 358)
- **Main Image**: https://files.cdn.printful.com/products/358/product_1553084472.jpg
- **Variant Images** (by size):
  - 3"×3": https://files.cdn.printful.com/products/358/10163_1553083889.jpg
  - 4"×4": (fetch from API)
  - 5.5"×5.5": (fetch from API)

## Implementation Options

### Option 1: Store Images During Import (Recommended)
Add image URLs to the database during product import:
1. Extend the `products` table with `main_image_url` field
2. Extend the `product_variants` table with `product_image_url` field
3. Update the import process to fetch and store these URLs

### Option 2: Fetch Images On-Demand
Create an API endpoint that fetches images from Printful when needed:
- `GET /api/products/:id/images` - Returns all available images for a product
- Pros: Always up-to-date
- Cons: Slower, requires Printful API calls

### Option 3: Use Existing Variant Data
The variant data already includes image URLs in the API response. We just need to expose them:
- Modify `/api/products` endpoint to include variant images
- The URLs are already being fetched but not stored

## Next Steps

1. Decide which approach to use for serving product images
2. Update the API to include image URLs in responses
3. Frontend can then use these URLs instead of placeholder images

## Note on Image Types

Printful provides different image types:
- **Product photos**: Clean product shots on white background
- **Model photos**: Products worn by models
- **Lifestyle photos**: Products in real-world settings
- **Mockup templates**: Used for generating custom designs

For the product selection page, the variant-specific product photos (on white background) are probably most appropriate.