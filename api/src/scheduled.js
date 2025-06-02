import { seedProductData } from './seed';

/**
 * Updates a product by calling the existing import-product logic
 * @param {object} env - Worker environment object.
 * @param {number} dbProductId - The database ID of the product.
 * @param {string} printfulProductId - The Printful Product ID.
 */
async function updateProductVariants(env, dbProductId, printfulProductId) {
    console.log(`Updating variants for Product ID: ${dbProductId} (Printful ID: ${printfulProductId})`);
    
    try {
        // Use the same seedProductData function that the admin endpoint uses
        // This ensures we get the same logic including hardcoded dimensions for sticker sheets
        const result = await seedProductData(env, printfulProductId, []); // Empty array means import all colors for the product
        
        if (result.success) {
            console.log(`Successfully updated product ${printfulProductId}: ${result.message}`);
        } else {
            console.error(`Failed to update product ${printfulProductId}: ${result.message}`);
        }
        
        return result;
    } catch (error) {
        console.error(`Unhandled error updating product ${printfulProductId}:`, error);
        return { success: false, message: `Update failed: ${error.message}` };
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