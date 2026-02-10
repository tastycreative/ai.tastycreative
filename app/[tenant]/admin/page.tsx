import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import { LayoutDashboard, Activity, TrendingUp, Server } from 'lucide-react';

export default async function AdminOverviewPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-gradient-to-br from-brand-blue to-brand-mid-pink rounded-xl shadow-lg shadow-brand-blue/25">
          <LayoutDashboard className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground">System health and key metrics at a glance</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-6 border border-border hover:border-brand-mid-pink/50 transition-colors">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
              <Server className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">System Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Platform Status</span>
              <span className="text-sm font-medium text-green-500">Operational</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Server Uptime</span>
              <span className="text-sm font-medium text-foreground">99.9%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">API Response Time</span>
              <span className="text-sm font-medium text-foreground">127ms</span>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border hover:border-brand-mid-pink/50 transition-colors">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-brand-blue to-brand-mid-pink rounded-lg shadow-lg shadow-brand-blue/25">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Quick Stats</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Users Today</span>
              <span className="text-sm font-medium text-brand-blue">+24</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Sessions</span>
              <span className="text-sm font-medium text-purple-500">1,234</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Content Generated Today</span>
              <span className="text-sm font-medium text-emerald-500">5,678</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl p-6 border border-border hover:border-brand-mid-pink/50 transition-colors">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
        </div>
        <p className="text-sm text-muted-foreground">Monitor system-wide activities and events in real-time.</p>
      </div>
    </div>
  );
}
