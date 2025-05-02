 # Development Phases & Sprints for Rapid MVP

 **Team**: 2 Developers (1 Front-End, 1 Back-End)

 **Objective**: Lightning-fast MVP with iterative prototypes—validate core flows first, then refine and harden.

---
## Current Status
- Front-End: Next.js app scaffold under `src/app` with default landing page and layout (JavaScript only).
- Front-End: `package.json` includes Next.js, React, React-DOM; `jsconfig.json` and `next.config.mjs` configured.
- API: Cloudflare Worker scaffold under `api/` using Hono (`api/src/index.js`) with root route; `wrangler.toml` present.
- Dependencies installed: `hono`, `wrangler`, and core Next.js/React packages.
- Pending: D1 binding, Durable Objects, and database migrations.
- Pending: Frame SDK integration for Farcaster Frame V2.
---

## Phase 1 (Days 1–2): Core Setup
**Goals**: Enable Frame context, database access, and authentication stub.

Front-End:
- Install `@farcaster/frame-sdk` and add a `FrameInit` component integrated in `src/app/layout.js`.
- Implement Sign-In-With-Farcaster flow using Frame SDK context to retrieve user FID and stub JWT exchange.
- Update landing page to minimal project branding (keep existing JS files).

Back-End:
- Configure `api/wrangler.toml` to bind the D1 database and Durable Object namespaces.
- Implement initial D1 setup: create tables (products, product_variants) and seed a basic catalog.
- Stub auth endpoint (`POST /api/auth/signin`) to verify SIWF messages and issue JWTs via middleware.

---

## Phase 2 (Days 3–4): Product API & Picker
**Goals**: Core catalog flow wired; front-end can list & select products.

Back-End:
- `GET /api/products?active=true` + `/api/products/:id/variants`
- Validate responses; integrate with D1 seeded data

Front-End:
- Product list page: fetch `/api/products` + variants
- UI to select product + color variant, save selection in state

---

## Phase 3 (Days 5–8): Canvas Editor & Design Intake
**Goals**: Core design flow—upload, position, submit a design draft.

Front-End:
- Dual-canvas editor per FRONTEND_SPEC.md
- Image upload + basic move/scale/rotate
- “Save Design” triggers stubbed `POST /api/designs`

Back-End:
- `POST /api/designs`: validate, insert into D1, return `designId`
- Stub/mock Durable Object enqueue (no external API yet)

## Phase 4 (Days 9–11): Mockup Generation Prototype
**Goals**: Connect to Printful; display real mockups.

Back-End:
- Implement Durable Object queue, call Printful mockup API
- Webhook route (`/api/webhooks/printful`), update record, notify session
- WebSocket endpoint (`/api/ws`) for live updates

Front-End:
- “Generate Mockup” → actual `POST /api/designs`
- Listen on WS or poll `/api/designs/:id` for `mockup_url`
- Render mockup image when ready

---

## Phase 5 (Days 12–14): Ordering & Payment Flow
**Goals**: End-to-end purchase—orders to Printful & payment signature.

Back-End:
- `POST /api/orders`: validate, decrement inventory, create Printful order
- `GET /api/orders/:id/signature`: generate EIP-712 payload
- `GET /api/feed`: fetch public designs

Front-End:
- Checkout UI: shipping form → `/api/orders`
- Display order confirmation + payment details
- Public gallery page: list designs from `/api/feed`

## Phase 6 (Days 15–17): Polishing & Extras
**Goals**: Polish UX, add background removal, on-chain contract tests, CI/process.

Both:
- Integrate background-removal API or stub
- Write smoke tests for auth, design, mockup, order flows
- Test on-chain USDC signature + contract interaction
- Responsive tweaks, error handling, accessibility review
- Deploy to staging/preview, gather feedback