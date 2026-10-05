import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// ✅ Keep the import line — we'll use it later

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VidForge AI — Turn Ideas Into Videos Instantly",
  description: "Photo + Music → Video | Photo + Script → Video",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        {/* ✅ PublicNavbar removed from here — done */}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}