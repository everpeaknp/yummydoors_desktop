import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "YummyDoors",
  description: "YummyDoors customer web app",
  icons: {
    icon: "/Yummy_Doors-Png.png",
    apple: "/Yummy_Doors-Png.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("min-h-screen font-sans bg-white", poppins.variable, poppins.className)}>{children}</body>
    </html>
  );
}
