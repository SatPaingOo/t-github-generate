import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TGen — App Generator",
  description:
    "Generate a branded Android or Windows app from a form — built on GitHub Actions and delivered by email.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
