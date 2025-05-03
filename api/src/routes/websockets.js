import { Hono } from 'hono';

const websocketRoutes = new Hono();

// --- WebSocket Routes ---

// GET /api/ws
websocketRoutes.get('/', (c) => {
    // TODO: Implement WebSocket upgrade logic
    // TODO: Connect to Durable Object session
    console.log("WebSocket connection request");
    return c.text('WebSocket endpoint not implemented yet', 501);
});

export default websocketRoutes; 