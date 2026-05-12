import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, TrendingUp, FileText, Sparkles, MessageSquare, Eye, Target, Zap, Clock, CheckCircle2, Loader2, Moon, Sun, RefreshCw } from "lucide-react";
import { fetchAnalytics, type AnalyticsData } from "./lib/analytics";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { const s = localStorage.getItem("pulse-theme"); if (s === "light" || s === "dark") return s; } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("pulse-theme", theme); } catch {}
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const tooltipStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 12, color: "var(--foreground)" };

export default function App() {
  const { theme, toggle } = useTheme();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchAnalytics();
      setData(result.data); setSource(result.source); setRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--background) 90%, transparent)" }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white font-bold text-lg shadow-lg" style={{ background: "linear-gradient(135deg, var(--cat-ai-from), var(--cat-ai-to))", fontFamily: "Fraunces, serif" }}>P</span>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1 }}>Pulse</div>
              <div className="meta">Analytics dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {source && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={source === "live"
                  ? { background: "oklch(0.45 0.16 155 / 0.12)", color: "oklch(0.45 0.16 155)", borderColor: "oklch(0.45 0.16 155 / 0.3)" }
                  : { background: "oklch(0.65 0.18 75 / 0.12)", color: "oklch(0.55 0.18 75)", borderColor: "oklch(0.55 0.18 75 / 0.3)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: source === "live" ? "oklch(0.45 0.16 155)" : "oklch(0.55 0.18 75)" }} />
                {source === "live" ? "Live data" : "Demo data"}
              </span>
            )}
            {refreshed && <span className="meta hidden md:block" style={{ fontSize: "0.65rem" }}>Updated {refreshed.toLocaleTimeString()}</span>}
            <button onClick={load} disabled={loading} className="grid h-9 w-9 place-items-center rounded-full border transition-colors disabled:opacity-40" style={{ borderColor: "var(--rule)" }}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full border transition-colors" style={{ borderColor: "var(--rule)" }}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-10">
        <header className="mb-10">
          <div className="meta">Newsroom Analytics</div>
          <h1 className="display-lg text-4xl mt-1 mb-3">Autonomous journalism in numbers</h1>
          <p className="text-sm max-w-2xl" style={{ color: "var(--muted-foreground)" }}>Real-time insights into the AI-powered newsroom. All content is researched, written, and curated by autonomous agents.</p>
        </header>

        {loading && !data && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} /></div>}

        {error && (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--destructive)", background: "oklch(0.58 0.24 27 / 0.08)" }}>
            <p className="font-semibold mb-2" style={{ color: "var(--destructive)" }}>Failed to load</p>
            <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>{error}</p>
            <button onClick={load} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: "var(--foreground)", color: "var(--background)" }}>Retry</button>
          </div>
        )}

        {data && <Dashboard data={data} />}
      </main>

      <footer className="border-t mt-16" style={{ borderColor: "var(--rule)" }}>
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex justify-between">
          <span className="meta">© {new Date().getFullYear()} Pulse Analytics</span>
          <span className="meta">Standalone module</span>
        </div>
      </footer>
    </div>
  );
}

