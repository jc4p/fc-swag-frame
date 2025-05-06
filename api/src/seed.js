import {
    getPrintfulProduct,
    getPrintfulProductVariants,
    getPrintfulProductAvailability,
    getPrintfulProductPrices,
    getPrintfulMockupTemplates,
    downloadImage
} from './printful';

/**
 * Generates a URL-friendly slug from a string.
 * @param {string} text
 * @returns {string}
 */
function generateSlug(text) {
    return text
        .toString()
        .normalize('NFD') // split accented characters into their base characters and diacritical marks
        .replace(/[\u0300-\u036f]/g, '') // remove diacritical marks
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // replace spaces with -
        .replace(/[^\w-]+/g, '') // remove all non-word chars except -
        .replace(/--+/g, '-'); // replace multiple - with single -
}

/**
 * Fetches product data from Printful, filters it, and seeds the D1 database.
 * @param {object} env - The Worker environment (contains DB, PRINTFUL_API_KEY).
 * @param {string|number} productId - The Printful Product ID to seed.
 * @param {Array<string>} targetColors - List of color names to include.
 * @returns {Promise<object>} - A summary of the operation.
 */
export async function seedProductData(env, productId, targetColors) {
    const apiKey = env.PRINTFUL_API_KEY;
    const db = env.DB;
    if (!apiKey || !db || !env.R2_BUCKET || !env.R2_PUBLIC_URL) {
        console.error('Missing environment variables: PRINTFUL_API_KEY, DB binding, R2_BUCKET binding, or R2_PUBLIC_URL');
        return { success: false, message: 'Missing required environment configuration for seeding.' };
    }

    const targetColorsLower = targetColors ? targetColors.map(c => c.toLowerCase()) : []; // Ensure array even if null/undefined
    const DEFAULT_INVENTORY = 100; // Assign this if Printful says 'in stock'
    const TARGET_TECHNIQUE = 'dtg'; // This might need adjustment for non-DTG products like stickers (digital)
    const TARGET_REGIONS = ['usa', 'europe'];

    try {
        // 1. Fetch Product data first to determine type and placement
        console.log(`Fetching product data for Printful product ${productId}...`);
        const productData = await getPrintfulProduct(productId, apiKey);
        const productName = productData.data?.name;
        const productType = productData.data?.type; // e.g., 'T-SHIRT', 'STICKER'
        const productTechniqueKey = productData.data?.techniques?.find(t => t.is_default)?.key || 'digital'; // Use default or fallback
        
        if (!productName || !productType) {
            return { success: false, message: `Product ${productId} not found or critical data (name, type) is missing.` };
        }
        console.log(`Fetched product: ${productName} (Type: ${productType}, Default Technique: ${productTechniqueKey})`);

        // Determine the placement to fetch templates for
        const placementToFetch = productType === 'STICKER' ? 'default' : 'front';
        console.log(`Using placement '${placementToFetch}' for fetching templates based on product type.`);

        // Fetch remaining data
        console.log(`Fetching variants, availability, prices, and templates for Printful product ${productId}...`);
        const [allVariants, allAvailability, pricingData, mockupTemplates] = await Promise.all([
            getPrintfulProductVariants(productId, apiKey),
            getPrintfulProductAvailability(productId, apiKey),
            getPrintfulProductPrices(productId, apiKey, 'USD'),
            getPrintfulMockupTemplates(productId, apiKey, placementToFetch) // Use determined placement
        ]);
        console.log(`Fetched Printful data: ${allVariants.length} variants, ${mockupTemplates.length} templates for ${placementToFetch}.`);

        console.log(`Fetched ${allVariants.length} variants.`);
        console.log(`Fetched availability for ${allAvailability.length} entries.`);
        console.log(`Fetched pricing data.`);
        console.log(`Fetched ${mockupTemplates.length} mockup templates for '${placementToFetch}'.`);

        // --- Process Mockup Templates & Upload Images ---
        let commonTemplateData = null;
        const variantTextureR2UrlMap = {}; // { printful_variant_id: r2_texture_url }
        const uniqueImageUrlsToUpload = new Map(); // <printful_url, { hash, extension, r2_url }>

        if (mockupTemplates.length > 0) {
            const firstTemplate = mockupTemplates[0];

            // Process common overlay image URL
            if (firstTemplate.image_url) {
                if (!uniqueImageUrlsToUpload.has(firstTemplate.image_url)) {
                    const urlHash = await sha256(firstTemplate.image_url);
                    const extension = firstTemplate.image_url.split('.').pop()?.split('?')[0] || 'png'; // Basic extension guess
                    uniqueImageUrlsToUpload.set(firstTemplate.image_url, { hash: urlHash, extension, r2_url: null });
                }
            }

            // Process background/texture URLs
            for (const template of mockupTemplates) {
                if (template.background_url && !uniqueImageUrlsToUpload.has(template.background_url)) {
                    const urlHash = await sha256(template.background_url);
                    const extension = template.background_url.split('.').pop()?.split('?')[0] || 'jpg';
                    uniqueImageUrlsToUpload.set(template.background_url, { hash: urlHash, extension, r2_url: null });
                }
            }

            console.log(`Identified ${uniqueImageUrlsToUpload.size} unique template images to process.`);

            // Download and upload unique images in parallel
            const uploadPromises = [];
            for (const [printfulUrl, imageData] of uniqueImageUrlsToUpload.entries()) {
                uploadPromises.push(
                    (async () => {
                        try {
                            const { arrayBuffer, contentType } = await downloadImage(printfulUrl);
                            
                            // --- Generate readable filename from URL path ---
                            const urlPath = new URL(printfulUrl).pathname;
                            let filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
                            // Clean filename (remove query params just in case, though URL obj should handle it)
                            filename = filename.split('?')[0]; 
                            // Basic sanitization (replace potential problematic chars, though unlikely needed for Printful URLs)
                            filename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_'); 
                            if (!filename) { // Fallback if extraction fails
                                filename = `template_${imageData.hash}.${imageData.extension}`;
                                console.warn(`Could not extract filename from ${printfulUrl}, using hash fallback: ${filename}`);
                            }
                            // --------------------------------------------------

                            // Pass productId to uploadToR2
                            imageData.r2_url = await uploadToR2(env, productId, filename, arrayBuffer, contentType); // Use new filename
                            uniqueImageUrlsToUpload.set(printfulUrl, imageData); // Update map with R2 URL
                        } catch (uploadError) {
                            console.error(`Failed to process image ${printfulUrl}: ${uploadError.message}`);
                            // Decide how to handle failures - skip this image? Fail the seed?
                            // For now, we log and continue, variants needing this image will have null URL.
                        }
                    })()
                );
            }
            await Promise.all(uploadPromises);
            console.log("Finished processing template image uploads.");

            // Now build the final data using the R2 URLs
            const commonOverlayR2Url = uniqueImageUrlsToUpload.get(firstTemplate.image_url)?.r2_url || null;
            commonTemplateData = {
                template_image_url: commonOverlayR2Url,
                template_width: firstTemplate.template_width,
                template_height: firstTemplate.template_height,
                print_area_width: firstTemplate.print_area_width,
                print_area_height: firstTemplate.print_area_height,
                print_area_top: firstTemplate.print_area_top,
                print_area_left: firstTemplate.print_area_left,
            };
            console.log("Common Template Data (using R2 URLs) extracted.");

            // Map texture R2 URLs to variants
            for (const template of mockupTemplates) {
                if (template.background_url) {
                    const textureR2Url = uniqueImageUrlsToUpload.get(template.background_url)?.r2_url || null;
                    if (textureR2Url) {
                        for (const variantId of template.catalog_variant_ids) {
                            variantTextureR2UrlMap[variantId] = textureR2Url;
                        }
                    }
                }
            }
            console.log(`Mapped ${Object.keys(variantTextureR2UrlMap).length} variants with R2 texture URLs.`);

        } else {
            console.warn(`No mockup templates found for product ${productId}, placement ${placementToFetch}. Template fields will be null.`);
        }
        // -------------------------------------------

        // Create availability map - adjust technique based on product?
        // Using productTechniqueKey fetched earlier instead of hardcoded TARGET_TECHNIQUE
        const availabilityMap = allAvailability.reduce((map, avail) => {
            const techniqueAvailability = avail.techniques?.find(t => t.technique === productTechniqueKey);
            if (techniqueAvailability) {
                const isInStock = techniqueAvailability.selling_regions?.some(r => TARGET_REGIONS.includes(r.name) && r.availability === 'in stock');
                map[avail.catalog_variant_id] = {
                    isAvailable: true,
                    isInStock: isInStock
                };
            }
            return map;
        }, {});

        // Create price map - adjust technique based on product?
        // Using productTechniqueKey instead of hardcoded TARGET_TECHNIQUE
        const priceMap = {};
        if (pricingData && pricingData.variants) {
            pricingData.variants.forEach(variantPriceInfo => {
                const techniquePrice = variantPriceInfo.techniques?.find(t => t.technique_key === productTechniqueKey);
                if (techniquePrice && techniquePrice.price) {
                    priceMap[variantPriceInfo.id] = techniquePrice.price;
                }
            });
            console.log(`Created price map for ${Object.keys(priceMap).length} variants using technique '${productTechniqueKey}'.`);
        } else {
            console.warn(`No pricing data or variants found in pricing response for product ${productId}`);
        }

        // ---> ADDED: Truncate Name at first '|'
        let processedProductName = productName;
        const pipeIndex = processedProductName.indexOf('|');
        if (pipeIndex !== -1) {
            processedProductName = processedProductName.substring(0, pipeIndex).trim();
        }
        // <---

        // 2. Process and Filter Variants
        const apparelSizes = ['S', 'M', 'L', 'XL']; // Sizes typically for apparel
        console.log(`Filtering variants. Target Colors: ${targetColorsLower.length > 0 ? targetColorsLower.join(', ') : '[All]'}. Applying size filter only for non-sticker types.`);
        
        const filteredVariants = allVariants.filter(variant => {
            // Availability Check (required for all)
            const isAvailable = availabilityMap[variant.id]?.isAvailable;
            if (!isAvailable) return false;

            // Color Filter (only if targetColors specified)
            if (targetColorsLower.length > 0) {
                const colorNameLower = variant.color?.toLowerCase();
                if (!colorNameLower || !targetColorsLower.includes(colorNameLower)) {
                    return false;
                }
            }

            // Size Filter (only for non-sticker types, using apparelSizes for now)
            if (productType !== 'STICKER') {
                 if (!variant.size || !apparelSizes.includes(variant.size)) {
                     return false;
                 }
            }
            // If we passed all applicable filters, include the variant
            return true;
        }).map(variant => ({
            printful_variant_id: variant.id,
            printful_product_id: variant.catalog_product_id,
            size: variant.size,
            color_name: variant.color,
            color_code: variant.color_code,
            printful_price: priceMap[variant.id] ? parseFloat(priceMap[variant.id]) : null,
            inventory_count: availabilityMap[variant.id]?.isInStock ? DEFAULT_INVENTORY : 0,
            template_image_url: commonTemplateData?.template_image_url || null,
            template_texture_url: variantTextureR2UrlMap[variant.id] || null,
            template_width: commonTemplateData?.template_width || null,
            template_height: commonTemplateData?.template_height || null,
            print_area_width: commonTemplateData?.print_area_width || null,
            print_area_height: commonTemplateData?.print_area_height || null,
            print_area_top: commonTemplateData?.print_area_top || null,
            print_area_left: commonTemplateData?.print_area_left || null,
            status: availabilityMap[variant.id]?.isInStock ? 'available' : 'out_of_stock'
        }));

        if (filteredVariants.length === 0) {
            // Add more context to the error message
            return { success: false, message: `No variants found matching criteria for product ${productId} (Type: ${productType}). Check availability, color filters (if used), and size filters (if applicable).` };
        }
        console.log(`Found ${filteredVariants.length} variants to seed after filtering.`);

        // 3. Prepare for D1
        // Slug generation - Make it more generic?
        // Let's use productId in slug for non-586 cases for now
        let productSlug;
        if (productId.toString() === '586') {
            productSlug = 'unisex-t-shirt';
            console.log(`Using hardcoded slug '${productSlug}' for Printful Product ID ${productId}`);
        } else {
            // Generic slug: type-id or name-id
            productSlug = generateSlug(`${productType}-${productId}`); // Use type and ID for uniqueness
            console.log(`Generated slug '${productSlug}' for Printful Product ID ${productId}`);
        }
        
        const productInsertStmt = db.prepare(
            'INSERT INTO products (name, slug, printful_product_id, status) VALUES (?, ?, ?, ?) ON CONFLICT(printful_product_id) DO UPDATE SET name=excluded.name, slug=excluded.slug, status=excluded.status, updated_at=CURRENT_TIMESTAMP RETURNING id'
        );

        // Corrected SQL Statement
        const variantUpsertStmt = db.prepare(`
            INSERT INTO product_variants (
                product_id, printful_variant_id, printful_product_id, color_name, color_code,
                size, printful_price, inventory_count, status,
                template_image_url, template_texture_url, template_width, template_height,
                print_area_width, print_area_height, print_area_top, print_area_left
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(printful_variant_id) DO UPDATE SET
                product_id = excluded.product_id,
                printful_product_id = excluded.printful_product_id,
                color_name = excluded.color_name,
                color_code = excluded.color_code,
                size = excluded.size,
                printful_price = excluded.printful_price,
                inventory_count = excluded.inventory_count,
                status = excluded.status,
                template_image_url = excluded.template_image_url,
                template_texture_url = excluded.template_texture_url,
                template_width = excluded.template_width,
                template_height = excluded.template_height,
                print_area_width = excluded.print_area_width,
                print_area_height = excluded.print_area_height,
                print_area_top = excluded.print_area_top,
                print_area_left = excluded.print_area_left,
                updated_at = CURRENT_TIMESTAMP
        `);

        // 4. Execute D1 Queries
        console.log(`Inserting/Updating product: ${processedProductName} (Slug: ${productSlug})`);
        const productResult = await productInsertStmt.bind(processedProductName, productSlug, productId, 'active').first();

        if (!productResult?.id) {
            throw new Error('Failed to insert or retrieve product ID from D1.');
        }
        const dbProductId = productResult.id;

        // Batch insert/update variants
        const variantBindings = filteredVariants.map(v =>
            variantUpsertStmt.bind(
                dbProductId, v.printful_variant_id, v.printful_product_id, v.color_name, v.color_code,
                v.size, v.printful_price, v.inventory_count, v.status,
                v.template_image_url, v.template_texture_url, v.template_width, v.template_height,
                v.print_area_width, v.print_area_height, v.print_area_top, v.print_area_left
            )
        );

        console.log(`Batch inserting/updating ${variantBindings.length} variants...`);
        const batchResult = await db.batch(variantBindings);

        console.log('D1 Batch Result Summary:', batchResult.map(r => ({ success: r.success, error: r.error })));
        const successCount = batchResult.filter(r => r.success).length;
        const failedCount = batchResult.length - successCount;

        if (failedCount > 0) {
            console.error(`Failed to insert/update ${failedCount} variants.`);
            // Optionally log more details about failures if needed
        }

        return {
            success: true, // Indicate overall process attempted
            message: `Seeded product ${productId} (${processedProductName}) with ID ${dbProductId}. Processed ${filteredVariants.length} variants (Succeeded: ${successCount}, Failed: ${failedCount}).`,
            productId: dbProductId,
            variantsProcessed: filteredVariants.length,
            variantsSucceeded: successCount
        };

    } catch (error) {
        console.error('Error during product seeding:', error);
        if (error.cause) {
            console.error('Caused by:', error.cause);
        }
        return { success: false, message: `Seeding failed: ${error.message}` };
    }
}

