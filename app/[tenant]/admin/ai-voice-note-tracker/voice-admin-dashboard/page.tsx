"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  AudioWaveform,
  ClipboardCheck,
  Settings2,
} from "lucide-react";
import OverviewTab from "./OverviewTab";
import RevenueTab from "./RevenueTab";
import ChattersTab from "./ChattersTab";
import VoiceAnalyticsTab from "./VoiceAnalyticsTab";
import SalesAuditTab from "./SalesAuditTab";
import CommissionsTab from "./CommissionsTab";

const TABS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "revenue", label: "Revenue", icon: DollarSign },
  { id: "chatters", label: "Chatters", icon: Users },
  { id: "voices", label: "Voice Analytics", icon: AudioWaveform },
  { id: "audit", label: "Sales Audit", icon: ClipboardCheck },
  { id: "commissions", label: "Commissions", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function VoiceAdminDashboardPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="vad-root">
      {/* Tab Bar */}
      <div className="vad-tabbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`vad-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="vad-content">
        {activeTab === "overview" && <OverviewTab tenant={tenant} onNavigate={(tab: string) => setActiveTab(tab as TabId)} />}
        {activeTab === "revenue" && <RevenueTab tenant={tenant} />}
        {activeTab === "chatters" && <ChattersTab tenant={tenant} />}
        {activeTab === "voices" && <VoiceAnalyticsTab tenant={tenant} />}
        {activeTab === "audit" && <SalesAuditTab tenant={tenant} />}
        {activeTab === "commissions" && <CommissionsTab tenant={tenant} />}
      </div>

      <style jsx>{`
        .vad-root {
          min-height: 100%;
        }
        .vad-tabbar {
          display: flex;
          gap: 4px;
          padding: 0 4px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 20px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vad-tabbar::-webkit-scrollbar { display: none; }
        .vad-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 9px;
          background: transparent;
          border: 1px solid transparent;
          color: rgba(238,238,255,0.45);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          font-family: inherit;
        }
        .vad-tab:hover {
          background: rgba(255,255,255,0.04);
          color: rgba(238,238,255,0.7);
        }
        .vad-tab.active {
          background: rgba(236,103,161,0.1);
          border-color: rgba(236,103,161,0.2);
          color: #EC67A1;
        }
        .vad-tab.active svg {
          color: #EC67A1;
        }
        .vad-content {
          min-height: 400px;
        }

        @media (max-width: 768px) {
          .vad-tabbar {
            gap: 2px;
            padding: 0 2px 12px;
          }
          .vad-tab {
            padding: 7px 12px;
            font-size: 12px;
          }
          .vad-tab span {
            display: none;
          }
          .vad-tab.active span {
            display: inline;
          }
        }
      `}</style>
    </div>
  );
}
