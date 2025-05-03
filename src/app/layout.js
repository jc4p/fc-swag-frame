import { FrameInit } from "@/components/FrameInit";
import "./globals.css";

export const metadata = {
  title: "FC Swag Frame",
  description: "Design and order custom T-shirts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FrameInit />
      </body>
    </html>
  );
}
