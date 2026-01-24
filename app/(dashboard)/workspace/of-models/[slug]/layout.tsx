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
} from 'lucide-react';

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

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ARCHIVED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function OfModelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/of-models/${slug}`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
      }
    } catch (error) {
      console.error('Error loading model:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      name: 'Overview',
      href: `/workspace/of-models/${slug}`,
      icon: User,
      exact: true,
    },
    {
      name: 'Pricing',
      href: `/workspace/of-models/${slug}/pricing`,
      icon: DollarSign,
    },
    {
      name: 'Assets',
      href: `/workspace/of-models/${slug}/assets`,
      icon: Image,
    },
    {
      name: 'Details',
      href: `/workspace/of-models/${slug}/details`,
      icon: FileText,
    },
  ];

  const isActive = (tab: { href: string; exact?: boolean }) => {
    if (tab.exact) {
      return pathname === tab.href;
    }
    return pathname.startsWith(tab.href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Back Button Skeleton */}
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6"></div>

          {/* Header Skeleton */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2"></div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4"></div>
                <div className="h-5 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-2 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/workspace/of-models"
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to OF Models
          </Link>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Model Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The OF model you're looking for doesn't exist or has been removed.
            </p>
            <Link
              href="/workspace/of-models"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              View All Models
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link
          href="/workspace/of-models"
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to OF Models
        </Link>

        {/* Model Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Profile Image */}
            {model.profileImageUrl ? (
              <img
                src={model.profileImageUrl}
                alt={model.displayName}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-semibold">
                {model.displayName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Model Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {model.displayName}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[model.status]}`}>
                  {model.status}
                </span>
              </div>

              <p className="text-gray-500 dark:text-gray-400 mb-3">
                @{model.slug}
              </p>

              {model.bio && (
                <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-2xl">
                  {model.bio}
                </p>
              )}

              {/* Social Links */}
              <div className="flex flex-wrap items-center gap-3">
                {model.instagramUrl && (
                  <a
                    href={model.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300"
                  >
                    <Instagram className="w-4 h-4" />
                    Instagram
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {model.twitterUrl && (
                  <a
                    href={model.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Twitter className="w-4 h-4" />
                    Twitter
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {model.websiteUrl && (
                  <a
                    href={model.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {model.profileLinkUrl && (
                  <a
                    href={model.profileLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Profile Link
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
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
