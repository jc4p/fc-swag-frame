/**
 * Fetches the list of active products from the backend API.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of product objects.
 */
export async function getProducts() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        console.error("API URL (NEXT_PUBLIC_API_URL) is not defined in environment variables.");
        throw new Error("API URL is not configured."); // Throw to indicate critical config error
    }

    try {
        const res = await fetch(`${apiUrl}/api/products`); // Backend returns active by default

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`API Error fetching products (${res.status}): ${errorText}`);
            // Provide a more specific error message based on status if needed
            throw new Error(`Failed to fetch products. Status: ${res.status}`);
        }

        const data = await res.json();

        // Basic validation of the expected structure
        if (!data || !Array.isArray(data.products)) {
            console.error("Invalid API response structure received:", data);
            throw new Error("Received invalid data format from product API.");
        }

        return data.products;

    } catch (error) {
        console.error("Error during product fetch operation:", error);
        // Depending on requirements, you might return [], or re-throw
        // Re-throwing makes the error surface in Server Components during build/render
        throw error;
    }
}

// Add other API functions here as needed, e.g., postDesign, getDesignStatus etc. 