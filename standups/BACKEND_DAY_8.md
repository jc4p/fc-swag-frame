# Backend Day 8 Standup - December 6, 2025

## What I Got Done Today

### Fixed Sticker Sheet Dimensions Issue
- **Problem**: Frontend getting 728×728 instead of rectangular dimensions
- **Root cause**: Was using hardcoded values instead of Printful's actual data
- **Fix**: Converted to dynamic calculation using `placement_dimensions` from variants API
- **Result**: Now returns 1899×2631px (5.83″×8.27″ at 300 DPI)

### Added Kiss-Cut Stickers (Product 358)
- Implemented dynamic sizing for square stickers: 3″×3″, 4″×4″, 5.5″×5.5″
- Filtered out rectangular 15″×3.75″ variant as requested
- Each size gets calculated dimensions (e.g., 975×975px for 3″×3″)
- Pricing: $2.29, $2.49, $2.69

### Built Design Publishing System
- `POST /api/designs/:design_id/publish` with royalty validation (15-30%)
- Pricing calculation: `roundUpTo99((raw_cost + $4) / (1 - royalty%))`
- Updates DB with `is_public`, `published_at`, `retail_price`, `artist_earn`
- Example: $2.29 sticker → $7.99 retail with 20% royalty

### Implemented Public Feed
- `GET /api/feed?page=1&limit=20` with pagination
- Returns published designs with product/variant details
- Sorted by newest first, includes artist earnings data

### Improved Product Sync
- Made both sticker products (358, 505) use dynamic `placement_dimensions`
- Updated pricing: T-shirts $14.95→$15.29, Stickers $4.95→$5.05
- Scheduled sync now maintains accurate dimensions automatically

## Current Product Status
- **T-Shirts (586)**: 32 variants, uses mockup templates
- **Sticker Sheet (505)**: 1 variant, dynamic calc
- **Kiss-Cut Stickers (358)**: 3 variants, dynamic calc

## What To Work On Next

### Posters (High Priority) 
- **Challenge**: Dynamic sizing unlike fixed sticker sizes
- Need to find Printful product IDs for matte/glossy posters
- Handle multiple size variants (12×18, 18×24, 24×36, etc.)
- Frontend will need size recommendation logic based on upload resolution

### Investigation Tasks
```bash
# Check how poster sizing works
curl "https://api.printful.com/v2/catalog-products/{ID}/catalog-variants"
curl "https://api.printful.com/v2/catalog-products/{ID}/sizes"
```

### Missing Sticker Variants
- Only got 3 of 5 square Kiss-Cut sizes
- Missing 2″×2″ and 6″×6″ (exist in pricing as variants 22522, 22523)
- Need to figure out why they're not in variants API response

### Technical Notes for Tomorrow
- Poster template calculation will need to extend current `calculateStickerDimensions()`
- May need different margin logic for posters vs stickers
- Consider how frontend will handle size selection UI for many poster options
- Database schema already supports everything needed

## Code Changes Made
- `src/seed.js`: Added dynamic sticker calculation, removed hardcoded 505 data
- `src/routes/protected.js`: Implemented publishing endpoint with pricing logic
- `src/routes/public.js`: Built paginated feed endpoint
- Both sticker products now use same calculation approach

## Frontend Notes
- All publishing endpoints are ready for integration
- Sticker sheet dimensions fixed - should work properly now
- Feed endpoint returns artist earnings and pricing data for display
- Background removal already confirmed working