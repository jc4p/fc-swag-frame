import {
    getPrintfulProduct,
    getPrintfulProductVariants,
    getPrintfulProductAvailability,
    getPrintfulProductPrices
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
    if (!apiKey) {
        return { success: false, message: 'PRINTFUL_API_KEY is not configured in environment.' };
    }
    if (!env.DB) {
         return { success: false, message: 'DB environment binding is not configured.' };
    }

    const targetColorsLower = targetColors.map(c => c.toLowerCase());
    const DEFAULT_INVENTORY = 100; // Assign this if Printful says 'in stock'
    const TARGET_TECHNIQUE = 'dtg';
    // Define relevant regions to check stock for (can be adjusted)
    const TARGET_REGIONS = ['usa', 'europe']; 

    try {
        // 1. Fetch data from Printful
        const [productData, allVariants, allAvailability, pricingData] = await Promise.all([
            getPrintfulProduct(productId, apiKey),
            getPrintfulProductVariants(productId, apiKey),
            getPrintfulProductAvailability(productId, apiKey),
            getPrintfulProductPrices(productId, apiKey, 'USD')
        ]);

        const productName = productData.data?.name;
        if (!productName) {
            return { success: false, message: `Product ${productId} not found or name is missing.` };
        }

        // Create a map for quick availability lookup: variantId -> { availabilityStatus, ... }
        const availabilityMap = allAvailability.reduce((map, avail) => {
             // Find the availability data specifically for the DTG technique
            const dtgTechniqueAvailability = avail.techniques?.find(t => t.technique === TARGET_TECHNIQUE);
            if (dtgTechniqueAvailability) {
                 // Check stock in target regions
                 const stockInfo = dtgTechniqueAvailability.selling_regions?.find(r => TARGET_REGIONS.includes(r.name));
                 // Consider 'in stock' if available in *any* target region
                 const isInStock = dtgTechniqueAvailability.selling_regions?.some(r => TARGET_REGIONS.includes(r.name) && r.availability === 'in stock');
                 map[avail.catalog_variant_id] = {
                     isAvailable: true, // Available via DTG somewhere
                     isInStock: isInStock
                 };
            }
            return map;
        }, {});

        // ---> Create price map for DTG technique
        const priceMap = {};
        if (pricingData && pricingData.variants) {
            pricingData.variants.forEach(variantPriceInfo => {
                const dtgTechnique = variantPriceInfo.techniques?.find(t => t.technique_key === TARGET_TECHNIQUE);
                if (dtgTechnique && dtgTechnique.price) {
                    priceMap[variantPriceInfo.id] = dtgTechnique.price; // Store price string
                }
            });
            console.log(`Created price map for ${Object.keys(priceMap).length} variants.`);
        } else {
            console.warn(`No pricing data or variants found in pricing response for product ${productId}`);
        }
        // <---

        // ---> ADDED: Truncate Name at first '|'
        let processedProductName = productName;
        const pipeIndex = processedProductName.indexOf('|');
        if (pipeIndex !== -1) {
            processedProductName = processedProductName.substring(0, pipeIndex).trim();
        }
        // <---

        // 2. Process and Filter Variants
        // ---> ADDED: Define allowed sizes
        const allowedSizes = ['S', 'M', 'L', 'XL'];
        // <---
        const filteredVariants = allVariants.filter(variant => {
            const colorNameLower = variant.color?.toLowerCase();
            // ---> MODIFIED: Filter by allowedSizes
            return colorNameLower && variant.size && targetColorsLower.includes(colorNameLower) && allowedSizes.includes(variant.size) && availabilityMap[variant.id]?.isAvailable;
            // <---
        }).map(variant => ({
            variant_sku: variant.id.toString(),
            size: variant.size,
            color_name: variant.color,
            color_code: variant.color_code,
            // ---> MODIFIED: Parse price to float or store null
            printful_price: priceMap[variant.id] ? parseFloat(priceMap[variant.id]) : null,
            // <---
            inventory_count: availabilityMap[variant.id]?.isInStock ? DEFAULT_INVENTORY : 0,
        }));

        if (filteredVariants.length === 0) {
            return { success: false, message: `No variants found matching colors [${targetColors.join(', ')}] and technique '${TARGET_TECHNIQUE}' for product ${productId}.` };
        }

        console.log(`Found ${filteredVariants.length} variants to seed after filtering.`);

        // 3. Prepare for D1
        // ---> MODIFIED: Generate slug, hardcode if productId is 586
        let productSlug;
        if (productId.toString() === '586') {
            productSlug = 'unisex-t-shirt';
            console.log(`Using hardcoded slug '${productSlug}' for Printful Product ID ${productId}`);
        } else {
            productSlug = generateSlug(processedProductName); // Use processed name for slug generation
        }
        // <---

        const productInsertStmt = env.DB.prepare(
            'INSERT INTO products (name, slug, printful_product_id, status) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, printful_product_id=excluded.printful_product_id, updated_at=CURRENT_TIMESTAMP RETURNING id'
        );

        const variantInsertStmt = env.DB.prepare(
            // ---> Add printful_price to INSERT and UPDATE
            'INSERT INTO product_variants (product_id, variant_sku, size, color_name, color_code, printful_price, inventory_count) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(product_id, variant_sku) DO UPDATE SET size=excluded.size, color_name=excluded.color_name, color_code=excluded.color_code, printful_price=excluded.printful_price, inventory_count=excluded.inventory_count, updated_at=CURRENT_TIMESTAMP'
            // <---
        );

        // 4. Execute D1 Queries
        console.log(`Inserting/Updating product: ${processedProductName} (Slug: ${productSlug})`);
        const productResult = await productInsertStmt.bind(processedProductName, productSlug, productId.toString(), 'active').first();

        if (!productResult?.id) {
             throw new Error('Failed to insert or retrieve product ID from D1.');
        }
        const dbProductId = productResult.id;
        console.log(`Product ID in D1: ${dbProductId}`);

        // Batch insert/update variants
        const variantBindings = filteredVariants.map(v => 
             // ---> Add printful_price binding
            variantInsertStmt.bind(dbProductId, v.variant_sku, v.size, v.color_name, v.color_code, v.printful_price, v.inventory_count)
            // <---
        );
        
        console.log(`Batch inserting/updating ${variantBindings.length} variants...`);
        const batchResult = await env.DB.batch(variantBindings);
        
        console.log('D1 Batch Result:', JSON.stringify(batchResult, null, 2));
        const successCount = batchResult.filter(r => r.success).length;
        const failedCount = batchResult.length - successCount;

        return {
            success: true,
            message: `Seeded product ${productId} (${productName}) with ID ${dbProductId}. Processed ${filteredVariants.length} variants (Inserted/Updated: ${successCount}, Failed: ${failedCount}).`,
            productId: dbProductId,
            variantsProcessed: filteredVariants.length,
            variantsSucceeded: successCount
        };

    } catch (error) {
        console.error('Error during product seeding:', error);
        return { success: false, message: `Seeding failed: ${error.message}` };
    }
} 