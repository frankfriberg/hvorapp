import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Menu } from "@/components/home/menu";
import Logo from "@/components/logo";
import { Analytics } from "@vercel/analytics/react";
import { BackButton } from "@/components/ui/backButton";
import { getLatestUpdate, hasUnreadUpdates } from "@/lib/updates";
import { cookies } from "next/headers";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hvor",
  description: "Hvor sitter du?",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const latestUpdate = getLatestUpdate();
  const cookieStore = await cookies();
  const updatesLastVisited = cookieStore.get("updatesLastVisited")?.value;
  const hasUnread = hasUnreadUpdates(latestUpdate, updatesLastVisited);

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <BackButton />
            <Logo />
          </div>
          <Menu hasUnread={hasUnread} />
        </div>

        {children}
        <Analytics />
      </body>
    </html>
  );
}
