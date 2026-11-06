import type { NextConfig } from "next";

// Content Security Policy for the Figma-designed storefront routes and the editor preview. Sections never load
// third-party scripts; embeds are limited to YouTube (no-cookie), Vimeo and Stripe checkout. Inline styles are needed
// for design tokens; inline scripts for Next.js bootstrapping and JSON-LD.
const storefrontCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://res.cloudinary.com",
  "media-src 'self' https:",
  "connect-src 'self' https://res.cloudinary.com",
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://js.stripe.com https://checkout.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // E2E runs a second dev server next to the normal one (playwright.config.ts).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  reactStrictMode: false,
  // Dev server only: the E2E suite and demo store use 127.0.0.1 and *.localhost hosts.
  allowedDevOrigins: ["127.0.0.1", "*.localhost"],
  // exceljs is CommonJS with optional deps; load it from node_modules instead of bundling.
  // isomorphic-dompurify brings jsdom, which must not be bundled either.
  serverExternalPackages: ["exceljs", "isomorphic-dompurify", "svgo"],
  async headers() {
    const csp = [{ key: "Content-Security-Policy", value: storefrontCsp }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }];
    return [
      ...["/pages/:path*", "/products/:path*", "/collections/:path*", "/cart"].map((source) => ({ source, headers: csp })),
      // Editor previews may only be framed by the admin on the same origin.
      { source: "/design-preview/:path*", headers: [...csp, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
      { source: "/admin", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};

export default nextConfig;
