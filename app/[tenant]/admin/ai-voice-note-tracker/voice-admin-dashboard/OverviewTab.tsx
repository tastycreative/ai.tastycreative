"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, ArrowRight, Link2, Percent } from "lucide-react";

interface OverviewData {
  totalRevenue: number;
  totalNet: number;
  totalSalesCount: number;
  monthRevenue: number;
  monthNet: number;
  monthSalesCount: number;
  revenueChange: number;
  activeChattersCount: number;
  totalGenerations: number;
  weekGenerations: number;
  salesLinkedToClips: number;
  conversionRate: string;
  pendingSalesCount: number;
  topVoices: { name: string; revenue: number; uses: number }[];
  recentSales: {
    id: string;
    chatter: string;
    fanUsername: string;
    saleType: string;
    amount: number;
    netEarned: number;
    voiceName: string | null;
    generationId: string | null;
    notes: string | null;
    createdAt: string;
  }[];
  monthlyRevenue: { label: string; revenue: number; count: number }[];
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #b47aff, #ff6eb4)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #4fd1ff, #7b6fff)",
  "linear-gradient(135deg, #ff6eb4, #ffb347)",
  "linear-gradient(135deg, #ffd700, #ff8c00)",
  "linear-gradient(135deg, #ff6060, #ff9a8b)",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatCurrency(val: number) {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const SALE_TYPE_LABELS: Record<string, string> = {
  tip: "Tip",
  ppv: "PPV",
  subscription: "Subscription",
  custom_voice: "Custom Voice",
  bundle: "Bundle",
};

export default function OverviewTab({ tenant, onNavigate }: { tenant: string; onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNet, setShowNet] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-dashboard?section=overview`);
      const json = await res.json();
      if (json.overview) setData(json.overview);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="vad-loading">
        <div className="vad-spinner" />
        <span>Loading dashboard...</span>
        <style jsx>{`
          .vad-loading { display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px; }
          .vad-spinner { width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "rgba(238,238,255,0.4)" }}>No data available</div>;

  const maxBarRevenue = Math.max(...data.monthlyRevenue.map((m) => m.revenue), 1);
  const maxVoiceRevenue = data.topVoices[0]?.revenue || 1;

  return (
    <div className="ov-root">
      {/* Header */}
      <div className="ov-header">
        <div>
          <h2 className="ov-title">Dashboard</h2>
          <p className="ov-subtitle">Overview &middot; {new Date().toLocaleString("en", { month: "long", year: "numeric" })}</p>
        </div>
        <button className="ov-refresh" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="ov-stats-grid">
        <div className="ov-stat-card">
          <div className="ov-stat-glow green" />
          <div className="ov-micro-label-row">
            <div className="ov-micro-label">{showNet ? "Net Revenue" : "Total Revenue"}</div>
            <button className="ov-toggle-btn" onClick={() => setShowNet(!showNet)}>
              {showNet ? "Gross" : "Net"}
            </button>
          </div>
          <div className="ov-stat-val green">{formatCurrency(showNet ? data.totalNet : data.totalRevenue)}</div>
          <div className="ov-stat-change">
            {data.revenueChange >= 0 ? (
              <span className="up"><TrendingUp size={12} /> {data.revenueChange}%</span>
            ) : (
              <span className="dn"><TrendingDown size={12} /> {Math.abs(data.revenueChange)}%</span>
            )}
            <span className="dim">vs last month</span>
          </div>
        </div>
        <div className="ov-stat-card">
          <div className="ov-stat-glow accent" />
          <div className="ov-micro-label">Active Chatters</div>
          <div className="ov-stat-val accent">{data.activeChattersCount}</div>
          <div className="ov-stat-change"><span className="dim">{data.monthSalesCount} sales this month</span></div>
        </div>
        <div className="ov-stat-card">
          <div className="ov-stat-glow blue" />
          <div className="ov-micro-label">Voice Clips Used</div>
          <div className="ov-stat-val blue">{data.totalGenerations}</div>
          <div className="ov-stat-change">
            <span className="up"><TrendingUp size={12} /> {data.weekGenerations}</span>
            <span className="dim">this week</span>
          </div>
        </div>
        <div className="ov-stat-card">
          <div className="ov-stat-glow yellow" />
          <div className="ov-micro-label">Pending Review</div>
          <div className="ov-stat-val yellow">{data.pendingSalesCount}</div>
          <div className="ov-stat-change"><span className="dim" style={{ color: "#ffc542" }}>needs review</span></div>
        </div>
      </div>

      {/* Secondary Stats Strip */}
      <div className="ov-secondary-strip">
        <div className="ov-sec-card">
          <div className="ov-sec-icon green"><DollarSign size={14} /></div>
          <div>
            <div className="ov-micro-label">Net Revenue</div>
            <div className="ov-sec-val">{formatCurrency(data.totalNet)}</div>
          </div>
          <div className="ov-sec-delta">{data.totalRevenue > 0 ? Math.round((data.totalNet / data.totalRevenue) * 100) : 0}% of gross</div>
        </div>
        <div className="ov-sec-card">
          <div className="ov-sec-icon accent"><Percent size={14} /></div>
          <div>
            <div className="ov-micro-label">Conversion Rate</div>
            <div className="ov-sec-val">{data.conversionRate}%</div>
          </div>
          <div className="ov-sec-delta">clips → sales</div>
        </div>
        <div className="ov-sec-card">
          <div className="ov-sec-icon blue"><Link2 size={14} /></div>
          <div>
            <div className="ov-micro-label">Sales from Clips</div>
            <div className="ov-sec-val">{data.salesLinkedToClips}</div>
          </div>
          <div className="ov-sec-delta">of {data.totalSalesCount} total</div>
        </div>
      </div>

      {/* Two columns: Revenue Chart + Top Voices */}
      <div className="ov-two-col">
        {/* Revenue bar chart */}
        <div className="ov-card">
          <div className="ov-micro-label" style={{ marginBottom: 16 }}>Monthly Revenue</div>
          <div className="ov-bar-chart">
            {data.monthlyRevenue.map((m, i) => {
              const isLast = i === data.monthlyRevenue.length - 1;
              const height = maxBarRevenue > 0 ? Math.max((m.revenue / maxBarRevenue) * 100, 4) : 4;
              return (
                <div className="ov-bar-col" key={m.label}>
                  <div className={`ov-bar-amount ${isLast ? "current" : ""}`}>
                    {m.revenue > 0 ? formatCurrency(m.revenue) : ""}
                  </div>
                  <div
                    className={`ov-bar ${isLast ? "current" : ""}`}
                    style={{ height: `${height}px` }}
                    title={`${m.label}: ${formatCurrency(m.revenue)}`}
                  />
                  <div className={`ov-bar-label ${isLast ? "current" : ""}`}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div className="ov-chart-footer">
            <div>
              <div className="ov-micro-label">This Month</div>
              <div className="ov-chart-val">{formatCurrency(data.monthRevenue)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="ov-micro-label">Avg/Sale</div>
              <div className="ov-chart-val green">
                {data.monthSalesCount > 0
                  ? formatCurrency(Math.round(data.monthRevenue / data.monthSalesCount))
                  : "$0"}
              </div>
            </div>
          </div>
        </div>

        {/* Top Voices */}
        <div className="ov-card">
          <div className="ov-micro-label" style={{ marginBottom: 4 }}>Top Voices by Revenue</div>
          <div className="ov-voice-list">
            {data.topVoices.length === 0 && (
              <div style={{ color: "rgba(238,238,255,0.3)", fontSize: 13, padding: "20px 0" }}>No voice data yet</div>
            )}
            {data.topVoices.map((v) => {
              const pct = maxVoiceRevenue > 0 ? (v.revenue / maxVoiceRevenue) * 100 : 0;
              return (
                <div className="ov-vp-item" key={v.name}>
                  <div className="ov-vp-avatar" style={{ background: getGradient(v.name) }}>
                    {v.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ov-vp-info">
                    <div className="ov-vp-row">
                      <span className="ov-vp-name">{v.name}</span>
                      <span className="ov-vp-count">{v.uses} uses</span>
                    </div>
                    <div className="ov-vp-bar">
                      <div className="ov-vp-fill" style={{ width: `${pct}%`, background: getGradient(v.name) }} />
                    </div>
                  </div>
                  <div className="ov-vp-amount">
                    <span className="ov-vp-amount-label">Revenue</span>
                    {formatCurrency(v.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Sales Preview */}
      <div className="ov-card">
        <div className="ov-card-header">
          <div className="ov-micro-label">Recent Sales</div>
          {onNavigate && (
            <button className="ov-view-all" onClick={() => onNavigate("audit")}>
              View All <ArrowRight size={12} />
            </button>
          )}
        </div>
        <div className="ov-audit-list">
          {data.recentSales.length === 0 && (
            <div style={{ color: "rgba(238,238,255,0.3)", fontSize: 13, padding: "20px 0" }}>No sales yet</div>
          )}
          {data.recentSales.map((sale) => (
            <div className="ov-audit-item" key={sale.id}>
              <div className="ov-audit-icon sale">
                <DollarSign size={15} />
              </div>
              <div className="ov-audit-content">
                <div className="ov-audit-title">
                  <strong>{sale.chatter}</strong> &mdash;{" "}
                  <span className="green">{formatCurrency(sale.amount)} {SALE_TYPE_LABELS[sale.saleType] || sale.saleType}</span>
                  {" "}&middot; fan @{sale.fanUsername}
                  {sale.voiceName && <> via {sale.voiceName}</>}
                </div>
                <div className="ov-audit-meta">
                  {formatTimeAgo(sale.createdAt)}
                  {sale.generationId && <> &middot; {sale.generationId.slice(0, 8)}</>}
                  {sale.notes && <> &middot; {sale.notes}</>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ov-root { display:flex;flex-direction:column;gap:16px; }
        .ov-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
        .ov-title { font-family:'Syne',system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#eeeeff; }
        .ov-subtitle { font-size:12px;color:rgba(238,238,255,0.4);margin-top:2px; }
        .ov-refresh { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(238,238,255,0.5);font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .ov-refresh:hover { border-color:rgba(236,103,161,0.25);color:rgba(238,238,255,0.8); }
        .ov-refresh:disabled { opacity:0.5;cursor:not-allowed; }
        .ov-refresh :global(.spinning) { animation:spin 0.8s linear infinite; }

        /* Toggle button */
        .ov-micro-label-row { display:flex;align-items:center;justify-content:space-between; }
        .ov-toggle-btn { padding:2px 8px;border-radius:6px;background:rgba(61,220,151,0.08);border:1px solid rgba(61,220,151,0.2);color:#3ddc97;font-size:10px;cursor:pointer;font-family:inherit;transition:all 0.15s;letter-spacing:0.04em; }
        .ov-toggle-btn:hover { background:rgba(61,220,151,0.15); }

        /* Stats Grid */
        .ov-stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:12px; }
        @media(max-width:900px) { .ov-stats-grid { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:500px) { .ov-stats-grid { grid-template-columns:1fr; } }

        .ov-stat-card {
          position:relative;
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
          overflow:hidden;
        }
        .ov-stat-card:hover { border-color:rgba(236,103,161,0.15); }
        .ov-stat-glow {
          position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;opacity:0.6;pointer-events:none;
        }
        .ov-stat-glow.green { background:radial-gradient(circle,rgba(61,220,151,0.12),transparent); }
        .ov-stat-glow.accent { background:radial-gradient(circle,rgba(236,103,161,0.1),transparent); }
        .ov-stat-glow.blue { background:radial-gradient(circle,rgba(79,209,255,0.1),transparent); }
        .ov-stat-glow.yellow { background:radial-gradient(circle,rgba(255,197,66,0.1),transparent); }

        .ov-micro-label { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(238,238,255,0.35); }
        .ov-stat-val { font-family:'Syne',system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;margin:8px 0 4px; }
        .ov-stat-val.green { color:#3ddc97; }
        .ov-stat-val.accent { color:#EC67A1; }
        .ov-stat-val.blue { color:#4fd1ff; }
        .ov-stat-val.yellow { color:#ffc542; }

        .ov-stat-change { font-size:11px;display:flex;align-items:center;gap:6px; }
        .ov-stat-change .up { color:#3ddc97;display:flex;align-items:center;gap:3px; }
        .ov-stat-change .dn { color:#ff5c5c;display:flex;align-items:center;gap:3px; }
        .ov-stat-change .dim { color:rgba(238,238,255,0.35); }

        /* Secondary Stats Strip */
        .ov-secondary-strip { display:grid;grid-template-columns:repeat(3,1fr);gap:12px; }
        @media(max-width:700px) { .ov-secondary-strip { grid-template-columns:1fr; } }
        .ov-sec-card { display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 16px; }
        .ov-sec-icon { width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .ov-sec-icon.green { background:rgba(61,220,151,0.1);color:#3ddc97; }
        .ov-sec-icon.accent { background:rgba(236,103,161,0.1);color:#EC67A1; }
        .ov-sec-icon.blue { background:rgba(79,209,255,0.1);color:#4fd1ff; }
        .ov-sec-val { font-family:'Syne',system-ui,sans-serif;font-size:17px;font-weight:700;color:#eeeeff;margin-top:2px; }
        .ov-sec-delta { margin-left:auto;font-size:10px;color:rgba(238,238,255,0.3);white-space:nowrap; }

        /* Two Columns */
        .ov-two-col { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
        @media(max-width:800px) { .ov-two-col { grid-template-columns:1fr; } }

        /* Cards */
        .ov-card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
        }
        .ov-card-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px; }
        .ov-view-all { display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:7px;background:transparent;border:1px solid rgba(236,103,161,0.2);color:#EC67A1;font-size:11px;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .ov-view-all:hover { background:rgba(236,103,161,0.08);border-color:rgba(236,103,161,0.35); }

        /* Bar Chart */
        .ov-bar-chart { display:flex;align-items:flex-end;gap:6px;height:100px;padding:0 4px; }
        .ov-bar-col { flex:1;display:flex;flex-direction:column;align-items:center;gap:5px; }
        .ov-bar {
          width:100%;border-radius:6px 6px 2px 2px;
          background:linear-gradient(180deg,rgba(236,103,161,0.6) 0%,rgba(236,103,161,0.15) 100%);
          transition:height 0.4s ease;
          min-height:4px;
        }
        .ov-bar:hover { filter:brightness(1.2); }
        .ov-bar.current { background:linear-gradient(180deg,#3ddc97 0%,rgba(61,220,151,0.25) 100%); }
        .ov-bar-label { font-size:10px;color:rgba(238,238,255,0.35); }
        .ov-bar-label.current { color:#3ddc97; }
        .ov-bar-amount { font-size:9px;color:rgba(238,238,255,0.25);text-align:center;white-space:nowrap;min-height:14px; }
        .ov-bar-amount.current { color:#3ddc97;font-weight:600; }

        .ov-chart-footer { display:flex;justify-content:space-between;margin-top:14px; }
        .ov-chart-val { font-family:'Syne',system-ui,sans-serif;font-size:15px;font-weight:700;margin-top:4px;color:#eeeeff; }
        .ov-chart-val.green { color:#3ddc97; }

        /* Voice Performance */
        .ov-voice-list { display:flex;flex-direction:column;gap:12px;margin-top:14px; }
        .ov-vp-item { display:flex;align-items:center;gap:12px; }
        .ov-vp-avatar { width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:14px;color:white;flex-shrink:0; }
        .ov-vp-info { flex:1; }
        .ov-vp-row { display:flex;justify-content:space-between;margin-bottom:4px; }
        .ov-vp-name { font-size:13px;font-weight:600;color:#eeeeff; }
        .ov-vp-count { font-size:10px;color:rgba(238,238,255,0.35); }
        .ov-vp-bar { height:4px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden; }
        .ov-vp-fill { height:100%;border-radius:100px;transition:width 0.4s ease; }
        .ov-vp-amount { font-size:12px;color:#3ddc97;flex-shrink:0;min-width:48px;text-align:right;font-weight:600;display:flex;flex-direction:column;align-items:flex-end;gap:1px; }
        .ov-vp-amount-label { font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(238,238,255,0.25);font-weight:400; }

        /* Audit Preview */
        .ov-audit-list { display:flex;flex-direction:column;gap:0; }
        .ov-audit-item { display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04); }
        .ov-audit-item:last-child { border-bottom:none; }
        .ov-audit-icon {
          width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .ov-audit-icon.sale { background:rgba(61,220,151,0.12);color:#3ddc97; }
        .ov-audit-content { flex:1;min-width:0; }
        .ov-audit-title { font-size:13px;font-weight:500;line-height:1.4;color:rgba(238,238,255,0.85); }
        .ov-audit-title strong { color:#EC67A1; }
        .ov-audit-title .green { color:#3ddc97; }
        .ov-audit-meta { font-size:11px;color:rgba(238,238,255,0.35);margin-top:3px; }

        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
