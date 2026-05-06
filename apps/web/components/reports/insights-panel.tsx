import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react';

const iconBySentiment = {
  positive: TrendingUp,
  caution: AlertTriangle,
  warning: Lightbulb,
} as const;

const tileBySentiment = {
  positive: 'bg-[rgba(29,168,136,0.12)] text-[var(--color-teal)]',
  caution: 'bg-[rgba(232,118,63,0.12)] text-[var(--color-coral)]',
  warning: 'bg-[rgba(233,196,106,0.18)] text-[#9a6a12]',
} as const;

export type Insight = { sentiment: keyof typeof iconBySentiment; title: string; description: string };

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <div className="space-y-3">
      {insights.slice(0, 3).map((insight) => {
        const Icon = iconBySentiment[insight.sentiment];
        return (
          <div key={insight.title} className="flex gap-3 rounded-[10px] border border-[#edf3f1] p-3">
            <div className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] ${tileBySentiment[insight.sentiment]}`}>
              <Icon className="size-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-charcoal)]">{insight.title}</p>
              <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
