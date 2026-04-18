"use client";

import { useEffect, useState, useRef } from "react";

type LogEntry = { time: string; message: string; kind: "info" | "ok" | "warn" | "err" };

export default function DeepLinkTestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ua, setUa] = useState("");
  const [isInstagram, setIsInstagram] = useState(false);
  const [isFacebook, setIsFacebook] = useState(false);
  const [isTikTok, setIsTikTok] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosVersion, setIosVersion] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [autoTried, setAutoTried] = useState(false);
  const autoRan = useRef(false);

  const log = (message: string, kind: LogEntry["kind"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, message, kind }]);
    // eslint-disable-next-line no-console
    console.log(`[${kind}] ${message}`);
  };

  useEffect(() => {
    const agent = navigator.userAgent || "";
    setUa(agent);
    setCurrentUrl(window.location.href);

    const ig = /Instagram/i.test(agent);
    const fb = /(FBAN|FBAV|FB_IAB)/i.test(agent);
    const tt = /(musical_ly|Bytedance|TikTok)/i.test(agent);
    const ios = /iPad|iPhone|iPod/.test(agent) && !("MSStream" in window);

    setIsInstagram(ig);
    setIsFacebook(fb);
    setIsTikTok(tt);
    setIsIOS(ios);

    const versionMatch = agent.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
    if (versionMatch) {
      setIosVersion(
        `${versionMatch[1]}.${versionMatch[2]}${versionMatch[3] ? "." + versionMatch[3] : ""}`
      );
    }

    log(`Detected: iOS=${ios} iOSVer=${versionMatch?.[0] ?? "?"} IG=${ig} FB=${fb} TT=${tt}`);

    // Attempt auto-escape ONCE on load — these almost certainly won't fire without a tap,
    // but we try so we know for sure on this exact iOS + IG build.
    if (!autoRan.current && (ig || fb || tt)) {
      autoRan.current = true;
      setTimeout(() => {
        log("Auto-attempt: window.location = x-safari-https://...", "info");
        try {
          const target = window.location.href.replace(/^https?:\/\//, "");
          // intentionally do not actually navigate away on desktop testing:
          if (ios) {
            window.location.href = "x-safari-https://" + target;
          }
        } catch (e) {
          log("x-safari-https threw: " + String(e), "err");
        }
        setAutoTried(true);
      }, 600);
    }
  }, []);

  const randomId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  // ---------- Techniques ----------

  const tryShortcutsCallback = () => {
    const enc = encodeURIComponent(window.location.href);
    const id = randomId();
    const url = `shortcuts://x-callback-url/run-shortcut?name=${id}&x-error=${enc}`;
    log("Shortcuts x-callback: " + url, "info");
    window.location.href = url;
  };

  const tryShortcutsOpenURL = () => {
    const enc = encodeURIComponent(window.location.href);
    const url = `shortcuts://run-shortcut?name=OpenInSafari&input=${enc}`;
    log("Shortcuts run-shortcut: " + url, "info");
    window.location.href = url;
  };

  const tryXSafariHttpsDirect = () => {
    const target = window.location.href.replace(/^https?:\/\//, "");
    const url = "x-safari-https://" + target;
    log("x-safari-https (location.href): " + url, "info");
    window.location.href = url;
  };

  const tryXSafariHttpsWindowOpen = () => {
    const target = window.location.href.replace(/^https?:\/\//, "");
    const url = "x-safari-https://" + target;
    log("x-safari-https (window.open): " + url, "info");
    const w = window.open(url, "_blank");
    if (!w) log("window.open returned null/blocked", "warn");
  };

  const tryGoogleChrome = () => {
    const target = window.location.href.replace(/^https?:\/\//, "");
    const url = "googlechromes://" + target;
    log("googlechromes://: " + url, "info");
    window.open(url, "_blank");
  };

  const tryFirefox = () => {
    const url = `firefox://open-url?url=${encodeURIComponent(window.location.href)}`;
    log("firefox://open-url: " + url, "info");
    window.open(url, "_blank");
  };

  const tryAnchorClick = () => {
    log("anchor click with target=_blank", "info");
    const a = document.createElement("a");
    a.href = window.location.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const tryAnchorXSafari = () => {
    const target = window.location.href.replace(/^https?:\/\//, "");
    log("anchor click x-safari-https", "info");
    const a = document.createElement("a");
    a.href = "x-safari-https://" + target;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const tryChain = () => {
    log("Running chain: shortcuts → x-safari-https window.open → googlechromes", "info");
    // 1. Shortcuts callback (most reliable on recent iOS)
    tryShortcutsCallback();
    // If the above fails, Safari-direct via window.open
    setTimeout(() => tryXSafariHttpsWindowOpen(), 500);
    // Last resort — Chrome
    setTimeout(() => tryGoogleChrome(), 1200);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      log("URL copied to clipboard", "ok");
    } catch (e) {
      log("clipboard failed: " + String(e), "err");
    }
  };

  // ---------- UI ----------

  const Button = ({
    onClick,
    children,
    variant = "primary",
  }: {
    onClick: () => void;
    children: React.ReactNode;
    variant?: "primary" | "secondary" | "danger";
  }) => {
    const base =
      "w-full px-4 py-3 rounded-lg font-medium text-sm transition active:scale-[0.98] mb-2";
    const styles = {
      primary:
        "bg-brand-light-pink hover:bg-brand-mid-pink text-white dark:bg-brand-dark-pink dark:hover:bg-brand-mid-pink",
      secondary:
        "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-brand-off-white border border-gray-200 dark:border-brand-mid-pink/30",
      danger:
        "bg-brand-blue hover:bg-brand-blue/80 text-white",
    };
    return (
      <button type="button" onClick={onClick} className={`${base} ${styles[variant]}`}>
        {children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
      <div className="max-w-xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
            iOS In-App Browser Escape Test
          </h1>
          <p className="text-sm text-gray-600 dark:text-brand-off-white/70">
            Open this page inside Instagram on iPhone, then tap the techniques below.
          </p>
        </header>

        {/* Device info — important for screen recording */}
        <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-900 dark:text-brand-off-white">
            Device Detection
          </h2>
          <dl className="text-xs space-y-1 text-gray-700 dark:text-brand-off-white/80">
            <div className="flex justify-between">
              <dt className="font-medium">iOS:</dt>
              <dd>
                {isIOS ? "YES" : "no"} {iosVersion && `(${iosVersion})`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">Instagram:</dt>
              <dd className={isInstagram ? "text-brand-light-pink font-semibold" : ""}>
                {isInstagram ? "YES" : "no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">Facebook:</dt>
              <dd>{isFacebook ? "YES" : "no"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">TikTok:</dt>
              <dd>{isTikTok ? "YES" : "no"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">Auto-attempted:</dt>
              <dd>{autoTried ? "yes" : "no"}</dd>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-brand-mid-pink/20">
              <dt className="font-medium mb-1">URL:</dt>
              <dd className="break-all text-[11px] font-mono">{currentUrl}</dd>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-brand-mid-pink/20">
              <dt className="font-medium mb-1">User Agent:</dt>
              <dd className="break-all text-[11px] font-mono">{ua}</dd>
            </div>
          </dl>
        </section>

        {/* Techniques */}
        <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-brand-off-white">
            Techniques (tap each to test)
          </h2>

          <Button onClick={tryChain}>Try ALL (chain: shortcuts → safari → chrome)</Button>

          <div className="h-px bg-gray-200 dark:bg-brand-mid-pink/20 my-3" />

          <Button onClick={tryShortcutsCallback} variant="secondary">
            1. shortcuts:// x-callback-url (most reliable)
          </Button>
          <Button onClick={tryShortcutsOpenURL} variant="secondary">
            2. shortcuts://run-shortcut (needs installed shortcut)
          </Button>
          <Button onClick={tryXSafariHttpsWindowOpen} variant="secondary">
            3. x-safari-https:// via window.open
          </Button>
          <Button onClick={tryXSafariHttpsDirect} variant="secondary">
            4. x-safari-https:// via location.href
          </Button>
          <Button onClick={tryAnchorXSafari} variant="secondary">
            5. x-safari-https:// via &lt;a&gt;.click()
          </Button>
          <Button onClick={tryGoogleChrome} variant="secondary">
            6. googlechromes:// (opens Chrome, fallback)
          </Button>
          <Button onClick={tryFirefox} variant="secondary">
            7. firefox://open-url (opens Firefox, fallback)
          </Button>
          <Button onClick={tryAnchorClick} variant="secondary">
            8. Plain &lt;a target=&quot;_blank&quot;&gt; click
          </Button>

          <div className="h-px bg-gray-200 dark:bg-brand-mid-pink/20 my-3" />

          <Button onClick={copyUrl} variant="danger">
            Copy URL (then paste in Safari manually)
          </Button>
        </section>

        {/* Fallback instructions */}
        {isInstagram && (
          <section className="bg-brand-light-pink/10 dark:bg-brand-dark-pink/10 border border-brand-light-pink/40 dark:border-brand-mid-pink/30 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold mb-2 text-gray-900 dark:text-brand-off-white">
              Manual fallback
            </h2>
            <ol className="text-xs space-y-1 list-decimal list-inside text-gray-700 dark:text-brand-off-white/80">
              <li>Tap the three dots (···) at the top right</li>
              <li>Choose &quot;Open in external browser&quot;</li>
            </ol>
          </section>
        )}

        {/* Log */}
        <section className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-[11px]">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-white font-semibold">Event Log</h2>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-white/60 hover:text-white text-xs"
            >
              clear
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="text-white/40">(no events yet)</div>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-auto">
              {logs.map((l, i) => (
                <li
                  key={i}
                  className={
                    l.kind === "err"
                      ? "text-red-400"
                      : l.kind === "warn"
                      ? "text-yellow-400"
                      : l.kind === "ok"
                      ? "text-green-300"
                      : "text-white/80"
                  }
                >
                  <span className="text-white/40">[{l.time}]</span> {l.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
