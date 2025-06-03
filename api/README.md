# FC Swag Frame API

This is the backend API for FC Swag Frame, a platform that allows artists to create and sell custom designs on various products through Printful integration.

## Prerequisites

- Node.js 23+ and npm/bun
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with D1 and R2 access
- Printful API key

## Setup

1. Install dependencies:
```bash
npm install
# or
bun install
```

2. Create a `.dev.vars` file with required secrets:
```bash
PRINTFUL_API_KEY="your_printful_api_key"
ADMIN_AUTH_KEY="your_admin_secret"
AUTH_SECRET="your_auth_secret"
R2_PUBLIC_URL="https://your-r2-bucket-url.com"
```

3. Initialize the database (first time only):
```bash
wrangler d1 execute fc_swag --local --file schema.sql
```

## Development

Start the development server:
```bash
wrangler dev
```

The API will be available at `http://localhost:8787`.

## Database Management

### Reset Database

To completely reset the database and start fresh:

```bash
# Clear all data from tables (preserves schema)
wrangler d1 execute fc_swag --local --command "DELETE FROM designs; DELETE FROM product_variants; DELETE FROM products;"

# Or to completely recreate the database structure:
# Note: This may fail if triggers already exist
wrangler d1 execute fc_swag --local --file schema.sql
```

### Import Products

The system supports importing products from Printful. Currently configured products:

- **T-Shirt (ID: 586)**: Unisex Garment-Dyed Heavyweight T-Shirt
  - Limited to 8 colors: Berry, Black, Blue Jean, Brick, Grey, Moss, True Navy, White
  - 4 sizes: S, M, L, XL
  - Product image downloaded and hosted on R2
  
- **Sticker Sheet (ID: 505)**: Kiss-Cut Sticker Sheet
  - Single variant (5.83"×8.27")
  - White color only
  
- **Kiss-Cut Stickers (ID: 358)**: Individual stickers
  - 3 size variants (3"×3", 4"×4", 5.5"×5.5")
  - Rectangular variants are automatically filtered out
  - White color only

- **Matte Poster (ID: 1)**: Enhanced Matte Paper Poster
  - 16 size variants (from 5"×7" to 24"×36")
  - Various aspect ratios for different image formats
  - Full bleed printing (no margins)

- **Glossy Poster (ID: 171)**: Premium Luster Photo Paper Poster
  - 14 size variants (from 5"×7" to 24"×36")
  - Similar sizes to matte poster
  - Full bleed printing (no margins)

To import products via the admin API:

```bash
# Import T-Shirt
curl -X POST http://localhost:8787/api/admin/import-product/586 \
  -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" \
  -H "Content-Type: application/json"

# Import Sticker Sheet
curl -X POST http://localhost:8787/api/admin/import-product/505 \
  -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" \
  -H "Content-Type: application/json"

# Import Kiss-Cut Stickers
curl -X POST http://localhost:8787/api/admin/import-product/358 \
  -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" \
  -H "Content-Type: application/json"

# Import Matte Poster
curl -X POST http://localhost:8787/api/admin/import-product/1 \
  -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" \
  -H "Content-Type: application/json"

# Import Glossy Poster
curl -X POST http://localhost:8787/api/admin/import-product/171 \
  -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" \
  -H "Content-Type: application/json"
```

Replace `YOUR_ADMIN_AUTH_KEY` with the value from your `.dev.vars` file.

### Complete Reset and Import

To perform a complete reset and reimport all products:

```bash
# 1. Clear all data
wrangler d1 execute fc_swag --local --command "DELETE FROM designs; DELETE FROM product_variants; DELETE FROM products;"

# 2. Import all products (replace YOUR_ADMIN_AUTH_KEY)
curl -X POST http://localhost:8787/api/admin/import-product/586 -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" -H "Content-Type: application/json"
curl -X POST http://localhost:8787/api/admin/import-product/505 -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" -H "Content-Type: application/json"
curl -X POST http://localhost:8787/api/admin/import-product/358 -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" -H "Content-Type: application/json"
curl -X POST http://localhost:8787/api/admin/import-product/1 -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" -H "Content-Type: application/json"
curl -X POST http://localhost:8787/api/admin/import-product/171 -H "X-Admin-Secret: YOUR_ADMIN_AUTH_KEY" -H "Content-Type: application/json"
```

## API Endpoints

### Public Endpoints

- `GET /api/products` - List all products with variants
- `GET /api/products/:product_id/variants` - Get variants for a specific product
- `GET /api/feed` - Get published designs feed
- `GET /api/designs/:design_id` - Get public design details

### Protected Endpoints (require authentication)

- `POST /api/designs` - Create a new design
- `GET /api/designs` - List user's designs
- `POST /api/designs/:design_id/publish` - Publish a design with royalty settings
- `POST /api/designs/:design_id/mockup` - Generate mockup for a design

### Admin Endpoints (require X-Admin-Secret header)

- `POST /api/admin/import-product/:productId` - Import a product from Printful
- `POST /api/admin/seed-product` - Legacy seeding endpoint (deprecated)

## Database Schema

The system uses three main tables:

- **products**: Base product information
  - Includes `image_url` field for product images hosted on R2
  - Images are downloaded from Printful during import
- **product_variants**: Color/size combinations with pricing and template data
  - Template dimensions calculated dynamically for stickers and posters
  - Mockup templates stored for t-shirts
- **designs**: User-created designs with mockups and publishing info

See `schema.sql` for the complete database structure.

## Scheduled Tasks

The system includes a daily scheduled task (configured in `wrangler.toml`) that updates product prices and inventory from Printful. This runs automatically at midnight UTC.

## Deployment

Deploy to Cloudflare Workers:

```bash
wrangler deploy
```

For production, ensure all environment variables are set:

```bash
wrangler secret put PRINTFUL_API_KEY
wrangler secret put ADMIN_AUTH_KEY
wrangler secret put AUTH_SECRET
```

## Troubleshooting

### Database Issues

If you encounter "trigger already exists" errors when running schema.sql:
```bash
# Just clear the data instead of recreating schema
wrangler d1 execute fc_swag --local --command "DELETE FROM designs; DELETE FROM product_variants; DELETE FROM products;"
```

### Import Failures

If product imports fail:
1. Check your Printful API key is valid
2. Ensure R2 bucket is configured and accessible
3. Check the console logs for specific error messages
4. Verify the product ID exists in Printful's catalog

### Development Server

If the development server won't start:
1. Check if port 8787 is already in use
2. Try a different port: `wrangler dev --port 8788`
3. Ensure all required environment variables are in `.dev.vars`

## Security Notes

- Never commit `.dev.vars` or expose API keys
- The admin endpoints require the `X-Admin-Secret` header
- User authentication uses JWT tokens stored in HTTP-only cookies
- All Printful API calls are made server-side to protect the API key