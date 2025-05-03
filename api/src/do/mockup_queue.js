// api/src/do/mockup_queue.js

// Placeholder for Mockup Generation Queue Durable Object
// Will accept jobs, store them, and potentially process them or call external APIs (like Printful mockup API)

export class MockupQueueDurableObject {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.printfulApiKey = env.PRINTFUL_API_KEY;
        this.db = env.DB;
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/queue' && request.method === 'POST') {
            return this.handleQueueRequest(request);
        }

        return new Response('Not found', { status: 404 });
    }

    async handleQueueRequest(request) {
        if (!this.printfulApiKey) {
            console.error('[DO MockupQueue] PRINTFUL_API_KEY not set in environment.');
            return new Response('Internal Server Error: Printful API Key missing', { status: 500 });
        }
        if (!this.db) {
            console.error('[DO MockupQueue] DB binding not available.');
            return new Response('Internal Server Error: Database binding missing', { status: 500 });
        }

        let taskData;
        try {
            taskData = await request.json();
            if (!taskData.designId || !taskData.imageUrl || !taskData.variantId) {
                throw new Error('Missing required fields: designId, imageUrl, variantId');
            }
        } catch (e) {
            console.error('[DO MockupQueue] Failed to parse task data:', e);
            return new Response(`Bad Request: ${e.message}`, { status: 400 });
        }

        const { designId, imageUrl, variantId } = taskData;
        console.log(`[DO MockupQueue] Received task for design ${designId}`);

        try {
            // 1. Get Printful Variant ID from DB
            const variantInfo = await this.db.prepare(
                `SELECT printful_variant_id, print_area_width, print_area_height, print_area_top, print_area_left
                 FROM product_variants WHERE id = ?`
            ).bind(variantId).first();

            if (!variantInfo || !variantInfo.printful_variant_id) {
                throw new Error(`Could not find Printful variant ID or print area for DB variant ${variantId}`);
            }
            
            const printfulVariantId = variantInfo.printful_variant_id;
            console.log(`[DO MockupQueue] Found Printful variant ID: ${printfulVariantId} for DB variant ${variantId}`);

            // 2. Construct Printful Mockup Task Payload
            //    Positioning Logic: Center the image within the print area.
            //    Printful's API positions based on the *print area* coordinates, not the template.
            //    Assuming the image is intended to fill the print area width/height for now.
            //    More sophisticated logic (scaling, aspect ratio handling) might be needed later.
            const printfulPayload = {
                variant_ids: [printfulVariantId],
                format: 'png', // Request PNG mockups
                files: [
                    {
                        placement: 'front', // Assuming 'front' placement for now
                        image_url: imageUrl,
                        position: { // Center within the print area
                            area_width: variantInfo.print_area_width,
                            area_height: variantInfo.print_area_height,
                            width: variantInfo.print_area_width, // Use full print area width
                            height: variantInfo.print_area_height, // Use full print area height
                            top: 0, // Position relative to print area top-left
                            left: 0 // Position relative to print area top-left
                        }
                    }
                ],
                // Use designId as external_id for webhook correlation
                external_id: designId.toString() 
            };

            // console.log(`[DO MockupQueue] Calling Printful Mockup API for design ${designId}... Payload:`, JSON.stringify(printfulPayload, null, 2));
            console.log(`[DO MockupQueue] Calling Printful Mockup API for design ${designId}...`);

            // 3. Call Printful API
            const printfulApiUrl = 'https://api.printful.com/v2/mockup-tasks';
            const printfulResponse = await fetch(printfulApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.printfulApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(printfulPayload)
            });

            const printfulResult = await printfulResponse.json();

            if (!printfulResponse.ok) {
                console.error(`[DO MockupQueue] Printful API error for design ${designId}:`, printfulResponse.status, printfulResult);
                // Update design status to indicate error?
                await this.updateDesignStatus(designId, 'mockup_error');
                throw new Error(`Printful API request failed with status ${printfulResponse.status}`);
            }

            // console.log(`[DO MockupQueue] Printful mockup task created successfully for design ${designId}:`, printfulResult);
            console.log(`[DO MockupQueue] Printful mockup task created successfully for design ${designId}. Task key: ${printfulResult?.task_key}`);

            // Update design status to pending
            await this.updateDesignStatus(designId, 'mockup_pending');

            return new Response(JSON.stringify({ success: true, message: 'Mockup task queued with Printful' }), { status: 200 });

        } catch (error) {
            console.error(`[DO MockupQueue] Error processing mockup task for design ${designId}:`, error);
            // Attempt to update design status to error
            try {
                 await this.updateDesignStatus(designId, 'mockup_error');
            } catch (dbError) {
                console.error(`[DO MockupQueue] Failed to update design ${designId} status to error after task failure:`, dbError);
            }
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
    }

    // Helper to update design status in D1
    async updateDesignStatus(designId, status) {
        try {
            await this.db.prepare(
                `UPDATE designs SET status = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(status, designId).run();
            console.log(`[DO MockupQueue] Updated status for design ${designId} to ${status}`);
        } catch (dbError) {
            console.error(`[DO MockupQueue] Failed to update DB status for design ${designId} to ${status}:`, dbError);
            // Re-throw? Or just log?
            throw dbError; // Re-throw so the caller knows the update failed
        }
    }
} 