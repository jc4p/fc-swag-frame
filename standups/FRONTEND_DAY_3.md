# Frontend Standup - Day 3

## Summary

Successfully integrated the backend updates from Day 3, resolving the blockers related to default t-shirt images and print area boundaries. Refactored the preview/editor significantly, switching from previous attempts (direct canvas drawing, Fabric.js) to **Konva.js** (`react-konva` + `use-image`) for better stability and easier object manipulation. The core editor now displays the selected variant's color, texture (if available), and template image correctly. Users can upload their own image, which is displayed on top and can be dragged, scaled (with aspect ratio locked), and rotated using a transformer. An out-of-bounds warning is displayed if the user image exceeds the printable area. The API call for publishing is prepared but requires authentication integration.

## What was done today?

*   **Library Migration & Integration:**
    *   Installed `konva`, `react-konva`, and `use-image`.
    *   Refactored `ProductOptions.jsx` to use `react-konva` components (`Stage`, `Layer`, `Rect`, `Image`, `Transformer`).
    *   Implemented dynamic import for `ProductOptions` via a new `ProductOptionsLoader.jsx` client component to resolve SSR issues with Konva.
*   **Backend Data Integration (`GET /api/products`):**
    *   Utilized the newly available `template_image_url`, `template_texture_url`, `template_width`, `template_height`, and `print_area_*` fields from the API response.
    *   Used `use-image` hook to load texture and template images.
*   **Konva Canvas Implementation:**
    *   Set up Konva `Stage` with dynamic sizing based on container width and template aspect ratio.
    *   Rendered background `<Rect>` using `selectedColor.color_code`.
    *   Rendered texture `<Image>` (if `textureImg` loaded).
    *   Rendered template `<Image>` (if `templateImg` loaded).
    *   Implemented user image upload using `<input type="file">` and `FileReader`.
    *   Rendered user uploaded `<Image>` using `use-image` and stored its attributes (position, scale, rotation) in `userImageAttrs` state.
    *   Added Konva `<Transformer>` attached to the user image.
    *   Implemented `draggable` prop and `onDragEnd`/`onTransformEnd` handlers to update `userImageAttrs`.
    *   Configured Transformer (`keepRatio: true`) to lock aspect ratio during scaling.
    *   Implemented `dragBoundFunc` to constrain image dragging within the print area (based on image center).
    *   Implemented stage click handler (`handleStageClick`) for selecting/deselecting the user image (`isUserImageSelected` state) and triggering file upload if no image is present.
    *   Added auto-selection of the user image immediately after upload.
*   **User Experience & Constraints:**
    *   Added placeholder text ("Click to Upload Art") using Konva `<Text>`, adapting text color based on background contrast (`getContrastColor` helper).
    *   Added visual warning text (`<p>`) displayed below the canvas when the user image `getClientRect()` extends beyond the calculated print area (`isOutOfBounds` state).
    *   Added a "Remove Image" button (`handleRemoveImage`) to clear the uploaded image and state.
*   **API Preparation (`POST /api/designs`):**
    *   Refactored `handlePublishClick` to outline the export process using a hidden `Konva.Stage`.
    *   Included logic for calculating high-resolution transformations based on `userImageAttrs`.
    *   Included logic for exporting the hidden stage canvas to a Blob.
    *   Prepared `FormData` structure.
    *   Added placeholder for retrieving authentication token (`Authorization: Bearer ...`).
*   **Troubleshooting:**
    *   Resolved CORS errors related to loading R2 images onto the canvas by ensuring correct R2 bucket CORS policy and purging the Cloudflare cache.
    *   Debugged and fixed issues related to `use-image` loading statuses for the loading overlay.
    *   Resolved Konva/Fabric SSR and initialization issues using dynamic imports and effect refactoring.

## Blockers

*   **Authentication Token:** The frontend currently uses a placeholder JWT. Need to integrate with the Frame SDK context (`useFrame`?) to retrieve the actual user FID and obtain a valid session JWT required for the `Authorization` header in the `POST /api/designs` request.

## Plan for Tomorrow (Day 4 - Continue Phase 3/Start Phase 4 Frontend)

*   **Complete Design Submission:**
    *   **Authentication:** Integrate Frame SDK context to get the user's JWT for API calls.
    *   **Finalize Export:** Thoroughly test the hidden Konva stage export logic in `handlePublishClick` to ensure the correct portion of the user image is exported at high resolution.
    *   **Test `POST /api/designs`:** Perform end-to-end tests of selecting variant, uploading, positioning, and successfully publishing a design via the API.
*   **UI Polish:**
    *   Refine the visual appearance of the transformer/selection.
    *   Potentially add finer-grained controls or feedback during transformations.
*   **Prepare for Mockups (Phase 4):**
    *   Review backend plan for WebSockets (`/api/ws`).
    *   Plan frontend implementation for connecting to the WebSocket and listening for mockup status updates (e.g., `mockup_task_finished`). 