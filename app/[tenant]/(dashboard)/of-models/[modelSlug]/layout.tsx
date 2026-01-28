'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  DollarSign,
  Image,
  FileText,
  ChevronLeft,
  Instagram,
  Twitter,
  Globe,
  ExternalLink,
  Crown,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { useOfModelStore } from '@/stores/of-model-store';

interface OfModel {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
  profileImageUrl: string | null;
  bio: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  profileLinkUrl: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/20'
  },
  INACTIVE: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
    border: 'border-zinc-500/20'
  },
  PENDING: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    border: 'border-amber-500/20'
  },
  ARCHIVED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    border: 'border-rose-500/20'
  },
};

function getDisplayImageUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.includes('drive.google.com')) {
    try {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      let driveId: string | null = null;

      if (fileMatch && fileMatch[1]) {
        driveId = fileMatch[1];
      } else {
        const urlObj = new URL(url);
        driveId = urlObj.searchParams.get('id');
      }

      if (driveId) {
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
      }
    } catch {
      // Fall through
    }
  }

  return url;
}

function getSocialUrl(value: string | null, platform: 'instagram' | 'twitter' | 'tiktok'): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    default:
      return trimmed;
  }
}

export default function OfModelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const modelSlug = params.modelSlug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [loading, setLoading] = useState(true);

  const storeModel = useOfModelStore((state) => state.selectedModel);

  useEffect(() => {
    if (modelSlug) {
      loadModel();
    }
  }, [modelSlug]);

  const loadModel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/of-models/${modelSlug}`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error loading model:', response.status, error);
        if (storeModel && storeModel.slug === modelSlug) {
          setModel(storeModel as OfModel);
        }
      }
    } catch (error) {
      console.error('Error loading model:', error);
      if (storeModel && storeModel.slug === modelSlug) {
        setModel(storeModel as OfModel);
      }
    } finally {
      setLoading(false);
    }
  };

  // Build base path from current pathname (strips any sub-route like /pricing, /assets, /details)
  const basePath = pathname.replace(/\/(pricing|assets|details)$/, '');

  const tabs = [
    { name: 'Overview', href: basePath, icon: User, exact: true },
    { name: 'Pricing', href: `${basePath}/pricing`, icon: DollarSign },
    { name: 'Assets', href: `${basePath}/assets`, icon: Image },
    { name: 'Details', href: `${basePath}/details`, icon: FileText },
  ];

  const isActive = (tab: { href: string; exact?: boolean }) => {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button Skeleton */}
          <div className="h-5 w-40 bg-zinc-800/50 rounded-lg animate-pulse mb-8" />

          {/* Header Skeleton */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8 mb-6">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-32 h-32 bg-zinc-800/50 rounded-2xl animate-pulse" />
              <div className="flex-1 space-y-4">
                <div className="h-10 w-64 bg-zinc-800/50 rounded-lg animate-pulse" />
                <div className="h-5 w-32 bg-zinc-800/50 rounded-lg animate-pulse" />
                <div className="h-6 w-96 bg-zinc-800/50 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-2 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 w-32 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8">
            <div className="h-64 bg-zinc-800/30 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-[#0a0a0b]">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="../"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Models
          </Link>

          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 mb-6">
              <User className="w-16 h-16 text-zinc-700" />
            </div>
            <h2 className="text-2xl font-medium text-white mb-3">Model Not Found</h2>
            <p className="text-zinc-500 mb-8 max-w-md">
              The model you're looking for doesn't exist or has been removed.
            </p>
            <Link
              href="../"
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Crown className="relative w-5 h-5" />
              <span className="relative">View All Models</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const config = statusConfig[model.status] || statusConfig.INACTIVE;
  const imageUrl = getDisplayImageUrl(model.profileImageUrl);

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="../"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Models
        </Link>

        {/* Profile Header */}
        <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden mb-6">
          {/* Header Gradient Accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              {/* Profile Image */}
              <div className="relative shrink-0">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-zinc-800/50 ring-2 ring-zinc-700/50 ring-offset-2 ring-offset-[#0a0a0b]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={model.displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 ${imageUrl ? 'hidden' : ''}`}>
                    <span className="text-5xl font-light text-white/80">
                      {model.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Status Badge - Floating */}
                <div className={`absolute -bottom-2 -right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg} border ${config.border} backdrop-blur-sm`}>
                  <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
                    {model.status}
                  </span>
                </div>
              </div>

              {/* Model Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-2">
                      {model.displayName}
                    </h1>
                    <p className="text-zinc-500 text-lg mb-4">@{model.slug}</p>
                  </div>
                </div>

                {model.bio && (
                  <p className="text-zinc-400 max-w-2xl mb-5 leading-relaxed">
                    {model.bio}
                  </p>
                )}

                {/* Social Links */}
                <div className="flex flex-wrap items-center gap-2">
                  {model.instagramUrl && (
                    <a
                      href={getSocialUrl(model.instagramUrl, 'instagram')!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/30 transition-all group"
                    >
                      <Instagram className="w-4 h-4" />
                      <span className="text-sm font-medium">Instagram</span>
                      <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                  {model.twitterUrl && (
                    <a
                      href={getSocialUrl(model.twitterUrl, 'twitter')!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 transition-all group"
                    >
                      <Twitter className="w-4 h-4" />
                      <span className="text-sm font-medium">Twitter</span>
                      <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                  {model.websiteUrl && (
                    <a
                      href={model.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50 hover:border-zinc-600/50 transition-all group"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="text-sm font-medium">Website</span>
                      <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                  {model.profileLinkUrl && (
                    <a
                      href={model.profileLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all group"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-sm font-medium">Profile</span>
                      <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  active
                    ? 'text-white'
                    : 'bg-zinc-900/50 border border-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/50'
                }`}
              >
                {active && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                  </>
                )}
                <Icon className={`relative w-4 h-4 ${active ? 'text-white' : ''}`} />
                <span className="relative">{tab.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Tab Content */}
        {children}
      </div>
    </div>
  );
}
