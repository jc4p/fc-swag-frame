# Backend Standup - Day 4

**Date:** 2025-05-05 (Adjust as needed)
**Developer:** Backend AI (Gemini)

## Summary

Completed the backend implementation for Phase 4 (Mockup Generation Prototype). This involved integrating the `POST /api/designs` endpoint with a new `MockupQueueDurableObject` to asynchronously call the Printful Mockup API. Implemented the `/api/webhooks/printful` endpoint to receive callbacks from Printful, update the design status and `mockup_url` in the database, and trigger real-time notifications. Also implemented the `/api/ws` WebSocket endpoint, enabling authenticated clients to connect to their specific `SessionDurableObject` instance based on their FID and receive these notifications. Debugged and resolved issues related to Durable Object bindings and local D1 simulation reporting for updates. Reduced excessive logging.

## What was done today?

*   **Mockup Generation Flow:**
    *   Modified `POST /api/designs` (`api/src/routes/protected.js`): Upon successful design creation, it now enqueues a task in the `MockupQueueDurableObject`, passing `designId`, R2 `imageUrl`, and `variantId`.
    *   Implemented `MockupQueueDurableObject` (`api/src/do/mockup_queue.js`):
        *   Handles task requests.
        *   Fetches Printful variant details (`printful_variant_id`, print area) from D1 using the DB `variantId`.
        *   Calls the Printful Mockup API (`POST /v2/mockup-tasks`) with the user image URL and placement details, using `designId` as `external_id`.
        *   Updates the design status in D1 to `mockup_pending` on successful task submission to Printful, or `mockup_error` if the API call fails.
    *   Implemented `POST /api/webhooks/printful` (`api/src/routes/webhooks.js`):
        *   Handles `mockup_task_finished` and `mockup_task_failed` events from Printful.
        *   Updates the corresponding `designs` record in D1 based on the `external_id` (designId) with the `mockup_url` and status (`mockup_ready` or `mockup_error`).
        *   **WebSocket Notification:** Fetches the FID for the design and calls the `/notify` endpoint on the user's specific `SessionDurableObject` instance.
*   **WebSocket Implementation:**
    *   Modified `SessionDurableObject` (`api/src/do/session.js`):
        *   Added a `/notify` handler to receive internal POST requests (from the webhook handler).
        *   Parses the notification data and calls `broadcast()` to send it to all connected WebSocket clients for that session/FID.
    *   Implemented `GET /api/ws` (`api/src/routes/websockets.js`):
        *   Protected the route using `authMiddleware`.
        *   Verifies the `Upgrade: websocket` header.
        *   Retrieves the authenticated user's FID.
        *   Gets the specific `SessionDurableObject` instance using `idFromName(userFid)`.
        *   Forwards the upgrade request to the correct DO instance to establish the connection.
*   **Debugging & Refinements:**
    *   Corrected Durable Object binding name usage in `protected.js` (`MOCKUP_QUEUE_DO`).
    *   Investigated and worked around local D1 simulation inconsistencies with `result.changes` reporting in the webhook handler.
    *   Reduced verbose logging in the DO and webhook handler.

## Blockers

*   None currently. Ready to move to Phase 5 backend tasks (Publishing, Orders).

## Plan for Tomorrow (Day 5 - Start Phase 5 Backend)

*   **Implement Design Publishing:**
    *   Implement `POST /api/designs/:design_id/publish` (`api/src/routes/protected.js`).
    *   Requires adding `royalty_percent`, `retail_price`, `artist_earn`, `platform_profit`, `is_public`, `published_at` columns to the `designs` table schema.
    *   Validate input (`royalty_percent`).
    *   Calculate pricing based on `API_OVERVIEW_PLAN.md`.
    *   Update the `designs` record in D1.
*   **Implement Public Feed:**
    *   Implement `GET /api/feed` (`api/src/routes/public.js`).
    *   Query D1 for public designs (`is_public = true`), sorted and paginated.
*   **Schema Updates:** Apply necessary D1 schema changes for publishing fields.

---

## Mockup Generation & Notification Flow (for Frontend)

Here's the updated flow for submitting a design and receiving the mockup URL:

1.  **Submit Design:** Frontend sends the usual `POST /api/designs` request with `product_id`, `variant_id`, and the final image file (as `multipart/form-data`). Requires the user's JWT (`Authorization: Bearer <token>`).
2.  **Initial Response:** The backend immediately responds with `201 Created` upon successful image upload and database record creation:
    ```json
    {
      "success": true,
      "designId": 123, // The new unique ID for the created design
      "imageUrl": "https://.../user-images/{fid}/{productId}/{uuid}.png" // Public URL of the user's uploaded image
    }
    ```
    *At this point, the backend has asynchronously triggered the mockup generation task with Printful.*
3.  **WebSocket Connection:** The frontend should establish a WebSocket connection to `GET /api/ws` using the same JWT (`Authorization: Bearer <token>`) used for other API calls. This connection keeps the user linked to their server-side session.
4.  **Listen for Messages:** The frontend listens for incoming messages on the WebSocket.
5.  **Mockup Ready Notification:** When Printful finishes generating the mockup (this can take seconds to minutes), the backend webhook handler receives the notification, updates the database, and sends a message via the WebSocket to the connected frontend client. The message will have the following JSON format:
    ```json
    {
      "type": "mockup_ready",
      "designId": 123, // The ID of the design that is ready
      "mockupUrl": "https://printful-generated-url.com/your-mockup.png" // The URL of the generated mockup image
    }
    ```
6.  **Mockup Failed Notification:** If Printful fails to generate the mockup, the frontend will receive this message:
    ```json
    {
      "type": "mockup_error",
      "designId": 123, // The ID of the design that failed
      "reason": "Optional reason string from Printful or backend" // A description of why it failed
    }
    ```
7.  **Update UI:** Upon receiving the `mockup_ready` message, the frontend can fetch the `mockupUrl` and display the mockup image to the user. If `mockup_error` is received, display an appropriate error message.

This asynchronous flow allows the UI to remain responsive while the mockup is generated in the background, providing a better user experience. The frontend only needs to handle the initial design submission and then listen on the WebSocket for the result. 