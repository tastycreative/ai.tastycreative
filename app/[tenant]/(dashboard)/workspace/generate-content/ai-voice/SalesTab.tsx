"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import {
  DollarSign,
  Trash2,
  Check,
  AudioWaveform,
  Link2,
  TrendingUp,
  Play,
  Pause,
  Search,
  Upload,
  X,
  ImageIcon,
  Globe,
  Pencil,
  MessageSquare,
} from "lucide-react";

interface VoiceGeneration {
  id: string;
  voiceName: string;
  voiceAccountId: string;
  characterCount: number;
  createdAt: string;
  audioUrl: string | null;
  text: string;
}

interface Sale {
  id: string;
  chatter: string;
  fanUsername: string;
  saleType: string;
  amount: number;
  platformCut: number;
  netEarned: number;
  voiceClipId: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  submittedBy: string;
  generation: {
    id: string;
    voiceName: string;
    voiceAccountId: string;
    characterCount: number;
  } | null;
}

interface TopChatter {
  chatter: string;
  totalNet: number;
  totalRevenue?: number;
  salesCount: number;
}

interface SalesStats {
  totalRevenue: number;
  totalNet: number;
  totalCount: number;
  avgPerSale: number;
  monthRevenue: number;
  monthNet: number;
  monthCount: number;
  topChatters: TopChatter[];
  globalTopChatters: TopChatter[];
  isOrgScoped: boolean;
}

const SALE_TYPES = [
  { value: "tip", label: "💰 Tip", badge: "tip" },
  { value: "ppv", label: "🔒 PPV", badge: "ppv" },
  { value: "subscription", label: "⭐ Subscription", badge: "sub" },
  { value: "custom_voice", label: "🎙️ Custom Voice", badge: "custom" },
  { value: "bundle", label: "📦 Bundle", badge: "custom" },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #b47aff, #ff6eb4)",
  "linear-gradient(135deg, #4fd1ff, #7b6fff)",
  "linear-gradient(135deg, #ff6eb4, #ffb347)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #ffd700, #ff8c00)",
  "linear-gradient(135deg, #ff6060, #ff9a8b)",
];

function getAvatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
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
  if (diffHours < 24) {
    const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return diffDays === 0 ? `Today ${timeStr}` : `Yesterday ${timeStr}`;
  }
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export default function SalesTab() {
  const { user } = useUser();

  const displayName =
    user?.username ||
    (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null) ||
    user?.firstName ||
    user?.fullName ||
    "You";

  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<VoiceGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [clipSearch, setClipSearch] = useState("");
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [fanUsername, setFanUsername] = useState("");
  const [saleType, setSaleType] = useState("tip");
  const [amount, setAmount] = useState("");
  const [platformCut, setPlatformCut] = useState("20");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Screenshot lightbox modal
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Edit sale modal
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPlatformCut, setEditPlatformCut] = useState("20");
  const [editSaleType, setEditSaleType] = useState("tip");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Screenshot state
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);

  const handleScreenshotSelect = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setScreenshotFile(file);
    setScreenshotUrl(null);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUrl(null);
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
  };

  const netEarned = (() => {
    const amt = parseFloat(amount) || 0;
    const cut = parseFloat(platformCut) || 0;
    return amt * (1 - cut / 100);
  })();

  const filteredGenerations = clipSearch.trim()
    ? recentGenerations.filter(
        (g) =>
          g.voiceName.toLowerCase().includes(clipSearch.toLowerCase()) ||
          g.text.toLowerCase().includes(clipSearch.toLowerCase())
      )
    : recentGenerations;

  const handleClipPlayPause = (gen: VoiceGeneration, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gen.audioUrl) return;
    if (playingClipId === gen.id) {
      clipAudioRef.current?.pause();
      setPlayingClipId(null);
    } else {
      if (clipAudioRef.current) {
        clipAudioRef.current.pause();
        clipAudioRef.current.src = gen.audioUrl;
        clipAudioRef.current.play().catch(() => {});
        setPlayingClipId(gen.id);
      }
    }
  };

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-voice/sales");
      const data = await res.json();
      if (data.sales) setSales(data.sales);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch sales:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRecentGenerations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-voice/generations?limit=200");
      const data = await res.json();
      if (data.generations) {
        setRecentGenerations(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.generations.map((g: any) => ({
            id: g.id,
            voiceName: g.voiceName,
            voiceAccountId: g.voiceAccountId,
            characterCount: g.characterCount,
            createdAt: g.createdAt,
            audioUrl: g.audioUrl ?? null,
            text: g.text ?? "",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch generations:", err);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    fetchRecentGenerations();
  }, [fetchSales, fetchRecentGenerations]);

  // Paste screenshot from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) { handleScreenshotSelect(file); break; }
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!fanUsername.trim() || !amount) return;

    setIsSubmitting(true);
    try {
      // Upload screenshot to S3 first if one is staged
      let finalScreenshotUrl: string | null = screenshotUrl;
      if (screenshotFile && !screenshotUrl) {
        setUploadingScreenshot(true);
        const urlRes = await fetch("/api/ai-voice/sales/screenshot-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: screenshotFile.name,
            fileType: screenshotFile.type,
            fileSize: screenshotFile.size,
          }),
        });
        if (urlRes.ok) {
          const { presignedUrl, fileUrl } = await urlRes.json();
          await fetch(presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": screenshotFile.type },
            body: screenshotFile,
          });
          finalScreenshotUrl = fileUrl;
          setScreenshotUrl(fileUrl);
        }
        setUploadingScreenshot(false);
      }

      const res = await fetch("/api/ai-voice/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fanUsername: fanUsername.trim(),
          saleType,
          amount: parseFloat(amount),
          platformCut: parseFloat(platformCut) || 20,
          voiceClipId: selectedClipId,
          notes: notes.trim() || null,
          screenshotUrl: finalScreenshotUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const data = await res.json();
      setSales((prev) => [data.sale, ...prev]);

      // Reset form
      setFanUsername("");
      setSaleType("tip");
      setAmount("");
      setPlatformCut("20");
      setSelectedClipId(null);
      setNotes("");
      clearScreenshot();

      // Show success toast
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);

      // Refresh stats
      fetchSales();
    } catch (err) {
      console.error("Failed to submit sale:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeleteConfirmId(null);
    try {
      const res = await fetch(`/api/ai-voice/sales?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSales((prev) => prev.filter((s) => s.id !== id));
      fetchSales();
    } catch (err) {
      console.error("Failed to delete sale:", err);
    }
  };

  const openEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditAmount(sale.amount.toString());
    setEditPlatformCut(sale.platformCut.toString());
    setEditSaleType(sale.saleType);
    setEditNotes(sale.notes || "");
  };

  const handleEditSave = async () => {
    if (!editingSale) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/ai-voice/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSale.id,
          saleType: editSaleType,
          amount: parseFloat(editAmount),
          platformCut: parseFloat(editPlatformCut) || 20,
          notes: editNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setSales((prev) =>
        prev.map((s) => (s.id === editingSale.id ? data.sale : s))
      );
      setEditingSale(null);
      fetchSales();
    } catch (err) {
      console.error("Failed to update sale:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredSales =
    filterType === "all"
      ? sales
      : sales.filter((s) => s.saleType === filterType);

  const maxChatterNet =
    stats?.globalTopChatters?.[0]?.totalNet || stats?.topChatters?.[0]?.totalNet || 1;
  const leaderboardData = stats?.globalTopChatters?.length
    ? stats.globalTopChatters
    : stats?.topChatters ?? [];

  return (
    <div className="vs-sales-root">
      {/* Hidden audio player for clip preview */}
      <audio
        ref={clipAudioRef}
        onEnded={() => setPlayingClipId(null)}
        style={{ display: "none" }}
      />

      {/* ── MAIN LAYOUT ── */}
      <div className="vs-main-layout">
        {/* ── LEFT: FORM + LOG ── */}
        <div>
          {/* Submit Form */}
          <div className="vs-card vs-submit-card">
            <div className="vs-card-head">
              <div className="vs-card-title">
                <div className="vs-card-dot vs-dot-green" />
                Log a Sale
              </div>
            </div>

            <div className="vs-form-grid">
              <div className="vs-field">
                <div className="vs-field-label">Submitting as</div>
                <div className="vs-submitter-tag">
                  <div
                    className="vs-td-avatar"
                    style={{ background: getAvatarGradient(displayName), width: 22, height: 22, borderRadius: 6, fontSize: 10, flexShrink: 0 }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span>{displayName}</span>
                </div>
              </div>
              <div className="vs-field">
                <div className="vs-field-label">Fan Username</div>
                <input
                  type="text"
                  placeholder="e.g. @fan123"
                  value={fanUsername}
                  onChange={(e) => setFanUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Sale type */}
            <div className="vs-field" style={{ marginBottom: 14 }}>
              <div className="vs-field-label">Sale Type</div>
              <div className="vs-type-pills">
                {SALE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSaleType(t.value)}
                    className={`vs-type-pill${saleType === t.value ? " active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="vs-form-grid vs-three">
              <div className="vs-field">
                <div className="vs-field-label">Amount</div>
                <div className="vs-amount-wrap">
                  <span className="vs-amount-prefix">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="vs-field">
                <div className="vs-field-label">Platform Cut %</div>
                <input
                  type="number"
                  placeholder="20"
                  min="0"
                  max="100"
                  value={platformCut}
                  onChange={(e) => setPlatformCut(e.target.value)}
                />
              </div>
              <div className="vs-field">
                <div className="vs-field-label">Net Earned</div>
                <input
                  type="text"
                  readOnly
                  value={netEarned > 0 ? `$${netEarned.toFixed(2)}` : ""}
                  placeholder="$0.00"
                  style={{ color: "var(--vg-green, #3ddc97)", fontFamily: "'DM Mono', monospace" }}
                />
              </div>
            </div>

            {/* Voice clip link */}
            <div className="vs-field" style={{ marginBottom: 14 }}>
              <div className="vs-field-label">Linked Voice Clip</div>
              <div className="vs-clip-wrap">
                <AudioWaveform className="vs-clip-icon" style={{ width: 14, height: 14 }} />
                <input
                  type="text"
                  readOnly
                  value={
                    selectedClipId
                      ? `${recentGenerations.find((g) => g.id === selectedClipId)?.voiceName || "Voice"} · ${selectedClipId.slice(0, 8)}`
                      : ""
                  }
                  placeholder="Select from recent voices on the right →"
                />
              </div>
            </div>

            <div className="vs-field">
              <div className="vs-field-label">Notes (optional)</div>
              <textarea
                placeholder="e.g. Fan loved the Rachel voice, asked for more custom content…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Screenshot upload */}
            <div className="vs-field" style={{ marginTop: 10, marginBottom: 4 }}>
              <div className="vs-field-label">Proof Screenshot (optional)</div>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenshotSelect(f);
                }}
              />
              {screenshotPreview ? (
                <div className="vs-screenshot-preview-wrap">
                  <img
                    src={screenshotPreview}
                    alt="Sale proof"
                    className="vs-screenshot-preview-img"
                  />
                  <button
                    className="vs-screenshot-remove"
                    onClick={clearScreenshot}
                    title="Remove screenshot"
                    type="button"
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                  {uploadingScreenshot && (
                    <div className="vs-screenshot-uploading">Uploading…</div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="vs-screenshot-drop-zone"
                  onClick={() => screenshotInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleScreenshotSelect(f);
                  }}
                >
                  <Upload style={{ width: 16, height: 16, opacity: 0.5 }} />
                  <span>Click or drag to upload screenshot</span>
                </button>
              )}
            </div>

            <button
              className="vs-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting || !fanUsername.trim() || !amount}
            >
              <DollarSign style={{ width: 16, height: 16 }} />
              {isSubmitting ? "Submitting…" : "Submit Sale"}
            </button>

            {showSuccess && (
              <div className="vs-success-toast">
                <Check style={{ width: 16, height: 16 }} />
                Sale logged successfully! Revenue updated.
              </div>
            )}
          </div>

          {/* Sales Log */}
          <div className="vs-card vs-log-card">
            <div className="vs-log-header-row">
              <div className="vs-card-title">
                <div className="vs-card-dot vs-dot-green" />
                Sales Log
              </div>
              <div className="vs-log-filters">
                {[
                  { value: "all", label: "All" },
                  { value: "tip", label: "Tips" },
                  { value: "ppv", label: "PPV" },
                  { value: "subscription", label: "Subs" },
                  { value: "custom_voice", label: "Custom" },
                  { value: "bundle", label: "Bundle" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilterType(f.value)}
                    className={`vs-log-filter${filterType === f.value ? " active" : ""}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="vs-overflow-x">
              {isLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--vg-text-dim)" }}>
                  Loading sales…
                </div>
              ) : filteredSales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--vg-text-dim)" }}>
                  No sales logged yet
                </div>
              ) : (
                <table className="vs-log-table">
                  <thead>
                    <tr>
                      <th>Voice / Clip</th>
                      <th>Chatter</th>
                      <th>Fan</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Net</th>
                      <th>Date</th>
                      <th>Notes</th>
                      <th>Proof</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => {
                      const voiceName = sale.generation?.voiceName || "—";
                      const clipShort = sale.voiceClipId
                        ? sale.voiceClipId.slice(0, 8)
                        : "";
                      const typeInfo = SALE_TYPES.find(
                        (t) => t.value === sale.saleType
                      );
                      return (
                        <tr key={sale.id}>
                          <td>
                            <div className="vs-td-voice">
                              <div
                                className="vs-td-avatar"
                                style={{
                                  background: getAvatarGradient(voiceName),
                                }}
                              >
                                {voiceName.charAt(0)}
                              </div>
                              <span>
                                {voiceName}
                                {clipShort && ` · ${clipShort}`}
                              </span>
                            </div>
                          </td>
                          <td className="vs-td-chatter">{sale.chatter}</td>
                          <td className="vs-td-chatter">{sale.fanUsername}</td>
                          <td>
                            <span className={`vs-badge vs-badge-${typeInfo?.badge || "tip"}`}>
                              {typeInfo?.label || sale.saleType}
                            </span>
                          </td>
                          <td className="vs-td-amount">
                            ${sale.amount.toFixed(0)}
                          </td>
                          <td className="vs-td-amount">
                            ${sale.netEarned.toFixed(0)}
                          </td>
                          <td className="vs-td-date">
                            {formatTimeAgo(sale.createdAt)}
                          </td>
                          <td>
                            {sale.notes ? (
                              <div className="vs-notes-cell">
                                <MessageSquare style={{ width: 13, height: 13 }} />
                                <span className="vs-notes-tooltip">{sale.notes}</span>
                              </div>
                            ) : (
                              <span style={{ opacity: 0.15, display: "inline-flex" }}>
                                <MessageSquare style={{ width: 13, height: 13 }} />
                              </span>
                            )}
                          </td>
                          <td>
                            {sale.screenshotUrl ? (
                              <button
                                className="vs-screenshot-thumb-btn"
                                onClick={() => setLightboxUrl(sale.screenshotUrl!)}
                                title="View proof screenshot"
                                type="button"
                              >
                                <img
                                  src={sale.screenshotUrl}
                                  alt="Proof"
                                  className="vs-screenshot-thumb"
                                />
                              </button>
                            ) : (
                              <span className="vs-no-screenshot">
                                <ImageIcon style={{ width: 12, height: 12, opacity: 0.2 }} />
                              </span>
                            )}
                          </td>
                          <td>
                            {deleteConfirmId === sale.id ? (
                              <div className="vs-delete-confirm-row">
                                <span className="vs-del-sure">Sure?</span>
                                <button className="vs-del-yes" onClick={() => handleDeleteConfirm(sale.id)}>Yes</button>
                                <button className="vs-del-no" onClick={handleDeleteCancel}>No</button>
                              </div>
                            ) : (
                              <div className="vs-row-actions">
                                <button
                                  className="vs-edit-row"
                                  onClick={() => openEdit(sale)}
                                  title="Edit"
                                >
                                  <Pencil style={{ width: 11, height: 11 }} />
                                </button>
                                <button
                                  className="vs-delete-row"
                                  onClick={() => handleDeleteRequest(sale.id)}
                                  title="Delete"
                                >
                                  <Trash2 style={{ width: 12, height: 12 }} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: LINK VOICE + LEADERBOARD ── */}
        <div className="vs-right-col">
          {/* Link Recent Voice */}
          <div className="vs-card vs-linked-card">
            <div className="vs-card-head" style={{ marginBottom: 4 }}>
              <div className="vs-card-title">
                <Link2 style={{ width: 12, height: 12, color: "var(--vg-accent)" }} />
                Link Recent Voice
              </div>
            </div>
            <p className="vs-linked-desc">
              Select the voice clip that drove this sale
            </p>

            {/* Search bar */}
            {recentGenerations.length > 0 && (
              <div className="vs-clip-search-wrap">
                <Search className="vs-clip-search-icon" />
                <input
                  type="text"
                  className="vs-clip-search-input"
                  placeholder="Search by voice or text…"
                  value={clipSearch}
                  onChange={(e) => setClipSearch(e.target.value)}
                />
              </div>
            )}

            <div className="vs-clip-list">
              {recentGenerations.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: "var(--vg-text-dim)",
                    fontSize: 12,
                  }}
                >
                  No recent generations
                </div>
              ) : filteredGenerations.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "var(--vg-text-dim)",
                    fontSize: 12,
                  }}
                >
                  No results for &ldquo;{clipSearch}&rdquo;
                </div>
              ) : (
                filteredGenerations.map((gen) => (
                  <div
                    key={gen.id}
                    className={`vs-linked-voice${selectedClipId === gen.id ? " selected" : ""}`}
                    onClick={() =>
                      setSelectedClipId(
                        selectedClipId === gen.id ? null : gen.id
                      )
                    }
                  >
                    <div
                      className="vs-lv-avatar"
                      style={{
                        background: getAvatarGradient(gen.voiceName),
                      }}
                    >
                      {gen.voiceName.charAt(0)}
                    </div>
                    <div className="vs-lv-info">
                      <div className="vs-lv-name">{gen.voiceName}</div>
                      {gen.text && (
                        <div className="vs-lv-text-preview">{gen.text}</div>
                      )}
                      <div className="vs-lv-meta">
                        {formatTimeAgo(gen.createdAt)} · {gen.characterCount} chars
                      </div>
                    </div>
                    {/* Play/Pause button */}
                    <button
                      className={`vs-clip-play-btn${!gen.audioUrl ? " disabled" : ""}${playingClipId === gen.id ? " playing" : ""}`}
                      onClick={(e) => handleClipPlayPause(gen, e)}
                      title={gen.audioUrl ? (playingClipId === gen.id ? "Pause" : "Play") : "No audio"}
                      disabled={!gen.audioUrl}
                    >
                      {playingClipId === gen.id ? (
                        <Pause style={{ width: 10, height: 10 }} />
                      ) : (
                        <Play style={{ width: 10, height: 10 }} />
                      )}
                    </button>
                    <div className="vs-lv-check">
                      {selectedClipId === gen.id && (
                        <Check
                          style={{
                            width: 10,
                            height: 10,
                            color: "white",
                            strokeWidth: 3,
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="vs-card vs-leaderboard-card">
            <div className="vs-card-head">
              <div className="vs-card-title">
                <TrendingUp style={{ width: 12, height: 12, color: "var(--vg-green, #3ddc97)" }} />
                Chatter Leaderboard
              </div>
              <span className="vs-card-subtitle vs-lb-scope-badge">
                {stats?.isOrgScoped ? (
                  <><Globe style={{ width: 9, height: 9 }} /> Org · This month</>
                ) : "This month"}
              </span>
            </div>

            <div className="vs-lb-list">
              {leaderboardData.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: "var(--vg-text-dim)",
                    fontSize: 12,
                  }}
                >
                  No data yet
                </div>
              ) : (
                leaderboardData.map((c, i) => {
                  const isYou = c.chatter === displayName;
                  return (
                  <div key={c.chatter} className={`vs-lb-item${isYou ? " vs-lb-you" : ""}`}>
                    <div
                      className={`vs-lb-rank${i < 3 ? " top" : ""}`}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </div>
                    <div
                      className="vs-lb-avatar"
                      style={{ background: getAvatarGradient(c.chatter) }}
                    >
                      {c.chatter.replace("@", "").charAt(0).toUpperCase()}
                    </div>
                    <div className="vs-lb-info">
                      <div className="vs-lb-chatter">
                        {c.chatter}
                        {isYou && <span className="vs-lb-you-badge">you</span>}
                      </div>
                      <div className="vs-lb-subs">
                        {c.salesCount} sale{c.salesCount !== 1 ? "s" : ""}
                      </div>
                      <div className="vs-lb-bar-wrap">
                        <div className="vs-lb-bar">
                          <div
                            className="vs-lb-bar-fill"
                            style={{
                              width: `${(c.totalNet / maxChatterNet) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="vs-lb-amount">
                      ${c.totalNet.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STYLES ── */}
      <style jsx>{`
        .vs-sales-root {
          width: 100%;
        }

        /* ── MAIN LAYOUT ── */
        .vs-main-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1000px) { .vs-main-layout { grid-template-columns: 1fr; } }

        /* ── CARD ── */
        .vs-card {
          background: var(--vg-surface);
          border: 1px solid var(--vg-border);
          border-radius: 16px;
        }

        .vs-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0;
          margin-bottom: 18px;
        }
        .vs-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .vs-card-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--vg-accent);
          opacity: 0.8;
        }
        .vs-dot-green { background: #3ddc97; }
        .vs-card-subtitle {
          font-size: 11px;
          color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
        }

        /* ── SUBMIT FORM ── */
        .vs-submit-card { padding: 20px; }

        .vs-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        @media (max-width: 600px) { .vs-form-grid { grid-template-columns: 1fr; } }
        .vs-three { grid-template-columns: 1fr 1fr 1fr; }
        @media (max-width: 700px) { .vs-three { grid-template-columns: 1fr 1fr; } }

        .vs-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .vs-field-label {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .vs-field input,
        .vs-field select,
        .vs-field textarea {
          padding: 11px 14px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 10px;
          color: var(--vg-text);
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        .vs-field input::placeholder,
        .vs-field textarea::placeholder {
          color: rgba(240,238,255,0.18);
        }
        .vs-field input:focus,
        .vs-field select:focus,
        .vs-field textarea:focus {
          border-color: rgba(180,120,255,0.3);
          box-shadow: 0 0 0 3px rgba(180,120,255,0.05);
        }
        .vs-field select { appearance: none; cursor: pointer; }
        .vs-field textarea { resize: vertical; min-height: 80px; line-height: 1.6; }

        /* Amount input */
        .vs-amount-wrap { position: relative; }
        .vs-amount-prefix {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          color: #3ddc97;
          pointer-events: none;
        }
        .vs-amount-wrap input { padding-left: 28px; }

        /* Clip input */
        .vs-clip-wrap { position: relative; }
        .vs-clip-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--vg-accent);
          pointer-events: none;
        }
        .vs-clip-wrap input { padding-left: 36px; }

        /* Type pills */
        .vs-type-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .vs-type-pill {
          padding: 7px 14px;
          border-radius: 8px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          color: var(--vg-text-dim);
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .vs-type-pill.active {
          background: rgba(61,220,151,0.12);
          border-color: rgba(61,220,151,0.25);
          color: #3ddc97;
        }
        .vs-type-pill:hover:not(.active) {
          border-color: rgba(255,255,255,0.1);
          color: var(--vg-text-mid);
        }

        /* Submitter tag (read-only who-am-I display) */
        .vs-submitter-tag {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 14px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 10px;
          font-size: 14px;
          color: var(--vg-text);
          font-weight: 500;
        }

        /* Submit button */
        .vs-submit-btn {
          padding: 15px;
          background: linear-gradient(135deg, #3ddc97 0%, #22c77a 100%);
          border: none;
          border-radius: 12px;
          color: #050d0a;
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: all 0.22s;
          box-shadow: 0 8px 28px rgba(61,220,151,0.2), 0 2px 8px rgba(0,0,0,0.3);
          margin-top: 18px;
        }
        .vs-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 36px rgba(61,220,151,0.3);
        }
        .vs-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Success toast */
        .vs-success-toast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 16px;
          background: rgba(61,220,151,0.12);
          border: 1px solid rgba(61,220,151,0.25);
          border-radius: 11px;
          margin-top: 12px;
          font-size: 13px;
          color: #3ddc97;
          font-weight: 500;
          animation: vs-fadeIn 0.3s ease;
        }
        @keyframes vs-fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── RIGHT PANEL ── */
        .vs-right-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Linked voice card */
        .vs-linked-card { padding: 16px 18px; }
        .vs-linked-desc {
          font-size: 11px;
          color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
          margin-top: 6px;
          margin-bottom: 0;
        }

        .vs-linked-voice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 11px;
          margin-top: 12px;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .vs-linked-voice:hover { border-color: rgba(180,120,255,0.25); }
        .vs-linked-voice.selected {
          border-color: rgba(61,220,151,0.3);
          background: rgba(61,220,151,0.04);
        }

        .vs-lv-avatar {
          width: 38px; height: 38px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Syne', system-ui, sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: white;
          flex-shrink: 0;
        }
        .vs-lv-info { flex: 1; min-width: 0; }
        .vs-lv-name { font-size: 13px; font-weight: 600; }
        .vs-lv-meta {
          font-size: 10px;
          color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vs-lv-check {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: var(--vg-surface);
          border: 1.5px solid var(--vg-border);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.18s;
        }
        .vs-linked-voice.selected .vs-lv-check {
          background: #3ddc97;
          border-color: #3ddc97;
          box-shadow: 0 0 10px rgba(61,220,151,0.35);
        }

        /* ── Leaderboard ── */
        .vs-leaderboard-card { padding: 16px 18px 18px; }
        .vs-lb-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 14px;
        }
        .vs-lb-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 9px;
          transition: background 0.15s;
        }
        .vs-lb-item:hover { background: rgba(255,255,255,0.025); }

        .vs-lb-rank {
          width: 22px;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim);
          flex-shrink: 0;
          text-align: center;
        }
        .vs-lb-rank.top { color: #3ddc97; font-weight: 600; }

        .vs-lb-scope-badge {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .vs-lb-avatar {
          width: 30px; height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Syne', system-ui, sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: white;
          flex-shrink: 0;
        }
        .vs-lb-info { flex: 1; min-width: 0; }
        .vs-lb-chatter {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vs-lb-subs {
          font-size: 10px;
          color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
          margin-top: 1px;
        }
        .vs-lb-amount {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          color: #3ddc97;
          flex-shrink: 0;
        }
        .vs-lb-bar-wrap { margin-top: 3px; }
        .vs-lb-bar {
          height: 2px;
          background: rgba(61,220,151,0.15);
          border-radius: 100px;
          overflow: hidden;
        }
        .vs-lb-bar-fill {
          height: 100%;
          background: #3ddc97;
          border-radius: 100px;
        }

        /* ── SALES LOG TABLE ── */
        .vs-log-card { padding: 18px 20px; margin-top: 16px; }
        .vs-log-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .vs-log-filters { display: flex; gap: 6px; }
        .vs-log-filter {
          padding: 5px 12px;
          border-radius: 7px;
          background: transparent;
          border: 1px solid var(--vg-border);
          color: var(--vg-text-dim);
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: all 0.15s;
        }
        .vs-log-filter.active {
          background: rgba(180,120,255,0.1);
          border-color: rgba(180,120,255,0.3);
          color: var(--vg-accent);
        }
        .vs-log-filter:hover:not(.active) {
          color: var(--vg-text-mid);
          border-color: rgba(255,255,255,0.1);
        }

        .vs-overflow-x { overflow-x: auto; }

        .vs-log-table { width: 100%; border-collapse: collapse; }
        .vs-log-table th {
          text-align: left;
          padding: 8px 12px;
          font-size: 9px;
          font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--vg-border);
        }
        .vs-log-table td {
          padding: 12px 12px;
          font-size: 13px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          vertical-align: middle;
        }
        .vs-log-table tr:last-child td { border-bottom: none; }
        .vs-log-table tr:hover td { background: rgba(255,255,255,0.015); }

        .vs-td-voice { display: flex; align-items: center; gap: 9px; }
        .vs-td-avatar {
          width: 28px; height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Syne', system-ui, sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: white;
          flex-shrink: 0;
        }
        .vs-td-amount {
          font-family: 'DM Mono', monospace;
          font-weight: 600;
          color: #3ddc97;
        }
        .vs-td-date {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--vg-text-dim);
        }
        .vs-td-chatter { color: var(--vg-text-mid); font-size: 12px; }

        .vs-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 100px;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.04em;
        }
        .vs-badge-tip { background: rgba(61,220,151,0.1); color: #3ddc97; border: 1px solid rgba(61,220,151,0.2); }
        .vs-badge-ppv { background: rgba(180,120,255,0.1); color: var(--vg-accent); border: 1px solid rgba(180,120,255,0.2); }
        .vs-badge-sub { background: rgba(79,209,255,0.1); color: var(--vg-accent-3); border: 1px solid rgba(79,209,255,0.2); }
        .vs-badge-custom { background: rgba(255,180,60,0.1); color: #ffb43c; border: 1px solid rgba(255,180,60,0.2); }

        .vs-delete-row {
          width: 26px; height: 26px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--vg-text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .vs-delete-row:hover { background: rgba(255,60,60,0.1); color: #ff6060; }
        .vs-lv-text-preview {
          font-size: 11px;
          color: var(--vg-text-mid);
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
          opacity: 0.75;
        }

        /* Clip search */
        .vs-clip-search-wrap {
          position: relative;
          margin-top: 10px;
          margin-bottom: 10px;
        }
        .vs-clip-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 13px;
          height: 13px;
          color: var(--vg-text-dim);
          pointer-events: none;
        }
        .vs-clip-search-input {
          width: 100%;
          padding: 9px 12px 9px 32px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 9px;
          color: var(--vg-text);
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .vs-clip-search-input::placeholder { color: rgba(240,238,255,0.2); }
        .vs-clip-search-input:focus {
          border-color: rgba(180,120,255,0.3);
          box-shadow: 0 0 0 3px rgba(180,120,255,0.05);
        }

        /* Scrollable clip list */
        .vs-clip-list {
          max-height: 400px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .vs-clip-list::-webkit-scrollbar { width: 4px; }
        .vs-clip-list::-webkit-scrollbar-track { background: transparent; }
        .vs-clip-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 100px;
        }

        /* Play button on clip rows */
        .vs-clip-play-btn {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 50%;
          background: rgba(79,209,255,0.1);
          border: 1px solid rgba(79,209,255,0.2);
          color: var(--vg-accent-3, #4fd1ff);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s;
          padding: 0;
        }
        .vs-clip-play-btn:hover:not(.disabled) {
          background: rgba(79,209,255,0.2);
          box-shadow: 0 0 10px rgba(79,209,255,0.2);
          transform: scale(1.05);
        }
        .vs-clip-play-btn.playing {
          background: rgba(61,220,151,0.15);
          border-color: rgba(61,220,151,0.3);
          color: #3ddc97;
          box-shadow: 0 0 10px rgba(61,220,151,0.2);
        }
        .vs-clip-play-btn.disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        /* ── SCREENSHOT UPLOAD ── */
        .vs-screenshot-drop-zone {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: var(--vg-surface-2);
          border: 1.5px dashed var(--vg-border);
          border-radius: 10px;
          color: var(--vg-text-dim);
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: all 0.18s;
          width: 100%;
        }
        .vs-screenshot-drop-zone:hover {
          border-color: rgba(180,120,255,0.35);
          color: var(--vg-text-mid);
          background: rgba(180,120,255,0.04);
        }

        .vs-screenshot-preview-wrap {
          position: relative;
          display: inline-flex;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--vg-border);
          max-height: 160px;
        }
        .vs-screenshot-preview-img {
          display: block;
          max-height: 160px;
          max-width: 100%;
          object-fit: cover;
          border-radius: 10px;
        }
        .vs-screenshot-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(0,0,0,0.7);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .vs-screenshot-remove:hover { background: rgba(255,60,60,0.8); }
        .vs-screenshot-uploading {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          background: rgba(0,0,0,0.65);
          color: #fff;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          text-align: center;
          padding: 5px;
          letter-spacing: 0.05em;
        }

        /* Screenshot thumbnail in log */
        .vs-screenshot-thumb-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: 6px;
          overflow: hidden;
          display: inline-flex;
        }
        .vs-screenshot-thumb {
          width: 36px;
          height: 36px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid var(--vg-border);
          transition: transform 0.15s, box-shadow 0.15s;
          display: block;
        }
        .vs-screenshot-thumb-btn:hover .vs-screenshot-thumb {
          transform: scale(1.08);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        }
        .vs-no-screenshot {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
        }

        /* Screenshot lightbox */
        .vs-lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(6px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: vs-fadeIn 0.18s ease;
        }
        .vs-lightbox-inner {
          position: relative;
          max-width: 90vw;
          max-height: 88vh;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7);
          animation: vs-lightbox-in 0.22s cubic-bezier(0.34,1.4,0.64,1);
        }
        .vs-lightbox-img {
          display: block;
          max-width: 90vw;
          max-height: 88vh;
          object-fit: contain;
          border-radius: 14px;
        }
        .vs-lightbox-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(0,0,0,0.65);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
        }
        .vs-lightbox-close:hover {
          background: rgba(255,60,60,0.7);
          color: #fff;
          transform: scale(1.08);
        }
        @keyframes vs-lightbox-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ── ROW ACTIONS (edit + delete) ── */
        .vs-row-actions {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .vs-log-table tr:hover .vs-row-actions { opacity: 1; }
        .vs-edit-row {
          width: 26px; height: 26px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--vg-text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .vs-edit-row:hover { background: rgba(79,209,255,0.1); color: var(--vg-accent-3, #4fd1ff); }

        /* Inline delete confirm */
        .vs-delete-confirm-row {
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .vs-del-sure {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #ff6060;
        }
        .vs-del-yes, .vs-del-no {
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          border: 1px solid;
          transition: all 0.12s;
          line-height: 1;
        }
        .vs-del-yes {
          background: rgba(255,60,60,0.15);
          border-color: rgba(255,60,60,0.35);
          color: #ff6060;
        }
        .vs-del-yes:hover { background: rgba(255,60,60,0.3); }
        .vs-del-no {
          background: rgba(255,255,255,0.04);
          border-color: var(--vg-border);
          color: var(--vg-text-dim);
        }
        .vs-del-no:hover { background: rgba(255,255,255,0.08); }

        /* Notes tooltip */
        .vs-notes-cell {
          position: relative;
          display: inline-flex;
          align-items: center;
          color: var(--vg-text-dim);
          cursor: default;
        }
        .vs-notes-cell:hover { color: var(--vg-accent); }
        .vs-notes-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #1a1530;
          border: 1px solid var(--vg-border);
          color: var(--vg-text);
          font-size: 12px;
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
          line-height: 1.5;
          padding: 8px 12px;
          border-radius: 9px;
          white-space: pre-wrap;
          word-break: break-word;
          max-width: 240px;
          min-width: 100px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          z-index: 200;
          pointer-events: none;
        }
        .vs-notes-cell:hover .vs-notes-tooltip { display: block; }

        /* Leaderboard "you" highlight */
        .vs-lb-item.vs-lb-you {
          background: rgba(61,220,151,0.04);
          outline: 1px solid rgba(61,220,151,0.15);
        }
        .vs-lb-you-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          background: rgba(61,220,151,0.15);
          border: 1px solid rgba(61,220,151,0.25);
          border-radius: 100px;
          font-size: 9px;
          font-family: 'DM Mono', monospace;
          color: #3ddc97;
          margin-left: 6px;
          letter-spacing: 0.05em;
          vertical-align: middle;
        }

        /* Edit modal */
        .vs-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: vs-fadeIn 0.15s ease;
        }
        .vs-modal {
          background: var(--vg-surface);
          border: 1px solid var(--vg-border);
          border-radius: 18px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
          margin: 16px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6);
          animation: vs-lightbox-in 0.2s cubic-bezier(0.34,1.2,0.64,1);
        }
        .vs-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .vs-modal-title {
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
        }
        .vs-modal-close {
          width: 30px; height: 30px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid var(--vg-border);
          color: var(--vg-text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .vs-modal-close:hover { background: rgba(255,255,255,0.06); color: var(--vg-text); }
        .vs-modal-save {
          padding: 10px 22px;
          background: linear-gradient(135deg, #3ddc97 0%, #22c77a 100%);
          border: none;
          border-radius: 10px;
          color: #050d0a;
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
        }
        .vs-modal-save:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(61,220,151,0.25);
        }
        .vs-modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .vs-modal-cancel {
          padding: 10px 18px;
          background: transparent;
          border: 1px solid var(--vg-border);
          border-radius: 10px;
          color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .vs-modal-cancel:hover {
          background: rgba(255,255,255,0.04);
          color: var(--vg-text-mid);
        }
      `}</style>

      {/* Screenshot lightbox portal */}
      {lightboxUrl && typeof document !== "undefined" && createPortal(
        <div
          className="vs-lightbox-backdrop"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="vs-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Sale proof screenshot"
              className="vs-lightbox-img"
            />
            <button
              className="vs-lightbox-close"
              onClick={() => setLightboxUrl(null)}
              type="button"
              title="Close"
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Edit sale modal portal */}
      {editingSale && typeof document !== "undefined" && createPortal(
        <div
          className="vs-modal-backdrop"
          onClick={() => setEditingSale(null)}
        >
          <div
            className="vs-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vs-modal-head">
              <span className="vs-modal-title">Edit Sale</span>
              <button
                className="vs-modal-close"
                onClick={() => setEditingSale(null)}
                type="button"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div className="vs-field" style={{ marginBottom: 14 }}>
              <div className="vs-field-label">Sale Type</div>
              <div className="vs-type-pills">
                {SALE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setEditSaleType(t.value)}
                    className={`vs-type-pill${editSaleType === t.value ? " active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div className="vs-field">
                <div className="vs-field-label">Amount</div>
                <div className="vs-amount-wrap">
                  <span className="vs-amount-prefix">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="vs-field">
                <div className="vs-field-label">Platform Cut %</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editPlatformCut}
                  onChange={(e) => setEditPlatformCut(e.target.value)}
                />
              </div>
              <div className="vs-field">
                <div className="vs-field-label">Net Earned</div>
                <input
                  type="text"
                  readOnly
                  value={(() => {
                    const amt = parseFloat(editAmount) || 0;
                    const cut = parseFloat(editPlatformCut) || 0;
                    const net = amt * (1 - cut / 100);
                    return net > 0 ? `$${net.toFixed(2)}` : "";
                  })()}
                  placeholder="$0.00"
                  style={{ color: "#3ddc97", fontFamily: "'DM Mono', monospace" }}
                />
              </div>
            </div>

            <div className="vs-field" style={{ marginBottom: 20 }}>
              <div className="vs-field-label">Notes</div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="vs-modal-cancel" onClick={() => setEditingSale(null)}>
                Cancel
              </button>
              <button
                className="vs-modal-save"
                onClick={handleEditSave}
                disabled={isSavingEdit || !editAmount}
              >
                {isSavingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
