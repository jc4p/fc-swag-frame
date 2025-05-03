import { Hono } from 'hono';
import { authMiddleware } from '../auth'; // Import auth middleware

// Helper function to generate a unique filename (e.g., UUID)
// Using Web Crypto API available in Workers
function generateUUID() {
    return crypto.randomUUID();
}

// Helper to get file extension
function getExtension(filename) {
    return filename.substring(filename.lastIndexOf('.') + 1) || 'png'; // Default to png if no extension
}

const protectedRoutes = new Hono();

// Apply auth middleware to all routes in this file
protectedRoutes.use('*', authMiddleware);

// --- Protected Routes ---

// GET /api/designs - List user's designs
protectedRoutes.get('/designs', async (c) => {
  const userFid = c.get('userFid');
  if (!userFid) {
    // Should be caught by middleware, but belt-and-suspenders
    return c.json({ error: 'Unauthorized: Missing user FID in context' }, 401);
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, product_id, variant_id, image_url, mockup_url, status, is_public, created_at, updated_at
       FROM designs WHERE fid = ? ORDER BY created_at DESC`
    ).bind(userFid).all();
    return c.json({ designs: results || [] });
  } catch (e) {
    console.error("Error fetching user designs:", e);
    return c.json({ error: 'Failed to fetch designs' }, 500);
  }
});

// POST /api/designs - Create a new design (handles multipart/form-data)
protectedRoutes.post('/designs', async (c) => {
    const userFid = c.get('userFid');
    if (!userFid) {
        return c.json({ error: 'Unauthorized: Missing user FID in context' }, 401);
    }

    let formData;
    try {
        formData = await c.req.formData();
    } catch (e) {
        console.error("Error parsing form data:", e);
        return c.json({ success: false, message: 'Invalid form data' }, 400);
    }

    const product_id = formData.get('product_id');
    const variant_id = formData.get('variant_id');
    const imageFile = formData.get('image'); // Assuming the file input name is 'image'

    // Validation
    if (!product_id || !variant_id || !(imageFile instanceof File)) {
        return c.json({ success: false, message: 'Missing required fields: product_id, variant_id, and image file' }, 400);
    }

    if (!c.env.R2_BUCKET || !c.env.R2_PUBLIC_URL) {
        console.error('R2 environment variables not configured');
        return c.json({ success: false, message: 'Server configuration error for image storage.' }, 500);
    }

    const db = c.env.DB;
    const r2 = c.env.R2_BUCKET;
    const r2PublicUrl = c.env.R2_PUBLIC_URL;

    try {
        // Generate R2 key
        const fileExtension = getExtension(imageFile.name);
        const uniqueFilename = `${generateUUID()}.${fileExtension}`;
        const r2Key = `user-images/${userFid}/${product_id}/${uniqueFilename}`;

        // Upload to R2
        await r2.put(r2Key, await imageFile.arrayBuffer(), {
            httpMetadata: { contentType: imageFile.type || 'image/png' }
        });
        const imageUrl = `${r2PublicUrl.replace(/\/$/, '')}/${r2Key}`;
        console.log(`Design image uploaded: ${imageUrl}`);

        // Insert into Database
        const result = await db.prepare(
            `INSERT INTO designs (fid, product_id, variant_id, image_url, status)
             VALUES (?, ?, ?, ?, 'draft') RETURNING id`
        ).bind(userFid, product_id, variant_id, imageUrl).first();

        const newDesignId = result?.id;
        if (!newDesignId) {
            // Attempt to clean up R2 upload if DB insert fails?
            // await r2.delete(r2Key);
            throw new Error("Failed to insert design into database after image upload.");
        }
        console.log(`Design DB record created for FID ${userFid} with ID ${newDesignId}.`);

        // Enqueue mockup generation task
        try {
            // Use the correct binding name from wrangler.toml
            const doBinding = c.env.MOCKUP_QUEUE_DO; 
            if (!doBinding) {
                throw new Error("MOCKUP_QUEUE_DO binding is not configured in wrangler.toml or not available in env.");
            }
            const doId = doBinding.idFromName("singleton"); // Use a consistent name for the queue DO
            const stub = doBinding.get(doId);

            // Send the task to the DO
            await stub.fetch('http://do-mockup-queue/queue', { // Use a dummy internal URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    designId: newDesignId,
                    imageUrl: imageUrl,
                    variantId: parseInt(variant_id) // Pass variant_id too, needed for Printful
                })
            });
            console.log(`Mockup task enqueued for design ID: ${newDesignId}`);
        } catch (doError) {
            console.error(`Failed to enqueue mockup task for design ${newDesignId}:`, doError);
            // Decide how to handle this: maybe update design status to 'queue_failed'?
            // For now, we'll just log it and return success for the design creation itself.
            // Optionally, could return a 202 Accepted with a warning.
        }

        return c.json({ success: true, designId: newDesignId, imageUrl: imageUrl }, 201);

    } catch (e) {
        console.error("Error processing design creation:", e);
        if (e.message && e.message.includes('FOREIGN KEY constraint failed')) {
            return c.json({ success: false, message: 'Invalid product_id or variant_id.' }, 400);
        }
        return c.json({ success: false, message: 'Failed to create design' }, 500);
    }
});

// POST /api/designs/:design_id/publish - Publish a design (stub)
protectedRoutes.post('/designs/:design_id/publish', (c) => {
    const userFid = c.get('userFid');
    const designId = c.req.param('design_id');
    console.log(`Publishing design ${designId} for user FID: ${userFid}`);
    // TODO: Implement publish logic (update is_public, set royalty, calculate price)
    return c.json({ message: `Publish design ${designId} for ${userFid} not implemented yet` }, 501);
});

// GET /api/orders - List user's orders (stub)
protectedRoutes.get('/orders', (c) => {
    const userFid = c.get('userFid');
    console.log(`Fetching orders for user FID: ${userFid}`);
    // TODO: Implement order fetching logic
    return c.json({ message: `User ${userFid} orders list not implemented yet` }, 501);
});

// POST /api/orders - Create an order (stub)
protectedRoutes.post('/orders', (c) => {
    const userFid = c.get('userFid');
    console.log(`Creating order for user FID: ${userFid}`);
    // TODO: Implement order creation logic
    return c.json({ message: `Create order for ${userFid} not implemented yet` }, 501);
});

// GET /api/orders/:order_id/signature - Generate payment signature (stub)
protectedRoutes.get('/orders/:order_id/signature', (c) => {
    const userFid = c.get('userFid');
    const orderId = c.req.param('order_id');
    console.log(`Generating signature for order ${orderId} requested by FID: ${userFid}`);
    // TODO: Implement signature generation logic
    return c.json({ message: `Generate signature for order ${orderId} (user ${userFid}) not implemented yet` }, 501);
});

export default protectedRoutes; 