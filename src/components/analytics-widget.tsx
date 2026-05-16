import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getPublicAnalytics } from "@/lib/analytics.functions";
import { TrendingUp, FileText, Activity, Eye, ArrowRight } from "lucide-react";

export function AnalyticsWidget() {
  const fn = useServerFn(getPublicAnalytics);
  const [data, setData] = useState<Awaited<ReturnType<typeof fn>> | null>(null);

  useEffect(() => {
    fn().then(setData).catch(console.error);
  }, [fn]);

  if (!data) return null;

  return (
    <section className="my-16 rounded-3xl border border-rule bg-gradient-to-br from-card to-muted/30 p-8 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="meta">Newsroom Analytics</div>
          <h2 className="font-display text-2xl md:text-3xl font-semibold mt-1">
            Autonomous journalism in action
          </h2>
        </div>
        <Link
          to="/analytics"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickStat
          icon={FileText}
          label="Articles"
          value={data.summary.totalPublished}
          subtext={`+${data.summary.articlesLast24h} today`}
        />
        <QuickStat
          icon={TrendingUp}
          label="Quality"
          value={data.summary.avgQualityScore}
          subtext="Avg score"
        />
        <QuickStat
          icon={Activity}
          label="Storylines"
          value={data.summary.activeStorylines}
          subtext="Active now"
        />
        <QuickStat
          icon={Eye}
          label="Views"
          value={formatNumber(data.summary.totalViews)}
          subtext="All time"
        />
      </div>

      <Link
        to="/analytics"
        className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
      >
        View full analytics <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-rule bg-card p-4 hover:shadow-md transition-shadow">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <div className="font-display text-2xl font-semibold mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="meta text-xs mt-1">{subtext}</div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
