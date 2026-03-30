"use client";

import { useState, useCallback } from "react";
import {
  X,
  Share2,
  Users,
  Building2,
  Shield,
  Eye,
  Pencil,
  Zap,
  Trash2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useOrganization } from "@/lib/hooks/useOrganization.query";
import {
  useFolderShares,
  useShareFolderMutation,
  useUnshareFolderMutation,
  useOrgTeams,
  type FolderShare,
} from "@/lib/hooks/useSharedFolders.query";

interface ShareFolderModalProps {
  folderId: string;
  folderName: string;
  onClose: () => void;
}

const PERMISSION_OPTIONS = [
  {
    value: "VIEW" as const,
    label: "View",
    description: "Can browse items in this folder",
    icon: Eye,
  },
  {
    value: "USE" as const,
    label: "Use",
    description: "Can use items in generation tabs",
    icon: Zap,
  },
  {
    value: "EDIT" as const,
    label: "Edit",
    description: "Can add, remove, and modify items",
    icon: Pencil,
  },
];

export function ShareFolderModal({
  folderId,
  folderName,
  onClose,
}: ShareFolderModalProps) {
  const { currentOrganization, organizations } = useOrganization();
  const { data: sharesData, isLoading: sharesLoading } =
    useFolderShares(folderId);
  const shareMutation = useShareFolderMutation();
  const unshareMutation = useUnshareFolderMutation();

  const [selectedOrgId, setSelectedOrgId] = useState(
    currentOrganization?.id || ""
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedPermission, setSelectedPermission] = useState<
    "VIEW" | "USE" | "EDIT"
  >("USE");
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  const { data: teamsData } = useOrgTeams(selectedOrgId || null);
  const teams = teamsData?.teams ?? [];
  const shares = sharesData?.shares ?? [];

  const handleShare = useCallback(async () => {
    if (!selectedOrgId) return;

    await shareMutation.mutateAsync({
      folderId,
      organizationId: selectedOrgId,
      orgTeamId: selectedTeamId || null,
      permission: selectedPermission,
    });

    // Reset team selection after sharing
    setSelectedTeamId("");
  }, [
    folderId,
    selectedOrgId,
    selectedTeamId,
    selectedPermission,
    shareMutation,
  ]);

  const handleRemoveShare = useCallback(
    async (share: FolderShare) => {
      await unshareMutation.mutateAsync({
        folderId,
        shareId: share.id,
      });
    },
    [folderId, unshareMutation]
  );

  const getPermissionBadge = (permission: string) => {
    const opt = PERMISSION_OPTIONS.find((p) => p.value === permission);
    if (!opt) return null;
    const Icon = opt.icon;
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
        <Icon className="w-3 h-3" />
        {opt.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-light-pink to-brand-dark-pink rounded-xl flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Share Folder
              </h2>
              <p className="text-sm text-gray-400 truncate max-w-[250px]">
                {folderName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Share Form */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Organization selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Share with Organization
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>
                    {organizations.find((o) => o.id === selectedOrgId)?.name ||
                      "Select organization..."}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showOrgDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrgId(org.id);
                        setSelectedTeamId("");
                        setShowOrgDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${
                        selectedOrgId === org.id
                          ? "text-brand-light-pink bg-gray-700/50"
                          : "text-gray-300"
                      }`}
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">{org.name}</span>
                    </button>
                  ))}
                  {organizations.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500">
                      No organizations found
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Team selector (optional) */}
          {selectedOrgId && teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Restrict to Team{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-light-pink/50"
              >
                <option value="">Entire organization</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Permission selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Permission Level
            </label>
            <div className="space-y-2">
              {PERMISSION_OPTIONS.map((perm) => {
                const Icon = perm.icon;
                return (
                  <button
                    key={perm.value}
                    onClick={() => setSelectedPermission(perm.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      selectedPermission === perm.value
                        ? "border-brand-light-pink/50 bg-brand-light-pink/10 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{perm.label}</div>
                      <div className="text-xs text-gray-500">
                        {perm.description}
                      </div>
                    </div>
                    {selectedPermission === perm.value && (
                      <div className="w-4 h-4 bg-brand-light-pink rounded-full flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            disabled={!selectedOrgId || shareMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-mid-pink hover:to-brand-dark-pink text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {shareMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {shareMutation.isPending ? "Sharing..." : "Share Folder"}
          </button>

          {shareMutation.isError && (
            <p className="text-sm text-red-400">
              {(shareMutation.error as Error).message}
            </p>
          )}

          {/* Existing shares */}
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Currently Shared With
            </h3>
            {sharesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Not shared with anyone yet
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {share.organization?.name || "Unknown Org"}
                        </p>
                        {share.orgTeam && (
                          <p className="text-xs text-gray-500 truncate">
                            Team: {share.orgTeam.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getPermissionBadge(share.permission)}
                      <button
                        onClick={() => handleRemoveShare(share)}
                        disabled={unshareMutation.isPending}
                        className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Remove share"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
