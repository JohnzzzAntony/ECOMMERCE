import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/frontend/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/frontend/components/ui/sonner";

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
  title: "NexEcoms — Premium Medical Equipment in UAE | Dubai & Abu Dhabi",
  description: "NexEcoms delivers world-class medical equipment, mobility solutions, rehabilitation devices, and hospital supplies across the UAE. ISO certified. Dubai & Abu Dhabi showrooms.",
  keywords: ["medical equipment UAE", "wheelchair Dubai", "hospital equipment Abu Dhabi", "NexEcoms", "medical supplies UAE", "mobility aids", "rehabilitation equipment"],
  authors: [{ name: "NexEcoms" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "NexEcoms — Premium Medical Equipment in UAE",
    description: "Delivering world-class medical equipment across Dubai & Abu Dhabi. ISO certified healthcare solutions.",
    url: "https://jkrinternational.com",
    siteName: "NexEcoms",
    type: "website",
    locale: "en_AE",
  },
  twitter: {
    card: "summary_large_image",
    title: "NexEcoms — Premium Medical Equipment in UAE",
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
      <head>
        {/* A template script navigated its isolated frame (name "theme-frame") to a store URL: hand the
            URL to the real page and render nothing here. Runs before the app bundle. */}
        <script dangerouslySetInnerHTML={{ __html: "if(window.name==='theme-frame'&&window.parent!==window){window.parent.postMessage({__themeFrame:1,type:'navigate',href:location.href},'*');document.documentElement.style.display='none';window.stop&&window.stop()}" }} />
      </head>
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
