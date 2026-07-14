import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Fonts are self-hosted by the `geist` package (Phase 1). No build-time
// fetch to fonts.googleapis.com — the .woff2 files ship inside the
// dependency, so every build (local, CI, Workers Builds) is offline-safe.
// GeistSans.variable sets --font-geist-sans; GeistMono sets --font-geist-mono;
// globals.css maps those onto --font-sans / --font-mono.

export const metadata: Metadata = {
  title: "Rounds",
  description: "Vendor table survey for Best Buy camera departments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Light is the default theme (no data-theme attribute). Dark is opt-in
  // via data-theme="dark" — the /kitchen-sink page toggles it for review.
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans">
        {/* Suspense boundary so the html/body shell stays static (PPR) while
            dynamic, per-request pages (the CMS, the survey) stream in. */}
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
