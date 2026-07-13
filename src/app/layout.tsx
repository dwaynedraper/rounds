import type { Metadata } from "next";
import "./globals.css";

// Phase 0 placeholder: system font stack, deliberately no next/font/google.
// next/font/google fetches font files from fonts.googleapis.com at BUILD
// time, which makes every build (local, CI, Cloudflare Workers Builds)
// depend on reachability of an external host we don't control — exactly
// the kind of dependency plan §2 says to avoid ("boring where boring is a
// virtue"). Phase 1 (design system, plan §9) picks the real typeface; if
// it's a Google Font, self-host it via next/font/local with the .woff2
// committed to the repo instead, so builds never make an external call.
export const metadata: Metadata = {
  title: "Rounds",
  description: "Vendor table survey for Best Buy camera departments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
