import 'dotenv/config'; // Automatically loads vars from root .env file

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRODUCT_ID = '586'; // As requested

async function fetchPrintfulProduct(productId, apiKey) {
    if (!apiKey) {
        console.error("Error: PRINTFUL_API_KEY environment variable is not set.");
        console.error("Please set it, for example by creating a .env file in the root directory with PRINTFUL_API_KEY=your_key");
        return;
    }

    // Endpoint from Printful OpenAPI spec v2: /v2/catalog-products/{id}
    const url = `https://api.printful.com/v2/catalog-products/${productId}`;
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    console.log(`Fetching product data for ID: ${productId}...`);

    try {
        const response = await fetch(url, { method: 'GET', headers: headers });

        if (!response.ok) {
            let errorBody = 'Could not read error body';
            try {
                errorBody = await response.json(); // Printful V2 uses application/problem+json
            } catch (e) { /* ignore */ }

            console.error(`Error fetching data: ${response.status} ${response.statusText}`);
            console.error('Response Body:', errorBody);
            return;
        }

        const data = await response.json();
        console.log("\n--- Printful Product Data ---");
        console.log(JSON.stringify(data, null, 2));
        console.log("\n---------------------------");

    } catch (error) {
        console.error("An error occurred during the fetch operation:", error);
    }
}

fetchPrintfulProduct(PRODUCT_ID, PRINTFUL_API_KEY); 