const TARGET_PRINTFUL_PRODUCT_ID = 586; // Comfort Colors 1717
const TARGET_COLORS = [ // From Frontend Day 1 Standup
  'Berry', 'Black', 'Blue Jean', 'Brick',
  'Grey', 'Moss', 'True Navy', 'White',
];
const TARGET_SIZES = ['S', 'M', 'L', 'XL']; // Defined in Backend Day 2 Standup
const TARGET_TECHNIQUE = 'dtg'; // Defined in Backend Day 1 Standup

async function seedDatabase(db, env) {
  console.log(`Starting seed process for Printful Product ID: ${TARGET_PRINTFUL_PRODUCT_ID}...`);

  try {
    // --- 1. Fetch Product Info ---
    // (Keep existing product fetching logic if necessary, or simplify if only one product is needed)
    // For MVP, we assume product 'Comfort Colors 1717' (ID 586) is already in DB or we create it here.
    // Ensure the base product exists
    const productName = "Unisex Garment-Dyed Heavyweight T-Shirt"; // Name for Comfort Colors 1717
    const productSlug = "comfort-colors-1717"; // Example slug
    let productResult = await db.prepare("SELECT id FROM products WHERE printful_product_id = ?")
                                 .bind(TARGET_PRINTFUL_PRODUCT_ID).first();

    let productId;
    if (!productResult) {
      console.log(`Product ${TARGET_PRINTFUL_PRODUCT_ID} not found, inserting...`);
      const insertResult = await db.prepare(
        "INSERT INTO products (printful_product_id, name, slug, status) VALUES (?, ?, ?, 'active') RETURNING id"
      ).bind(TARGET_PRINTFUL_PRODUCT_ID, productName, productSlug).first();
      productId = insertResult.id;
      console.log(`Inserted product with ID: ${productId}`);
    } else {
      productId = productResult.id;
      console.log(`Found existing product with ID: ${productId}`);
    }

    // --- 2. Fetch Variants & Prices ---
    console.log('Fetching variants from Printful...');
    const allVariants = await getPrintfulProductVariants(TARGET_PRINTFUL_PRODUCT_ID, env.PRINTFUL_API_KEY);
    console.log(`Fetched ${allVariants.length} total variants.`);

    console.log('Fetching prices from Printful...');
    const variantPrices = await getPrintfulProductPrices(TARGET_PRINTFUL_PRODUCT_ID, env.PRINTFUL_API_KEY); // Assuming this returns a map { printful_variant_id: price }
    console.log(`Fetched prices for ${Object.keys(variantPrices).length} variants.`);

    // --- 3. Fetch Mockup Template Data ---
    console.log('Fetching mockup template data (front placement) from Printful...');
    const mockupTemplates = await getPrintfulMockupTemplates(TARGET_PRINTFUL_PRODUCT_ID, env.PRINTFUL_API_KEY, 'front');
    console.log(`Fetched ${mockupTemplates.length} template definitions for 'front' placement.`);

    if (mockupTemplates.length === 0) {
      console.warn("Warning: No mockup template data found for 'front' placement. Cannot populate template/print area columns.");
      // Decide how to proceed: skip populating these fields or throw error? For now, skip.
    }

    // Process template data into a usable format
    // We need: common overlay image, boundaries, and variant-specific texture URLs
    let commonTemplateData = null;
    const variantTextureMap = {}; // { printful_variant_id: texture_url }

    if (mockupTemplates.length > 0) {
        // Assume the first template has the common data we need (boundaries, overlay image)
        const firstTemplate = mockupTemplates[0];
        commonTemplateData = {
            template_image_url: firstTemplate.image_url,
            template_width: firstTemplate.template_width,
            template_height: firstTemplate.template_height,
            print_area_width: firstTemplate.print_area_width,
            print_area_height: firstTemplate.print_area_height,
            print_area_top: firstTemplate.print_area_top,
            print_area_left: firstTemplate.print_area_left,
        };
        console.log("Common Template Data:", commonTemplateData);

        // Map texture URLs to variants that use them
        for (const template of mockupTemplates) {
            if (template.background_url) {
                for (const variantId of template.catalog_variant_ids) {
                    variantTextureMap[variantId] = template.background_url;
                }
            }
        }
        console.log(`Mapped ${Object.keys(variantTextureMap).length} variants with specific texture URLs.`);
    }


    // --- 4. Filter and Insert/Update Variants ---
    const variantsToSeed = allVariants.filter(variant =>
      TARGET_COLORS.includes(variant.color) &&
      TARGET_SIZES.includes(variant.size) &&
      variantPrices[variant.id] !== undefined // Ensure we have a price
      // Add technique filtering if available in variant data, otherwise assume DTG for this product
    );

    console.log(`Filtered down to ${variantsToSeed.length} variants matching target colors/sizes/price.`);

    if (variantsToSeed.length === 0) {
      console.warn('Warning: No variants matched the filtering criteria. Check TARGET_COLORS, TARGET_SIZES, and Printful data.');
      return { success: false, message: 'No matching variants found to seed.' };
    }

    // Prepare batch insert/update statement
    const stmt = db.prepare(`
      INSERT INTO product_variants (
        product_id, printful_variant_id, printful_product_id, color_name,
        color_code, size, printful_price, inventory_count, status,
        template_image_url, template_texture_url, template_width, template_height,
        print_area_width, print_area_height, print_area_top, print_area_left
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(printful_variant_id) DO UPDATE SET
        product_id = excluded.product_id,
        printful_product_id = excluded.printful_product_id,
        color_name = excluded.color_name,
        color_code = excluded.color_code,
        size = excluded.size,
        printful_price = excluded.printful_price,
        inventory_count = excluded.inventory_count, -- Or fetch live inventory here
        status = excluded.status,
        template_image_url = excluded.template_image_url,
        template_texture_url = excluded.template_texture_url,
        template_width = excluded.template_width,
        template_height = excluded.template_height,
        print_area_width = excluded.print_area_width,
        print_area_height = excluded.print_area_height,
        print_area_top = excluded.print_area_top,
        print_area_left = excluded.print_area_left,
        updated_at = CURRENT_TIMESTAMP
    `);

    const batchData = variantsToSeed.map(variant => {
        const price = variantPrices[variant.id];
        const templateData = commonTemplateData || {}; // Use empty object if no template data fetched
        const textureUrl = variantTextureMap[variant.id] || null;
        const inventoryCount = 100; // Placeholder inventory
        const status = 'available'; // Placeholder status

        return stmt.bind(
            productId,
            variant.id,
            TARGET_PRINTFUL_PRODUCT_ID, // Assuming variant.catalog_product_id exists, or use constant
            variant.color,
            variant.color_code || '#000000', // Default color code if missing
            variant.size,
            price,
            inventoryCount,
            status,
            templateData.template_image_url || null,
            textureUrl,
            templateData.template_width || null,
            templateData.template_height || null,
            templateData.print_area_width || null,
            templateData.print_area_height || null,
            templateData.print_area_top || null,
            templateData.print_area_left || null
        );
    });

    console.log(`Executing batch insert/update for ${batchData.length} variants...`);
    await db.batch(batchData);
    console.log('Batch insert/update complete.');

    console.log('Seed process finished successfully.');
    return { success: true, message: `Seeded/Updated ${batchData.length} variants for product ID ${productId}.` };

  } catch (error) {
    console.error('Error during seeding process:', error);
    if (error.cause) {
        console.error('Caused by:', error.cause);
    }
    // Attempt to log D1 specific errors if available
     if (error.message && error.message.includes('D1_ERROR')) {
       console.error('D1 Error details:', error);
     }
    return { success: false, message: `Seeding failed: ${error.message}` };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/admin/seed-product') {
        // Simple security check (replace with proper auth later)
        if (request.headers.get('X-Admin-Secret') !== env.ADMIN_AUTH_KEY) {
            return new Response('Unauthorized', { status: 401 });
        }

        try {
            const result = await seedProductData(env, TARGET_PRINTFUL_PRODUCT_ID, TARGET_COLORS);
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' },
                status: result.success ? 200 : 500,
            });
        } catch (e) {
            console.error('Seeding endpoint error:', e);
            return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500 });
        }
    }
    return new Response('Not Found', { status: 404 });
  },

  // Add scheduled handler if needed, e.g., for daily updates
   async scheduled(event, env, ctx) {
     // Implement daily price/inventory updates here if required
     console.log(`Scheduled task triggered: ${event.cron}`);
     // Example: await updateProductVariants(env.DB, env);
   }
};

