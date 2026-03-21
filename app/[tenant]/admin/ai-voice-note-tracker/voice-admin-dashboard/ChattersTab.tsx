"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Pencil, Ban } from "lucide-react";

interface Chatter {
  chatter: string;
  userId: string;
  displayName: string;
  revenue: number;
  netEarned: number;
  salesCount: number;
  lastActive: string | null;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #b47aff, #ff6eb4)",
  "linear-gradient(135deg, #4fd1ff, #7b6fff)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #ff6eb4, #ffb347)",
  "linear-gradient(135deg, #ffd700, #ff8c00)",
  "linear-gradient(135deg, #ff6060, #ff9a8b)",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatCurrency(val: number) {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export default function ChattersTab({ tenant }: { tenant: string }) {
  const [chatters, setChatters] = useState<Chatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-dashboard?section=chatters`);
      const json = await res.json();
      if (json.chatters) setChatters(json.chatters);
    } catch (err) {
      console.error("Failed to fetch chatters:", err);
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
        <span>Loading chatters...</span>
        <style jsx>{`
          .vad-loading { display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px; }
          .vad-spinner { width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ch-root">
      {/* Header */}
      <div className="ch-header">
        <div>
          <h2 className="ch-title">Chatters</h2>
          <p className="ch-subtitle">Team management</p>
        </div>
        <div className="ch-header-actions">
          <button className="ch-btn" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="ch-card">
        <div className="ch-card-header">
          <div className="ch-micro-label">All Chatters</div>
          <div className="ch-count">{chatters.length} total</div>
        </div>
        <div className="ch-table-wrap">
          {chatters.length === 0 ? (
            <div className="ch-empty">No chatters found. Sales submissions will populate this list.</div>
          ) : (
            <table className="ch-table">
              <thead>
                <tr>
                  <th>Chatter</th>
                  <th>Status</th>
                  <th>Revenue</th>
                  <th>Net Earned</th>
                  <th>Sales</th>
                  <th>Last Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chatters.map((c) => {
                  const isRecent = c.lastActive && (new Date().getTime() - new Date(c.lastActive).getTime()) < 86400000;
                  return (
                    <tr key={c.chatter}>
                      <td>
                        <div className="ch-cell">
                          <div className="ch-avatar" style={{ background: getGradient(c.chatter) }}>
                            {c.chatter.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="ch-name">{c.displayName}</div>
                            <div className="ch-handle">{c.chatter}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`ch-badge ${isRecent ? "active" : "inactive"}`}>
                          <span className="ch-badge-dot" />
                          {isRecent ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="ch-td-revenue">{formatCurrency(c.revenue)}</td>
                      <td className="ch-td-revenue">{formatCurrency(c.netEarned)}</td>
                      <td className="ch-td-dim">{c.salesCount} sales</td>
                      <td className="ch-td-dim">{formatTimeAgo(c.lastActive)}</td>
                      <td>
                        <div className="ch-row-actions">
                          <button className="ch-row-btn" title="Edit">
                            <Pencil size={12} />
                          </button>
                          <button className="ch-row-btn danger" title="Disable">
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style jsx>{`
        .ch-root { display:flex;flex-direction:column;gap:16px; }
        .ch-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
        .ch-title { font-family:'Syne',system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#eeeeff; }
        .ch-subtitle { font-size:12px;color:rgba(238,238,255,0.4);margin-top:2px; }
        .ch-header-actions { display:flex;gap:8px; }
        .ch-btn { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(238,238,255,0.5);font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .ch-btn:hover { border-color:rgba(236,103,161,0.25);color:rgba(238,238,255,0.8); }
        .ch-btn:disabled { opacity:0.5;cursor:not-allowed; }
        .ch-btn :global(.spinning) { animation:spin 0.8s linear infinite; }

        .ch-card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
          padding:18px 20px;
        }
        .ch-card-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
        .ch-micro-label { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(238,238,255,0.35); }
        .ch-count { font-size:11px;color:rgba(238,238,255,0.35); }
        .ch-empty { color:rgba(238,238,255,0.3);font-size:13px;padding:30px 0;text-align:center; }

        .ch-table-wrap { overflow-x:auto; }
        .ch-table { width:100%;border-collapse:collapse; }
        .ch-table th {
          text-align:left;padding:10px 14px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
          color:rgba(238,238,255,0.3);border-bottom:1px solid rgba(255,255,255,0.06);font-weight:500;
        }
        .ch-table td {
          padding:13px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.03);vertical-align:middle;
        }
        .ch-table tr:last-child td { border-bottom:none; }
        .ch-table tr:hover td { background:rgba(255,255,255,0.015); }

        .ch-cell { display:flex;align-items:center;gap:10px; }
        .ch-avatar {
          width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;
          font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:13px;color:white;flex-shrink:0;
        }
        .ch-name { font-weight:600;font-size:13px;color:#eeeeff; }
        .ch-handle { font-size:11px;color:rgba(238,238,255,0.35);margin-top:1px; }

        .ch-badge {
          display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:10px;
        }
        .ch-badge.active { background:rgba(61,220,151,0.1);color:#3ddc97;border:1px solid rgba(61,220,151,0.2); }
        .ch-badge.inactive { background:rgba(255,92,92,0.1);color:#ff5c5c;border:1px solid rgba(255,92,92,0.2); }
        .ch-badge-dot { width:5px;height:5px;border-radius:50%;background:currentColor; }

        .ch-td-revenue { font-weight:600;color:#3ddc97; }
        .ch-td-dim { color:rgba(238,238,255,0.35);font-size:12px; }

        .ch-row-actions { display:flex;gap:4px;opacity:0;transition:opacity 0.15s; }
        .ch-table tr:hover .ch-row-actions { opacity:1; }
        .ch-row-btn {
          width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          color:rgba(238,238,255,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;
        }
        .ch-row-btn:hover { background:rgba(255,255,255,0.06);color:#eeeeff; }
        .ch-row-btn.danger:hover { background:rgba(255,92,92,0.12);color:#ff5c5c; }

        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
