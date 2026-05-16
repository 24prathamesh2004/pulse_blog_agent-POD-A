import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPostBySlug } from "@/lib/posts.functions";
import { categoryGradient, formatRelativeDate } from "@/lib/categories";
import { StoryCard, type PostCardData } from "@/components/post-cards";
import { AskPanel } from "@/components/ask-panel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/post/$slug")({
  loader: async ({ params }) => {
    const data = await getPostBySlug({ data: { slug: params.slug } });
    if (!data.post) throw notFound();
    return data;
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="display-lg text-3xl">Couldn't load this story</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="display-lg text-3xl">Story not found</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">Back to front page</Link>
    </div>
  ),
  component: PostPage,
});

function PostPage() {
  const { post, related } = Route.useLoaderData();
  const p = post!;
  const isDraft = (p as any).isDraft;
  
  return (
    <article>
      {isDraft && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/50 px-6 py-3 text-center">
          <p className="text-sm font-medium">
            ⚠️ <strong>DRAFT PREVIEW</strong> — This post is not published yet
          </p>
        </div>
      )}
      <header
        className="relative overflow-hidden border-b border-rule"
        style={{ background: p.hero_url ? undefined : categoryGradient(p.category_slug) }}
      >
        {p.hero_url && (
          <>
            <img src={p.hero_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/30" />
          </>
        )}
        <div className="absolute inset-0 paper-grain opacity-30 mix-blend-overlay" />
        <div className="relative mx-auto max-w-[1100px] px-6 py-20 md:py-32 text-white">
          {p.category_slug && (
            <Link
              to="/category/$slug"
              params={{ slug: p.category_slug }}
              className="cat-chip-anim inline-block px-3 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest text-white shadow-sm mb-6"
              style={{ backgroundImage: categoryGradient(p.category_slug) }}
            >
              {p.category_name ?? p.category_slug}
            </Link>
          )}
          <h1 className="display-xl text-4xl sm:text-6xl md:text-7xl lg:text-8xl max-w-4xl">{p.title}</h1>
          {p.subtitle && <p className="mt-6 text-lg md:text-2xl text-white/85 max-w-3xl font-display">{p.subtitle}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4 meta opacity-90">
            <span>{formatRelativeDate(p.published_at)}</span>
            {p.source_name && <span>via {p.source_name}</span>}
            {p.quality_score > 0 && <span>quality {p.quality_score}</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-16 grid grid-cols-12 gap-10">
        <div className="col-span-12 md:col-span-8">
          {p.summary && (
            <p className="font-display text-2xl leading-snug text-foreground/90 border-l-2 border-primary pl-5 mb-10">
              {p.summary}
            </p>
          )}
          <div className="prose-pulse">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.body_md || ""}</ReactMarkdown>
          </div>
          {Array.isArray(p.takeaways) && p.takeaways.length > 0 && (
            <div className="mt-12 rounded-2xl border border-rule p-6 bg-card">
              <div className="meta mb-3">Key takeaways</div>
              <ul className="space-y-2 list-disc pl-5">
                {(p.takeaways as string[]).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {p.source_url && (
            <p className="mt-8 meta">
              Source: <a href={p.source_url} target="_blank" rel="noreferrer" className="text-primary underline">{p.source_name ?? p.source_url}</a>
            </p>
          )}
        </div>
        <aside className="col-span-12 md:col-span-4 md:border-l md:border-rule md:pl-8 space-y-8">
          <AskPanel postId={p.id} placeholder="Ask about this story…" />
          <div>
            <div className="meta mb-3">More in this section</div>
            <div className="space-y-6">
              {(related as PostCardData[]).map((r) => <StoryCard key={r.slug} post={r} size="sm" />)}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
