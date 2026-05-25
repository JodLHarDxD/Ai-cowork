/**
 * @jodl/typography — font pairings
 * Named pairings sourced from jodl-system registry.
 * Each pairing links back to graph/pairings.json entry for traceability.
 */

export type FontPairing = {
  name: string;
  display: string;
  body: string;
  mono?: string;
  context: string[];          // brand contexts this pairing suits
  sources: string[];          // sites this was extracted from
  quality: "experimental" | "staging" | "proven";
  registrySlug: string;       // links to jodl-system/patterns/typography/<slug>
};

export const pairings: FontPairing[] = [
  {
    name: "Editorial Luxury",
    display: "Cormorant Garamond, Bodoni Moda, serif",
    body: "Inter, Neue Haas Grotesk, sans-serif",
    context: ["luxury", "fashion", "editorial", "ecommerce-premium"],
    sources: ["apple.com", "sarta (internal)"],
    quality: "proven",
    registrySlug: "editorial-luxury",
  },
  {
    name: "Tech Minimal",
    display: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
    context: ["saas", "tech", "dashboard", "minimal"],
    sources: ["linear.app", "vercel.com"],
    quality: "staging",
    registrySlug: "tech-minimal",
  },
  {
    name: "Kinetic Display",
    display: "Bodoni Moda, Didot, serif",
    body: "Inter, sans-serif",
    context: ["fashion", "editorial", "motion-heavy", "hero-dominant"],
    sources: ["awwwards.com", "sarta (internal)"],
    quality: "staging",
    registrySlug: "kinetic-display",
  },
];

export function getPairing(slug: string): FontPairing | undefined {
  return pairings.find(p => p.registrySlug === slug);
}
