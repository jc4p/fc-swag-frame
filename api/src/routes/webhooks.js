import { Hono } from 'hono';

const webhookRoutes = new Hono();

// --- Webhook Routes ---

// POST /api/webhooks/printful
webhookRoutes.post('/printful', async (c) => {
    const db = c.env.DB;
    if (!db) {
        console.error('[Webhook Printful] DB binding not available.');
        return c.json({ error: 'Internal Server Error: Database binding missing' }, 500);
    }

    let payload;
    try {
        payload = await c.req.json();
        // console.log('[Webhook Printful] Received payload:', JSON.stringify(payload, null, 2));
    } catch (e) {
        console.error('[Webhook Printful] Failed to parse request body:', e);
        return c.json({ error: 'Invalid request body' }, 400);
    }

    // TODO: Implement Printful webhook signature verification if available/required
    // const signature = c.req.header('X-Printful-Signature'); // Example header
    // if (!isValidSignature(payload, signature, c.env.PRINTFUL_WEBHOOK_SECRET)) {
    //     console.warn('[Webhook Printful] Invalid signature received');
    //     return c.json({ error: 'Invalid signature' }, 401);
    // }

    const eventType = payload.type;
    const task = payload.data?.task; // Data structure might vary based on event
    const mockup = payload.data?.mockup; // Data structure for finished mockup

    // Check if it's a finished mockup task
    if (eventType === 'mockup_task_finished' && mockup) {
        const externalId = mockup.external_id;
        const mockupUrl = mockup.mockup_url;

        if (!externalId || !mockupUrl) {
            console.error('[Webhook Printful] Missing external_id or mockup_url in finished event', payload);
            return c.json({ error: 'Missing required data in webhook payload' }, 400);
        }

        const designId = parseInt(externalId, 10);
        if (isNaN(designId)) {
            console.error('[Webhook Printful] Invalid external_id (designId):', externalId);
            return c.json({ error: 'Invalid external_id' }, 400);
        }

        console.log(`[Webhook Printful] Mockup finished for design ${designId}. URL: ${mockupUrl}`);

        try {
            // Update the design record in D1
            console.log(`[Webhook Printful] Attempting update for ID: ${designId} with status IN check.`);
            await db.prepare(
                `UPDATE designs
                 SET mockup_url = ?, status = 'mockup_ready', updated_at = datetime('now')
                 WHERE id = ? AND status IN (?, ?)`
            ).bind(mockupUrl, designId, 'mockup_pending', 'draft').run();

            // Assume success if no error is thrown, as result.changes might be unreliable in local D1 simulation.
            console.log(`[Webhook Printful] Successfully updated design ${designId} with mockup URL (or assumed success).`);

            // Notify Session Durable Object via WebSocket
            try {
                // Get the FID associated with this design
                const designInfo = await db.prepare(
                    `SELECT fid FROM designs WHERE id = ?`
                ).bind(designId).first();

                if (designInfo && designInfo.fid) {
                    const userFid = designInfo.fid;
                    const sessionDoBinding = c.env.SESSION_DO;
                    if (!sessionDoBinding) {
                         console.error('[Webhook Printful] SESSION_DO binding missing. Cannot notify client.');
                    } else {
                        const doId = sessionDoBinding.idFromName(userFid.toString());
                        const stub = sessionDoBinding.get(doId);
                        // Send notification asynchronously (fire-and-forget)
                        stub.fetch('http://do-session/notify', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'mockup_ready', designId, mockupUrl })
                        }); 
                        console.log(`[Webhook Printful] Sent mockup_ready notification to SessionDO for FID ${userFid}, Design ${designId}`);
                    }
                } else {
                    console.warn(`[Webhook Printful] Could not find FID for design ${designId} to send notification.`);
                }
            } catch (notifyError) {
                console.error(`[Webhook Printful] Error sending notification for design ${designId}:`, notifyError);
            }

            return c.json({ success: true }); // Acknowledge receipt
        } catch (e) {
            console.error(`[Webhook Printful] Failed to update database for design ${designId}:`, e);
            return c.json({ error: 'Database update failed' }, 500);
        }

    } else if (eventType === 'mockup_task_failed' && task) {
        const externalId = task.external_id;
        const reason = task.reason || 'Unknown error';
        
        if (!externalId) {
             console.error('[Webhook Printful] Missing external_id in failed event', payload);
             return c.json({ error: 'Missing external_id in failure payload' }, 400);
        }
        
        const designId = parseInt(externalId, 10);
        if (isNaN(designId)) {
            console.error('[Webhook Printful] Invalid external_id (designId) in failed event:', externalId);
            return c.json({ error: 'Invalid external_id' }, 400);
        }
        
        console.warn(`[Webhook Printful] Mockup task failed for design ${designId}. Reason: ${reason}`);
        
         try {
            await db.prepare(
                `UPDATE designs SET status = 'mockup_error', updated_at = datetime('now')
                 WHERE id = ? AND status = 'mockup_pending'`
            ).bind(designId).run();
            console.log(`[Webhook Printful] Updated status to mockup_error for design ${designId}.`);
            // TODO: Notify Session Durable Object about failure?
            try {
                 // Get the FID associated with this design
                const designInfo = await db.prepare(
                    `SELECT fid FROM designs WHERE id = ?`
                ).bind(designId).first();
                
                if (designInfo && designInfo.fid) {
                    const userFid = designInfo.fid;
                    const sessionDoBinding = c.env.SESSION_DO;
                    if (sessionDoBinding) {
                        const doId = sessionDoBinding.idFromName(userFid.toString());
                        const stub = sessionDoBinding.get(doId);
                        stub.fetch('http://do-session/notify', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'mockup_error', designId, reason })
                        }); 
                         console.log(`[Webhook Printful] Sent mockup_error notification to SessionDO for FID ${userFid}, Design ${designId}`);
                    }
                } 
            } catch (notifyError) {
                 console.error(`[Webhook Printful] Error sending failure notification for design ${designId}:`, notifyError);
            }
        } catch (e) {
            console.error(`[Webhook Printful] Failed to update database status to error for design ${designId}:`, e);
            // Don't return 500, Printful might retry. Log error and return success.
        }
        
        return c.json({ success: true }); // Acknowledge receipt even on failure update

    } else {
        console.log(`[Webhook Printful] Received unhandled event type: ${eventType}`);
        return c.json({ message: 'Webhook received, event type not processed' });
    }
});

export default webhookRoutes; 