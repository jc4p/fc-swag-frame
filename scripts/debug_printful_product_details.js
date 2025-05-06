import 'dotenv/config';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

async function fetchPrintfulProductDetails(productId, apiKey) {
    if (!apiKey) {
        console.error("Error: PRINTFUL_API_KEY environment variable is not set.");
        console.error("Please set it in your .env file.");
        return;
    }

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    // 1. Fetch main product data
    const productUrl = `https://api.printful.com/v2/catalog-products/${productId}`;
    console.log(`Fetching main product data for ID: ${productId} from ${productUrl}...`);

    try {
        const productResponse = await fetch(productUrl, { method: 'GET', headers: headers });
        if (!productResponse.ok) {
            let errorBody = 'Could not read error body';
            try { errorBody = await productResponse.json(); } catch (e) { /* ignore */ }
            console.error(`Error fetching main product data: ${productResponse.status} ${productResponse.statusText}`);
            console.error('Response Body:', errorBody);
            // return; // Continue to try fetching variants even if product details fail, for more debug info
        } else {
            const productData = await productResponse.json();
            console.log("\n--- Printful Main Product Data (catalog-products/${productId}) ---");
            console.log(JSON.stringify(productData, null, 2));
            console.log("\n-----------------------------------------------------");
        }

    } catch (error) {
        console.error("An error occurred during the main product data fetch operation:", error);
    }
    
    // 2. Fetch product variants data
    // According to Printful API v2, variants are often included in the product details,
    // but we can also try fetching them explicitly if needed or to see if there's a difference.
    // The endpoint /v2/catalog-products/{id}/variants exists.
    const variantsUrl = `https://api.printful.com/v2/catalog-products/${productId}/catalog-variants`;
    console.log(`\nFetching product variants for ID: ${productId} from ${variantsUrl}...`);

    try {
        const variantsResponse = await fetch(variantsUrl, { method: 'GET', headers: headers });
        if (!variantsResponse.ok) {
            let errorBody = 'Could not read error body';
            try { errorBody = await variantsResponse.json(); } catch (e) { /* ignore */ }
            console.error(`Error fetching product variants: ${variantsResponse.status} ${variantsResponse.statusText}`);
            console.error('Response Body:', errorBody);
            return;
        }
        const variantsData = await variantsResponse.json();
        console.log("\n--- Printful Product Variants (catalog-products/${productId}/variants) ---");
        console.log(JSON.stringify(variantsData, null, 2));
        console.log("\n------------------------------------------------------------");

    } catch (error) {
        console.error("An error occurred during the product variants fetch operation:", error);
    }

    // 3. Fetch mockup templates for the appropriate placement
    const placementToFetch = productId === '505' ? 'default' : 'front'; // Re-determine placement for clarity
    const templatesUrl = `https://api.printful.com/v2/catalog-products/${productId}/mockup-templates?placement=${placementToFetch}`;
    console.log(`\nFetching mockup templates for ID: ${productId}, Placement: ${placementToFetch} from ${templatesUrl}...`);

    try {
        const templatesResponse = await fetch(templatesUrl, { method: 'GET', headers: headers });
        if (!templatesResponse.ok) {
            let errorBody = 'Could not read error body';
            try { errorBody = await templatesResponse.json(); } catch (e) { /* ignore */ }
            console.error(`Error fetching mockup templates: ${templatesResponse.status} ${templatesResponse.statusText}`);
            console.error('Response Body:', errorBody);
            return;
        }
        const templatesData = await templatesResponse.json();
        console.log("\n--- Printful Mockup Templates (catalog-products/${productId}/mockup-templates?placement=${placementToFetch}) ---");
        console.log(JSON.stringify(templatesData, null, 2));
        console.log("\n-----------------------------------------------------------------------");

    } catch (error) {
        console.error("An error occurred during the mockup templates fetch operation:", error);
    }
}

// Get productId from command line arguments, default to 505
const targetProductId = process.argv[2] || '505'; 

fetchPrintfulProductDetails(targetProductId, PRINTFUL_API_KEY); 