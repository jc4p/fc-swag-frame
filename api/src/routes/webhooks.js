import { Hono } from 'hono';

const webhookRoutes = new Hono();

// --- Webhook Routes ---

// POST /api/webhooks/printful
webhookRoutes.post('/printful', (c) => {
    // TODO: Handle Printful webhook payload (verify signature if possible)
    // TODO: Update D1 'designs' or 'orders' based on webhook type
    // TODO: Notify relevant Durable Object session
    console.log("Printful webhook received");
    // Acknowledge webhook quickly to prevent retries from Printful
    return c.json({ success: true }); 
});

export default webhookRoutes; 