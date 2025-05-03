import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import Routers
import publicRoutes from './routes/public';
import protectedRoutes from './routes/protected';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';
import websocketRoutes from './routes/websockets';

// Import Scheduled Handler and DO Exports
import { handleScheduled } from './scheduled'; 
import { SessionDurableObject } from './do/session'; 
import { MockupQueueDurableObject } from './do/mockup_queue'; 

const app = new Hono();

// --- Global Middleware ---
app.use('/api/*', cors({
	origin: (origin) => {
		// Allow requests from localhost:3000 during development
		// TODO: Add production frontend URL(s) here
		const allowedOrigins = [
			'http://localhost:3000',
			'https://swag.kasra.codes' // Example production URL
		];
		if (allowedOrigins.includes(origin)) {
			return origin; 
		}
		// Allow other types of requests (e.g. mobile apps, curl)
		// Or handle them more strictly based on requirements
		return origin; // Allow any origin for now, refine later if needed
	},
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // MUST include OPTIONS
	allowHeaders: ['Content-Type', 'Authorization'], // MUST include Authorization and Content-Type
	maxAge: 600, // Cache preflight response for 10 minutes
	credentials: true, // Allow cookies if needed later (doesn't hurt now)
}));

// --- Register Routes (Revised Order) ---
// Register more specific routes first
app.route('/api/admin', adminRoutes);      // Handles /api/admin/*
app.route('/api/webhooks', webhookRoutes); // Handles /api/webhooks/*
app.route('/api/ws', websocketRoutes);     // Handles /api/ws/*

// Register broader /api routes (protected middleware is applied within protectedRoutes)
app.route('/api', publicRoutes);         // Handles public /api/auth/signin, /api/products, /api/feed
app.route('/api', protectedRoutes);      // Handles protected /api/designs, /api/orders

// --- Root and Error Handling ---
app.get('/', (c) => c.text('FC Swag API - Root'));

app.notFound((c) => {
	return c.json({ error: 'Not Found', message: `The requested path ${c.req.url} was not found on this server.` }, 404);
})

app.onError((err, c) => {
	console.error(`[onError] ${c.req.url}: ${err}`, err.stack);
	return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

// --- Exports ---
export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};

// Export Durable Objects
export { SessionDurableObject }; 
export { MockupQueueDurableObject };
