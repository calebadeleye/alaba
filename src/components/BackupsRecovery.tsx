/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Database, 
  Cloud, 
  HardDrive, 
  History, 
  Download, 
  RotateCcw, 
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Play,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { type BackupSnapshot } from '../types';
import { AccountService } from '../services/api';

const MOCK_SNAPSHOTS: BackupSnapshot[] = [
  { id: '1', date: '2024-03-24 03:00 AM', type: 'Incremental', size: '1.2 GB', status: 'Healthy' },
  { id: '2', date: '2024-03-23 03:00 AM', type: 'Incremental', size: '1.1 GB', status: 'Healthy' },
  { id: '3', date: '2024-03-22 03:00 AM', type: 'Incremental', size: '1.3 GB', status: 'Warning' },
  { id: '4', date: '2024-03-21 00:00 AM', type: 'Full', size: '42.5 GB', status: 'Healthy' },
  { id: '5', date: '2024-03-20 03:00 AM', type: 'Incremental', size: '1.4 GB', status: 'Healthy' },
];

export const BackupsRecovery: React.FC = () => {
  const [snapshots, setSnapshots] = React.useState<BackupSnapshot[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchBackups() {
      try {
        const data = await AccountService.getBackupSnapshots();
        setSnapshots(data);
      } catch (err) {
        console.error('Failed to fetch backups');
      } finally {
        setLoading(false);
      }
    }
    fetchBackups();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Backups & Recovery</h1>
          <p className="text-on-surface-variant">Scheduled snapshots, off-site storage, and disaster recovery.</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
          <Play size={20} />
          <span>Manual Snapshot</span>
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant transition-all hover:bg-surface-variant/5 hover:border-secondary/30">
              <div className="p-3 bg-secondary-container w-fit rounded-xl mb-4 text-secondary">
                <Database size={24} />
              </div>
              <h3 className="font-bold text-lg mb-1 text-on-surface">Local Storage</h3>
              <p className="text-xs text-on-surface-variant mb-6">Internal server backup drive</p>
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium text-on-surface-variant">
                  <span>Usage</span>
                  <span>420GB / 1TB</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-[42%]" />
                </div>
              </div>
            </div>

            <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant transition-all hover:bg-surface-variant/5 hover:border-primary/30">
              <div className="p-3 bg-primary-container w-fit rounded-xl mb-4 text-primary">
                <Cloud size={24} />
              </div>
              <h3 className="font-bold text-lg mb-1 text-on-surface">Hosting Mirror</h3>
              <p className="text-xs text-on-surface-variant mb-6">AWS S3 - Connected</p>
              <div className="flex items-center gap-2 text-green-500">
                <ShieldCheck size={18} />
                <span className="text-sm font-bold">Updated</span>
              </div>
            </div>

            <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant transition-all hover:bg-surface-variant/5 hover:border-error/30">
              <div className="p-3 bg-error-container/10 w-fit rounded-xl mb-4 text-error">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-bold text-lg mb-1 text-on-surface">Safety Checks</h3>
              <p className="text-xs text-on-surface-variant mb-6">Integrity & validation</p>
              <p className="text-sm font-medium text-on-surface">System Readiness: Clean</p>
            </div>
          </div>

          <div className="bg-surface-container rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="text-primary" size={20} />
                <h2 className="text-xl font-bold text-on-surface">Recent Snapshots</h2>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-surface rounded-lg transition-colors text-on-surface-variant"><Download size={18} /></button>
                <button className="p-2 hover:bg-surface rounded-lg transition-colors text-on-surface-variant"><Calendar size={18} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Snapshot Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Domain</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Size</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    <th className="px-6 py-4 text-right px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {snapshots.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant italic">No snapshots available in database.</td>
                    </tr>
                  ) : (
                    snapshots.map((snap) => (
                      <tr key={snap.id} className="hover:bg-primary-container/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-on-surface">{snap.date}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant italic font-medium">
                          {(snap as any).domain || 'System-wide'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide",
                            snap.type === 'Full' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          )}>
                            {snap.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">
                          {snap.size}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              snap.status === 'Healthy' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                            )} />
                            <span className={cn(
                              "text-xs font-bold",
                              snap.status === 'Healthy' ? "text-green-600" : "text-amber-600"
                            )}>
                              {snap.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-outline-variant bg-surface-container hover:bg-primary hover:text-white hover:border-primary transition-all text-xs font-bold text-on-surface ml-auto shadow-sm">
                            <RotateCcw size={14} />
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
