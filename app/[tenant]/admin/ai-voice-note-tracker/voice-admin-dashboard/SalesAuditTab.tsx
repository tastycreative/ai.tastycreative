"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, DollarSign, Flag, AlertTriangle, Check } from "lucide-react";

interface AuditSale {
  id: string;
  chatter: string;
  fanUsername: string;
  saleType: string;
  amount: number;
  platformCut: number;
  netEarned: number;
  voiceName: string | null;
  generationId: string | null;
  voiceClipId: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  submittedBy: string;
  createdAt: string;
}

const SALE_TYPE_LABELS: Record<string, string> = {
  tip: "Tip",
  ppv: "PPV",
  subscription: "Subscription",
  custom_voice: "Custom Voice",
  bundle: "Bundle",
};

function formatCurrency(val: number) {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

type FilterType = "all" | "pending" | "approved" | "flagged";

export default function SalesAuditTab({ tenant }: { tenant: string }) {
  const [sales, setSales] = useState<AuditSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  // Track approved/flagged items locally for UI state
  const [auditStatus, setAuditStatus] = useState<Record<string, "approved" | "flagged">>({});

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-dashboard?section=audit`);
      const json = await res.json();
      if (json.audit?.sales) setSales(json.audit.sales);
    } catch (err) {
      console.error("Failed to fetch audit data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = (id: string) => {
    setAuditStatus((prev) => ({ ...prev, [id]: "approved" }));
  };

  const handleFlag = (id: string) => {
    setAuditStatus((prev) => ({ ...prev, [id]: "flagged" }));
  };

  // Filter sales based on audit status
  const filteredSales = sales.filter((sale) => {
    const status = auditStatus[sale.id];
    if (filter === "all") return true;
    if (filter === "approved") return status === "approved";
    if (filter === "flagged") return status === "flagged";
    if (filter === "pending") return !status;
    return true;
  });

  const pendingCount = sales.filter((s) => !auditStatus[s.id]).length;
  const approvedCount = sales.filter((s) => auditStatus[s.id] === "approved").length;
  const flaggedCount = sales.filter((s) => auditStatus[s.id] === "flagged").length;

  if (loading) {
    return (
      <div className="vad-loading">
        <div className="vad-spinner" />
        <span>Loading audit log...</span>
        <style jsx>{`
          .vad-loading { display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px; }
          .vad-spinner { width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="sa-root">
      {/* Header */}
      <div className="sa-header">
        <div>
          <h2 className="sa-title">Sales Audit</h2>
          <p className="sa-subtitle">{pendingCount} submissions pending review</p>
        </div>
        <button className="sa-refresh" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="sa-filters">
        <button
          className={`sa-filter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({sales.length})
        </button>
        <button
          className={`sa-filter ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={`sa-filter ${filter === "approved" ? "active" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Approved ({approvedCount})
        </button>
        <button
          className={`sa-filter ${filter === "flagged" ? "active" : ""}`}
          onClick={() => setFilter("flagged")}
        >
          Flagged ({flaggedCount})
        </button>
      </div>

      {/* Audit List */}
      <div className="sa-card">
        {filteredSales.length === 0 ? (
          <div className="sa-empty">No sales match this filter</div>
        ) : (
          <div className="sa-audit-list">
            {filteredSales.map((sale) => {
              const status = auditStatus[sale.id];
              const isApproved = status === "approved";
              const isFlagged = status === "flagged";
              const hasNoVoice = !sale.voiceClipId;

              return (
                <div className={`sa-audit-item ${isApproved || isFlagged ? "reviewed" : ""}`} key={sale.id}>
                  <div className={`sa-audit-icon ${isFlagged ? "flag" : hasNoVoice && !status ? "warning" : "sale"}`}>
                    {isFlagged ? <Flag size={15} /> : hasNoVoice && !status ? <AlertTriangle size={15} /> : <DollarSign size={15} />}
                  </div>
                  <div className="sa-audit-content">
                    <div className="sa-audit-title">
                      <strong>{sale.chatter}</strong> &mdash;{" "}
                      <span className={isFlagged ? "red" : "green"}>
                        {formatCurrency(sale.amount)} {SALE_TYPE_LABELS[sale.saleType] || sale.saleType}
                      </span>
                      {" "}&middot; fan @{sale.fanUsername}
                      {sale.voiceName && <> &middot; {sale.voiceName}</>}
                      {hasNoVoice && !status && <> <span className="warning-text">⚠️ no voice linked</span></>}
                    </div>
                    <div className="sa-audit-meta">
                      {formatTimeAgo(sale.createdAt)}
                      {sale.generationId && <> &middot; {sale.generationId.slice(0, 8)}</>}
                      {sale.notes && <> &middot; {sale.notes}</>}
                      {isApproved && <span className="sa-status-approved"> &middot; ✓ Approved</span>}
                      {isFlagged && <span className="sa-status-flagged"> &middot; ✕ Flagged</span>}
                    </div>
                  </div>
                  <div className="sa-audit-action">
                    {!status ? (
                      <>
                        <button className="sa-approve-btn" onClick={() => handleApprove(sale.id)}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="sa-flag-btn" onClick={() => handleFlag(sale.id)}>
                          <Flag size={12} /> Flag
                        </button>
                      </>
                    ) : (
                      <span className={`sa-status-label ${status}`}>
                        {isApproved ? "✓ Approved" : "✕ Flagged"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .sa-root { display:flex;flex-direction:column;gap:16px; }
        .sa-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
        .sa-title { font-family:'Syne',system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#eeeeff; }
        .sa-subtitle { font-size:12px;color:rgba(238,238,255,0.4);margin-top:2px; }
        .sa-refresh { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(238,238,255,0.5);font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .sa-refresh:hover { border-color:rgba(236,103,161,0.25);color:rgba(238,238,255,0.8); }
        .sa-refresh:disabled { opacity:0.5;cursor:not-allowed; }
        .sa-refresh :global(.spinning) { animation:spin 0.8s linear infinite; }

        /* Filters */
        .sa-filters { display:flex;gap:6px;flex-wrap:wrap; }
        .sa-filter {
          padding:5px 12px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,0.06);
          color:rgba(238,238,255,0.4);font-size:11px;cursor:pointer;transition:all 0.15s;font-family:inherit;
        }
        .sa-filter.active { background:rgba(236,103,161,0.1);border-color:rgba(236,103,161,0.3);color:#EC67A1; }
        .sa-filter:hover:not(.active) { color:rgba(238,238,255,0.6);border-color:rgba(255,255,255,0.1); }

        /* Card */
        .sa-card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
        }
        .sa-empty { color:rgba(238,238,255,0.3);font-size:13px;padding:30px 0;text-align:center; }

        /* Audit List */
        .sa-audit-list { display:flex;flex-direction:column;gap:0; }
        .sa-audit-item {
          display:flex;align-items:flex-start;gap:12px;padding:14px 0;
          border-bottom:1px solid rgba(255,255,255,0.04);transition:opacity 0.2s;
        }
        .sa-audit-item:last-child { border-bottom:none; }
        .sa-audit-item.reviewed { opacity:0.5; }
        .sa-audit-item:hover { opacity:1; }

        .sa-audit-icon {
          width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .sa-audit-icon.sale { background:rgba(61,220,151,0.12);color:#3ddc97; }
        .sa-audit-icon.flag { background:rgba(255,92,92,0.12);color:#ff5c5c; }
        .sa-audit-icon.warning { background:rgba(255,197,66,0.12);color:#ffc542; }

        .sa-audit-content { flex:1;min-width:0; }
        .sa-audit-title { font-size:13px;font-weight:500;line-height:1.4;color:rgba(238,238,255,0.85); }
        .sa-audit-title strong { color:#EC67A1; }
        .sa-audit-title .green { color:#3ddc97; }
        .sa-audit-title .red { color:#ff5c5c; }
        .sa-audit-title .warning-text { color:#ffc542;font-size:11px; }
        .sa-audit-meta { font-size:11px;color:rgba(238,238,255,0.35);margin-top:3px; }
        .sa-status-approved { color:#3ddc97; }
        .sa-status-flagged { color:#ff5c5c; }

        .sa-audit-action { display:flex;gap:5px;flex-shrink:0;margin-top:2px; }

        .sa-approve-btn, .sa-flag-btn {
          display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:8px;
          font-size:11px;cursor:pointer;transition:all 0.15s;border:none;font-family:inherit;
        }
        .sa-approve-btn {
          background:rgba(61,220,151,0.1);color:#3ddc97;border:1px solid rgba(61,220,151,0.2);
        }
        .sa-approve-btn:hover { background:rgba(61,220,151,0.18); }
        .sa-flag-btn {
          background:rgba(255,92,92,0.08);color:#ff5c5c;border:1px solid rgba(255,92,92,0.2);
        }
        .sa-flag-btn:hover { background:rgba(255,92,92,0.15); }

        .sa-status-label { font-size:11px; }
        .sa-status-label.approved { color:#3ddc97; }
        .sa-status-label.flagged { color:#ff5c5c; }

        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
