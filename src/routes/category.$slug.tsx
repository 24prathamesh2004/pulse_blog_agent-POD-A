import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getCategoryFeed } from "@/lib/posts.functions";
import { StoryCard, type PostCardData } from "@/components/post-cards";
import { categoryGradient, CATEGORY_STYLES } from "@/lib/categories";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const data = await getCategoryFeed({ data: { slug: params.slug } });
    if (!data.category) throw notFound();
    return data;
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="display-lg text-3xl">Couldn't load this section</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="display-lg text-3xl">Section not found</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">Back to front page</Link>
    </div>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { category, posts } = Route.useLoaderData();
  const slug = category!.slug;
  const style = CATEGORY_STYLES[slug];
  return (
    <>
      <header
        className="relative overflow-hidden border-b border-rule"
        style={{ background: categoryGradient(slug) }}
      >
        <div className="absolute inset-0 paper-grain opacity-30 mix-blend-overlay" />
        <div className="relative mx-auto max-w-[1400px] px-6 py-16 md:py-24 text-white">
          <div className="meta opacity-80 mb-3">Section</div>
          <h1 className="display-xl text-5xl md:text-7xl lg:text-8xl">{style?.name ?? category!.name}</h1>
          {category!.description && (
            <p className="mt-4 max-w-2xl text-white/85 text-lg">{category!.description}</p>
          )}
        </div>
      </header>
      <section className="mx-auto max-w-[1400px] px-6 py-12">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No stories in this section yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {posts.map((p: PostCardData) => <StoryCard key={p.slug} post={p} />)}
          </div>
        )}
      </section>
    </>
  );
}
