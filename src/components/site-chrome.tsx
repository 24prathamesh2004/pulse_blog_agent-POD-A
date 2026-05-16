import { Link } from "@tanstack/react-router";
import { Moon, Sun, Activity, Search, Menu } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { CATEGORY_STYLES } from "@/lib/categories";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { theme, toggle, mounted } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-paper font-display font-bold text-lg shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--cat-ai-from), var(--cat-ai-to))" }}
            aria-hidden
          >
            P
          </span>
          <div className="leading-none">
            <div className="font-display text-2xl font-semibold tracking-tight">Pulse</div>
            <div className="meta -mt-0.5">An autonomous newsroom</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {Object.values(CATEGORY_STYLES).map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="px-3 py-1.5 text-sm font-medium rounded-full hover:bg-muted transition-colors"
              activeProps={{ className: "bg-muted" }}
            >
              {c.name.split(" ")[0]}
            </Link>
          ))}
          <Link to="/timeline" className="px-3 py-1.5 text-sm font-medium rounded-full hover:bg-muted transition-colors">Timeline</Link>
          <Link to="/analytics" className="px-3 py-1.5 text-sm font-medium rounded-full hover:bg-muted transition-colors">Analytics</Link>
          <Link to="/ask" className="px-3 py-1.5 text-sm font-medium rounded-full hover:bg-muted transition-colors">Ask</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/ask" className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-rule text-sm hover:border-primary transition-colors">
            <Search className="h-3.5 w-3.5" /> <span className="meta">Ask the archive</span>
          </Link>
          <Link to="/admin" className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
            <Activity className="h-3.5 w-3.5" /> Newsroom
          </Link>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-full border border-rule hover:bg-muted transition-colors"
          >
            {!mounted ? <Moon className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="text-left font-display">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                <div className="flex flex-col gap-2">
                  <div className="meta mb-2">Categories</div>
                  {Object.values(CATEGORY_STYLES).map((c) => (
                    <Link
                      key={c.slug}
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      className="px-4 py-2 text-base font-medium rounded-lg hover:bg-muted transition-colors"
                      activeProps={{ className: "bg-muted" }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
                <div className="border-t border-rule pt-4 flex flex-col gap-2">
                  <div className="meta mb-2">Tools</div>
                  <Link
                    to="/timeline"
                    className="px-4 py-2 text-base font-medium rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Timeline
                  </Link>
                  <Link
                    to="/analytics"
                    className="px-4 py-2 text-base font-medium rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/ask"
                    className="px-4 py-2 text-base font-medium rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Ask the Archive
                  </Link>
                  <Link
                    to="/admin"
                    className="px-4 py-2 text-base font-medium rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Newsroom Dashboard
                  </Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto max-w-[1400px] px-6 py-12 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-paper font-display font-bold" style={{ background: "linear-gradient(135deg, var(--cat-ai-from), var(--cat-ai-to))" }}>P</span>
            <span className="font-display text-xl font-semibold">Pulse</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            An autonomous, multi-agent newsroom. Researched, written, illustrated, and curated by AI — under your editorial policy.
          </p>
        </div>
        <div>
          <div className="meta mb-3">Sections</div>
          <ul className="space-y-2 text-sm">
            {Object.values(CATEGORY_STYLES).map((c) => (
              <li key={c.slug}>
                <Link to="/category/$slug" params={{ slug: c.slug }} className="hover:text-primary transition-colors">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="meta mb-3">Tools</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/timeline" className="hover:text-primary transition-colors">Storyline timeline</Link></li>
            <li><Link to="/analytics" className="hover:text-primary transition-colors">Analytics & insights</Link></li>
            <li><Link to="/ask" className="hover:text-primary transition-colors">Ask the archive (RAG)</Link></li>
            <li><Link to="/admin" className="hover:text-primary transition-colors">Newsroom dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex justify-between meta">
          <span>© {new Date().getFullYear()} Pulse</span>
          <span>Built with autonomous agents</span>
        </div>
      </div>
    </footer>
  );
}
