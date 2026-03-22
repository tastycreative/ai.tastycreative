"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface RevenueData {
  totalGross: number;
  totalNet: number;
  platformCut: number;
  bySaleType: {
    saleType: string;
    amount: number;
    netEarned: number;
    count: number;
    percentage: string;
  }[];
  chatterPayouts: {
    chatter: string;
    gross: number;
    net: number;
    salesCount: number;
  }[];
}

const SALE_TYPE_COLORS: Record<string, string> = {
  custom_voice: "#3ddc97",
  tip: "#EC67A1",
  ppv: "#b47aff",
  subscription: "#4fd1ff",
  bundle: "#ffc542",
};

const SALE_TYPE_LABELS: Record<string, string> = {
  tip: "Tips",
  ppv: "PPV",
  subscription: "Subscriptions",
  custom_voice: "Custom Voice",
  bundle: "Bundles",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #b47aff, #ff6eb4)",
  "linear-gradient(135deg, #4fd1ff, #7b6fff)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #ff6eb4, #ffb347)",
  "linear-gradient(135deg, #ffd700, #ff8c00)",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatCurrency(val: number) {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RevenueTab({ tenant }: { tenant: string }) {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<"month" | "30d" | "90d" | "all">("all");
  const [showTypeNet, setShowTypeNet] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-dashboard?section=revenue&range=${range}`);
      const json = await res.json();
      if (json.revenue) setData(json.revenue);
    } catch (err) {
      console.error("Failed to fetch revenue:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="vad-loading">
        <div className="vad-spinner" />
        <span>Loading revenue...</span>
        <style jsx>{`
          .vad-loading { display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px; }
          .vad-spinner { width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "rgba(238,238,255,0.4)" }}>No revenue data</div>;

  const maxSaleTypeVal = Math.max(...data.bySaleType.map((s) => showTypeNet ? s.netEarned : s.amount), 1);

  return (
    <div className="rv-root">
      {/* Header */}
      <div className="rv-header">
        <div>
          <h2 className="rv-title">Revenue</h2>
          <p className="rv-subtitle">Financials &amp; payouts</p>
        </div>
        <div className="rv-header-right">
          <div className="rv-range-pills">
            {(["month", "30d", "90d", "all"] as const).map((r) => (
              <button key={r} className={`rv-range-pill${range === r ? " active" : ""}`} onClick={() => setRange(r)}>
                {r === "month" ? "This Month" : r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "All Time"}
              </button>
            ))}
          </div>
          <button className="rv-refresh" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="rv-stats-grid">
        <div className="rv-stat-card">
          <div className="rv-micro-label">Gross Revenue</div>
          <div className="rv-stat-val green">{formatCurrency(data.totalGross)}</div>
        </div>
        <div className="rv-stat-card">
          <div className="rv-micro-label">Platform Cut</div>
          <div className="rv-stat-val red">-{formatCurrency(data.platformCut)}</div>
          <div className="rv-stat-sub">OF standard · {data.totalGross > 0 ? Math.round((data.platformCut / data.totalGross) * 100) : 0}%</div>
        </div>
        <div className="rv-stat-card">
          <div className="rv-micro-label">Net to Agency</div>
          <div className="rv-stat-val green">{formatCurrency(data.totalNet)}</div>
          <div className="rv-stat-sub">after platform</div>
        </div>
      </div>

      {/* Two Columns */}
      <div className="rv-two-col">
        {/* Revenue by Sale Type */}
        <div className="rv-card">
          <div className="rv-type-card-header">
            <div className="rv-micro-label">Revenue by Sale Type</div>
            <button className="rv-toggle-btn" onClick={() => setShowTypeNet(!showTypeNet)}>
              {showTypeNet ? "Net" : "Gross"}
            </button>
          </div>
          {(() => {
            const C = 251.327;
            const total = showTypeNet ? data.totalNet : data.totalGross;
            let accum = 0;
            const segs = data.bySaleType.map((s) => {
              const val = showTypeNet ? s.netEarned : s.amount;
              const arc = total > 0 ? (val / total) * C : 0;
              const off = -accum;
              accum += arc;
              return { s, arc, off };
            });
            return (
              <div className="rv-donut-wrap">
                <svg viewBox="0 0 100 100" className="rv-donut">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
                  {segs.map(({ s, arc, off }, i) => (
                    <circle key={i} cx="50" cy="50" r="40" fill="none"
                      stroke={SALE_TYPE_COLORS[s.saleType] || "#EC67A1"}
                      strokeWidth="14"
                      strokeDasharray={`${arc} ${C}`}
                      strokeDashoffset={off}
                      transform="rotate(-90 50 50)"
                    />
                  ))}
                  <text x="50" y="47" textAnchor="middle" fontSize="10" fill="#eeeeff" fontWeight="700" fontFamily="Syne,sans-serif">
                    {formatCurrency(total)}
                  </text>
                  <text x="50" y="57" textAnchor="middle" fontSize="7" fill="rgba(238,238,255,0.4)">{showTypeNet ? "NET" : "GROSS"}</text>
                </svg>
              </div>
            );
          })()}
          <div className="rv-type-list">
            {data.bySaleType.length === 0 && (
              <div style={{ color: "rgba(238,238,255,0.3)", fontSize: 13, padding: "20px 0" }}>No sales data</div>
            )}
            {data.bySaleType.map((s) => {
              const color = SALE_TYPE_COLORS[s.saleType] || "#EC67A1";
              const typeVal = showTypeNet ? s.netEarned : s.amount;
              const typePct = maxSaleTypeVal > 0 ? (typeVal / maxSaleTypeVal) * 100 : 0;
              const displayPct = showTypeNet
                ? (data.totalNet > 0 ? ((s.netEarned / data.totalNet) * 100).toFixed(1) : "0")
                : s.percentage;
              return (
                <div className="rv-type-item" key={s.saleType}>
                  <div className="rv-type-dot" style={{ background: color }} />
                  <div className="rv-type-info">
                    <div className="rv-type-row">
                      <span className="rv-type-name">{SALE_TYPE_LABELS[s.saleType] || s.saleType} <span className="rv-type-count">({s.count})</span></span>
                      <span className="rv-type-pct">{displayPct}%</span>
                    </div>
                    <div className="rv-type-bar">
                      <div className="rv-type-fill" style={{ width: `${typePct}%`, background: color }} />
                    </div>
                  </div>
                  <div className="rv-type-amount">{formatCurrency(typeVal)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chatter Payouts */}
        <div className="rv-card">
          <div className="rv-micro-label" style={{ marginBottom: 6 }}>Chatter Payouts (after agency cut)</div>
          <div className="rv-payout-list">
            {data.chatterPayouts.length === 0 && (
              <div style={{ color: "rgba(238,238,255,0.3)", fontSize: 13, padding: "20px 0" }}>No payouts yet</div>
            )}
            {data.chatterPayouts.map((c) => {
              const rate = c.gross > 0 ? Math.round((c.net / c.gross) * 100) : 0;
              return (
                <div className="rv-payout-row" key={c.chatter}>
                  <div className="rv-payout-chatter">
                    <div className="rv-payout-avatar" style={{ background: getGradient(c.chatter) }}>
                      {c.chatter.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="rv-payout-name">{c.chatter}</div>
                    <div className="rv-payout-rate">{rate}% rate · {c.salesCount} sale{c.salesCount !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="rv-payout-earned">{formatCurrency(c.net)}</div>
                    <div className="rv-payout-gross">of {formatCurrency(c.gross)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .rv-root { display:flex;flex-direction:column;gap:16px; }
        .rv-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
        .rv-title { font-family:'Syne',system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#eeeeff; }
        .rv-subtitle { font-size:12px;color:rgba(238,238,255,0.4);margin-top:2px; }
        .rv-refresh { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(238,238,255,0.5);font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .rv-refresh:hover { border-color:rgba(236,103,161,0.25);color:rgba(238,238,255,0.8); }
        .rv-refresh:disabled { opacity:0.5;cursor:not-allowed; }
        .rv-refresh :global(.spinning) { animation:spin 0.8s linear infinite; }

        /* Stats */
        .rv-stats-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px; }
        @media(max-width:700px) { .rv-stats-grid { grid-template-columns:1fr; } }

        .rv-stat-card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
        }
        .rv-micro-label { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(238,238,255,0.35); }
        .rv-stat-val { font-family:'Syne',system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;margin:8px 0 4px; }
        .rv-stat-val.green { color:#3ddc97; }
        .rv-stat-val.red { color:#ff5c5c; }
        .rv-stat-sub { font-size:11px;color:rgba(238,238,255,0.35); }

        /* Two Columns */
        .rv-two-col { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
        @media(max-width:800px) { .rv-two-col { grid-template-columns:1fr; } }

        .rv-card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
        }

        /* Revenue by Type */
        .rv-type-list { display:flex;flex-direction:column;gap:14px; }
        .rv-type-item { display:flex;align-items:center;gap:12px; }
        .rv-type-dot { width:12px;height:12px;border-radius:3px;flex-shrink:0; }
        .rv-type-info { flex:1; }
        .rv-type-row { display:flex;justify-content:space-between;margin-bottom:4px; }
        .rv-type-name { font-size:13px;color:#eeeeff; }
        .rv-type-pct { font-size:10px;color:rgba(238,238,255,0.35); }
        .rv-type-bar { height:4px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden; }
        .rv-type-fill { height:100%;border-radius:100px;transition:width 0.4s ease; }
        .rv-type-amount { font-size:12px;color:#3ddc97;font-weight:600;flex-shrink:0;min-width:48px;text-align:right; }

        /* Chatter Payouts */
        .rv-payout-list { display:flex;flex-direction:column;gap:0;margin-top:14px; }
        .rv-payout-row { display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04); }
        .rv-payout-row:last-child { border-bottom:none; }
        .rv-payout-chatter { display:flex;align-items:center;gap:10px; }
        .rv-payout-avatar { width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:13px;color:white;flex-shrink:0; }
        .rv-payout-name { font-size:13px;font-weight:600;color:#eeeeff; }
        .rv-payout-rate { font-size:10px;color:rgba(238,238,255,0.35);margin-top:1px; }
        .rv-payout-earned { font-size:13px;font-weight:600;color:#3ddc97; }
        .rv-payout-gross { font-size:10px;color:rgba(238,238,255,0.35);margin-top:1px; }

        /* Header right / range pills */
        .rv-header-right { display:flex;align-items:center;gap:10px; }
        .rv-range-pills { display:flex;gap:4px; }
        .rv-range-pill { padding:5px 10px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,0.07);color:rgba(238,238,255,0.4);font-size:11px;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .rv-range-pill:hover { border-color:rgba(236,103,161,0.2);color:rgba(238,238,255,0.7); }
        .rv-range-pill.active { background:rgba(236,103,161,0.1);border-color:rgba(236,103,161,0.3);color:#EC67A1; }

        /* Sale Type card header + toggle */
        .rv-type-card-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
        .rv-toggle-btn { padding:3px 10px;border-radius:7px;background:rgba(61,220,151,0.06);border:1px solid rgba(61,220,151,0.15);color:#3ddc97;font-size:10px;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .rv-toggle-btn:hover { background:rgba(61,220,151,0.12); }

        /* Donut chart */
        .rv-donut-wrap { display:flex;justify-content:center;margin:8px 0 14px; }
        .rv-donut { width:110px;height:110px; }

        /* Sale type count badge */
        .rv-type-count { font-size:9px;color:rgba(238,238,255,0.3);margin-left:4px; }

        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