// Helper to ensure updateProductVariants is defined if used in scheduled
async function updateProductVariants(db, env) {
    console.log("Running scheduled task to update product variants (price/inventory)...");
    // Add logic from BACKEND_DAY_2.md's scheduled.js here
    console.log("Scheduled task finished.");
}

// Helper function to generate SHA-256 hash (needed for filename generation)
// Uses the Web Crypto API available in Workers
async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

// Helper to upload to R2 and return public URL
async function uploadToR2(env, productId, filename, arrayBuffer, contentType) {
    if (!env.R2_BUCKET) {
        throw new Error('R2_BUCKET environment binding is not configured.');
    }
    if (!env.R2_PUBLIC_URL) {
        throw new Error('R2_PUBLIC_URL environment variable is not set.');
    }

    const r2Key = `product-templates/${productId}/${filename}`; // Create folder structure

    try {
        console.log(`Uploading ${r2Key} to R2...`); // Log the full key
        const options = { httpMetadata: { contentType } };
        await env.R2_BUCKET.put(r2Key, arrayBuffer, options); // Use r2Key
        const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`; // Use r2Key in public URL
        console.log(`Uploaded to R2: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error(`Failed to upload ${r2Key} to R2:`, error);
        throw new Error(`R2 upload failed for ${r2Key}: ${error.message}`);
    }
} 