function Dashboard({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={FileText} label="Total Articles" value={data.summary.totalPublished} sub={`+${data.summary.articlesLast24h} today`} color="var(--cat-ai-from)" />
        <Metric icon={Target} label="Avg Quality" value={data.summary.avgQualityScore} sub="AI-assessed score" color="var(--cat-science-from)" />
        <Metric icon={Activity} label="Active Storylines" value={data.summary.activeStorylines} sub={`${data.summary.totalStorylines} total`} color="var(--cat-geopolitics-from)" />
        <Metric icon={Eye} label="Total Views" value={data.summary.totalViews.toLocaleString()} sub={`${data.summary.avgViewsPerArticle} avg/article`} color="var(--cat-culture-from)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Publishing Velocity" sub="Articles per day — last 30 days">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.publishingVelocity}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Articles by Category" sub="Content distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.postsByCategory} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                {data.postsByCategory.map((e, i) => <Cell key={i} fill={e.color ?? `hsl(${i * 60},60%,55%)`} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Quality Distribution" sub="AI quality scores for published articles">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.qualityDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--cat-science-from)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Discovery Funnel" sub="Candidate → published (last 30 days)">
          <div className="space-y-4 py-4">
            <Funnel label="Discovered" value={data.discoveryFunnel.discovered} pct={100} color="var(--cat-ai-from)" />
            <Funnel label="Scraped" value={data.discoveryFunnel.scraped} pct={data.discoveryFunnel.discovered > 0 ? (data.discoveryFunnel.scraped / data.discoveryFunnel.discovered) * 100 : 0} color="var(--cat-climate-from)" />
            <Funnel label="Approved" value={data.discoveryFunnel.approved} pct={data.discoveryFunnel.discovered > 0 ? (data.discoveryFunnel.approved / data.discoveryFunnel.discovered) * 100 : 0} color="var(--cat-markets-from)" />
            <Funnel label="Published" value={data.discoveryFunnel.published} pct={data.discoveryFunnel.discovered > 0 ? (data.discoveryFunnel.published / data.discoveryFunnel.discovered) * 100 : 0} color="var(--primary)" />
            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--rule)" }}>
              <span className="text-sm font-medium">Conversion Rate</span>
              <span className="text-2xl font-semibold" style={{ fontFamily: "Fraunces, serif", color: "var(--primary)" }}>{data.discoveryFunnel.conversionRate}%</span>
            </div>
            <div className="flex gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span>Rejected: {data.discoveryFunnel.rejected}</span><span>•</span><span>Duplicates: {data.discoveryFunnel.duplicate}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Views Trend" sub="Daily article views — last 30 days">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.viewsTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="views" fill="var(--cat-culture-from)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Agent Performance" sub="Autonomous system metrics — last 30 days">
          <div className="grid grid-cols-2 gap-4 py-4">
            <StatBox icon={Zap} label="Total Runs" value={data.agentPerformance.totalRuns} color="var(--cat-ai-from)" />
            <StatBox icon={CheckCircle2} label="Success Rate" value={`${data.agentPerformance.successRate}%`} color="var(--cat-climate-from)" />
            <StatBox icon={Clock} label="Avg Duration" value={`${data.agentPerformance.avgRunDurationSeconds}s`} color="var(--cat-science-from)" />
            <StatBox icon={Activity} label="Failed Runs" value={data.agentPerformance.failedRuns} color="var(--destructive)" />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Top Sources" sub="Most productive news sources">
          <div className="space-y-2 max-h-72 overflow-y-auto mt-2">
            {data.sourceStats.length === 0
              ? <p className="text-sm py-8 text-center" style={{ color: "var(--muted-foreground)" }}>No source data yet</p>
              : data.sourceStats.slice(0, 12).map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--rule)" }}>
                  <div className="min-w-0"><div className="text-sm font-medium truncate">{s.name}</div><div className="meta text-xs">{s.category}</div></div>
                  <div className="text-right ml-4"><div className="text-lg font-semibold" style={{ fontFamily: "Fraunces, serif" }}>{s.articles}</div><div className="meta text-xs">articles</div></div>
                </div>
              ))}
          </div>
        </Card>
        <Card title="Ask the Archive" sub="RAG question analytics">
          <div className="flex flex-col items-center justify-center py-8 gap-6">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--primary)" }} />
              <div className="text-5xl font-semibold mb-1" style={{ fontFamily: "Fraunces, serif" }}>{data.ragStats.totalQuestions}</div>
              <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Total questions asked</div>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full border-t pt-6" style={{ borderColor: "var(--rule)" }}>
              <div className="text-center"><div className="text-3xl font-semibold" style={{ fontFamily: "Fraunces, serif", color: "var(--primary)" }}>{data.ragStats.questionsLast7Days}</div><div className="meta text-xs mt-1">Last 7 days</div></div>
              <div className="text-center"><div className="text-3xl font-semibold" style={{ fontFamily: "Fraunces, serif", color: "var(--primary)" }}>{data.summary.totalSources}</div><div className="meta text-xs mt-1">Active sources</div></div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Newsroom Status" sub="Real-time operational metrics">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 py-2">
          <StatusItem icon={TrendingUp} label="Last Published" value={data.summary.lastPublished ? new Date(data.summary.lastPublished).toLocaleString() : "N/A"} />
          <StatusItem icon={Sparkles} label="Articles (24h)" value={String(data.summary.articlesLast24h)} />
          <StatusItem icon={Activity} label="Active Storylines" value={String(data.summary.activeStorylines)} />
          <StatusItem icon={FileText} label="Total Published" value={String(data.summary.totalPublished)} />
        </div>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl border p-5 hover:shadow-lg transition-shadow" style={{ borderColor: "var(--rule)", background: "var(--card)" }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${color}20` }}><Icon className="h-5 w-5" style={{ color }} /></div>
        <div className="meta">{label}</div>
      </div>
      <div className="text-3xl font-semibold mb-1" style={{ fontFamily: "Fraunces, serif" }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: "var(--rule)", background: "var(--card)" }}>
      <h3 className="text-xl font-semibold mb-1" style={{ fontFamily: "Fraunces, serif" }}>{title}</h3>
      {sub && <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      {children}
    </div>
  );
}

function Funnel({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 text-sm"><span className="font-medium">{label}</span><span className="font-semibold">{value.toLocaleString()}</span></div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--rule)" }}>
      <Icon className="h-6 w-6 mx-auto mb-2" style={{ color }} />
      <div className="text-2xl font-semibold mb-1" style={{ fontFamily: "Fraunces, serif" }}>{value}</div>
      <div className="meta text-xs">{label}</div>
    </div>
  );
}

function StatusItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--rule)" }}>
      <Icon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
      <div className="min-w-0"><div className="meta text-xs mb-1">{label}</div><div className="text-sm font-medium truncate">{value}</div></div>
    </div>
  );
}
