"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Percent, Save } from "lucide-react";

interface CommissionChatter {
  clerkId: string;
  displayName: string;
  avatarUrl: string | null;
  grossRevenue: number;
  netEarned: number;
  avgPlatformCut: number;
  salesCount: number;
}

function formatCurrency(val: number) {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function CommissionsTab({ tenant }: { tenant: string }) {
  const [chatters, setChatters] = useState<CommissionChatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await fetch(`/api/tenant/${tenant}/ai-voice-dashboard?section=commissions`);
      const json = await res.json();
      if (json.commissions?.chatters) {
        setChatters(json.commissions.chatters);
        // Initialize rates from avg platform cut
        const initialRates: Record<string, number> = {};
        for (const c of json.commissions.chatters) {
          initialRates[c.clerkId] = Math.round(c.avgPlatformCut);
        }
        setRates(initialRates);
      }
    } catch (err) {
      console.error("Failed to fetch commissions data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRateChange = (clerkId: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 100) return;
    setRates((prev) => ({ ...prev, [clerkId]: num }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    // Simulate save – in production, POST to an API endpoint
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 600);
  };

  const totalGross = chatters.reduce((s, c) => s + c.grossRevenue, 0);
  const totalNet = chatters.reduce((s, c) => s + c.netEarned, 0);
  const totalPlatformCut = totalGross - totalNet;
  const avgRate = chatters.length > 0
    ? chatters.reduce((s, c) => s + c.avgPlatformCut, 0) / chatters.length
    : 0;

  if (loading) {
    return (
      <div className="vad-loading">
        <div className="vad-spinner" />
        <span>Loading commissions...</span>
        <style jsx>{`
          .vad-loading { display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:rgba(238,238,255,0.5);font-size:14px; }
          .vad-spinner { width:20px;height:20px;border:2px solid rgba(236,103,161,0.2);border-top-color:#EC67A1;border-radius:50%;animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="co-cs-wrapper">
      <div className="co-cs-box">
        <div className="co-cs-icon">
          <Percent size={28} />
        </div>
        <div className="co-cs-badge">Coming Soon</div>
        <h3 className="co-cs-title">Commission Management</h3>
        <p className="co-cs-text">
          Configure chatter commission rates and track payouts.<br />
          This feature is currently under development.
        </p>
      </div>

      <style jsx>{`
        .co-cs-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 420px;
          padding: 40px;
        }
        .co-cs-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
          max-width: 360px;
        }
        .co-cs-icon {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: rgba(236,103,161,0.1);
          border: 1px solid rgba(236,103,161,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #EC67A1;
          margin-bottom: 4px;
        }
        .co-cs-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 20px;
          background: rgba(236,103,161,0.12);
          border: 1px solid rgba(236,103,161,0.3);
          color: #EC67A1;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }
        .co-cs-title {
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #eeeeff;
          margin: 0;
        }
        .co-cs-text {
          font-size: 13px;
          color: rgba(238,238,255,0.4);
          line-height: 1.7;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
