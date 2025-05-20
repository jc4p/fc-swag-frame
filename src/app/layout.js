import { FrameInit } from "@/components/FrameInit";
import "./globals.css";
import { DebugProvider } from "../contexts/DebugContext";
import DebugOverlay from "../components/DebugOverlay";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata = {
  title: "FC Swag Frame",
  description: "Design and order custom T-shirts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DebugProvider>
            {children}
            <FrameInit />
            <DebugOverlay />
          </DebugProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
