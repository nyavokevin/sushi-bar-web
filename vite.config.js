import { defineConfig } from 'vite';

// Content Security Policy: only our own code, Google Fonts, and blob/data URLs that GLTFLoader uses for textures.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'", // checkout is handled in JS; no form may post anywhere
].join('; ');

// Headers for `vite preview` (same as public/_headers used by static hosts)
const securityHeaders = {
  'Content-Security-Policy': `${csp}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  plugins: [{
    // meta CSP in the built HTML protects even hosts that cannot set headers (dev keeps Vite's inline HMR styles working)
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  }],
  preview: { headers: securityHeaders },
  server: { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
  build: { sourcemap: false },
});
