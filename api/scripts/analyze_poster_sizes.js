import 'dotenv/config';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY || process.env.VITE_PRINTFUL_API_KEY;

async function analyzePosterSizes(productId) {
    if (!PRINTFUL_API_KEY) {
        console.error("Error: PRINTFUL_API_KEY not found");
        return;
    }

    const headers = {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // Get product info
        const productResponse = await fetch(`https://api.printful.com/v2/catalog-products/${productId}`, { headers });
        const productData = await productResponse.json();
        
        console.log(`\nProduct: ${productData.data.name}`);
        console.log(`Total sizes: ${productData.data.sizes.length}`);
        
        // Get variants with dimensions
        const variantsResponse = await fetch(`https://api.printful.com/v2/catalog-products/${productId}/catalog-variants`, { headers });
        const variantsData = await variantsResponse.json();
        
        // Analyze sizes and group by aspect ratio
        const sizesByAspectRatio = {};
        const allSizes = [];
        
        for (const variant of variantsData.data) {
            const placement = variant.placement_dimensions?.find(p => p.placement === 'default');
            if (placement) {
                const width = placement.width;
                const height = placement.height;
                const aspectRatio = (width / height).toFixed(3);
                
                const sizeInfo = {
                    id: variant.id,
                    size: variant.size,
                    width: width,
                    height: height,
                    aspectRatio: parseFloat(aspectRatio),
                    orientation: width > height ? 'landscape' : width < height ? 'portrait' : 'square'
                };
                
                allSizes.push(sizeInfo);
                
                if (!sizesByAspectRatio[aspectRatio]) {
                    sizesByAspectRatio[aspectRatio] = [];
                }
                sizesByAspectRatio[aspectRatio].push(sizeInfo);
            }
        }
        
        // Sort sizes by dimensions
        allSizes.sort((a, b) => (a.width * a.height) - (b.width * b.height));
        
        console.log("\nAll sizes sorted by area:");
        console.log("========================");
        for (const size of allSizes) {
            console.log(`${size.size.padEnd(20)} - ${size.width}″×${size.height}″ (${size.aspectRatio}) - ${size.orientation}`);
        }
        
        console.log("\nSizes grouped by aspect ratio:");
        console.log("==============================");
        const sortedRatios = Object.keys(sizesByAspectRatio).sort((a, b) => parseFloat(a) - parseFloat(b));
        
        for (const ratio of sortedRatios) {
            const sizes = sizesByAspectRatio[ratio];
            const orientation = sizes[0].orientation;
            console.log(`\nAspect Ratio ${ratio} (${orientation}):`);
            for (const size of sizes) {
                console.log(`  - ${size.size} (${size.width}″×${size.height}″)`);
            }
        }
        
        // Common aspect ratios
        console.log("\nCommon aspect ratio groups:");
        console.log("===========================");
        const commonRatios = {
            '1:1 (Square)': 1.0,
            '3:4 (Portrait)': 0.75,
            '4:5 (Portrait)': 0.8,
            '2:3 (Portrait)': 0.667,
            '5:7 (Portrait)': 0.714,
            '3:2 (Landscape)': 1.5,
            '4:3 (Landscape)': 1.333,
            '16:9 (Wide)': 1.778
        };
        
        for (const [name, targetRatio] of Object.entries(commonRatios)) {
            console.log(`\n${name}:`);
            const matching = allSizes.filter(s => Math.abs(s.aspectRatio - targetRatio) < 0.05);
            if (matching.length > 0) {
                for (const size of matching) {
                    console.log(`  - ${size.size} (${size.width}″×${size.height}″) - ratio: ${size.aspectRatio}`);
                }
            } else {
                console.log("  No matching sizes");
            }
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

// Analyze both poster types
async function main() {
    console.log("=".repeat(60));
    console.log("MATTE POSTER (ID: 1)");
    console.log("=".repeat(60));
    await analyzePosterSizes('1');
    
    console.log("\n\n" + "=".repeat(60));
    console.log("GLOSSY POSTER (ID: 171)");
    console.log("=".repeat(60));
    await analyzePosterSizes('171');
}

main();