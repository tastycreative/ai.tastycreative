"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { RefreshCw, Download, Search, ChevronLeft, ChevronRight, Calendar, Play, Square } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface GenStats {
  totalGenerations: number;
  totalCreditsUsed: number;
  activeUsers: number;
  avgCreditsPerGeneration: number;
  generationsToday: number;
  generationsThisWeek: number;
  generationsThisMonth: number;
  dailyBreakdown?: { day: string; count: number }[];
  formatBreakdown?: { format: string; count: number }[];
}

interface TopUser {
  userId: string;
  userEmail: string;
  userName: string;
  totalGenerations: number;
  totalCreditsUsed: number;
  lastGenerationAt: string;
}

interface Generation {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  voiceAccountId: string;
  voiceName: string;
  text: string;
  characterCount: number;
  modelId: string;
  outputFormat: string;
  audioUrl: string | null;
  createdAt: string;
}

interface VoiceModel {
  id: string;
  name: string;
  generationCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#b47aff,#ff6eb4)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#4fd1ff,#7b6fff)",
  "linear-gradient(135deg,#ff6eb4,#ffb347)",
  "linear-gradient(135deg,#ffd700,#ff8c00)",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ── API response shapes ──────────────────────────────────────────────────
interface StatsAPIResponse {
  stats: GenStats;
  topUsers: TopUser[];
  voiceModels: VoiceModel[];
}
interface TableAPIResponse {
  generations: Generation[];
  totalCount: number;
  totalPages: number;
  page: number;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VoiceAnalyticsTab({ tenant }: { tenant: string }) {
  // Filters
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [topUsersRange, setTopUsersRange] = useState<"today" | "week" | "month" | "all">("month");

  // Pagination
  const [page, setPage] = useState(1);

  // ── Stats + top users (only re-fetches when topUsersRange changes) ────────
  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useQuery<StatsAPIResponse>({
    queryKey: ["voice-gen-stats", tenant, topUsersRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/tenant/${tenant}/ai-voice-generations?mode=stats&topUsersTimeRange=${topUsersRange}`
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // ── Table (only re-fetches when filters/page change, not topUsersRange) ──
  const {
    data: tableData,
    isFetching: tableFetching,
    refetch: refetchTable,
  } = useQuery<TableAPIResponse>({
    queryKey: ["voice-gen-table", tenant, page, dateRange, selectedUser, selectedVoice, searchQuery],
    queryFn: async () => {
      const p = new URLSearchParams({ mode: "table", page: page.toString(), limit: "20" });
      if (dateRange !== "all") p.set("dateRange", dateRange);
      if (selectedUser) p.set("userId", selectedUser);
      if (selectedVoice) p.set("voiceAccountId", selectedVoice);
      if (searchQuery) p.set("search", searchQuery);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-generations?${p}`);
      if (!res.ok) throw new Error("Failed to fetch generations");
      return res.json();
    },
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // ── Derived state ──────────────────────────────────────────────────────────
  const stats = statsData?.stats ?? null;
  const topUsers: TopUser[] = statsData?.topUsers ?? [];
  const voiceModels: VoiceModel[] = statsData?.voiceModels ?? [];
  const generations: Generation[] = tableData?.generations ?? [];
  const totalPages = tableData?.totalPages ?? 1;
  const totalCount = tableData?.totalCount ?? 0;
  const loading = statsLoading;
  const refreshing = statsFetching || tableFetching;

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const handlePlay = (g: Generation) => {
    if (!g.audioUrl) return;
    if (playingId === g.id) {
      audioRef[0]?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef[0]) { audioRef[0].pause(); }
    const audio = new Audio(g.audioUrl);
    audioRef[1](audio);
    audio.play();
    setPlayingId(g.id);
    audio.onended = () => setPlayingId(null);
  };

  const handleExport = async () => {
    try {
      const ep = new URLSearchParams({ export: "true" });
      if (dateRange !== "all") ep.set("dateRange", dateRange);
      if (selectedUser) ep.set("userId", selectedUser);
      if (selectedVoice) ep.set("voiceAccountId", selectedVoice);
      if (searchQuery) ep.set("search", searchQuery);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-generations?${ep}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `voice-generations-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleFilterReset = () => {
    setDateRange("all");
    setSelectedUser("");
    setSelectedVoice("");
    setSearchQuery("");
    setSearchInput("");
    setPage(1);
  };

  if (loading) {
    return (
      <div className="vad-loading">
        <div className="vad-spinner" />
        <span>Loading generation tracker...</span>
        <style jsx>{`
          .vad-loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px;}
          .vad-spinner{width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite;}
          @keyframes spin{to{transform:rotate(360deg);}}
        `}</style>
      </div>
    );
  }

  return (
    <div className="va-root">
      {/* ── Header ──────────────────────────────── */}
      <div className="va-header">
        <div>
          <h2 className="va-title">Voice Analytics</h2>
          <p className="va-subtitle">Generation tracker — all voice clips produced</p>
        </div>
        <div className="va-header-actions">
          <button className="va-export-btn" onClick={handleExport}>
            <Download size={13} /> Export CSV
          </button>
          <button className="va-refresh" onClick={() => { refetchStats(); refetchTable(); }} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spinning" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Grid (7 cards in 2 rows) ────── */}
      <div className="va-stats-grid">
        <div className="va-stat-card span2">
          <div className="va-micro-label">Total Generations</div>
          <div className="va-stat-val accent">{stats?.totalGenerations ?? 0}</div>
          <div className="va-stat-sub">all time</div>
          {stats?.dailyBreakdown && stats.dailyBreakdown.length === 7 && (() => {
            const max = Math.max(...stats.dailyBreakdown.map((d) => d.count), 1);
            return (
              <div className="va-sparkline">
                <svg viewBox="0 0 76 26" className="va-sparkline-svg">
                  {stats.dailyBreakdown.map((d, i) => {
                    const h = Math.max(2, Math.round((d.count / max) * 22));
                    return (
                      <g key={i}>
                        <title>{d.day}: {d.count}</title>
                        <rect x={i * 11 + 1} y={26 - h} width={9} height={h} rx={2.5}
                          fill={i === 6 ? "#EC67A1" : "rgba(236,103,161,0.2)"} />
                      </g>
                    );
                  })}
                </svg>
                <span className="va-sparkline-label">Last 7 days</span>
              </div>
            );
          })()}
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">Credits Used</div>
          <div className="va-stat-val blue">{stats?.totalCreditsUsed?.toLocaleString() ?? 0}</div>
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">Active Users</div>
          <div className="va-stat-val green">{stats?.activeUsers ?? 0}</div>
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">Avg Credits / Gen</div>
          <div className="va-stat-val">{stats?.avgCreditsPerGeneration ?? 0}</div>
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">Today</div>
          <div className="va-stat-val accent">{stats?.generationsToday ?? 0}</div>
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">This Week</div>
          <div className="va-stat-val blue">{stats?.generationsThisWeek ?? 0}</div>
        </div>
        <div className="va-stat-card">
          <div className="va-micro-label">This Month</div>
          <div className="va-stat-val green">{stats?.generationsThisMonth ?? 0}</div>
        </div>
      </div>

      {/* ── Top Active Users ─────────────────── */}
      <div className="va-card">
        <div className="va-card-head">
          <span className="va-micro-label" style={{ color: "rgba(238,238,255,0.6)", fontSize: 12, letterSpacing: 0 }}>Top Active Users</span>
          <div className="va-range-tabs">
            {(["today", "week", "month", "all"] as const).map((r) => (
              <button
                key={r}
                className={`va-range-tab ${topUsersRange === r ? "active" : ""}`}
                onClick={() => setTopUsersRange(r)}
              >
                {r === "all" ? "All Time" : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="va-table-wrap">
          {topUsers.length === 0 ? (
            <div className="va-empty">No user data for this period</div>
          ) : (
            <table className="va-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Generations</th>
                  <th>Credits Used</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr
                    key={u.userId}
                    className={`va-user-row${selectedUser === u.userId ? " filtered" : ""}`}
                    onClick={() => { setSelectedUser(u.userId === selectedUser ? "" : u.userId); setPage(1); }}
                    title="Click to filter generations by this user"
                  >
                    <td>
                      <div className="va-voice-cell">
                        <div className="va-voice-avatar" style={{ background: getGradient(u.userName || u.userEmail) }}>
                          {(u.userName || u.userEmail || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "rgba(238,238,255,0.85)", fontSize: 13 }}>{u.userName || "—"}</div>
                          <div style={{ fontSize: 11, color: "rgba(238,238,255,0.35)" }}>{u.userEmail}</div>
                        </div>
                        {i === 0 && <span className="va-badge active" style={{ marginLeft: 6 }}>Top</span>}
                      </div>
                    </td>
                    <td className="va-td-highlight">{u.totalGenerations}</td>
                    <td className="va-td-dim">{u.totalCreditsUsed.toLocaleString()}</td>
                    <td className="va-td-dim">{timeAgo(u.lastGenerationAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Voice Models Breakdown ──────────── */}
      {voiceModels.length > 0 && (
        <div className="va-card">
          <div className="va-card-head">
            <span className="va-micro-label" style={{ color: "rgba(238,238,255,0.6)", fontSize: 12, letterSpacing: 0 }}>Voice Usage Breakdown</span>
            <span style={{ fontSize: 11, color: "rgba(238,238,255,0.3)" }}>{voiceModels.length} voice{voiceModels.length !== 1 ? "s" : ""} · click to filter</span>
          </div>
          <div className="va-vmu-list">
            {voiceModels.map((v, i) => {
              const maxCount = voiceModels[0]?.generationCount || 1;
              const pct = (v.generationCount / maxCount) * 100;
              const isSelected = selectedVoice === v.id;
              return (
                <div
                  key={v.id}
                  className={`va-vmu-item${isSelected ? " selected" : ""}`}
                  onClick={() => { setSelectedVoice(isSelected ? "" : v.id); setPage(1); }}
                >
                  <div className="va-vmu-rank">#{i + 1}</div>
                  <div className="va-vmu-info">
                    <div className="va-vmu-row">
                      <span className="va-vmu-name">{v.name}</span>
                      <span className="va-vmu-count">{v.generationCount.toLocaleString()} gen{v.generationCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="va-vmu-bar">
                      <div className="va-vmu-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Generations Table ────────────────── */}
      <div className="va-card">
        {/* Filters */}
        <div className="va-filters-row">
          <div className="va-filter-group">
            <Calendar size={13} />
            <select
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value as typeof dateRange); setPage(1); }}
              className="va-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <select
            value={selectedVoice}
            onChange={(e) => { setSelectedVoice(e.target.value); setPage(1); }}
            className="va-select"
          >
            <option value="">All Voices</option>
            {voiceModels.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.generationCount})</option>
            ))}
          </select>

          <select
            value={selectedUser}
            onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
            className="va-select"
          >
            <option value="">All Users</option>
            {topUsers.map((u) => (
              <option key={u.userId} value={u.userId}>{u.userName || u.userEmail}</option>
            ))}
          </select>

          <div className="va-search-wrap">
            <Search size={13} />
            <input
              className="va-search"
              placeholder="Search text..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <button className="va-search-btn" onClick={handleSearch}>Go</button>
          </div>

          {(dateRange !== "all" || selectedUser || selectedVoice || searchQuery) && (
            <button className="va-clear-btn" onClick={handleFilterReset}>Clear</button>
          )}

          <div className="va-total-badge">{totalCount} records</div>
        </div>

        {/* Format Distribution */}
        {stats?.formatBreakdown && stats.formatBreakdown.length > 0 && (
          <div className="va-format-strip">
            {stats.formatBreakdown.map((f) => (
              <span key={f.format} className="va-format-pill">
                {f.format.split("_").slice(0, 2).join(" ").toUpperCase()} · {f.count.toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="va-table-wrap">
          {generations.length === 0 ? (
            <div className="va-empty">No generations match the current filters</div>
          ) : (
            <table className="va-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Voice</th>
                  <th>Text Preview</th>
                  <th>Credits</th>
                  <th>Model</th>
                  <th>Format</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {generations.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="va-voice-cell">
                        <div className="va-voice-avatar" style={{ background: getGradient(g.userName || g.userEmail || g.userId) }}>
                          {(g.userName || g.userEmail || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "rgba(238,238,255,0.85)", fontSize: 12 }}>{g.userName || "—"}</div>
                          <div style={{ fontSize: 10, color: "rgba(238,238,255,0.3)" }}>{g.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="va-voice-badge">{g.voiceName}</span>
                    </td>
                    <td className="va-td-text">
                      <div className="va-text-wrap">
                        {g.text.length > 60 ? g.text.slice(0, 60) + "…" : g.text}
                        {g.text.length > 60 && <div className="va-text-tooltip">{g.text}</div>}
                      </div>
                    </td>
                    <td className="va-td-highlight">{g.characterCount}</td>
                    <td className="va-td-dim" style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.modelId || "—"}</td>
                    <td>
                      <span className="va-badge pending">{g.outputFormat.toUpperCase()}</span>
                    </td>
                    <td className="va-td-dim">{timeAgo(g.createdAt)}</td>
                    <td>
                      {g.audioUrl ? (
                        <button
                          className={`va-play-btn ${playingId === g.id ? "playing" : ""}`}
                          onClick={() => handlePlay(g)}
                          title={playingId === g.id ? "Stop" : "Play audio"}
                        >
                          {playingId === g.id ? <Square size={11} /> : <Play size={11} />}
                        </button>
                      ) : (
                        <span className="va-no-audio">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="va-pagination">
            <button
              className="va-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="va-page-info">Page {page} of {totalPages}</span>
            <button
              className="va-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Styles ───────────────────────────── */}
      <style jsx>{`
        /* Root */
        .va-root { display:flex;flex-direction:column;gap:16px; }

        /* Header */
        .va-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:10px; }
        .va-title { font-family:'Syne',system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#eeeeff; }
        .va-subtitle { font-size:12px;color:rgba(238,238,255,0.4);margin-top:2px; }
        .va-header-actions { display:flex;gap:8px;align-items:center; }

        .va-refresh { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(238,238,255,0.5);font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .va-refresh:hover { border-color:rgba(236,103,161,0.25);color:rgba(238,238,255,0.8); }
        .va-refresh:disabled { opacity:0.5;cursor:not-allowed; }
        .va-refresh :global(.spinning) { animation:spin 0.8s linear infinite; }

        .va-export-btn { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;background:rgba(61,220,151,0.08);border:1px solid rgba(61,220,151,0.2);color:#3ddc97;font-size:12px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
        .va-export-btn:hover { background:rgba(61,220,151,0.14); }

        /* Stats */
        .va-stats-grid { display:grid;grid-template-columns:repeat(5,1fr);gap:12px; }
        @media(max-width:1000px) { .va-stats-grid { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:600px)  { .va-stats-grid { grid-template-columns:repeat(2,1fr); } }

        .va-stat-card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px 20px; }
        .va-stat-card.span2 { grid-column:span 2; }
        @media(max-width:1000px) { .va-stat-card.span2 { grid-column:span 1; } }

        .va-micro-label { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(238,238,255,0.35); }
        .va-stat-val { font-family:'Syne',system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;margin:8px 0 4px;color:#eeeeff; }
        .va-stat-val.accent { color:#EC67A1; }
        .va-stat-val.green  { color:#3ddc97; }
        .va-stat-val.blue   { color:#4fd1ff; }
        .va-stat-sub { font-size:11px;color:rgba(238,238,255,0.35); }

        /* Card */
        .va-card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px 20px; }
        .va-card-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px; }
        .va-empty { color:rgba(238,238,255,0.3);font-size:13px;padding:30px 0;text-align:center; }

        /* Range tabs */
        .va-range-tabs { display:flex;gap:4px; }
        .va-range-tab { padding:4px 10px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,0.06);color:rgba(238,238,255,0.35);font-size:11px;cursor:pointer;font-family:inherit;transition:all 0.15s; }
        .va-range-tab.active { background:rgba(236,103,161,0.1);border-color:rgba(236,103,161,0.3);color:#EC67A1; }
        .va-range-tab:hover:not(.active) { color:rgba(238,238,255,0.6); }

        /* Filters */
        .va-filters-row { display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap; }
        .va-filter-group { display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:9px;padding:6px 10px;color:rgba(238,238,255,0.35); }
        .va-select { background:transparent;border:none;color:rgba(238,238,255,0.65);font-size:12px;outline:none;cursor:pointer;font-family:inherit; }
        .va-select option { background:#1a1a2e; }

        select.va-select { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:9px;padding:6px 10px;color:rgba(238,238,255,0.65);font-size:12px;outline:none;cursor:pointer;font-family:inherit; }

        .va-search-wrap { display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:9px;padding:5px 10px;color:rgba(238,238,255,0.35);flex:1;min-width:160px; }
        .va-search { background:transparent;border:none;color:rgba(238,238,255,0.65);font-size:12px;outline:none;width:100%;font-family:inherit; }
        .va-search::placeholder { color:rgba(238,238,255,0.2); }
        .va-search-btn { background:rgba(236,103,161,0.1);border:1px solid rgba(236,103,161,0.2);color:#EC67A1;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:inherit; }
        .va-search-btn:hover { background:rgba(236,103,161,0.18); }

        .va-clear-btn { padding:5px 10px;border-radius:8px;background:transparent;border:1px solid rgba(255,92,92,0.2);color:rgba(255,92,92,0.7);font-size:11px;cursor:pointer;font-family:inherit; }
        .va-clear-btn:hover { background:rgba(255,92,92,0.06); }

        .va-total-badge { margin-left:auto;font-size:11px;color:rgba(238,238,255,0.3);white-space:nowrap; }

        /* Table */
        .va-table-wrap { overflow-x:auto; }
        .va-table { width:100%;border-collapse:collapse; }
        .va-table th { text-align:left;padding:10px 14px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(238,238,255,0.3);border-bottom:1px solid rgba(255,255,255,0.06);font-weight:500; }
        .va-table td { padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.03);vertical-align:middle; }
        .va-table tr:last-child td { border-bottom:none; }
        .va-table tr:hover td { background:rgba(255,255,255,0.015); }

        .va-voice-cell { display:flex;align-items:center;gap:9px; }
        .va-voice-avatar { width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:12px;color:white;flex-shrink:0; }

        .va-td-dim { color:rgba(238,238,255,0.35);font-size:12px; }
        .va-td-highlight { font-weight:700;color:#EC67A1; }
        .va-td-text { color:rgba(238,238,255,0.55);font-size:12px;max-width:260px; }

        .va-voice-badge { display:inline-block;padding:2px 9px;border-radius:6px;background:rgba(79,209,255,0.08);border:1px solid rgba(79,209,255,0.18);color:#4fd1ff;font-size:11px;white-space:nowrap; }

        .va-badge { display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-size:10px; }
        .va-badge.active  { background:rgba(61,220,151,0.1);color:#3ddc97;border:1px solid rgba(61,220,151,0.2); }
        .va-badge.pending { background:rgba(255,197,66,0.08);color:#ffc542;border:1px solid rgba(255,197,66,0.18); }
        .va-badge.inactive{ background:rgba(255,92,92,0.08);color:#ff5c5c;border:1px solid rgba(255,92,92,0.18); }

        /* Pagination */
        .va-pagination { display:flex;align-items:center;justify-content:center;gap:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.04);margin-top:4px; }
        .va-page-btn { display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.07);color:rgba(238,238,255,0.4);cursor:pointer;transition:all 0.15s; }
        .va-page-btn:hover:not(:disabled) { border-color:rgba(236,103,161,0.3);color:#EC67A1; }
        .va-page-btn:disabled { opacity:0.3;cursor:not-allowed; }
        .va-page-info { font-size:12px;color:rgba(238,238,255,0.35); }

        /* Play button */
        .va-play-btn { display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:rgba(79,209,255,0.08);border:1px solid rgba(79,209,255,0.2);color:#4fd1ff;cursor:pointer;transition:all 0.15s;flex-shrink:0; }
        .va-play-btn:hover { background:rgba(79,209,255,0.16);border-color:rgba(79,209,255,0.35); }
        .va-play-btn.playing { background:rgba(236,103,161,0.1);border-color:rgba(236,103,161,0.3);color:#EC67A1; }
        .va-no-audio { color:rgba(238,238,255,0.15);font-size:12px; }

        /* Sparkline */
        .va-sparkline { display:flex;align-items:center;gap:8px;margin-top:10px; }
        .va-sparkline-svg { width:76px;height:26px;display:block;flex-shrink:0; }
        .va-sparkline-label { font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(238,238,255,0.2); }

        /* Clickable user rows */
        .va-user-row { cursor:pointer; }
        .va-user-row:hover td { background:rgba(236,103,161,0.03) !important; }
        .va-user-row.filtered td { background:rgba(236,103,161,0.06) !important; }
        .va-user-row.filtered:first-child td:first-child { border-left:2px solid rgba(236,103,161,0.4); }

        /* Voice model usage card */
        .va-vmu-list { display:flex;flex-direction:column;gap:10px; }
        .va-vmu-item { display:flex;align-items:center;gap:10px;cursor:pointer;padding:5px 8px;border-radius:9px;border:1px solid transparent;transition:all 0.15s; }
        .va-vmu-item:hover { background:rgba(79,209,255,0.04);border-color:rgba(79,209,255,0.08); }
        .va-vmu-item.selected { background:rgba(79,209,255,0.07);border-color:rgba(79,209,255,0.2); }
        .va-vmu-rank { font-size:10px;color:rgba(238,238,255,0.2);width:20px;text-align:right;flex-shrink:0; }
        .va-vmu-info { flex:1; }
        .va-vmu-row { display:flex;justify-content:space-between;margin-bottom:5px; }
        .va-vmu-name { font-size:13px;color:rgba(238,238,255,0.75); }
        .va-vmu-count { font-size:11px;color:rgba(238,238,255,0.35); }
        .va-vmu-bar { height:3px;background:rgba(255,255,255,0.05);border-radius:100px;overflow:hidden; }
        .va-vmu-fill { height:100%;background:linear-gradient(90deg,#4fd1ff,#7b6fff);border-radius:100px;transition:width 0.5s ease; }

        /* Text tooltip */
        .va-text-wrap { position:relative;display:inline-block;max-width:260px; }
        .va-text-tooltip { display:none;position:absolute;bottom:calc(100% + 6px);left:0;z-index:200;background:#1d1d35;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;color:rgba(238,238,255,0.8);font-size:12px;line-height:1.6;width:300px;white-space:normal;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:none; }
        .va-text-wrap:hover .va-text-tooltip { display:block; }

        /* Format distribution strip */
        .va-format-strip { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px; }
        .va-format-pill { padding:3px 10px;border-radius:100px;font-size:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);color:rgba(238,238,255,0.4);letter-spacing:0.04em;white-space:nowrap; }

        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
