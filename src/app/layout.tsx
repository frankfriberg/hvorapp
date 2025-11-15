import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Menu } from "@/components/home/menu";
import Logo from "@/components/logo";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hvor",
  description: "Hvor sitter du?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="flex items-center justify-between p-6">
          <Logo />
          <Menu />
        </div>

        {children}
        <Analytics />
      </body>
    </html>
  );
}
