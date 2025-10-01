/**
 * Bandwidth monitoring component to show optimization statistics
 */
"use client";

import { useState, useEffect } from 'react';
import { getBandwidthStats } from '@/lib/directUrlUtils';
import { BarChart3, TrendingDown, Wifi, HardDrive } from 'lucide-react';

interface BandwidthStatsProps {
  mediaList: Array<{
    awsS3Key?: string | null;
    awsS3Url?: string | null;
    s3Key?: string | null;
    networkVolumePath?: string | null;
    dataUrl?: string | null;
    url?: string | null;
    id: string;
    filename: string;
    type?: string;
  }>;
  className?: string;
}

export function BandwidthStats({ mediaList, className = '' }: BandwidthStatsProps) {
  const [stats, setStats] = useState<{
    directAccess: number;
    requiresProxy: number;
    percentDirect: number;
  } | null>(null);

  useEffect(() => {
    if (mediaList.length > 0) {
      const newStats = getBandwidthStats(mediaList);
      setStats(newStats);
    }
  }, [mediaList]);

  if (!stats || mediaList.length === 0) {
    return null;
  }

  const bandwidthSavedPercent = stats.percentDirect;
  const proxyPercent = 100 - bandwidthSavedPercent;

  return (
    <div className={`bg-white rounded-lg border p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Bandwidth Optimization</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {bandwidthSavedPercent.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-600">Direct Access</p>
          <p className="text-xs text-gray-500">{stats.directAccess} files</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wifi className="w-4 h-4 text-orange-600" />
            <span className="text-2xl font-bold text-orange-600">
              {proxyPercent.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-600">Via Proxy</p>
          <p className="text-xs text-gray-500">{stats.requiresProxy} files</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div 
          className="bg-green-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${bandwidthSavedPercent}%` }}
        />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-600" />
          <span className="text-gray-700">
            <strong>Direct AWS S3:</strong> Zero server bandwidth usage
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-600" />
          <span className="text-gray-700">
            <strong>Legacy Proxy:</strong> Uses server bandwidth
          </span>
        </div>
      </div>

      {proxyPercent > 50 && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
          <div className="flex items-start gap-2">
            <HardDrive className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-orange-800 font-medium">Optimization Opportunity</p>
              <p className="text-orange-700">
                {stats.requiresProxy} files still use legacy storage. 
                New uploads automatically use direct AWS S3 access.
              </p>
            </div>
          </div>
        </div>
      )}

      {bandwidthSavedPercent > 80 && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
          <div className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-800 font-medium">Excellent Optimization</p>
              <p className="text-green-700">
                Most of your content uses direct S3 access, minimizing server costs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BandwidthStats;