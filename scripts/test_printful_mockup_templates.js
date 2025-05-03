import 'dotenv/config'; // Automatically loads vars from root .env file

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRODUCT_ID = '586'; // Target Product ID

async function fetchPrintfulMockupTemplates(productId, apiKey) {
    if (!apiKey) {
        console.error("Error: PRINTFUL_API_KEY environment variable is not set.");
        console.error("Please set it, for example by creating a .env file in the root directory with PRINTFUL_API_KEY=your_key");
        return;
    }

    // Endpoint from Printful OpenAPI spec v2: /v2/catalog-products/{id}/mockup-templates
    const url = new URL(`https://api.printful.com/v2/catalog-products/${productId}/mockup-templates`);
    url.searchParams.append('placements', 'front'); // Filter for front placement

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    console.log(`Fetching mockup template data for Product ID: ${productId} (placement: front)...`);

    try {
        const response = await fetch(url.toString(), { method: 'GET', headers: headers });

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
        console.log("\n--- Printful Mockup Template Data ---");
        console.log(JSON.stringify(data, null, 2));
        console.log("\n-----------------------------------");

    } catch (error) {
        console.error("An error occurred during the fetch operation:", error);
    }
}

fetchPrintfulMockupTemplates(PRODUCT_ID, PRINTFUL_API_KEY); 