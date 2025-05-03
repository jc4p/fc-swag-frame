import { Hono } from 'hono';
import { seedProductData } from '../seed'; // Assuming seed logic is in seed.js

const adminRoutes = new Hono();

// --- Admin Routes ---

// POST /api/admin/seed-product
adminRoutes.post('/seed-product', async (c) => {
    const env = c.env; // Get env from context first
    // Correctly use context (c) to access request headers and env
    if (c.req.headers.get('X-Admin-Secret') !== env.ADMIN_AUTH_KEY) { 
        return c.json({error: 'Unauthorized'}, 401); // Use c.json for consistency
    }

    const productId = '586'; // Hardcoding the target product ID for now
    const targetColors = [
        'Berry', 'Black', 'Blue Jean', 'Brick',
        'Grey', 'Moss', 'True Navy', 'White',
    ];

    console.log(`Received request to seed product ID: ${productId}`);

    try {
        const result = await seedProductData(env, productId, targetColors);
        console.log('Seed Result:', result);
        if (result.success) {
            return c.json(result);
        } else {
            return c.json(result, 500);
        }
    } catch (err) {
        console.error("Unhandled error in seed endpoint:", err);
        return c.json({ success: false, message: 'Internal server error during seeding.' }, 500);
    }
});

export default adminRoutes; 