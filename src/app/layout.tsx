import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Desk",
  description: "Weekly AI news candidates dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
