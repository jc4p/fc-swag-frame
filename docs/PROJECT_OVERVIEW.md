# Project Overview

This project provides a Farcaster Frame V2–based T-shirt designer and on-demand printing workflow:

- **Front-end**: a Next.js app (app router) running inside a Farcaster Frame  
- **Back-end**: a Cloudflare Worker (api/) hosting all HTTP endpoints, Durable Objects, task queue and D1  
- **POD**: Printful for mockup generation and final order fulfillment  

## MVP Goals

- **Authentication** via Frame V2 (user’s FID)  
- **Image upload & direct manipulation** (move, scale, rotate) in a safe print area at 150 DPI+  
- **Mockup generation** through Printful’s mockup API  
- **Curated product catalog** stored in D1 (start with one T-shirt style, multiple colors)  
- **Inventory tracking** in D1 (a table listing available color stock)  
- **Public landing page** where anyone can preview and place an order  

## End-to-End Flow

1. User opens Warpcast Frame → Frame SDK provides FID context.  
2. Next.js UI (dual-canvas per FRONTEND_SPEC.md) lets them upload and place their image.  
3. On “Generate Mockup” click, client POSTs to Worker API (`POST /api/designs`).  
4. Worker:
   - Validates FID, image metadata & product choice  
   - Inserts a minimal record into D1 (design_id, FID, product_id, variant_id)  
   - Enqueues a mockup job in an in-memory queue (Durable Object)  
5. Durable Object invokes Printful’s mockup endpoint.  
6. Printful calls back your Worker webhook with a mockup URL.  
7. Durable Object updates D1 record with mockup URL and notifies any listening client.  
8. Next.js app renders the mockup and offers “Publish & Sell.”  
9. On “Publish,” Next.js fetches `/api/publish?designId=…` → Worker updates D1 to mark it public.  
10. Front-end renders a public product page listing the design with a “Buy” button that calls `/api/order` → Worker creates the Printful order.  

## Architecture

```text
┌────────────┐   Frame V2    ┌─────────────┐    Durable    ┌──────────┐
│ Next.js    │◄────────────►│ Cloudflare  │◄────────────►│ Printful │
│ Frontend   │ Auth, UI,    │ Worker      │  Objects,    │ API      │
│ (app router)│ Canvas      │ (Hono)      │  Queue       └──────────┘
└────────────┘ Integration   └─────────────┘  & D1          
```  

### Frontend (Next.js + Frame)

- **Frame Integration** (see FRAME_INTEGRATION.md)  
- **Canvas Designer** (see FRONTEND_SPEC.md)  
- Calls Worker endpoints for products, designs, mockups & orders  

### Backend (Cloudflare Worker)

- Uses **Hono** for routing (`api/`)  
- **D1** tables:
  - `products(product_id, name, color, printful_sku, inventory_count)`  
  - `designs(design_id, fid, product_id, variant_id, mockup_url, is_public)`  
- **Durable Object** for session & task queue (PRINT_INTEGRATION.md)  
- **Webhook** route for Printful callbacks  
- All business logic and data stays in the Worker—Next.js only renders the UI  

### Printful Integration

- **Mockup Generation** via Printful’s “create mockup” API  
- **Order Creation** via Printful’s “create order” API  
- We manage a **fixed product catalog** in D1, starting with a single T-shirt style in multiple colors, tracking inventory in D1  

## MVP Scope

- Single T-shirt style support  
- Color selection from D1-backed catalog  
- FID-based auth only (no email/password)  
- Minimal D1 schema to track products, inventory, designs  
- Public design feed powered by D1 queries  

## Next Steps (Post-MVP)

- Add background removal, filters, advanced photo tools  
- Support multiple product styles (mugs, hoodies, etc.)  
- Build user galleries, saved designs (D1/KV)  
- Analytics, conversion tracking, email notifications  
- Auto-replenish inventory or real-time stock sync  

---

*This overview ties FRAME_INTEGRATION.md, PRINT_INTEGRATION.md, and FRONTEND_SPEC.md into a cohesive roadmap for our print-on-demand T-shirt designer MVP.*