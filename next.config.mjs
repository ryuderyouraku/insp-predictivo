/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'puppeteer'],
    // @sparticuz/chromium's binary is loaded from disk at runtime, not required(),
    // so Next's file tracer won't pick it up on its own — force it in.
    outputFileTracingIncludes: {
      // Key must be the internal route-trace path, which for an App Router
      // handler includes the trailing `/route` segment (i.e. the route.ts
      // file itself) — omitting it makes the glob match nothing, silently.
      // `[id]` is glob syntax (character class) here, so it must be escaped
      // to match the literal dynamic-segment folder name.
      '/api/reportes/\\[id\\]/pdf/route': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
}
export default nextConfig
