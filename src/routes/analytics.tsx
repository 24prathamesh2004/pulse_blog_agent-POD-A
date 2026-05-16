import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getPublicAnalytics } from "@/lib/analytics.functions";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Activity,
  TrendingUp,
  FileText,
  Sparkles,
  MessageSquare,
  Eye,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Pulse" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getPublicAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof fn>> | null>(null);

  useEffect(() => {
    fn().then(setData).catch(console.error);
  }, [fn]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-10">
      {/* Header */}
      <header className="mb-10">
        <div className="meta">Newsroom Analytics</div>
        <h1 className="display-lg text-4xl mt-1 mb-3">Autonomous journalism in numbers</h1>
        <p className="text-muted-foreground max-w-2xl">
          Real-time insights into our AI-powered newsroom. All content is researched, written, and curated by autonomous agents.
        </p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <MetricCard
          icon={FileText}
          label="Total Articles"
          value={data.summary.totalPublished}
          subtext={`${data.summary.articlesLast24h} in last 24h`}
          color="var(--cat-ai-from)"
        />
        <MetricCard
          icon={Target}
          label="Avg Quality Score"
          value={data.summary.avgQualityScore}
          subtext="AI-assessed quality"
          color="var(--cat-science-from)"
        />
        <MetricCard
          icon={Activity}
          label="Active Storylines"
          value={data.summary.activeStorylines}
          subtext={`${data.summary.totalStorylines} total`}
          color="var(--cat-geopolitics-from)"
        />
        <MetricCard
          icon={Eye}
          label="Total Views"
          value={data.summary.totalViews.toLocaleString()}
          subtext={`${data.summary.avgViewsPerArticle} avg/article`}
          color="var(--cat-culture-from)"
        />
      </div>

      {/* Charts Grid */}
      <div className="space-y-8">
        {/* Publishing Velocity & Category Distribution */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ChartCard title="Publishing Velocity" subtitle="Articles published per day (last 30 days)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.publishingVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={{ fill: "var(--primary)", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Articles by Category" subtitle="Content distribution across topics">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.postsByCategory}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.postsByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Quality Distribution & Discovery Funnel */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ChartCard title="Quality Distribution" subtitle="AI quality scores for published articles">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.qualityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--cat-science-from)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Discovery Funnel" subtitle="From candidate to published article (last 30 days)">
            <div className="space-y-4 py-6">
              <FunnelStep
                label="Discovered"
                value={data.discoveryFunnel.discovered}
                percentage={100}
                color="var(--cat-ai-from)"
              />
              <FunnelStep
                label="Scraped"
                value={data.discoveryFunnel.scraped}
                percentage={(data.discoveryFunnel.scraped / data.discoveryFunnel.discovered) * 100}
                color="var(--cat-climate-from)"
              />
              <FunnelStep
                label="Approved"
                value={data.discoveryFunnel.approved}
                percentage={(data.discoveryFunnel.approved / data.discoveryFunnel.discovered) * 100}
                color="var(--cat-markets-from)"
              />
              <FunnelStep
                label="Published"
                value={data.discoveryFunnel.published}
                percentage={(data.discoveryFunnel.published / data.discoveryFunnel.discovered) * 100}
                color="var(--primary)"
              />
              <div className="pt-4 border-t border-rule">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Conversion Rate</span>
                  <span className="text-2xl font-display font-semibold text-primary">
                    {data.discoveryFunnel.conversionRate}%
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Rejected: {data.discoveryFunnel.rejected}</span>
                  <span>•</span>
                  <span>Duplicates: {data.discoveryFunnel.duplicate}</span>
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Views Trend & Agent Performance */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ChartCard title="Views Trend" subtitle="Daily article views (last 30 days)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.viewsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="views" fill="var(--cat-culture-from)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Agent Performance" subtitle="Autonomous system metrics (last 30 days)">
            <div className="space-y-6 py-6">
              <div className="grid grid-cols-2 gap-4">
                <StatBox
                  icon={Zap}
                  label="Total Runs"
                  value={data.agentPerformance.totalRuns}
                  color="var(--cat-ai-from)"
                />
                <StatBox
                  icon={CheckCircle2}
                  label="Success Rate"
                  value={`${data.agentPerformance.successRate}%`}
                  color="var(--cat-climate-from)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatBox
                  icon={Clock}
                  label="Avg Duration"
                  value={`${data.agentPerformance.avgRunDurationSeconds}s`}
                  color="var(--cat-science-from)"
                />
                <StatBox
                  icon={Activity}
                  label="Failed Runs"
                  value={data.agentPerformance.failedRuns}
                  color="var(--destructive)"
                />
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Top Sources & RAG Stats */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ChartCard title="Top Sources" subtitle="Most productive news sources">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.sourceStats.slice(0, 15).map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-rule hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{source.name}</div>
                    <div className="meta text-xs">{source.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-semibold text-lg">{source.articles}</div>
                    <div className="meta text-xs">articles</div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Ask the Archive" subtitle="RAG question analytics">
            <div className="space-y-6 py-6">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-primary" />
                <div className="font-display text-4xl font-semibold mb-2">
                  {data.ragStats.totalQuestions}
                </div>
                <div className="text-sm text-muted-foreground">Total questions asked</div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-rule">
                <div className="text-center">
                  <div className="font-display text-2xl font-semibold text-primary">
                    {data.ragStats.questionsLast7Days}
                  </div>
                  <div className="meta text-xs mt-1">Last 7 days</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-semibold text-primary">
                    {data.summary.totalSources}
                  </div>
                  <div className="meta text-xs mt-1">Active sources</div>
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Real-time Status */}
        <ChartCard title="Newsroom Status" subtitle="Real-time operational metrics">
          <div className="grid md:grid-cols-4 gap-4 py-4">
            <StatusItem
              icon={TrendingUp}
              label="Last Published"
              value={
                data.summary.lastPublished
                  ? new Date(data.summary.lastPublished).toLocaleString()
                  : "N/A"
              }
            />
            <StatusItem
              icon={Sparkles}
              label="Articles (24h)"
              value={data.summary.articlesLast24h.toString()}
            />
            <StatusItem
              icon={Activity}
              label="Active Storylines"
              value={data.summary.activeStorylines.toString()}
            />
            <StatusItem
              icon={FileText}
              label="Total Published"
              value={data.summary.totalPublished.toString()}
            />
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

// UI Components
function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="meta">{label}</div>
      </div>
      <div className="font-display text-3xl font-semibold mb-1">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-rule bg-card p-6">
      <div className="mb-4">
        <h3 className="font-display text-xl font-semibold mb-1">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-rule p-4 text-center">
      <Icon className="h-6 w-6 mx-auto mb-2" style={{ color }} />
      <div className="font-display text-2xl font-semibold mb-1">{value}</div>
      <div className="meta text-xs">{label}</div>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-rule">
      <Icon className="h-5 w-5 text-primary mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="meta text-xs mb-1">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
