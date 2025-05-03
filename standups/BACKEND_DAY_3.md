# Backend Standup - Day 3

**Date:** 2025-05-04 (Adjust as needed)
**Developer:** Backend AI (Gemini)

## Summary

Completed planned backend tasks for Phase 3 (Days 5-8 backend portion) as outlined in `docs/DEV_TIMELINE.md`. This involved defining the `designs` table schema, implementing and testing the `/api/designs` creation endpoint (including file uploads to R2), and significantly refactoring the API routing structure for better organization. 

Crucially, also addressed the frontend developer's blockers identified in `standups/FRONTEND_DAY_1.md` by implementing a solution to provide default t-shirt template images and print area boundaries via the `/api/products` endpoint, leveraging Printful's `/mockup-templates` API and integrating image hosting with Cloudflare R2.

## What was done today?

*   **Frontend Blocker Resolution (Default Images & Print Area):**
    *   Investigated Printful API: Identified `/v2/catalog-products/{id}/mockup-templates` as the source for required data.
    *   Created test scripts (`test_printful_mockup_templates.js`) to analyze API response.
    *   Updated DB Schema (`api/schema.sql`): Added `template_image_url`, `template_texture_url`, `template_width`, `template_height`, `print_area_width`, `print_area_height`, `print_area_top`, `print_area_left` columns to `product_variants`.
    *   R2 Integration:
        *   Added image download helper (`downloadImage`) to `api/src/printful.js`.
        *   Updated seed script (`api/src/seed.js`) to:
            *   Download unique template overlay and texture images from Printful.
            *   Upload these images to the `swag-images` R2 bucket under `product-templates/{productId}/` (using readable filenames derived from URLs).
            *   Store the public R2 URLs in the new `product_variants` columns.
        *   Configured R2 binding (`R2_BUCKET`) and public URL variable (`R2_PUBLIC_URL`) requirements.
    *   API Update (`api/src/index.js` -> `api/src/routes/public.js`): Modified `GET /api/products` handler to query and return the new template/print area data alongside variant info.
    *   Troubleshooting: Resolved various issues during seeding/testing related to admin secrets, Hono routing order, and environment variable access in handlers.
*   **Design Endpoint Implementation (Phase 3):**
    *   Updated DB Schema (`api/schema.sql`): Added the `designs` table, removing previously considered placement columns based on clarified requirements.
    *   Applied schema changes to local D1.
    *   Implemented `POST /api/designs` Endpoint (`api/src/routes/protected.js`):
        *   Protected endpoint using `authMiddleware`.
        *   Handles `multipart/form-data` for image uploads.
        *   Uploads the user's final design image to R2 under `user-images/{fid}/{product_id}/{uuid}.{ext}`.
        *   Inserts design metadata (including R2 image URL) into the `designs` table.
    *   Implemented `GET /api/designs` Endpoint (`api/src/routes/protected.js`): Basic implementation to list designs belonging to the authenticated user.
*   **Code Refactoring:**
    *   Restructured API handlers from `api/src/index.js` into separate files under `api/src/routes/` (public, protected, admin, webhooks, websockets) for better maintainability.
    *   Updated `api/src/index.js` to import and register the new routers.
    *   Corrected DO import paths in `api/src/index.js`.
*   **Testing:**
    *   Created `api/tests/designs.test.js` using `bun:test`.
    *   Added tests for `POST /api/designs` covering success (with auth, file upload), unauthorized access, missing fields, and foreign key constraints.
    *   Switched testing strategy from `unstable_dev` to testing against live `wrangler dev` server due to environment/binding complexities.
    *   Debugged and resolved JWT signature verification issues related to environment variable consistency.
*   **Logging Cleanup:** Removed extensive diagnostic logging added during debugging from `index.js`, `auth.js`, and `seed.js`.

## Blockers

*   None currently. Ready to move to Phase 4 backend tasks.

