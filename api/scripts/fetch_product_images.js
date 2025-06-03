import 'dotenv/config';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY || process.env.VITE_PRINTFUL_API_KEY;

async function fetchProductImages(productId) {
    if (!PRINTFUL_API_KEY) {
        console.error("Error: PRINTFUL_API_KEY not found in environment variables");
        return;
    }

    const headers = {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // Fetch product images endpoint
        const imagesUrl = `https://api.printful.com/v2/catalog-products/${productId}/images`;
        console.log(`Fetching images for product ${productId}...`);
        
        const response = await fetch(imagesUrl, { headers });
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`Error: ${response.status} - ${error}`);
            return;
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error("Error fetching images:", error);
    }
}

// Get productId from command line or use default
const productId = process.argv[2] || '586';
fetchProductImages(productId);