import { Link } from "@tanstack/react-router";

type TickerItem = { slug: string; title: string; category?: string | null };

export function PulseTicker({ items }: { items: TickerItem[] }) {
  if (!items.length) return null;
  // Duplicate for seamless marquee loop
  const loop = [...items, ...items];
  return (
    <div className="border-b border-rule bg-foreground text-background overflow-hidden">
      <div className="mx-auto max-w-[1400px] flex items-stretch">
        <div className="shrink-0 px-4 py-2 flex items-center gap-2 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          Live
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="pulse-marquee flex gap-10 py-2 whitespace-nowrap will-change-transform">
            {loop.map((it, i) => (
              <Link
                key={`${it.slug}-${i}`}
                to="/post/$slug"
                params={{ slug: it.slug }}
                className="text-sm hover:text-primary transition-colors flex items-center gap-3"
              >
                {it.category && (
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">{it.category}</span>
                )}
                <span className="font-medium">{it.title}</span>
                <span className="opacity-30">●</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
