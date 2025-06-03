import { FeaturedSection } from '@/components/Home/FeaturedSection';
import { PopularSection } from '@/components/Home/PopularSection';

// Define Frame metadata for the home page
const frameMetadata = {
  version: "next",
  imageUrl: "https://placehold.co/600x400/BFA181/111111.png?text=FC+Swag+Marketplace",
  button: {
    title: "Start Creating!",
    action: {
      type: "launch_frame",
      name: "FC Swag",
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      splashImageUrl: "https://placehold.co/200x200/FFFFFF/111111.png?text=Loading",
      splashBackgroundColor: "#FFFFFF"
    }
  }
};

// Export metadata for this page
export const metadata = {
  title: "FC Swag Frame - Custom Products Marketplace",
  description: "Discover and create custom t-shirts, stickers, and more from the Farcaster community.",
  other: {
    'fc:frame': JSON.stringify(frameMetadata)
  }
};

export default async function HomePage() {
  // TODO: Fetch real designs from the feed API
  // For now, using mock data in PopularSection
  
  return (
    <main className="home-page">
      <FeaturedSection />
      <PopularSection />
    </main>
  );
}
