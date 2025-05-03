# Frontend Standup - Day 1

**Date:** 2025-05-04 (Adjust as needed)
**Developer:** Frontend AI (Gemini)

## Summary

Completed initial setup and core UI for the T-shirt designer based on Phase 1 & 2 frontend tasks from `docs/DEV_TIMELINE.md`. Integrated Farcaster Frame V2 basics, established styling, fetched and displayed product data from the backend API (`GET /api/products`), and implemented interactive variant selection (color) and commission setting. The basic page structure is in place, ready for the canvas editor integration.

## What was done today?

*   **Project Setup & Styling:**
    *   Configured project to use JavaScript and CSS Modules.
    *   Established base theme in `globals.css` using CSS variables (Inter/Playfair Display fonts, "high-end mall" color palette).
*   **Farcaster Frame V2 Integration:**
    *   Installed `@farcaster/frame-sdk`.
    *   Implemented `FrameInit` component and `initializeFrame` logic in `lib/frame.js`.
    *   Added necessary `fc:frame` metadata to `src/app/page.js` using `placehold.co` placeholders.
    *   Integrated `FrameInit` into `src/app/layout.js`.
*   **API Integration:**
    *   Created `lib/api.js` to fetch product data from `NEXT_PUBLIC_API_URL`.
    *   Successfully fetched and parsed data from the backend's `GET /api/products` endpoint in `src/app/page.js` (Server Component).
*   **Core UI (`ProductOptions.jsx` Client Component):**
    *   Displayed product name and base price (from selected color).
    *   Implemented interactive color swatch selection.
    *   Removed size selection UI (size is now handled internally/by buyer).
    *   Integrated clickable preview area for image upload (using hidden file input).
    *   Added commission selection using buttons (15%, 20%, 25%, 30%).
    *   Implemented price calculation based on `RAW_COST`, `PLATFORM_FEE`, and selected commission rate, displaying "Buyer pays" and "Your Earnings".
    *   Added placeholder image display and stubbed mockup generation triggered on file selection.
    *   Added "Publish Design" button (stubbed functionality).
*   **Layout & Responsiveness:**
    *   Simplified page header (`FC SWAG`).
    *   Arranged layout using CSS Modules and Flexbox/Grid, ensuring basic responsiveness and preventing horizontal overflow on mobile.
    *   Adjusted component spacing for a tighter layout.

## Blockers

*   None currently. Waiting on backend implementation for design creation, mockup generation, and publishing.

## Plan for Tomorrow (Day 2 - Start Phase 3 Frontend)

*   **Implement Canvas Editor (`FRONTEND_SPEC.md`):**
    *   Set up the dual-canvas system (editor/export) within the preview area.
    *   Integrate an image rendering library (e.g., Fabric.js or Konva) or implement native canvas logic.
    *   Implement basic image placement using the uploaded image data.
    *   Add direct manipulation controls (move, potentially scale/rotate later).
    *   Render the selected t-shirt color/image as the background (requires default images from backend - see notes).
    *   Constrain image movement/placement within the print area boundaries (requires boundary data from backend - see notes).
*   **Refine Upload/Mockup Flow:** Replace stubbed mockup generation with actual interaction logic once backend details are available.

---

## Notes for Backend Developer

1.  **Default T-Shirt Images:** To improve the user experience, please provide a way to fetch default images for the t-shirt (e.g., based on the `product_id` and `color_code` or `variant_id`). We need these to display in the canvas *before* the user uploads their art, so they can see the selected t-shirt color they are designing on.
2.  **Print Area Boundaries:** For the canvas editor, we need the specific printable area coordinates/dimensions for the front of the t-shirt (e.g., top-left x/y, width, height in pixels relative to a standard template size or DPI). Please add this information to the product/variant data returned by the API, or provide a separate endpoint. 