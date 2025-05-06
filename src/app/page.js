import { getProducts } from '@/lib/api';
// import { ProductOptions } from '@/components/ProductOptions/ProductOptions'; // Remove static import
// import dynamic from 'next/dynamic'; // Remove dynamic import
import { ProductSelectorAndEditor } from '@/components/ProductSelector/ProductSelectorAndEditor'; // Import the new component
import styles from './page.module.css'; // Import page-specific styles

// Define Frame metadata specifically for this page
const frameMetadata = {
  version: "next", // Correct version as per FRAME_INTEGRATION.md
  imageUrl: "https://placehold.co/600x400/BFA181/111111.png?text=Design+Your+Tee", // 1.91:1 using placehold.co, added .png extension
  button: {
    title: "Design Now!",
    action: {
      type: "launch_frame",
      name: "FC Swag",
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      splashImageUrl: "https://placehold.co/200x200/FFFFFF/111111.png?text=Loading", // Using placehold.co, added .png extension
      splashBackgroundColor: "#FFFFFF" // Match app background
    }
  }
};

// Export metadata for this page, including the fc:frame details
export const metadata = {
  title: "FC Swag Frame - Design Your Tee", // Page-specific title
  description: "Use the designer to create your custom T-shirt.", // Page-specific description
  other: {
    'fc:frame': JSON.stringify(frameMetadata)
  }
};

export default async function DesignPage() {
  let products = [];
  let error = null;

  try {
    products = await getProducts();
  } catch (e) {
    console.error("Failed to load products for page:", e);
    error = "Could not load product information. Please try again later.";
    // Optionally, you could implement retries or fallback data here
  }

  // The ProductSelectorAndEditor component will handle error display and no product states.
  // It will also handle the case of a single product.

  return (
    // Use the container utility class from globals.css
    <main className={`container ${styles.pageLayout}`}>
      <div className={styles.introSection}>
        <h1 className={styles.mainHeading}>FC SWAG</h1>
      </div>

      {/* Render the new component, passing products and any error */}
      <ProductSelectorAndEditor products={products} error={error} />
    </main>
  );
}
