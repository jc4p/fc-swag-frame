import { FrameInit } from "@/components/FrameInit";
import { BottomNav } from "@/components/shared/BottomNav";
import "./globals.css";
import { DebugProvider } from "../contexts/DebugContext";
import DebugOverlay from "../components/DebugOverlay";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata = {
  title: "FC Swag Frame",
  description: "Create and discover custom products from the Farcaster community.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com/" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?display=swap&family=Plus+Jakarta+Sans:wght@400;500;700;800"
        />
      </head>
      <body>
        <AuthProvider>
          <DebugProvider>
            <div className="app-container">
              <main className="main-content">
                {children}
              </main>
              <BottomNav />
            </div>
            <FrameInit />
            <DebugOverlay />
          </DebugProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