## Plan for Tomorrow (Day 4 - Start Phase 4 Backend)

*   **Implement Mockup Generation Logic:**
    *   Flesh out `MockupQueueDurableObject` (`api/src/do/mockup_queue.js`).
    *   Add logic within the DO to call Printful's Mockup API (`POST /v2/mockup-tasks`) using the `image_url` (pointing to our R2) stored in the `designs` table.
    *   Requires passing `DB` binding and potentially `PRINTFUL_API_KEY` to the DO via `wrangler.toml`.
*   **Implement Printful Webhook Handler:**
    *   Enhance the `POST /api/webhooks/printful` handler (`api/src/routes/webhooks.js`).
    *   Handle `mockup_task_finished` events from Printful.
    *   Verify webhook signature if Printful supports it for V2 webhooks.
    *   Update the corresponding `designs` record in D1 with the received `mockup_url` and update `status` (e.g., to `mockup_ready` or `error`).
*   **Consider Real-time Notifications:**
    *   Plan integration between the webhook handler/mockup DO and the `SessionDurableObject` to notify the frontend via WebSockets when a mockup is ready (or failed).

---

## API Endpoint Documentation (Changes/Additions from Day 3)

**1. `GET /api/products`**

*   **Purpose:** Retrieves a list of active products and their variants, now including data needed for the frontend canvas editor.
*   **Response Body Structure (Illustrative Snippet):**

```json
{
  "products": [
    {
      "id": 1,
      "printful_product_id": 586,
      "name": "Unisex Garment-Dyed Heavyweight T-Shirt",
      "slug": "unisex-t-shirt",
      "options": { // Unique colors/sizes for filtering
        "color_name": ["Berry", "Black", ...],
        "size": ["S", "M", "L", "XL"]
      },
      "colors": [
        {
          "color_name": "Berry",
          "color_code": "#8e5a7b",
          "base_price": 14.95,
          "variants": [
            {
              "id": 1, // DB Variant ID
              "printful_variant_id": 15158,
              "size": "L",
              "inventory_count": 100,
              "status": "available",
              "base_price": 14.95,
              "template_image_url": "https://fc-swag-images.kasra.codes/product-templates/586/05_cc1717_ghost_front_base_whitebg.png", // R2 URL
              "template_texture_url": null, // R2 URL or null
              "template_width": 3000,     // pixels
              "template_height": 3000,    // pixels
              "print_area_width": 1074,   // pixels
              "print_area_height": 1432,  // pixels
              "print_area_top": 473,      // pixels
              "print_area_left": 958      // pixels
            },
            // ... other sizes for Berry ...
          ]
        },
        // ... other colors ...
      ]
    }
    // ... other products ...
  ]
}
```

**2. `POST /api/designs`**

*   **Purpose:** Creates a new design record associated with the authenticated user.
*   **Authentication:** Required (Bearer Token with FID).
*   **Request Body:** `multipart/form-data` containing:
    *   `product_id`: (Number) The ID of the base product (from `GET /api/products`).
    *   `variant_id`: (Number) The ID of the specific product variant (from `GET /api/products`).
    *   `image`: (File) The final, transformed image file generated by the frontend canvas.
*   **Response Body (Success - 201 Created):**
    ```json
    {
      "success": true,
      "designId": 123, // The new unique ID for the created design
      "imageUrl": "https://fc-swag-images.kasra.codes/user-images/{fid}/{product_id}/{uuid}.png" // Public URL of the uploaded image in R2
    }
    ```
*   **Response Body (Error):** Standard JSON error object (e.g., 400 for missing fields/invalid FK, 401 for auth error, 500 for server error).

**3. `GET /api/designs`**

