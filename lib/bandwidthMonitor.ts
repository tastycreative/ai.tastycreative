interface BandwidthMetrics {
  endpoint: string;
  requestSize: number;
  responseSize: number;
  compressionRatio?: number;
  timestamp: Date;
  userId?: string;
}

class BandwidthMonitor {
  private static instance: BandwidthMonitor;
  private metrics: BandwidthMetrics[] = [];

  private constructor() {}

  static getInstance(): BandwidthMonitor {
    if (!BandwidthMonitor.instance) {
      BandwidthMonitor.instance = new BandwidthMonitor();
    }
    return BandwidthMonitor.instance;
  }

  trackRequest(
    endpoint: string,
    requestSize: number,
    responseSize: number,
    options: { compressionRatio?: number; userId?: string } = {}
  ): void {
    const metric: BandwidthMetrics = {
      endpoint,
      requestSize,
      responseSize,
      compressionRatio: options.compressionRatio,
      timestamp: new Date(),
      userId: options.userId
    };

    this.metrics.push(metric);

    // Keep only last 1000 entries to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Log the metrics
    console.log(`📊 Bandwidth: ${endpoint}`, {
      request: this.formatBytes(requestSize),
      response: this.formatBytes(responseSize),
      compression: options.compressionRatio ? `${options.compressionRatio}%` : 'N/A',
      total: this.formatBytes(requestSize + responseSize)
    });
  }

  getHourlyStats(): {
    totalRequests: number;
    totalBandwidth: number;
    avgRequestSize: number;
    avgResponseSize: number;
    topEndpoints: Array<{ endpoint: string; bandwidth: number; requests: number }>;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    const totalRequests = recentMetrics.length;
    const totalBandwidth = recentMetrics.reduce((sum, m) => sum + m.requestSize + m.responseSize, 0);
    const avgRequestSize = totalRequests > 0 ? totalBandwidth / totalRequests : 0;
    const avgResponseSize = totalRequests > 0 ? 
      recentMetrics.reduce((sum, m) => sum + m.responseSize, 0) / totalRequests : 0;

    // Group by endpoint
    const endpointStats = new Map<string, { bandwidth: number; requests: number }>();
    recentMetrics.forEach(m => {
      const current = endpointStats.get(m.endpoint) || { bandwidth: 0, requests: 0 };
      current.bandwidth += m.requestSize + m.responseSize;
      current.requests += 1;
      endpointStats.set(m.endpoint, current);
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.bandwidth - a.bandwidth)
      .slice(0, 10);

    return {
      totalRequests,
      totalBandwidth,
      avgRequestSize,
      avgResponseSize,
      topEndpoints
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  logHourlyReport(): void {
    const stats = this.getHourlyStats();
    
    console.log('📈 HOURLY BANDWIDTH REPORT');
    console.log('==========================');
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Total Bandwidth: ${this.formatBytes(stats.totalBandwidth)}`);
    console.log(`Avg Request Size: ${this.formatBytes(stats.avgRequestSize)}`);
    console.log(`Avg Response Size: ${this.formatBytes(stats.avgResponseSize)}`);
    console.log('\nTop Endpoints by Bandwidth:');
    stats.topEndpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.endpoint}: ${this.formatBytes(endpoint.bandwidth)} (${endpoint.requests} requests)`);
    });
    console.log('==========================\n');
  }
}

export const bandwidthMonitor = BandwidthMonitor.getInstance();

// Helper function to track API endpoint usage
export function trackApiUsage(
  endpoint: string,
  requestBody: any,
  responseBody: any,
  options: { userId?: string; compressionRatio?: number } = {}
): void {
  try {
    const requestSize = JSON.stringify(requestBody || {}).length;
    const responseSize = JSON.stringify(responseBody || {}).length;
    
    bandwidthMonitor.trackRequest(endpoint, requestSize, responseSize, options);
  } catch (error) {
    console.warn('⚠️ Failed to track bandwidth usage:', error);
  }
}

// Auto-report every hour
if (typeof global !== 'undefined') {
  setInterval(() => {
    bandwidthMonitor.logHourlyReport();
  }, 60 * 60 * 1000); // Every hour
}