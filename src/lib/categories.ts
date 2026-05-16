// Per-category visual identity. Slug must match `categories.slug` in DB.
export type CategoryStyle = {
  slug: string;
  name: string;
  from: string; // CSS var name without `--`
  to: string;
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  ai: { slug: "ai", name: "Artificial Intelligence", from: "cat-ai-from", to: "cat-ai-to" },
  climate: { slug: "climate", name: "Climate & Energy", from: "cat-climate-from", to: "cat-climate-to" },
  markets: { slug: "markets", name: "Markets", from: "cat-markets-from", to: "cat-markets-to" },
  geopolitics: { slug: "geopolitics", name: "Geopolitics", from: "cat-geopolitics-from", to: "cat-geopolitics-to" },
  science: { slug: "science", name: "Science", from: "cat-science-from", to: "cat-science-to" },
  culture: { slug: "culture", name: "Culture", from: "cat-culture-from", to: "cat-culture-to" },
};

export function categoryGradient(slug?: string | null): string {
  const s = slug && CATEGORY_STYLES[slug] ? CATEGORY_STYLES[slug] : CATEGORY_STYLES.ai;
  return `linear-gradient(135deg, var(--${s.from}), var(--${s.to}))`;
}

export function categoryAccent(slug?: string | null): string {
  const s = slug && CATEGORY_STYLES[slug] ? CATEGORY_STYLES[slug] : CATEGORY_STYLES.ai;
  return `var(--${s.from})`;
}

export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
