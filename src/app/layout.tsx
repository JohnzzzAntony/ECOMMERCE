import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JKR International — Premium Medical Equipment in UAE | Dubai & Abu Dhabi",
  description: "JKR International delivers world-class medical equipment, mobility solutions, rehabilitation devices, and hospital supplies across the UAE. ISO certified. Dubai & Abu Dhabi showrooms.",
  keywords: ["medical equipment UAE", "wheelchair Dubai", "hospital equipment Abu Dhabi", "JKR International", "medical supplies UAE", "mobility aids", "rehabilitation equipment"],
  authors: [{ name: "JKR International" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "JKR International — Premium Medical Equipment in UAE",
    description: "Delivering world-class medical equipment across Dubai & Abu Dhabi. ISO certified healthcare solutions.",
    url: "https://jkrinternational.com",
    siteName: "JKR International",
    type: "website",
    locale: "en_AE",
  },
  twitter: {
    card: "summary_large_image",
    title: "JKR International — Premium Medical Equipment in UAE",
    description: "Delivering world-class medical equipment across Dubai & Abu Dhabi.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} ${cairo.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
