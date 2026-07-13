import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rounds plan §3: tag-based caching is load-bearing for the free-tier
  // budget (plan §8). cacheComponents unlocks 'use cache' + cacheTag() +
  // cacheLife() — confirmed 2026-07-13 against the installed Next 16.2.10
  // docs (node_modules/next/dist/docs/.../cacheComponents.md). This
  // replaces the old experimental.dynamicIO / experimental.useCache flags.
  cacheComponents: true,

  // Plan S7 (security headers). Global and dependency-free, so it ships in
  // Phase 0 rather than waiting for Phase 3. CSP allows Cloudflare Web
  // Analytics' beacon (plan §1 item 9) — tighten the connect-src host once
  // that script is actually wired in and its real beacon domain is known.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' static.cloudflareinsights.com",
              "connect-src 'self' cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
