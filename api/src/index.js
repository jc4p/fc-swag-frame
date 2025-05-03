import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { seedProductData } from './seed';
import { SessionDurableObject } from './do/session';
import { MockupQueueDurableObject } from './do/mockup_queue'; // Import DO class
import { handleSignIn, authMiddleware } from './auth'; // Import auth handlers
import { handleScheduled } from './scheduled'; // <-- Import the scheduled handler

const app = new Hono();

// --- Middleware ---
// Enable CORS for all origins (adjust as needed for production)
app.use('/api/*', cors());

// --- Public Routes ---
app.post('/api/auth/signin', async (c) => {
	// Delegate to the auth handler
	return handleSignIn(c.req.raw, c.env);
});

app.get('/api/products', async (c) => {
	const active = c.req.query('active'); // Currently unused, assuming all seeded are active

	try {
		// Define the desired order for sizes
		const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
		const sizeSortMap = Object.fromEntries(sizeOrder.map((size, index) => [size, index]));

		// Fetch all products from the 'products' table
		const { results: products } = await c.env.DB.prepare(
			`SELECT id, name, slug FROM products WHERE status = 'active'` // Added status check
		).all();

		if (!products || products.length === 0) {
			return c.json({ products: [] });
		}

		// Prepare a statement to fetch variants for a given product ID
		const variantsStmt = c.env.DB.prepare(
			`SELECT id, color_name, color_code, size, inventory_count, printful_price
			 FROM product_variants
			 WHERE product_id = ?`
		);

		// Fetch and process variants for each product concurrently
		const productPromises = products.map(async (product) => {
			const { results: variants } = await variantsStmt.bind(product.id).all();

			if (!variants || variants.length === 0) {
				// Handle case where an active product might have 0 variants (e.g., out of stock)
				return {
					id: product.id,
					name: product.name,
					slug: product.slug,
					options: { color_name: [], size: [] },
					colors: []
				};
			}

			// 1. Sort variants by size
			const sortedVariants = variants.sort((a, b) => {
				const sizeA = sizeSortMap[a.size] ?? Infinity;
				const sizeB = sizeSortMap[b.size] ?? Infinity;
				return sizeA - sizeB;
			});

			// 2. Extract unique options (colors and sorted sizes)
			const uniqueColors = [...new Set(sortedVariants.map(v => v.color_name))];
			const uniqueSizes = [...new Set(sortedVariants.map(v => v.size))]
				.sort((a, b) => (sizeSortMap[a] ?? Infinity) - (sizeSortMap[b] ?? Infinity)); // Ensure sizes are sorted

			// 3. Group variants by color
			const variantsByColor = sortedVariants.reduce((acc, variant) => {
				if (!acc[variant.color_name]) {
					acc[variant.color_name] = {
						color_name: variant.color_name,
						color_code: variant.color_code,
						variants: []
					};
				}
				// Add only the relevant variant details, already sorted by size
				acc[variant.color_name].variants.push({
					id: variant.id,
					size: variant.size,
					inventory_count: variant.inventory_count,
					base_price: variant.printful_price
				});
				return acc;
			}, {});

			// ---> Calculate Price Range for each color
			const colorsArray = Object.values(variantsByColor).map(colorGroup => {
				// Get the base price from the first variant in the group (should be the same for S-XL)
				const firstVariantPrice = colorGroup.variants.length > 0
					? colorGroup.variants[0].base_price
					: null;

				return {
					...colorGroup,
					base_price: firstVariantPrice // Add the numeric base price for the color
				};
			});
			// <---

			// 4. Structure the final product object
			return {
				id: product.id,
				name: product.name,
				slug: product.slug,
				options: {
					color_name: uniqueColors,
					size: uniqueSizes
				},
				colors: colorsArray // Use the array with price_range included
			};
		});

		const productsWithVariants = await Promise.all(productPromises);

		return c.json({ products: productsWithVariants });

	} catch (error) {
		console.error("Error fetching products:", error);
		return c.json({ error: "Failed to fetch products" }, 500);
	}
});

