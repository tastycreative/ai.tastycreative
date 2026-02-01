'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  DollarSign,
  Instagram,
  Twitter,
  Globe,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfModel {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
  profileImageUrl: string | null;
  bio: string | null;
  personalityType: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  launchDate: string | null;
  guaranteedAmount?: number | null;
  percentageTaken?: number | null;
  chattingManagers?: string[];
  createdAt: string;
  updatedAt: string;
}

type SortField = 'displayName' | 'status' | 'launchDate' | 'guaranteedAmount' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface OfModelsTableProps {
  models: OfModel[];
  onEdit: (model: OfModel) => void;
  onDelete: (model: OfModel) => void;
  onModelClick: (model: OfModel) => void;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  INACTIVE: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
  },
  PENDING: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  ARCHIVED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
};

const personalityConfig: Record<string, { bg: string; text: string }> = {
  expressive: { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  outgoing: { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  analytical: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  logical: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  driver: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  ambitious: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  amiable: { bg: 'bg-green-500/10', text: 'text-green-400' },
  friendly: { bg: 'bg-green-500/10', text: 'text-green-400' },
  creative: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  artistic: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

function getPersonalityConfig(type: string | null): { bg: string; text: string } {
  if (!type) return { bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
  const typeLower = type.toLowerCase().trim();
  for (const [key, config] of Object.entries(personalityConfig)) {
    if (typeLower.includes(key)) return config;
  }
  return { bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
}

function getDisplayImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes('drive.google.com')) {
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w100`;
    }
  }
  return url;
}

function getSocialUrl(value: string | null, platform: 'instagram' | 'twitter' | 'tiktok'): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'twitter': return `https://twitter.com/${handle}`;
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    default: return trimmed;
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || amount === 0) return '$0';
  return `$${amount.toLocaleString()}`;
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortableHeader({ label, field, currentSort, direction, onSort }: SortableHeaderProps) {
  const isActive = currentSort === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1.5 text-left font-semibold text-xs uppercase tracking-wider transition-colors',
        isActive ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
      )}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
      )}
    </button>
  );
}

export function OfModelsTable({ models, onEdit, onDelete, onModelClick }: OfModelsTableProps) {
  const [sortField, setSortField] = useState<SortField>('displayName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'displayName':
        comparison = a.displayName.localeCompare(b.displayName);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'launchDate':
        const dateA = a.launchDate ? new Date(a.launchDate).getTime() : 0;
        const dateB = b.launchDate ? new Date(b.launchDate).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'guaranteedAmount':
        comparison = (a.guaranteedAmount || 0) - (b.guaranteedAmount || 0);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-500">No models to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800/50 bg-zinc-900/80">
              <th className="text-left py-4 px-5">
                <SortableHeader
                  label="Model"
                  field="displayName"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="text-left py-4 px-5">
                <SortableHeader
                  label="Status"
                  field="status"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="text-left py-4 px-5">
                <span className="font-semibold text-xs uppercase tracking-wider text-zinc-500">
                  Personality
                </span>
              </th>
              <th className="text-left py-4 px-5">
                <SortableHeader
                  label="Launch Date"
                  field="launchDate"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="text-left py-4 px-5">
                <SortableHeader
                  label="Guaranteed"
                  field="guaranteedAmount"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="text-left py-4 px-5">
                <span className="font-semibold text-xs uppercase tracking-wider text-zinc-500">
                  Social
                </span>
              </th>
              <th className="text-left py-4 px-5">
                <span className="font-semibold text-xs uppercase tracking-wider text-zinc-500">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((model) => {
              const imageUrl = getDisplayImageUrl(model.profileImageUrl);
              const statusStyle = statusConfig[model.status] || statusConfig.INACTIVE;
              const personalityStyle = getPersonalityConfig(model.personalityType);

              return (
                <tr
                  key={model.id}
                  className="border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors duration-150"
                >
                  {/* Model Info */}
                  <td className="py-4 px-5">
                    <Link
                      href={`of-models/${model.slug}`}
                      onClick={() => onModelClick(model)}
                      className="flex items-center gap-3 group"
                    >
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
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
                        <div className={cn(
                          'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30',
                          imageUrl ? 'hidden' : ''
                        )}>
                          <span className="text-sm font-medium text-white/80">
                            {model.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white group-hover:text-violet-300 transition-colors truncate">
                          {model.displayName}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">@{model.slug}</div>
                      </div>
                    </Link>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-5">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      statusStyle.bg
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
                      <span className={statusStyle.text}>
                        {model.status.charAt(0) + model.status.slice(1).toLowerCase()}
                      </span>
                    </span>
                  </td>

                  {/* Personality */}
                  <td className="py-4 px-5">
                    {model.personalityType ? (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        personalityStyle.bg, personalityStyle.text
                      )}>
                        <Sparkles className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{model.personalityType}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Launch Date */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm">
                        {model.launchDate
                          ? new Date(model.launchDate).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </td>

                  {/* Guaranteed */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium text-white">
                        {formatCurrency(model.guaranteedAmount)}
                      </span>
                    </div>
                  </td>

                  {/* Social */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-1">
                      {model.instagramUrl && (
                        <a
                          href={getSocialUrl(model.instagramUrl, 'instagram')!}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-pink-400/70 hover:text-pink-400 hover:bg-pink-500/10 transition-all"
                        >
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                      {model.twitterUrl && (
                        <a
                          href={getSocialUrl(model.twitterUrl, 'twitter')!}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-sky-400/70 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                        >
                          <Twitter className="w-4 h-4" />
                        </a>
                      )}
                      {model.websiteUrl && (
                        <a
                          href={model.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-zinc-400/70 hover:text-zinc-300 hover:bg-zinc-500/10 transition-all"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                      {!model.instagramUrl && !model.twitterUrl && !model.websiteUrl && (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`of-models/${model.slug}`}
                        onClick={() => onModelClick(model)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-all"
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => onEdit(model)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(model)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OfModelsTable;
