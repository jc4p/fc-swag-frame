import 'dotenv/config';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY || process.env.VITE_PRINTFUL_API_KEY;

const TARGET_COLORS = ['Berry', 'Black', 'Blue Jean', 'Brick', 'Grey', 'Moss', 'True Navy', 'White'];

async function extractProductImages(productId) {
    if (!PRINTFUL_API_KEY) {
        console.error("Error: PRINTFUL_API_KEY not found");
        return;
    }

    const headers = {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // Get main product info
        const productResponse = await fetch(`https://api.printful.com/v2/catalog-products/${productId}`, { headers });
        const productData = await productResponse.json();
        
        console.log(`\nProduct: ${productData.data.name}`);
        console.log(`Main image: ${productData.data.image}\n`);
        
        // Get product images
        const imagesResponse = await fetch(`https://api.printful.com/v2/catalog-products/${productId}/images`, { headers });
        const imagesData = await imagesResponse.json();
        
        console.log("Front images for target colors:");
        console.log("==============================");
        
        for (const colorData of imagesData.data) {
            if (TARGET_COLORS.includes(colorData.color)) {
                const frontImage = colorData.images.find(img => img.placement === "front");
                if (frontImage) {
                    console.log(`${colorData.color}: ${frontImage.image_url}`);
                }
            }
        }
        
        // Also check if we have variant-specific images
        console.log("\nChecking variant images...");
        const variantsResponse = await fetch(`https://api.printful.com/v2/catalog-products/${productId}/catalog-variants`, { headers });
        const variantsData = await variantsResponse.json();
        
        console.log("\nSample variant images (first of each color):");
        console.log("============================================");
        
        const seenColors = new Set();
        for (const variant of variantsData.data) {
            if (TARGET_COLORS.includes(variant.color) && !seenColors.has(variant.color)) {
                seenColors.add(variant.color);
                console.log(`${variant.color} (${variant.size}): ${variant.image}`);
            }
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

// Run for each product
const products = [
    { id: '586', name: 'T-Shirt' },
    { id: '505', name: 'Sticker Sheet' },
    { id: '358', name: 'Kiss-Cut Stickers' }
];

async function main() {
    for (const product of products) {
        console.log("\n" + "=".repeat(50));
        await extractProductImages(product.id);
    }
}

main();