app.get('/api/products/:product_id/variants', async (c) => {
	const productId = c.req.param('product_id');
	console.log(`Fetching variants for product ${productId}`);

	if (!productId) {
		return c.json({ error: "Missing product_id parameter" }, 400);
	}

	try {
		const { results: variants } = await c.env.DB.prepare(
			`SELECT id, color_name, size, inventory_count
			 FROM product_variants
			 WHERE product_id = ?`
		).bind(productId).all();

		if (!variants) {
			// D1 returns undefined if the query syntax is wrong, but an empty array if no rows match.
			// We'll treat undefined as an error but an empty array as a valid (though empty) result.
			console.error(`Error fetching variants for product ${productId}: Query failed (undefined result)`);
			return c.json({ error: "Failed to fetch variants" }, 500);
		}

		if (variants.length === 0) {
			// It's valid for a product to exist but have no variants (or the ID is wrong)
			// Check if the product itself exists to give a better error message
			const { results: productCheck } = await c.env.DB.prepare(
				`SELECT 1 FROM products WHERE id = ? LIMIT 1`
			).bind(productId).all();

			if (!productCheck || productCheck.length === 0) {
				return c.json({ error: `Product with ID ${productId} not found` }, 404);
			}
		}

		// Format the response
		const formattedVariants = variants.map(v => ({
			id: v.id,
			color_name: v.color_name,
			size: v.size,
			inventory_count: v.inventory_count
		}));

		return c.json({ variants: formattedVariants });

	} catch (error) {
		console.error(`Error fetching variants for product ${productId}:`, error);
		return c.json({ error: "Failed to fetch variants" }, 500);
	}
});

app.get('/api/designs/:design_id', (c) => {
	const designId = c.req.param('design_id');
	// TODO: Fetch public design details from D1
	console.log(`Fetching public design ${designId}`);
	return c.json({ message: `Design ${designId} details not implemented yet` }, 501);
});

app.get('/api/feed', (c) => {
	const page = c.req.query('page') || 1;
	const limit = c.req.query('limit') || 10;
	// TODO: Fetch paginated public designs from D1
	console.log(`Fetching public feed (page=${page}, limit=${limit})`);
	return c.json({ message: 'Public feed not implemented yet' }, 501);
});


// --- Protected Routes (Require Auth Middleware - to be added later) ---

app.get('/api/designs', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	console.log(`Fetching designs for user FID: ${userFid}`);
	return c.json({ message: `User ${userFid} designs list not implemented yet` }, 501);
});

app.post('/api/designs', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	console.log(`Creating design for user FID: ${userFid}`);
	return c.json({ message: `Create design for ${userFid} not implemented yet` }, 501);
});

app.post('/api/designs/:design_id/publish', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	const designId = c.req.param('design_id');
	console.log(`Publishing design ${designId} for user FID: ${userFid}`);
	return c.json({ message: `Publish design ${designId} for ${userFid} not implemented yet` }, 501);
});

app.get('/api/orders', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	console.log(`Fetching orders for user FID: ${userFid}`);
	return c.json({ message: `User ${userFid} orders list not implemented yet` }, 501);
});

app.post('/api/orders', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	console.log(`Creating order for user FID: ${userFid}`);
	return c.json({ message: `Create order for ${userFid} not implemented yet` }, 501);
});

app.get('/api/orders/:order_id/signature', authMiddleware, (c) => {
	const userFid = c.get('userFid');
	const orderId = c.req.param('order_id');
	console.log(`Generating signature for order ${orderId} requested by FID: ${userFid}`);
	return c.json({ message: `Generate signature for order ${orderId} (user ${userFid}) not implemented yet` }, 501);
});


// --- Admin/Utility Routes (REMOVE OR SECURE FOR PRODUCTION) ---
app.post('/api/admin/seed-product', async (c) => {
	const productId = '586'; // Hardcoding the target product ID for now
	const targetColors = [
		'Black',
		'White',
		'Blue Jean',
		'Moss',
		'Grey',
		'True Navy',
		'Berry',
		'Brick'
	];

	console.log(`Received request to seed product ID: ${productId}`);

	try {
		const result = await seedProductData(c.env, productId, targetColors);
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


// --- Webhooks & WebSockets ---
app.post('/api/webhooks/printful', (c) => {
	// TODO: Handle Printful webhook payload
	// TODO: Update D1 'designs' or 'orders' based on webhook type
	// TODO: Notify relevant Durable Object session
	console.log("Printful webhook received");
	return c.json({ success: true }); // Acknowledge webhook quickly
});

app.get('/api/ws', (c) => {
	// TODO: Implement WebSocket upgrade logic
	// TODO: Connect to Durable Object session
	console.log("WebSocket connection request");
	return c.text('WebSocket endpoint not implemented yet', 501);
});


// --- Root and Export ---
app.get('/', (c) => c.text('API Root - Hello World!'));

export default {
	fetch: app.fetch,
	scheduled: handleScheduled // <-- Add the scheduled handler export
};

// Export DO classes
export { SessionDurableObject, MockupQueueDurableObject };
