const BASE_URL = 'https://api.printful.com/v2';

/**
 * Helper function to make authenticated requests to the Printful API.
 * @param {string} endpoint - The API endpoint path (e.g., '/catalog-products/586')
 * @param {string} apiKey - The Printful API key.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @returns {Promise<object>} - The JSON response from the API.
 * @throws {Error} - Throws an error if the request fails.
 */
async function fetchPrintfulAPI(endpoint, apiKey, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        let errorBody = 'Could not read error body';
        try {
            errorBody = await response.json(); // Printful V2 uses application/problem+json
        } catch (e) { /* ignore */ }

        console.error(`Printful API Error (${response.status}): ${response.statusText} for ${url}`);
        console.error('Response Body:', JSON.stringify(errorBody));
        throw new Error(`Printful API request failed with status ${response.status}`);
    }

    return response.json();
}

/**
 * Fetches details for a specific catalog product.
 * @param {string|number} productId - The Printful Product ID.
 * @param {string} apiKey - The Printful API key.
 * @returns {Promise<object>} - The product data.
 */
export async function getPrintfulProduct(productId, apiKey) {
    console.log(`Fetching Printful product ${productId}...`);
    return fetchPrintfulAPI(`/catalog-products/${productId}`, apiKey);
}

/**
 * Fetches all variants for a specific catalog product.
 * Note: This currently fetches *all* variants. Printful API v2 doesn't seem to support filtering variants by color/size in this specific call.
 * We will filter them after fetching.
 * @param {string|number} productId - The Printful Product ID.
 * @param {string} apiKey - The Printful API key.
 * @returns {Promise<Array<object>>} - An array of variant data objects.
 */
export async function getPrintfulProductVariants(productId, apiKey) {
    console.log(`Fetching Printful variants for product ${productId}...`);
    // Need to handle potential pagination if a product has >100 variants, but 586 has 315. Default limit seems to be 20?
    // Let's fetch a larger limit for now. For robust solution, would need pagination loop.
    const result = await fetchPrintfulAPI(`/catalog-products/${productId}/catalog-variants?limit=100`, apiKey); // Fetch first 100
    let allVariants = result.data;

    // Basic pagination check (assuming 'next' link exists if more pages)
    let nextUrl = result._links?.next?.href;
    let safetyCounter = 0; // Prevent infinite loops
    const MAX_PAGES = 10;

    while (nextUrl && safetyCounter < MAX_PAGES) {
        console.log(`Fetching next page of variants: ${nextUrl}...`);
        // Need to strip the base URL from the next link provided by Printful
        const endpoint = nextUrl.replace(BASE_URL, '');
        const nextPageResult = await fetchPrintfulAPI(endpoint, apiKey);
        if (nextPageResult.data?.length > 0) {
            allVariants = allVariants.concat(nextPageResult.data);
        }
        nextUrl = nextPageResult._links?.next?.href;
        safetyCounter++;
    }
    if (safetyCounter === MAX_PAGES) {
        console.warn(`Reached max pagination limit (${MAX_PAGES}) for variants on product ${productId}. May be incomplete.`);
    }

    console.log(`Fetched total ${allVariants.length} variants for product ${productId}.`);
    return allVariants; 
}

/**
 * Fetches stock availability for a specific catalog product.
 * @param {string|number} productId - The Printful Product ID.
 * @param {string} apiKey - The Printful API key.
 * @returns {Promise<Array<object>>} - Availability data per variant/technique/region.
 */
export async function getPrintfulProductAvailability(productId, apiKey) {
    console.log(`Fetching Printful availability for product ${productId}...`);
    // Again, potentially need pagination for products with many variants
    const result = await fetchPrintfulAPI(`/catalog-products/${productId}/availability?limit=100`, apiKey);
    let allAvailability = result.data;

    let nextUrl = result._links?.next?.href;
    let safetyCounter = 0;
    const MAX_PAGES = 10;

    while (nextUrl && safetyCounter < MAX_PAGES) {
        console.log(`Fetching next page of availability: ${nextUrl}...`);
        const endpoint = nextUrl.replace(BASE_URL, '');
        const nextPageResult = await fetchPrintfulAPI(endpoint, apiKey);
        if (nextPageResult.data?.length > 0) {
            allAvailability = allAvailability.concat(nextPageResult.data);
        }
        nextUrl = nextPageResult._links?.next?.href;
        safetyCounter++;
    }
     if (safetyCounter === MAX_PAGES) {
        console.warn(`Reached max pagination limit (${MAX_PAGES}) for availability on product ${productId}. May be incomplete.`);
    }

    console.log(`Fetched availability for ${allAvailability.length} variant entries for product ${productId}.`);
    return allAvailability;
}

/**
 * Fetches product pricing information from Printful API v2.
 * @param {string|number} productId - The Printful Product ID.
 * @param {string} apiKey - The Printful API Key.
 * @param {string} currency - Optional currency code (e.g., 'USD'). Uses store default if omitted.
 * @returns {Promise<object>} - The pricing data object.
 */
export async function getPrintfulProductPrices(productId, apiKey, currency = 'USD') {
    const initialEndpoint = `/catalog-products/${productId}/prices?currency=${currency}&limit=100`;

    console.log(`Fetching initial page of Printful prices for product ${productId} in ${currency}...`);
    const initialResult = await fetchPrintfulAPI(initialEndpoint, apiKey);

    if (!initialResult || !initialResult.data || !initialResult.data.variants) {
        console.warn(`No pricing data or variants found in initial pricing response for product ${productId}`);
        return initialResult.data || {};
    }

    let allVariants = initialResult.data.variants;
    let nextUrl = initialResult._links?.next?.href;
    let safetyCounter = 0;
    const MAX_PAGES = 15;

    while (nextUrl && safetyCounter < MAX_PAGES) {
        console.log(`Fetching next page of prices: ${nextUrl}...`);
        const endpoint = nextUrl.replace(BASE_URL, '');
        try {
            const nextPageResult = await fetchPrintfulAPI(endpoint, apiKey);
            if (nextPageResult.data?.variants?.length > 0) {
                allVariants = allVariants.concat(nextPageResult.data.variants);
            }
            nextUrl = nextPageResult._links?.next?.href;
        } catch (error) {
            console.error(`Error fetching next page of prices (${nextUrl}):`, error);
            break;
        }
        safetyCounter++;
    }

    if (safetyCounter === MAX_PAGES) {
        console.warn(`Reached max pagination limit (${MAX_PAGES}) for prices on product ${productId}. May be incomplete.`);
    }

    console.log(`Fetched pricing for total ${allVariants.length} variants for product ${productId}.`);

    const finalData = initialResult.data;
    finalData.variants = allVariants;
    return finalData;
} 