*   **Purpose:** Retrieves a list of designs created by the authenticated user.
*   **Authentication:** Required (Bearer Token with FID).
*   **Response Body (Success - 200 OK):**
    ```json
    {
      "designs": [
        {
          "id": 123,
          "product_id": 1,
          "variant_id": 1,
          "image_url": "https://fc-swag-images.kasra.codes/user-images/12345/1/uuid1.png",
          "mockup_url": null, // Will be populated later
          "status": "draft",
          "is_public": false,
          "created_at": "2025-05-04T10:00:00Z",
          "updated_at": "2025-05-04T10:00:00Z"
        },
        // ... other designs ...
      ]
    }
    ``` 

---

## Notes for Frontend Developer (Using Template/Print Area Data)

The `GET /api/products` endpoint now includes template and print area information within each variant object to support the canvas editor:

```json
// Example variant object within the response:
{
  "id": 1, 
  "printful_variant_id": 15158,
  "size": "L",
  // ... other variant fields ...
  "template_image_url": "https://.../05_cc1717_ghost_front_base_whitebg.png", // R2 URL
  "template_texture_url": null, // R2 URL or null
  "template_width": 3000,     // pixels (original template size)
  "template_height": 3000,    // pixels (original template size)
  "print_area_width": 1074,   // pixels (relative to template_width/height)
  "print_area_height": 1432,  // pixels (relative to template_width/height)
  "print_area_top": 473,      // pixels (relative to template_width/height)
  "print_area_left": 958      // pixels (relative to template_width/height)
}
```

Here's how to use this data based on `docs/FRONTEND_SPEC.md`:

**1. Editor Canvas Setup (Visible Canvas):**

*   **Background:**
    *   Set the canvas background using the variant's `color_code`.
    *   If `template_texture_url` is not null, fetch this image (from R2) and draw it *over* the background color.
    *   Fetch the `template_image_url` (the ghost overlay image from R2) and draw it *on top* of the color/texture. This provides the visual t-shirt shape and shading for the user to design on.
*   **Print Area Boundaries:**
    *   The provided `print_area_width`, `print_area_height`, `print_area_top`, `print_area_left` are in pixels relative to the original template dimensions (`template_width`, `template_height` - e.g., 3000x3000).
    *   You need to **scale these dimensions** to match your visible editor canvas size.
    *   Calculate the scale factor: `scaleFactor = editorCanvas.width / template_width` (assuming aspect ratio is maintained, otherwise calculate separately for width/height).
    *   The print area rectangle on the editor canvas will be:
        *   `x = print_area_left * scaleFactor`
        *   `y = print_area_top * scaleFactor`
        *   `width = print_area_width * scaleFactor`
        *   `height = print_area_height * scaleFactor`
    *   Use this **scaled rectangle** to:
        *   Visually indicate the printable area to the user (optional).
        *   Constrain the user's image transformations (dragging, scaling, rotating) so the image stays within these boundaries.

**2. Export Canvas Setup (Hidden Canvas):**

*   **Dimensions:** Set this canvas's dimensions based on the required print output. A common approach is to match the original template size (`template_width`, `template_height`) to ensure sufficient resolution, or calculate dimensions based on the `print_area` dimensions and target DPI (e.g., 150 DPI).
*   **Drawing the Final Image:**
    *   Take the user's uploaded image.
    *   Apply the *same transformations* (position, scale, rotation) that were determined through interaction on the editor canvas, but **scaled up** to the high-resolution export canvas coordinates relative to the *original* print area boundaries (`print_area_top`, `print_area_left`, etc.).
    *   Draw this transformed, high-resolution user image onto the hidden export canvas.
*   **Sending to Backend (`POST /api/designs`):**
    *   Export the contents of the **export canvas** (which now contains *only* the correctly positioned, scaled, and rotated user graphic at high resolution) as an image file (e.g., PNG).
    *   Send this image file via `multipart/form-data` along with the `product_id` and `variant_id` to the `POST /api/designs` endpoint. The backend will store this final image in R2.

This approach keeps the backend simple (it just receives the final image asset) while ensuring the frontend has the necessary data to guide the user and generate a print-quality output file. 