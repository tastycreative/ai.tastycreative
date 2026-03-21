"use client";

import { useState, useCallback } from "react";
import {
  X,
  Instagram,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  ArrowRight,
  Info,
} from "lucide-react";
import { referenceBankAPI, type ReferenceFolder } from "@/lib/reference-bank/api";

interface InstagramImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  folders: ReferenceFolder[];
  currentFolderId: string | null;
}

type Tab = "urls" | "sheet";
type ImportPhase = "input" | "preview" | "importing" | "done";

interface ImportResult {
  url: string;
  status: "success" | "failed";
  itemId?: string;
  error?: string;
}

export function InstagramImportModal({
  onClose,
  onImportComplete,
  folders,
  currentFolderId,
}: InstagramImportModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("urls");
  const [phase, setPhase] = useState<ImportPhase>("input");

  // URL paste tab
  const [urlText, setUrlText] = useState("");

  // Google Sheet tab
  const [sheetUrl, setSheetUrl] = useState("");
  const [isParsingSheet, setIsParsingSheet] = useState(false);

  // Shared
  const [parsedUrls, setParsedUrls] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId
  );
  const [extraTags, setExtraTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Import state
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    failed: number;
  } | null>(null);

  // Parse URLs from pasted text
  const parseUrlsFromText = useCallback((text: string): string[] => {
    const pattern =
      /https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels)\/[A-Za-z0-9_-]+\/?/g;
    const matches = text.match(pattern);
    if (!matches) return [];
    // Deduplicate
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const url of matches) {
      const normalized = url.replace(/\/+$/, "");
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(normalized);
      }
    }
    return unique;
  }, []);

  // Handle "Preview" from URL paste tab
  const handlePreviewUrls = useCallback(() => {
    setError(null);
    const urls = parseUrlsFromText(urlText);
    if (urls.length === 0) {
      setError(
        "No valid Instagram URLs found. Paste Instagram post or reel links (one per line or mixed with other text)."
      );
      return;
    }
    if (urls.length > 100) {
      setError("Maximum 100 URLs per import. Please split into smaller batches.");
      return;
    }
    setParsedUrls(urls);
    setPhase("preview");
  }, [urlText, parseUrlsFromText]);

  // Handle "Parse Sheet" from Google Sheet tab
  const handleParseSheet = useCallback(async () => {
    setError(null);
    if (!sheetUrl.trim()) {
      setError("Please paste a Google Sheets URL");
      return;
    }
    setIsParsingSheet(true);
    try {
      const result = await referenceBankAPI.instagram.parseGoogleSheet(
        sheetUrl.trim()
      );
      if (result.urls.length === 0) {
        setError("No Instagram URLs found in this Google Sheet.");
        return;
      }
      if (result.urls.length > 100) {
        // Take first 100
        setParsedUrls(result.urls.slice(0, 100));
        setError(
          `Found ${result.urls.length} URLs but capped at 100 for this import. The rest can be imported in another batch.`
        );
      } else {
        setParsedUrls(result.urls);
      }
      setPhase("preview");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse Google Sheet"
      );
    } finally {
      setIsParsingSheet(false);
    }
  }, [sheetUrl]);

  // Remove a URL from the preview list
  const handleRemoveUrl = useCallback((index: number) => {
    setParsedUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Start import
  const handleStartImport = useCallback(async () => {
    if (parsedUrls.length === 0) return;
    setPhase("importing");
    setError(null);
    setImportProgress(0);

    const tags = extraTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      // Process in batches of 10 for progress visibility
      const batchSize = 10;
      const allResults: ImportResult[] = [];
      let totalImported = 0;
      let totalFailed = 0;

      for (let i = 0; i < parsedUrls.length; i += batchSize) {
        const batch = parsedUrls.slice(i, i + batchSize);
        const result = await referenceBankAPI.instagram.bulkImport(
          batch,
          selectedFolderId,
          tags.length > 0 ? tags : undefined
        );
        allResults.push(...result.results);
        totalImported += result.imported;
        totalFailed += result.failed;
        setImportResults([...allResults]);
        setImportProgress(
          Math.round(((i + batch.length) / parsedUrls.length) * 100)
        );
      }

      setImportSummary({ imported: totalImported, failed: totalFailed });
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed unexpectedly"
      );
      setPhase("done");
      setImportSummary({
        imported: importResults.filter((r) => r.status === "success").length,
        failed: importResults.filter((r) => r.status === "failed").length,
      });
    }
  }, [parsedUrls, selectedFolderId, extraTags, importResults]);

  // Extract shortcode for display
  const getShortcode = (url: string) => {
    const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] rounded-xl">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Import Instagram Content
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Import reels & posts into your Reference Bank
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* Tabs - only show in input phase */}
        {phase === "input" && (
          <div className="flex border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20 shrink-0">
            <button
              onClick={() => {
                setActiveTab("urls");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "urls"
                  ? "text-[#EC67A1] border-b-2 border-[#EC67A1]"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Paste URLs
            </button>
            <button
              onClick={() => {
                setActiveTab("sheet");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "sheet"
                  ? "text-[#EC67A1] border-b-2 border-[#EC67A1]"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Google Sheet
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* INPUT PHASE */}
          {phase === "input" && activeTab === "urls" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Paste Instagram post or reel URLs below, one per line. You can
                  also paste mixed text — we&apos;ll automatically extract any
                  Instagram links.
                </p>
              </div>
              <textarea
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder={`https://www.instagram.com/reel/ABC123/\nhttps://www.instagram.com/p/XYZ789/\nhttps://www.instagram.com/reel/DEF456/`}
                className="w-full h-48 p-3 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/30 focus:border-[#EC67A1] resize-none text-sm font-mono"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {parseUrlsFromText(urlText).length} Instagram URL(s) detected
                </span>
              </div>
            </div>
          )}

          {phase === "input" && activeTab === "sheet" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Paste the URL of a Google Sheet that contains Instagram links.
                  The sheet must be shared as &quot;Anyone with the link can
                  view&quot;. We&apos;ll scan all cells for Instagram URLs.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Google Sheets URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/30 focus:border-[#EC67A1] text-sm"
                />
              </div>
            </div>
          )}

          {/* PREVIEW PHASE */}
          {phase === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white">
                  {parsedUrls.length} Instagram URL(s) to import
                </h3>
                <button
                  onClick={() => {
                    setPhase("input");
                    setError(null);
                  }}
                  className="text-sm text-[#EC67A1] hover:text-[#E1518E]"
                >
                  Back to edit
                </button>
              </div>

              {/* URL list */}
              <div className="max-h-48 overflow-y-auto space-y-1 border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 rounded-lg p-2">
                {parsedUrls.map((url, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group"
                  >
                    <Instagram className="w-3.5 h-3.5 text-[#E1306C] shrink-0" />
                    <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate font-mono">
                      {getShortcode(url)}
                    </span>
                    <button
                      onClick={() => handleRemoveUrl(i)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Import to folder
                  </label>
                  <select
                    value={selectedFolderId || ""}
                    onChange={(e) =>
                      setSelectedFolderId(e.target.value || null)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20"
                  >
                    <option value="">Unfiled (root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Extra tags{" "}
                    <span className="text-zinc-400 font-normal">
                      (comma-separated, optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={extraTags}
                    onChange={(e) => setExtraTags(e.target.value)}
                    placeholder="e.g. reels-may-2026, campaign-name"
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* IMPORTING PHASE */}
          {phase === "importing" && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-[#EC67A1] animate-spin mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Importing...
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Processing {parsedUrls.length} Instagram URL(s)
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#EC67A1] to-[#F774B9] rounded-full transition-all duration-500"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                {importProgress}% complete
              </p>

              {/* Live results */}
              {importResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                  {importResults.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-2 py-1 rounded ${
                        r.status === "success"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      {r.status === "success" ? (
                        <CheckCircle className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate font-mono">
                        {getShortcode(r.url)}
                      </span>
                      {r.error && (
                        <span className="text-zinc-400 truncate">
                          — {r.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DONE PHASE */}
          {phase === "done" && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                {importSummary && importSummary.imported > 0 ? (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      Import Complete
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Successfully imported{" "}
                      <span className="text-green-500 font-medium">
                        {importSummary.imported}
                      </span>{" "}
                      item(s)
                      {importSummary.failed > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="text-red-500 font-medium">
                            {importSummary.failed}
                          </span>{" "}
                          failed
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      Import Failed
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Could not import any items. The posts may be private or
                      unavailable.
                    </p>
                  </>
                )}
              </div>

              {/* Results summary */}
              {importResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 rounded-lg p-2">
                  {importResults.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-2 py-1 rounded ${
                        r.status === "success"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      {r.status === "success" ? (
                        <CheckCircle className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate font-mono">
                        {getShortcode(r.url)}
                      </span>
                      {r.error && (
                        <span className="text-zinc-400 truncate">
                          — {r.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20 flex items-center justify-end gap-3">
          {phase === "input" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              {activeTab === "urls" ? (
                <button
                  onClick={handlePreviewUrls}
                  disabled={!urlText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Preview URLs
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleParseSheet}
                  disabled={!sheetUrl.trim() || isParsingSheet}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isParsingSheet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing Sheet...
                    </>
                  ) : (
                    <>
                      Parse Sheet
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {phase === "preview" && (
            <>
              <button
                onClick={() => {
                  setPhase("input");
                  setError(null);
                }}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                disabled={parsedUrls.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Instagram className="w-4 h-4" />
                Import {parsedUrls.length} item(s)
              </button>
            </>
          )}

          {phase === "importing" && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Please wait while we import your content...
            </p>
          )}

          {phase === "done" && (
            <button
              onClick={() => {
                onImportComplete();
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
