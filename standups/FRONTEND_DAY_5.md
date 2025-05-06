# Frontend Standup - Day 5

## Summary

Continued work on multi-product support, focusing on the Sticker Sheet editor (`OptionsStickerSheet.jsx`). While the T-shirt editor (`OptionsShirt.jsx`) is now stable and functional after refactoring, the Sticker Sheet editor is encountering persistent Konva rendering errors. We successfully refactored `page.js` to include product selection, and `ProductOptionsLoader.jsx` now correctly routes to either `OptionsShirt.jsx` or `OptionsStickerSheet.jsx` based on product type (using slug heuristic for now).

SVG icons were migrated to separate files and are loaded via `use-image` with their `.src` property. The `OptionsStickerSheet.jsx` component has been built out to support multi-image uploads, individual sticker selection and transformation, background removal for selected stickers, and a multi-image publish flow. However, it's plagued by Konva errors.

## What was done today?

*   **Product Selection UI (`page.js`, `ProductSelectorAndEditor.jsx`):**
    *   `page.js` now fetches all products and passes them to `ProductSelectorAndEditor.jsx`.
    *   `ProductSelectorAndEditor.jsx` allows users to choose a product or auto-selects if only one is available. It then loads the appropriate editor via `ProductOptionsLoader.jsx`.
*   **Component Refactoring (`OptionsShirt.jsx`, `OptionsStickerSheet.jsx`, `ProductOptionsLoader.jsx`):
    *   `ProductOptions.jsx` was successfully renamed to `OptionsShirt.jsx` and primarily handles single-image products.
    *   A new `OptionsStickerSheet.jsx` was created to manage multi-image sticker sheets, omitting color/size selection.
    *   `ProductOptionsLoader.jsx` dynamically loads `OptionsShirt` or `OptionsStickerSheet` using `React.lazy()` and a slug-based heuristic for product type (`product.slug.includes('sticker')`).
*   **SVG Icon Migration:**
    *   Inline SVG strings for trash and remove background icons were moved to `src/assets/icons/trash.svg` and `src/assets/icons/remove-bg.svg`.
    *   Both `OptionsShirt.jsx` and `OptionsStickerSheet.jsx` were updated to import these SVGs and use their `.src` property with the `use-image` hook.
*   **Sticker Sheet Functionality (`OptionsStickerSheet.jsx`):
    *   Implemented multi-file upload via `<input type=\"file\" multiple />`.
    *   `handleFileChange` processes multiple files and updates the `userImages` state array.
    *   `UserStickerImage` sub-component renders each sticker.
    *   Selection of individual stickers (`selectedImageId`) and attachment of a single `<Transformer />` to the selected sticker is implemented.
    *   Icon positioning logic was ported and adapted to update for the selected sticker during drag/transform events.
    *   Background removal (`handleRemoveBackgroundClick`) and image removal (`handleRemoveImage`) were adapted to work on the `selectedImageId`.
    *   Publish logic (`handlePublishClick`) was updated to attempt compositing all user images onto a hidden high-resolution canvas before generating a blob for the API.
    *   Added a persistent "Upload Stickers" / "Add More Stickers" button.
*   **Debugging Konva Errors in `OptionsStickerSheet.jsx`:**
    *   Addressed potential issues with `useImage` by using `importedSvgUrl.src`.
    *   Ensured conditional rendering of Konva components in `interactiveLayer` uses explicit `? <Component /> : null` ternary operators to avoid rendering invalid children (like booleans or undefined).
    *   Systematically commented out sections of the `interactiveLayer` (action icons, transformer, placeholder text, and `userImages.map`) to isolate the error source. The errors ("Text components are not supported..." and "Cannot read properties of undefined (reading 'getParent')" at `Layer.add`) persist even with most of the layer commented out.

## Blockers

*   **Persistent Konva Errors in `OptionsStickerSheet.jsx`:**
    *   The primary blocker is the recurring error: `TypeError: Cannot read properties of undefined (reading 'getParent')` originating from `Layer.add` in Konva, and the accompanying `Text components are not supported for now in ReactKonva. Your text is: " "`. Both point to line 515 of `OptionsStickerSheet.jsx` (the main return statement for the component).
    *   These errors occur when the `OptionsStickerSheet` component is rendered, even after commenting out most of its conditionally rendered children within the `interactiveLayer`.
    *   This suggests the issue might be very subtle, possibly related to:
        *   The `UserStickerImage` component (if it was still active in the last test that failed).
        *   The print area `<Rect>` (the only remaining item if `UserStickerImage` was also commented out in the last test).
        *   A more fundamental issue with the `<Layer>` itself or an interaction with React's reconciler in development mode (double-invoking effects, etc.) that causes an invalid child (like an empty text node) to be momentarily passed to Konva.
        *   The `key` prop on mapped items if not perfectly unique or if items are reordered in a way that confuses React/Konva.

## Plan for Tomorrow (Day 6)

*   **Deep Dive into `OptionsStickerSheet.jsx` Konva Errors:**
    1.  **Verify Simplest Case:** Completely empty the `interactiveLayer` in `OptionsStickerSheet.jsx` except for perhaps a single, static `<Rect />` to see if even that triggers the error. If it does, the issue might be with the Layer or Stage setup itself in this specific component.
    2.  **Inspect `UserStickerImage`:** If the simplest case works, incrementally add back components. Focus heavily on the `userImages.map(...)` and the `UserStickerImage` component.
        *   Ensure `UserStickerImage` *always* returns a valid Konva node or `null` at every stage of its lifecycle (loading, loaded, failed). Double-check all conditional returns within it.
        *   Log the exact output of the `userImages.map(...)` just before it's rendered to see if any `undefined` or string values are present in the array of children being passed to the Layer.
    3.  **Review `key` props:** Ensure the `key={imgData.id}` on `UserStickerImage` is always unique and stable.
    4.  **Consider React StrictMode:** Development mode runs effects twice. While generally good for catching bugs, it can sometimes interact oddly with libraries that manage their own DOM-like structures (like Konva). If all else fails, temporarily disable StrictMode for this component/page to see if it has an impact (though this is a last resort for diagnosis, not a solution).
*   **Refine Publish Flow for Stickers:** Once rendering is stable, re-test and refine the multi-image compositing in `handlePublishClick`.
*   **Styling and UX:** Minor style adjustments for the new buttons and overall layout of sticker options.
