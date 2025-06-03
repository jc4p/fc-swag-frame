import { getProducts } from '@/lib/api';
import { CreatePage } from '@/components/Create/CreatePage';

// Define Frame metadata for the create page
const frameMetadata = {
  version: "next",
  imageUrl: "https://placehold.co/600x400/BFA181/111111.png?text=Design+Your+Product",
  button: {
    title: "Design Now!",
    action: {
      type: "launch_frame",
      name: "FC Swag",
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      splashImageUrl: "https://placehold.co/200x200/FFFFFF/111111.png?text=Loading",
      splashBackgroundColor: "#FFFFFF"
    }
  }
};

// Export metadata for this page, including the fc:frame details
export const metadata = {
  title: "FC Swag Frame - Create Your Design",
  description: "Use the designer to create your custom products.",
  other: {
    'fc:frame': JSON.stringify(frameMetadata)
  }
};

export default async function Create() {
  let products = [];
  let error = null;

  try {
    products = await getProducts();
  } catch (e) {
    console.error("Failed to load products for create page:", e);
    error = "Could not load product information. Please try again later.";
  }

  return (
    <main className="create-page">
      <CreatePage products={products} error={error} />
    </main>
  );
}