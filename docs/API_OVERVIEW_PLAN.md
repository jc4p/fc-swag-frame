# API Overview & Plan

This document outlines the HTTP API endpoints, authentication, pricing logic, and data interactions for the Cloudflare Worker (api/), integrating with D1, Durable Objects, and Printful.

## 1. Assumptions
- **Authentication**: Uses Sign-In-With-Farcaster to issue JWTs. Public endpoints are open; protected endpoints require `Authorization: Bearer <JWT>` where the JWT payload contains the user’s FID.
- **Database**: D1 schema as per INITIAL_DB_PLAN.md.
- **Pricing**:
  - RAW_COST = 14.99 USD
  - PLATFORM_FEE = 4 USD
  - ARTIST_ROYALTY = 15–30% (chosen at publish)
  - `retail_price = roundUpTo99((RAW_COST + PLATFORM_FEE) / (1 - royalty_percent/100))`
  - `shipping_cost` added from Printful or fixed per product.

## 2. Authentication
- **Sign-In-With-Farcaster** flow:
  1. **POST /api/auth/signin**: Verifies a SIWF message (`message`, `signature`, `nonce`) via `@farcaster/auth-client` and returns a JWT (HS256, signed with `AUTH_SECRET`).
  2. Protected endpoints must include `Authorization: Bearer <JWT>`; the JWT’s `sub` claim is the user’s FID.

## 3. Pricing Logic
- On design publish, compute:
  - `artist_earn = retail_price * royalty_percent/100`
  - `platform_profit = retail_price - RAW_COST - artist_earn`

## 4. Endpoints

### 4.1 Public Endpoints
- **POST /api/auth/signin**
  - Verify SIWF message and signature; issue JWT token.
  - Body: `{ message, signature, nonce }`
  - Response: `{ success: true, token, fid }`

- **GET /api/products?active=true**
  - List active products with variants.
  - Response: `[{ id, name, slug, variants:[{ id, color_name, inventory_count }] }]`
- **GET /api/products/:product_id/variants**
  - List variants for a product.
- **GET /api/designs/:design_id**
  - Fetch a public design’s details (`is_public=true`).
- **GET /api/feed?page=&limit=**
  - Paginated list of public designs sorted by `published_at`.

### 4.2 Protected Endpoints (Frame-authenticated)
- **GET /api/designs**
  - List designs created by requester.
- **POST /api/designs**
  - Create a design.
  - Body: `{ product_id, variant_id, image_url, metadata }`
  - Inserts into `designs`; enqueue mockup job in Durable Object.
- **POST /api/designs/:design_id/publish**
  - Publish design and set royalty.
  - Body: `{ royalty_percent }` (15–30)
  - Computes pricing; updates `designs` fields and `is_public=true`.
- **GET /api/orders**
  - List orders for requester.
- **POST /api/orders**
  - Create an order when buyer clicks “Buy.”
  - Body: `{ design_id, shipping_details }`
  - Verify inventory; decrement `product_variants.inventory_count`.
  - Create Printful order; insert into `orders`.
- **GET /api/orders/:order_id/signature**
  - Generates an Ethereum-signed payload (EIP-712) for USDC payment.
  - Payload: `{ order_id, buyer_fid, amount: retail_price + shipping_cost, royalty_percent }`
  - Signed by platform private key.

### 4.3 Webhooks & WebSockets
- **POST /api/webhooks/printful**
  - Handle Printful callbacks for mockups and order status.
  - Update `designs.mockup_url` or `orders.status`; notify session Durable Object.
- **GET /api/ws**
  - Upgrade to WebSocket; attach to session Durable Object for real-time notifications.

## 5. Data Interactions
| Endpoint                        | DB Tables                        | Durable Object             |
|---------------------------------|----------------------------------|----------------------------|
| GET /api/products*              | `products`, `product_variants`   |                            |
| POST /api/designs               | `designs`                        | enqueue mockup task       |
| POST /api/designs/:id/publish   | `designs`                        |                            |
| POST /api/orders                | `orders`, `product_variants`     |                            |
| GET /api/orders/:id/signature   | `orders`, `designs`              |                            |
| POST /api/webhooks/printful     | `designs`, `orders`              | session notifications      |
| GET /api/ws                     |                                  | session management         |

## 6. Next Steps
- Monitor on-chain USDC payments post-signature.
- Add order fulfillment notifications and retry logic.
- Integrate background removal and advanced filters.
- Expand to multiple product styles and dynamic shipping.