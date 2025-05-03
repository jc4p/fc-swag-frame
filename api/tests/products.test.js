import { describe, it, expect, beforeAll } from 'bun:test';

const API_URL = 'http://localhost:8787'; // Default wrangler dev port

describe('Product API Endpoints', () => {
    let testTargetDbProductId = null; // The database ID of the product we want to test variants for
    let fetchedProducts = [];

    // Fetch all products once and find the DB ID for our seeded Printful product
    beforeAll(async () => {
        try {
            const response = await fetch(`${API_URL}/api/products`);
            expect(response.status).toBe(200); // Expect success here
            const data = await response.json();
            fetchedProducts = data.products || [];

            const targetProduct = fetchedProducts.find(p => p.id === 1); // Hardcoding DB ID 1 based on manual check

            if (targetProduct) {
                testTargetDbProductId = targetProduct.id;
                console.log(`Found target product with DB ID: ${testTargetDbProductId} for testing variants.`);
            } else {
                // If we didn't find DB ID 1, log an error, tests might fail.
                console.error(`Error: Could not find the seeded product (expected DB ID 1) in the /api/products response.`);
                // Attempt to use the first product if available, but warn heavily
                if(fetchedProducts.length > 0) {
                    testTargetDbProductId = fetchedProducts[0].id;
                    console.warn(`Falling back to using the first available product DB ID: ${testTargetDbProductId}`);
                }
            }

        } catch (error) {
            console.error('Error during beforeAll product fetch/setup:', error);
            // Rethrow or handle so tests don't run with bad setup
            throw new Error(`Test setup failed: ${error.message}`);
        }
    });

    describe('GET /api/products', () => {
        it('should return a list of products with variants', async () => {
            // Response already fetched and basic structure checked in beforeAll
            expect(fetchedProducts).toBeInstanceOf(Array);

            // Check structure of the first product if available
            if (fetchedProducts.length > 0) {
                const product = fetchedProducts[0];
                expect(product).toHaveProperty('id');
                expect(product).toHaveProperty('name');
                expect(product).toHaveProperty('slug');
                expect(product).toHaveProperty('variants');
                expect(Array.isArray(product.variants)).toBe(true);

                // Check structure of the first variant if available
                if (product.variants.length > 0) {
                    const variant = product.variants[0];
                    expect(variant).toHaveProperty('id');
                    expect(variant).toHaveProperty('color_name');
                    expect(variant).toHaveProperty('size');
                    expect(variant).toHaveProperty('inventory_count');
                }
            }
        });
    });

    describe('GET /api/products/:product_id/variants', () => {
        it('should return 200 OK and variants for a valid product ID', async () => {
            if (!testTargetDbProductId) {
                throw new Error('Cannot run variant test: test setup did not find a target DB product ID.');
            }
            const response = await fetch(`${API_URL}/api/products/${testTargetDbProductId}/variants`);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toHaveProperty('variants');
            expect(Array.isArray(data.variants)).toBe(true);

            // Check structure of the first variant if available
            if (data.variants.length > 0) {
                const variant = data.variants[0];
                 expect(variant).toHaveProperty('id');
                 expect(variant).toHaveProperty('color_name');
                 expect(variant).toHaveProperty('size');
                 expect(variant).toHaveProperty('inventory_count');
            }
        });

        it('should return 404 Not Found for a non-existent product ID', async () => {
            const nonExistentId = 'invalid-db-id-99999'; // Use an ID unlikely to exist in the DB
            const response = await fetch(`${API_URL}/api/products/${nonExistentId}/variants`);
            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toContain(`Product with ID ${nonExistentId} not found`);
        });

        // Hono usually handles routes without params as a 404 Not Found for the parent route
        // So a specific test for `/api/products//variants` isn't strictly necessary
        // unless you have specific middleware handling that case.
    });
}); 