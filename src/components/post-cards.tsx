import { Link } from "@tanstack/react-router";
import { categoryGradient, formatRelativeDate, CATEGORY_STYLES } from "@/lib/categories";

export type PostCardData = {
  slug: string;
  title: string;
  subtitle?: string | null;
  hero_url?: string | null;
  summary?: string | null;
  published_at?: string | null;
  category_slug?: string | null;
  source_name?: string | null;
};

function CategoryChip({ slug }: { slug?: string | null }) {
  const cat = slug && CATEGORY_STYLES[slug] ? CATEGORY_STYLES[slug] : null;
  if (!cat) return null;
  return (
    <span
      className="cat-chip-anim inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest text-white shadow-sm"
      style={{ backgroundImage: categoryGradient(slug) }}
    >
      {cat.name.split(" ")[0]}
    </span>
  );
}

export function HeroCard({ post }: { post: PostCardData }) {
  return (
    <Link to="/post/$slug" params={{ slug: post.slug }} className="group block">
      <article
        className="relative overflow-hidden rounded-3xl border border-rule bg-card aspect-[16/10] md:aspect-[5/3]"
        style={{ background: post.hero_url ? undefined : categoryGradient(post.category_slug) }}
      >
        {post.hero_url && (
          <img
            src={post.hero_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-0 paper-grain opacity-30 mix-blend-overlay" />
        <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10 text-white">
          <div className="flex items-center gap-3 mb-4">
            <CategoryChip slug={post.category_slug} />
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-80">
              {formatRelativeDate(post.published_at)}
            </span>
          </div>
          <h2 className="display-xl text-3xl sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
            {post.title}
          </h2>
          {post.subtitle && (
            <p className="mt-4 text-base md:text-lg text-white/85 max-w-2xl">{post.subtitle}</p>
          )}
        </div>
      </article>
    </Link>
  );
}

export function StoryCard({ post, size = "md" }: { post: PostCardData; size?: "sm" | "md" | "lg" }) {
  const titleSize = size === "lg" ? "text-3xl md:text-4xl" : size === "sm" ? "text-base" : "text-xl md:text-2xl";
  return (
    <Link to="/post/$slug" params={{ slug: post.slug }} className="group block">
      <article className="h-full flex flex-col gap-3">
        {post.hero_url && (
          <div className="relative overflow-hidden rounded-2xl aspect-[4/3] border border-rule bg-muted">
            <img
              src={post.hero_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute top-3 left-3"><CategoryChip slug={post.category_slug} /></div>
          </div>
        )}
        {!post.hero_url && (
          <div className="flex items-center gap-2"><CategoryChip slug={post.category_slug} /></div>
        )}
        <h3 className={`display-lg ${titleSize} group-hover:text-primary transition-colors`}>
          {post.title}
        </h3>
        {post.summary && size !== "sm" && (
          <p className="text-sm text-muted-foreground line-clamp-3">{post.summary}</p>
        )}
        <div className="flex items-center gap-3 mt-auto pt-2">
          <span className="meta">{formatRelativeDate(post.published_at)}</span>
          {post.source_name && <span className="meta opacity-60">via {post.source_name}</span>}
        </div>
      </article>
    </Link>
  );
}

export function MicroStory({ post }: { post: PostCardData }) {
  return (
    <Link to="/post/$slug" params={{ slug: post.slug }} className="group block py-3 border-b border-rule last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <CategoryChip slug={post.category_slug} />
        <span className="meta opacity-70">{formatRelativeDate(post.published_at)}</span>
      </div>
      <h4 className="font-display text-base font-medium leading-snug group-hover:text-primary transition-colors">
        {post.title}
      </h4>
    </Link>
  );
}
