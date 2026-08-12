/// <reference types="vite/client" />

/**
 * `?raw` imports, so the institutional marks can be inlined as SVG source
 * rather than linked as `<img>`. See `view/credit.ts` for why that matters:
 * inlined, every fill is `currentColor` and the mark takes the page's own ink;
 * linked, it would be flat white on parchment and would also be a runtime
 * network request, which §13 forbids.
 */
declare module '*.svg?raw' {
  const source: string;
  export default source;
}
