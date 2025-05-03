import {
    getPrintfulProductAvailability,
    getPrintfulProductPrices
} from './printful';

/**
 * Updates the inventory count and base price for variants of a given product.
 * @param {object} env - Worker environment object.
 * @param {number} dbProductId - The database ID of the product.
 * @param {string} printfulProductId - The Printful Product ID.
 */
async function updateProductVariants(env, dbProductId, printfulProductId) {
    console.log(`Updating variants for Product ID: ${dbProductId} (Printful ID: ${printfulProductId})`);
    const apiKey = env.PRINTFUL_API_KEY;
    if (!apiKey || !env.DB) {
        console.error(`Missing API Key or DB binding for product ${printfulProductId}`);
        return; // Skip this product if config is missing
    }

    const DEFAULT_INVENTORY = 100; // Match the seed script default
    const TARGET_TECHNIQUE = 'dtg';
    const TARGET_REGIONS = ['usa', 'europe']; // Match seed script

    try {
        // 1. Fetch latest data from Printful
        const [allAvailability, pricingData] = await Promise.all([
            getPrintfulProductAvailability(printfulProductId, apiKey),
            getPrintfulProductPrices(printfulProductId, apiKey, 'USD') // Fetch USD prices
        ]).catch(err => {
            console.error(`Failed to fetch Printful data for ${printfulProductId}:`, err);
            return [null, null]; // Allow function to continue to next product
        });

        if (!allAvailability || !pricingData) {
            console.log(`Skipping update for ${printfulProductId} due to fetch error.`);
            return;
        }

        // 2. Process Printful data into maps
        // Availability Map: variantId -> { isAvailable, isInStock }
        const availabilityMap = allAvailability.reduce((map, avail) => {
            const dtgTechniqueAvailability = avail.techniques?.find(t => t.technique === TARGET_TECHNIQUE);
            if (dtgTechniqueAvailability) {
                const isInStock = dtgTechniqueAvailability.selling_regions?.some(r => TARGET_REGIONS.includes(r.name) && r.availability === 'in stock');
                map[avail.catalog_variant_id] = {
                    isAvailable: true,
                    isInStock: isInStock
                };
            }
            return map;
        }, {});

        // Price Map: variantId -> price (float)
        const priceMap = {};
        if (pricingData && pricingData.variants) {
            pricingData.variants.forEach(variantPriceInfo => {
                const dtgTechnique = variantPriceInfo.techniques?.find(t => t.technique_key === TARGET_TECHNIQUE);
                if (dtgTechnique && dtgTechnique.price) {
                    priceMap[variantPriceInfo.id] = parseFloat(dtgTechnique.price);
                }
            });
        }

        // 3. Combine into update data: variant_sku -> { new_inventory, new_price }
        // We use variant_sku (Printful variant ID) as the key
        const updateDataMap = {};
        Object.keys(availabilityMap).forEach(variantIdStr => {
            const variantId = parseInt(variantIdStr, 10);
            const availability = availabilityMap[variantId];
            const price = priceMap[variantId]; // Already parsed to float or undefined

            if (availability) { // Only update variants we have availability info for
                updateDataMap[variantId] = {
                    new_inventory: availability.isInStock ? DEFAULT_INVENTORY : 0,
                    new_price: price !== undefined ? price : null // Store null if price wasn't found
                };
            }
        });

        if (Object.keys(updateDataMap).length === 0) {
             console.log(`No relevant variant data found from Printful for product ${printfulProductId}. Skipping D1 update.`);
             return;
        }

        // 4. Prepare D1 Update Statements
        const updateStmt = env.DB.prepare(
            `UPDATE product_variants
             SET inventory_count = ?, printful_price = ?, updated_at = CURRENT_TIMESTAMP
             WHERE product_id = ? AND variant_sku = ?`
        );

        const updateBindings = Object.entries(updateDataMap).map(([variantSku, data]) => {
            console.log(`  - Preparing update for SKU ${variantSku}: Inv=${data.new_inventory}, Price=${data.new_price}`);
            return updateStmt.bind(data.new_inventory, data.new_price, dbProductId, variantSku);
        });

        // 5. Batch Update D1
        console.log(`Batch updating ${updateBindings.length} variants in D1 for product ${dbProductId}...`);
        const batchResult = await env.DB.batch(updateBindings);
        console.log(`Batch update complete for product ${dbProductId}. Results:`, JSON.stringify(batchResult));

    } catch (error) {
        console.error(`Unhandled error updating product ${printfulProductId}:`, error);
        // Optionally, rethrow or handle differently
    }
}

/**
 * Scheduled event handler.
 */
export async function handleScheduled(event, env, ctx) {
    console.log(`Scheduled task started at: ${new Date(event.scheduledTime).toISOString()}`);

    try {
        // Get all products we manage
        const { results: productsToUpdate } = await env.DB.prepare(
            `SELECT id, printful_product_id FROM products WHERE status = 'active'`
        ).all();

        if (!productsToUpdate || productsToUpdate.length === 0) {
            console.log("No active products found to update.");
            return;
        }

        console.log(`Found ${productsToUpdate.length} active products to check for updates.`);

        // Update each product sequentially to avoid overwhelming Printful API/D1
        // For many products, consider a queue or staggering updates.
        for (const product of productsToUpdate) {
            // Use waitUntil to allow the function to finish while updates happen
            ctx.waitUntil(updateProductVariants(env, product.id, product.printful_product_id));
            // Optional: Add a small delay between products if rate limiting becomes an issue
            // await new Promise(resolve => setTimeout(resolve, 500)); 
        }

        console.log("Scheduled task finished initiating updates.");

    } catch (error) {
        console.error("Error during scheduled task:", error);
        // Consider reporting this error externally
    }
} 