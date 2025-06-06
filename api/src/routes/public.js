import { Hono } from 'hono';
// import { handleSignIn } from '../auth'; // Assuming auth handler is separate

const publicRoutes = new Hono();

// --- Public Routes ---

// POST /api/auth/signin
// publicRoutes.post('/auth/signin', async (c) => {
//     return handleSignIn(c.req.raw, c.env);
// });

// GET /api/products
publicRoutes.get('/products', async (c) => {
    const env = c.env;
    try {
        // Fetch all active products
        const { results: products } = await env.DB.prepare(
            "SELECT id, name, slug, printful_product_id, image_url FROM products WHERE status = 'active'"
        ).all();

        if (!products || products.length === 0) {
            return c.json({ products: [] });
        }

        // Fetch variants for all active products
        const placeholders = products.map(() => '?').join(',');
        const productIds = products.map(p => p.id);
        const query = `
          SELECT
            pv.id, pv.product_id, pv.printful_variant_id,
            pv.color_name, pv.color_code, pv.size, pv.printful_price,
            pv.inventory_count, pv.status,
            pv.template_image_url, pv.template_texture_url, pv.template_width, pv.template_height,
            pv.print_area_width, pv.print_area_height, pv.print_area_top, pv.print_area_left
          FROM product_variants pv
          WHERE pv.product_id IN (${placeholders})
            AND pv.status != 'discontinued'
          ORDER BY pv.product_id, pv.size
        `;
        const { results: allVariants } = await env.DB.prepare(query).bind(...productIds).all();

        // Group variants by product ID
        const variantsByProductId = allVariants.reduce((acc, variant) => {
            if (!acc[variant.product_id]) {
                acc[variant.product_id] = [];
            }
            acc[variant.product_id].push(variant);
            return acc;
        }, {});

        // Structure the response
        const responseProducts = products.map(product => {
            const productVariants = variantsByProductId[product.id] || [];
            const options = {
                color_name: [...new Set(productVariants.map(v => v.color_name))].sort(),
                size: [...new Set(productVariants.map(v => v.size))].sort((a, b) => {
                    const sizeOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4 };
                    return (sizeOrder[a] || 99) - (sizeOrder[b] || 99);
                }),
            };
            const colors = options.color_name.map(colorName => {
                const variantsOfColor = productVariants.filter(v => v.color_name === colorName);
                const representativeVariant = variantsOfColor.find(v => v.size === 'M') || variantsOfColor[0];
                const basePrice = representativeVariant ? representativeVariant.printful_price : null;
                const colorCode = representativeVariant ? representativeVariant.color_code : null;

                return {
                    color_name: colorName,
                    color_code: colorCode,
                    base_price: basePrice,
                    variants: variantsOfColor.map(v => ({
                        id: v.id,
                        printful_variant_id: v.printful_variant_id,
                        size: v.size,
                        inventory_count: v.inventory_count,
                        status: v.status,
                        base_price: v.printful_price,
                        template_image_url: v.template_image_url,
                        template_texture_url: v.template_texture_url,
                        template_width: v.template_width,
                        template_height: v.template_height,
                        print_area_width: v.print_area_width,
                        print_area_height: v.print_area_height,
                        print_area_top: v.print_area_top,
                        print_area_left: v.print_area_left,
                    })),
                };
            });
            return {
                id: product.id,
                printful_product_id: product.printful_product_id,
                name: product.name,
                slug: product.slug,
                image_url: product.image_url,
                options: options,
                colors: colors,
            };
        });
        return c.json({ products: responseProducts });
    } catch (e) {
        console.error("Error fetching products:", e);
        return c.json({ error: 'Error fetching products' }, 500);
    }
});

// GET /api/products/:product_id/variants
publicRoutes.get('/products/:product_id/variants', async (c) => {
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
            console.error(`Error fetching variants for product ${productId}: Query failed`);
            return c.json({ error: "Failed to fetch variants" }, 500);
        }

        if (variants.length === 0) {
            const { results: productCheck } = await c.env.DB.prepare(
                `SELECT 1 FROM products WHERE id = ? LIMIT 1`
            ).bind(productId).all();
            if (!productCheck || productCheck.length === 0) {
                return c.json({ error: `Product with ID ${productId} not found` }, 404);
            }
        }
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

// GET /api/designs/:design_id (Public view)
publicRoutes.get('/designs/:design_id', (c) => {
    const designId = c.req.param('design_id');
    // TODO: Fetch public design details from D1 (where is_public = true)
    console.log(`Fetching public design ${designId}`);
    return c.json({ message: `Public view for design ${designId} not implemented yet` }, 501);
});

// GET /api/feed (Public)
publicRoutes.get('/feed', async (c) => {
    const page = parseInt(c.req.query('page')) || 1;
    const limit = Math.min(parseInt(c.req.query('limit')) || 20, 50); // Max 50 per page
    const offset = (page - 1) * limit;

    try {
        // Get total count of published designs
        const countResult = await c.env.DB.prepare(
            'SELECT COUNT(*) as total FROM designs WHERE is_public = TRUE'
        ).first();
        const totalDesigns = countResult?.total || 0;

        if (totalDesigns === 0) {
            return c.json({
                designs: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    total_pages: 0,
                    has_next: false,
                    has_prev: false
                }
            });
        }

        // Fetch paginated published designs with product/variant info
        const { results: designs } = await c.env.DB.prepare(`
            SELECT 
                d.id,
                d.fid,
                d.image_url,
                d.mockup_url,
                d.retail_price,
                d.artist_earn,
                d.royalty_percent,
                d.published_at,
                p.name as product_name,
                p.slug as product_slug,
                pv.color_name,
                pv.size,
                pv.color_code
            FROM designs d
            JOIN products p ON d.product_id = p.id
            JOIN product_variants pv ON d.variant_id = pv.id
            WHERE d.is_public = TRUE
            ORDER BY d.published_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        const totalPages = Math.ceil(totalDesigns / limit);

        return c.json({
            designs: designs || [],
            pagination: {
                page,
                limit,
                total: totalDesigns,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_prev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching public feed:', error);
        return c.json({ error: 'Failed to fetch public feed' }, 500);
    }
});


export default publicRoutes; 