/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'puppeteer'],
  // @sparticuz/chromium's binary is loaded from disk at runtime, not required(),
  // so Next's file tracer won't pick it up on its own — force it in.
  outputFileTracingIncludes: {
    // Next's normalizeAppPath() strips the trailing `page`/`route` leaf
    // segment before matching against this key, so the key must be the
    // route's URL path WITHOUT `/route` — verified against
    // node_modules/next/dist/build/collect-build-traces.js and by
    // inspecting .next/server/app/api/reportes/[id]/pdf/route.js.nft.json
    // locally (with `/route` appended: 0 files matched; without it: all
    // 4 chromium/bin/*.br files matched).
    // `[id]` is glob syntax (character class) here, so it must be escaped
    // to match the literal dynamic-segment folder name.
    '/api/reportes/\\[id\\]/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
}
export default nextConfig
