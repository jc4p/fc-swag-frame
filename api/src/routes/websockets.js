import { Hono } from 'hono';
import { authMiddleware } from '../auth'; // Import auth middleware

const websocketRoutes = new Hono();

// Apply auth middleware - WebSocket connections should be authenticated
websocketRoutes.use('*', authMiddleware);

// GET /api/ws - Handles WebSocket upgrade requests
websocketRoutes.get('/', (c) => {
    const userFid = c.get('userFid');
    if (!userFid) {
        // Should be caught by middleware, but double-check
        return c.json({ error: 'Unauthorized: Missing user FID in context' }, 401);
    }

    // Check for the Upgrade header
    const upgradeHeader = c.req.header('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 }); // 426 Upgrade Required
    }

    // Get the Durable Object binding
    const sessionDoBinding = c.env.SESSION_DO;
    if (!sessionDoBinding) {
        console.error('SESSION_DO binding missing in environment.');
        return new Response('Internal Server Error: WebSocket service not configured.', { status: 500 });
    }

    try {
        // Get the specific DO instance for this user FID
        const doId = sessionDoBinding.idFromName(userFid.toString());
        const stub = sessionDoBinding.get(doId);

        // Forward the request (including headers) to the Durable Object
        // The DO's fetch handler will perform the WebSocket handshake
        console.log(`Forwarding WebSocket request for FID ${userFid} to SessionDO ${doId.toString()}`);
        return stub.fetch(c.req.raw); 
    } catch (e) {
        console.error(`Error getting/fetching SessionDO for FID ${userFid}:`, e);
        return new Response('Internal Server Error: Could not establish WebSocket connection.', { status: 500 });
    }
});

export default websocketRoutes; 