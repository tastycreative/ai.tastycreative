"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import {
  CheckCircle,
  XCircle,
  Eye,
  User,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  Instagram,
  Globe,
  DollarSign,
  Loader2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowUpDown,
  X,
  FileText,
  Users,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function OnboardingSubmissionsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>("PENDING");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  // Fetch submissions
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-submissions", selectedStatus],
    queryFn: async () => {
      const response = await fetch(
        `/api/onboarding-submissions?status=${selectedStatus}`,
      );
      if (!response.ok) throw new Error("Failed to fetch submissions");
      return response.json();
    },
    enabled: !!user,
  });

  // Filter and sort submissions
  const filteredSubmissions = useMemo(() => {
    if (!data?.submissions) return [];

    let filtered = data.submissions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sub: any) =>
          sub.name?.toLowerCase().includes(query) ||
          sub.instagramUsername?.toLowerCase().includes(query) ||
          sub.invitation?.email?.toLowerCase().includes(query) ||
          sub.location?.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a: any, b: any) => {
      if (sortBy === "date") {
        return (
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      } else {
        return (a.name || "").localeCompare(b.name || "");
      }
    });

    return filtered;
  }, [data?.submissions, searchQuery, sortBy]);

  // Approve submission
  const approveMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const response = await fetch(
        `/api/onboarding-submissions/${submissionId}/approve`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to approve submission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      toast.success("Submission approved! Profile created.");
      setSelectedSubmission(null);
      setShowPreview(false);
    },
    onError: () => {
      toast.error("Failed to approve submission");
    },
  });

  // Reject submission
  const rejectMutation = useMutation({
    mutationFn: async ({
      submissionId,
      reason,
    }: {
      submissionId: string;
      reason: string;
    }) => {
      const response = await fetch(
        `/api/onboarding-submissions/${submissionId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok) throw new Error("Failed to reject submission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      toast.success("Submission rejected");
      setSelectedSubmission(null);
      setShowPreview(false);
      setShowRejectModal(false);
      setRejectReason("");
    },
    onError: () => {
      toast.error("Failed to reject submission");
    },
  });

  const handleApprove = (submissionId: string) => {
    if (
      confirm(
        "Are you sure you want to approve this submission? This will create the model profile.",
      )
    ) {
      approveMutation.mutate(submissionId);
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    rejectMutation.mutate({
      submissionId: selectedSubmission.id,
      reason: rejectReason,
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-off-white dark:from-gray-900 dark:via-gray-900 dark:to-brand-dark-pink/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-brand-dark-pink via-brand-mid-pink to-brand-light-pink bg-clip-text text-transparent">
                Onboarding Review
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base">
                Review and approve model applications
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
              <Users className="w-5 h-5 text-brand-mid-pink" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {data?.stats
                  ? data.stats.pending +
                    data.stats.approved +
                    data.stats.rejected
                  : 0}{" "}
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {data?.stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {/* Pending Card */}
            <div className="group relative bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 dark:from-yellow-500/10 dark:to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                      Pending
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {data.stats.pending}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Awaiting review
                  </p>
                </div>
                {data.stats.pending > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-500/20 rounded-full">
                    <TrendingUp className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                      New
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Approved Card */}
            <div className="group relative bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 dark:from-green-500/10 dark:to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                      Approved
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {data.stats.approved}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Active profiles
                  </p>
                </div>
              </div>
            </div>

            {/* Rejected Card */}
            <div className="group relative bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5 dark:from-red-500/10 dark:to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Rejected
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {data.stats.rejected}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Not approved
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Status Filter Tabs */}
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                Filter by Status
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL", label: "All", icon: FileText },
                    { value: "PENDING", label: "Pending", icon: Clock },
                    { value: "APPROVED", label: "Approved", icon: CheckCircle },
                    { value: "REJECTED", label: "Rejected", icon: XCircle },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedStatus(value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                      selectedStatus === value
                        ? "bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white shadow-lg shadow-brand-light-pink/30 scale-105"
                        : "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Sort */}
            <div className="lg:w-80">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                Search & Sort
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSortBy(sortBy === "date" ? "name" : "date")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">
                    {sortBy === "date" ? "Date" : "Name"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {searchQuery && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found{" "}
                <span className="font-semibold text-brand-mid-pink">
                  {filteredSubmissions.length}
                </span>{" "}
                result{filteredSubmissions.length !== 1 ? "s" : ""} for "
                <span className="font-semibold">{searchQuery}</span>"
              </p>
            </div>
          )}
        </div>

        {/* Submissions List */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Submissions
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredSubmissions.length}{" "}
                {filteredSubmissions.length === 1
                  ? "submission"
                  : "submissions"}
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
            {isLoading ? (
              // Loading Skeletons
              <div className="p-6 space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="flex gap-2">
                          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSubmissions.length > 0 ? (
              filteredSubmissions.map((submission: any) => (
                <div
                  key={submission.id}
                  className="group p-6 hover:bg-gradient-to-r hover:from-brand-light-pink/5 hover:to-brand-blue/5 dark:hover:from-brand-dark-pink/10 dark:hover:to-brand-blue/10 transition-all duration-300"
                >
                  <div className="flex items-start gap-4 sm:gap-6">
                    {/* Profile Image */}
                    <div className="relative flex-shrink-0">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 dark:from-brand-dark-pink/30 dark:to-brand-blue/30 ring-2 ring-white dark:ring-gray-800 shadow-lg">
                        {submission.profileImageUrl ? (
                          <Image
                            src={submission.profileImageUrl}
                            alt={submission.name || "Profile"}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center ${
                          submission.reviewStatus === "PENDING"
                            ? "bg-yellow-500"
                            : submission.reviewStatus === "APPROVED"
                              ? "bg-green-500"
                              : "bg-red-500"
                        }`}
                      >
                        {submission.reviewStatus === "PENDING" ? (
                          <Clock className="w-3 h-3 text-white" />
                        ) : submission.reviewStatus === "APPROVED" ? (
                          <CheckCircle className="w-3 h-3 text-white" />
                        ) : (
                          <XCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Submission Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 truncate">
                            {submission.name || "Unnamed"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {submission.instagramUsername && (
                              <a
                                href={`https://instagram.com/${submission.instagramUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-brand-mid-pink hover:text-brand-light-pink transition-colors"
                              >
                                <Instagram className="w-4 h-4" />
                                <span className="font-medium">
                                  @{submission.instagramUsername}
                                </span>
                              </a>
                            )}
                            {submission.invitation?.email && (
                              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                <Mail className="w-4 h-4" />
                                {submission.invitation.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-full shadow-sm ${
                            submission.reviewStatus === "PENDING"
                              ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white"
                              : submission.reviewStatus === "APPROVED"
                                ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white"
                                : "bg-gradient-to-r from-red-400 to-pink-400 text-white"
                          }`}
                        >
                          {submission.reviewStatus}
                        </span>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4 text-brand-mid-pink" />
                          <span className="truncate">
                            {formatDate(submission.submittedAt)}
                          </span>
                        </div>
                        {submission.location && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4 text-brand-mid-pink" />
                            <span className="truncate">
                              {submission.location}
                            </span>
                          </div>
                        )}
                        {submission.age && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4 text-brand-mid-pink" />
                            <span>{submission.age} years</span>
                          </div>
                        )}
                        {submission.occupation && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Briefcase className="w-4 h-4 text-brand-mid-pink" />
                            <span className="truncate">
                              {submission.occupation}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Types */}
                      {submission.selectedContentTypes &&
                        submission.selectedContentTypes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {submission.selectedContentTypes.map(
                              (type: string) => (
                                <span
                                  key={type}
                                  className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-brand-light-pink/10 to-brand-blue/10 dark:from-brand-light-pink/20 dark:to-brand-blue/20 text-brand-dark-pink dark:text-brand-light-pink rounded-lg border border-brand-light-pink/20 dark:border-brand-light-pink/30"
                                >
                                  {type}
                                </span>
                              ),
                            )}
                          </div>
                        )}

                      {/* Action Buttons */}
                      {submission.reviewStatus === "PENDING" && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowPreview(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-blue to-brand-blue/90 text-white rounded-xl hover:shadow-lg hover:shadow-brand-blue/30 transition-all duration-200 hover:scale-105 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            Review
                          </button>
                          <button
                            onClick={() => handleApprove(submission.id)}
                            disabled={approveMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowRejectModal(true);
                            }}
                            disabled={rejectMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {submission.reviewStatus === "REJECTED" &&
                        submission.rejectionReason && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">
                                  Rejection Reason
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-400">
                                  {submission.rejectionReason}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Empty State
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 dark:from-brand-dark-pink/30 dark:to-brand-blue/30 rounded-2xl mb-4">
                  <FileText className="w-8 h-8 text-brand-mid-pink" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  No submissions found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  {searchQuery
                    ? `No results for "${searchQuery}". Try a different search term.`
                    : selectedStatus === "ALL"
                      ? "No submissions have been received yet."
                      : `No ${selectedStatus.toLowerCase()} submissions found.`}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 px-4 py-2 bg-brand-light-pink text-white rounded-xl hover:bg-brand-mid-pink transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview &&
        selectedSubmission &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-brand-mid-pink/30 animate-in slide-in-from-bottom duration-300">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink px-6 py-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    Submission Preview
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedSubmission(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative group">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 dark:from-brand-dark-pink/30 dark:to-brand-blue/30 ring-4 ring-white dark:ring-gray-700 shadow-2xl">
                      {selectedSubmission.profileImageUrl ? (
                        <Image
                          src={selectedSubmission.profileImageUrl}
                          alt={selectedSubmission.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-2 -right-2 px-3 py-1.5 text-xs font-bold rounded-full shadow-lg ${
                        selectedSubmission.reviewStatus === "PENDING"
                          ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white"
                          : selectedSubmission.reviewStatus === "APPROVED"
                            ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white"
                            : "bg-gradient-to-r from-red-400 to-pink-400 text-white"
                      }`}
                    >
                      {selectedSubmission.reviewStatus}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedSubmission.name}
                    </h3>
                    {selectedSubmission.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                        {selectedSubmission.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      {selectedSubmission.instagramUsername && (
                        <a
                          href={`https://instagram.com/${selectedSubmission.instagramUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-pink-500/30 transition-all font-medium"
                        >
                          <Instagram className="w-4 h-4" />@
                          {selectedSubmission.instagramUsername}
                        </a>
                      )}
                      {selectedSubmission.invitation?.email && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl">
                          <Mail className="w-4 h-4" />
                          {selectedSubmission.invitation.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  {selectedSubmission.age && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-light-pink/10 dark:bg-brand-light-pink/20 rounded-lg">
                          <User className="w-4 h-4 text-brand-mid-pink" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Age
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.age} years
                      </p>
                    </div>
                  )}
                  {selectedSubmission.location && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-lg">
                          <MapPin className="w-4 h-4 text-brand-blue" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Location
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.location}
                      </p>
                    </div>
                  )}
                  {selectedSubmission.nationality && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-lg">
                          <Globe className="w-4 h-4 text-brand-mid-pink" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Nationality
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.nationality}
                      </p>
                    </div>
                  )}
                  {selectedSubmission.ethnicity && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-light-pink/10 dark:bg-brand-light-pink/20 rounded-lg">
                          <Users className="w-4 h-4 text-brand-light-pink" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Ethnicity
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.ethnicity}
                      </p>
                    </div>
                  )}
                  {selectedSubmission.occupation && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-lg">
                          <Briefcase className="w-4 h-4 text-brand-blue" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Occupation
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.occupation}
                      </p>
                    </div>
                  )}
                  {selectedSubmission.relationshipStatus && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-lg">
                          <User className="w-4 h-4 text-brand-mid-pink" />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Relationship Status
                        </h4>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.relationshipStatus}
                      </p>
                    </div>
                  )}
                </div>

                {/* Backstory */}
                {selectedSubmission.backstory && (
                  <div className="mb-8 p-6 bg-gradient-to-br from-brand-light-pink/5 to-brand-blue/5 dark:from-brand-dark-pink/10 dark:to-brand-blue/10 rounded-2xl border border-brand-light-pink/20 dark:border-brand-light-pink/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-lg">
                        <FileText className="w-5 h-5 text-brand-mid-pink" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Backstory
                      </h4>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.backstory}
                    </p>
                  </div>
                )}

                {/* Content Types */}
                {selectedSubmission.selectedContentTypes &&
                  selectedSubmission.selectedContentTypes.length > 0 && (
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
                        Content Types
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSubmission.selectedContentTypes.map(
                          (type: string) => (
                            <span
                              key={type}
                              className="px-4 py-2 bg-gradient-to-r from-brand-light-pink/10 to-brand-blue/10 dark:from-brand-light-pink/20 dark:to-brand-blue/20 text-brand-dark-pink dark:text-brand-light-pink rounded-xl border border-brand-light-pink/20 dark:border-brand-light-pink/30 font-medium"
                            >
                              {type}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>

              {/* Action Footer */}
              <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleApprove(selectedSubmission.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    {approveMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Approve & Create Profile
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={rejectMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Submission
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Reject Modal */}
      {showRejectModal &&
        selectedSubmission &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full shadow-2xl border border-red-200 dark:border-red-800/50 overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Reject Submission
                  </h2>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Please provide a clear reason for rejecting{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedSubmission.name}
                  </span>
                  's submission. This will be sent to the applicant.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={5}
                  placeholder="e.g., Profile images do not meet quality standards, incomplete information, etc."
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason("");
                    }}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold"
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Confirm Rejection"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
