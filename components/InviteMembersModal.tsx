"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Mail, UserPlus, Loader2, CheckCircle, XCircle, AlertCircle, Users } from "lucide-react";
import { useOrgTeams } from "@/lib/hooks/useOrgTeams.query";

interface InviteMembersModalProps {
  organizationSlug: string;
  organizationName: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentMembers?: number;
  maxMembers?: number;
}

export function InviteMembersModal({
  organizationSlug,
  organizationName,
  organizationId,
  isOpen,
  onClose,
  onSuccess,
  currentMembers,
  maxMembers,
}: InviteMembersModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN" | "MANAGER" | "CREATOR" | "VIEWER">("MEMBER");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    invited: Array<{ email: string }>;
    failed: Array<{ email: string; error: string }>;
    skipped: string[];
  } | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const { data: teams } = useOrgTeams(organizationId);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loading) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, loading]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setLimitError(null);

    try {
      // Parse emails from textarea (comma, newline, or space separated)
      const emails = emailInput
        .split(/[\s,\n]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);

      if (emails.length === 0) {
        alert("Please enter at least one email address");
        setLoading(false);
        return;
      }

      // Check member limit if provided
      if (currentMembers !== undefined && maxMembers !== undefined) {
        const availableSlots = maxMembers - currentMembers;
        if (emails.length > availableSlots) {
          setLimitError(
            `You can only invite ${availableSlots} more member${availableSlots !== 1 ? 's' : ''}. ` +
            `Your plan allows ${maxMembers} members and you currently have ${currentMembers}. ` +
            `Please reduce the number of invites or upgrade your plan.`
          );
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`/api/tenant/${organizationSlug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, role, teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          invited: data.invited || [],
          failed: data.failed || [],
          skipped: data.skipped || [],
        });
        setEmailInput("");
        onSuccess?.();
      } else {
        alert(data.error || "Failed to send invitations");
      }
    } catch (error) {
      console.error("Error sending invites:", error);
      alert("Failed to send invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmailInput("");
    setResult(null);
    setRole("MEMBER");
    setSelectedTeamIds([]);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Close on backdrop click (but not when loading)
        if (e.target === e.currentTarget && !loading) {
          handleClose();
        }
      }}
    >
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-border animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EC67A1]/10 rounded-lg">
              <Mail className="w-5 h-5 text-[#EC67A1]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Invite Members
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                to {organizationName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {result ? (
            // Results View
            <div className="space-y-4">
              {result.invited.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-green-400 font-medium mb-2">
                        Successfully sent {result.invited.length} invitation(s)
                      </h3>
                      <ul className="text-sm text-green-300 space-y-1">
                        {result.invited.map((item, idx) => (
                          <li key={idx}>• {item.email}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-yellow-400 font-medium mb-2">
                        Skipped {result.skipped.length} (already members)
                      </h3>
                      <ul className="text-sm text-yellow-300 space-y-1">
                        {result.skipped.map((email, idx) => (
                          <li key={idx}>• {email}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.failed.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-red-400 font-medium mb-2">
                        Failed to invite {result.failed.length}
                      </h3>
                      <ul className="text-sm text-red-300 space-y-1">
                        {result.failed.map((item, idx) => (
                          <li key={idx}>
                            • {item.email}: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setResult(null); setSelectedTeamIds([]); }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#F774B9] hover:to-[#EC67A1] text-white rounded-lg transition-all shadow-md shadow-[#EC67A1]/25"
                >
                  Invite More
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 text-foreground border border-border rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            // Invite Form
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Member Limit Error */}
              {limitError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-rose-200 mb-1">
                        Too Many Invites
                      </h4>
                      <p className="text-sm text-rose-300">
                        {limitError}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLimitError(null)}
                      className="text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Member Limit Info */}
              {currentMembers !== undefined && maxMembers !== undefined && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-200">
                    <span className="font-semibold">Available slots:</span> {maxMembers - currentMembers} of {maxMembers} members
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Addresses
                </label>
                <textarea
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setLimitError(null); // Clear error when user starts typing
                  }}
                  placeholder="Enter email addresses (comma, space, or new line separated)&#10;&#10;Example:&#10;user1@example.com&#10;user2@example.com, user3@example.com"
                  className="w-full h-32 px-4 py-3 bg-accent border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1] focus:border-transparent resize-none transition-all"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You can paste multiple emails separated by commas, spaces, or new lines
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN" | "MANAGER" | "CREATOR" | "VIEWER")}
                  className="w-full px-4 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-[#5DC3F8] focus:border-transparent transition-all"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CREATOR">Creator</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  {role === 'ADMIN' && 'Full access to manage organization settings, members, and all spaces.'}
                  {role === 'MANAGER' && 'Can manage spaces, assign tasks, and oversee team workflows.'}
                  {role === 'CREATOR' && 'Can create and edit content within assigned spaces.'}
                  {role === 'MEMBER' && 'Standard access to view and collaborate in assigned spaces.'}
                  {role === 'VIEWER' && 'Read-only access to view spaces and content.'}
                </p>
              </div>

              {/* Team Assignment (optional) */}
              {teams && teams.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Assign to Teams <span className="text-muted-foreground font-normal">(optional)</span>
                    </span>
                  </label>
                  <div className="bg-accent border border-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {teams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-background/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(team.id)}
                          onChange={(e) => {
                            setSelectedTeamIds((prev) =>
                              e.target.checked
                                ? [...prev, team.id]
                                : prev.filter((id) => id !== team.id)
                            );
                          }}
                          className="rounded border-border text-brand-mid-pink focus:ring-brand-light-pink"
                        />
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color || '#6B7280' }}
                        />
                        <span className="text-sm text-foreground flex-1">{team.name}</span>
                        {team._count?.members !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {team._count.members} member{team._count.members !== 1 ? 's' : ''}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected members will be automatically added to these teams upon accepting the invite
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 text-foreground border border-border rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#F774B9] hover:to-[#EC67A1] text-white rounded-lg transition-all shadow-md shadow-[#EC67A1]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Send Invitations
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
