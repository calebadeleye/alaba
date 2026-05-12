/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Globe, 
  HardDrive, 
  Shield, 
  Mail, 
  Settings, 
  Activity,
  MoreHorizontal,
  ExternalLink,
  ChevronRight,
  Database,
  Terminal,
  Zap,
  ShieldCheck,
  Package,
  RefreshCw,
  Cpu,
  BarChart3,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { type Account } from '../types';
import { AccountService } from '../services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const AccountDetails: React.FC<{ accountId: string; onBack: () => void }> = ({ accountId, onBack }) => {
  const [account, setAccount] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDetails = async () => {
    try {
      // Fetch account first to avoid blocking on history results
      const accData = await AccountService.getAccount(accountId);
      setAccount(accData);
      
      // Separate history fetch
      try {
        const histData = await AccountService.getAccountHistory(accountId);
        if (histData) setHistory(histData);
      } catch (hErr) {
        console.warn('Metrics history not yet available for this cluster node.');
      }
    } catch (err) {
      console.error('Failed to resolve account context:', err);
      // Optional: don't toast every 10s if it stays failing, just show error in UI
      if (!account) toast.error('Failed to load real-time metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(fetchDetails, 10000); // Near real-time polling
    return () => clearInterval(interval);
  }, [accountId]);

  if (loading && !account) return <div className="p-8 flex items-center justify-center h-[50vh]"><RefreshCw className="animate-spin text-primary" /></div>;
  if (!account) return <div className="p-8 text-center text-on-surface-variant font-bold lowercase">Connection timeout. Service not responding.</div>;

  const diskPercent = account.diskLimit > 0 ? (account.diskUsage / account.diskLimit) * 100 : 0;
  const bwPercent = account.bwLimit > 0 ? (account.bwUsage / account.bwLimit) * 100 : 0;
  const ramPercent = account.ramLimit > 0 ? (account.ramUsage / account.ramLimit) * 100 : 0;
  const cpuPercent = account.cpuLimit > 0 ? (account.cpuUsage / account.cpuLimit) * 100 : 0;

  // Format data for charts
  const cpuData = history?.cpu.map((val: number, i: number) => ({ time: i, value: val })) || [];
  const ramData = history?.ram.map((val: number, i: number) => ({ time: i, value: val })) || [];
  const bwData = history?.bw.map((val: number, i: number) => ({ time: i, value: val })) || [];
  const diskData = history?.disk.map((val: number, i: number) => ({ time: i, value: val })) || [];

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      <nav className="flex items-center gap-2 text-on-surface-variant mb-4 lowercase">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-primary transition-colors font-bold text-[10px] uppercase tracking-widest">
          <ArrowLeft size={16} />
          <span>Subscriptions</span>
        </button>
        <ChevronRight size={14} />
        <span className="text-on-surface font-black text-[10px] uppercase tracking-widest">{account.domain}</span>
      </nav>

      {account.status === 'suspended' && (
        <div className="bg-error/10 border border-error/20 p-6 rounded-3xl flex items-center gap-6">
           <div className="w-12 h-12 rounded-2xl bg-error/20 flex items-center justify-center text-error">
              <AlertTriangle size={24} />
           </div>
           <div>
              <h3 className="text-lg font-black text-error tracking-tight">Hosting Access Restricted</h3>
              <p className="text-sm font-medium text-error/80">This account has exceeded its resource quota (Disk or Bandwidth). Please upgrade your plan or optimization your assets.</p>
           </div>
        </div>
      )}

      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-on-primary text-3xl font-display font-black shadow-2xl shadow-primary/40 relative">
            {account.domain.charAt(0).toUpperCase()}
            {account.status === 'active' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-surface rounded-full" />}
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-display font-black tracking-tighter text-on-surface lowercase">{account.domain}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                <Globe size={14} className="text-primary" />
                {account.ip || 'Provisioning...'}
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                account.status === 'active' ? "bg-green-500/10 text-green-600" : "bg-error/10 text-error"
              )}>{account.status}</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-40">Hosting Instance: alaba-cluster-v3</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => navigate(`/accounts/account/${accountId}/cpanel-dashboard`)}
            className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-[10px] font-black uppercase tracking-widest hover:bg-surface transition-all flex items-center justify-center gap-2 group"
          >
            <ExternalLink size={18} className="group-hover:scale-110 transition-transform" />
            Control Center
          </button>
          <button className="flex-1 md:flex-none bg-primary text-on-primary px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 group">
            <Settings size={20} className="group-hover:rotate-45 transition-transform" />
            <span>Power Cycle</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-20">
        <div className="xl:col-span-2 space-y-8">
          {/* Main Resource Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-high/30 p-8 rounded-[3rem] shadow-sm border border-outline-variant/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl">
                    <Cpu size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">CPU Processor Activity</p>
                    <h3 className="text-2xl font-black text-on-surface tracking-tighter">{account.cpuUsage?.toFixed(1)}% <span className="text-xs opacity-30 font-medium tracking-normal">/ {account.cpuLimit}% Available</span></h3>
                  </div>
                </div>
              </div>
              <div className="h-20 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cpuData}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCpu)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-surface-container-high/30 p-8 rounded-[3rem] shadow-sm border border-outline-variant/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-secondary/10 text-secondary rounded-2xl">
                    <Activity size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Memory (RAM) Payload</p>
                    <h3 className="text-2xl font-black text-on-surface tracking-tighter">{(account.ramUsage / 1024).toFixed(1)}GB <span className="text-xs opacity-30 font-medium tracking-normal">/ {(account.ramLimit / 1024).toFixed(0)}GB Allocation</span></h3>
                  </div>
                </div>
              </div>
              <div className="h-20 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ramData}>
                    <defs>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,1,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-surface-container-high/30 p-8 rounded-[3rem] shadow-sm border border-outline-variant/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-primary text-on-primary rounded-2xl shadow-xl shadow-primary/20">
                    <HardDrive size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Storage Allocation</p>
                    <h3 className="text-2xl font-black text-on-surface tracking-tighter">{account.diskUsage?.toLocaleString()}MB <span className="text-xs opacity-30 font-medium tracking-normal">/ {account.diskLimit?.toLocaleString()}MB</span></h3>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("text-xs font-black tracking-widest", diskPercent > 80 ? "text-error" : "text-primary")}>{diskPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-20 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={diskData}>
                    <defs>
                      <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorDisk)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-40 mt-4">High-performance NVMe Partition: /dev/alaba-hosting-01</p>
            </div>
            
            <div className="bg-surface-container-high/30 p-8 rounded-[3rem] shadow-sm border border-outline-variant/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-secondary text-on-secondary rounded-2xl shadow-xl shadow-secondary/20">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Near-Realtime Bandwidth</p>
                    <h3 className="text-2xl font-black text-on-surface tracking-tighter">{account.bwUsage?.toLocaleString()}MB <span className="text-xs opacity-30 font-medium tracking-normal">/ {account.bwLimit?.toLocaleString()}MB</span></h3>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black tracking-widest text-secondary">{bwPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-20 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bwData}>
                    <defs>
                      <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,1,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--secondary)" fillOpacity={1} fill="url(#colorBw)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-surface p-10 rounded-[3rem] shadow-sm border border-outline-variant/30 group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">SQL Database Cluster</h3>
                  <p className="text-xl font-black">{account.dbCount || 0} Entities Active</p>
                </div>
              </div>
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={cn(
                    "h-3 rounded-full transition-all duration-700",
                    i < (account.dbCount || 0) ? "bg-primary shadow-sm shadow-primary/40" : "bg-outline-variant/20"
                  )} />
                ))}
              </div>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mt-6 opacity-40">Managed Percona/MariaDB High-Availability Instance</p>
            </div>

            <div className="bg-surface p-10 rounded-[3rem] shadow-sm border border-outline-variant/30 group hover:border-secondary/30 transition-all">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-secondary/10 rounded-2xl text-secondary group-hover:scale-110 transition-transform">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Mail Exchange Nodes</h3>
                  <p className="text-xl font-black">{account.emailCount || 0} Registered SMTP</p>
                </div>
              </div>
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed opacity-70 italic lowercase">
                Dedicated Dovecot/Exim routing active for {account.domain}. All outbound traffic filtered via Alaba-Shield v2.
              </p>
              <div className="mt-8 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Secure Mail Relay Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-high/30 p-10 rounded-[3.5rem] border border-outline-variant/30 shadow-sm space-y-8">
             <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">Cluster Meta</h3>
               <Activity size={16} className="text-primary animate-pulse" />
             </div>
             <div className="space-y-6">
               {[
                 { label: 'Hosting Plan', value: account.package, icon: Package },
                 { label: 'PHP Version', value: '8.2 (Alaba Optimized)', icon: Terminal },
                 { label: 'Server Type', value: 'LiteSpeed Enterprise', icon: Zap },
                 { label: 'Security Firewall', value: 'Imunify360 + WAF', icon: ShieldCheck },
               ].map((item) => (
                 <div key={item.label} className="flex items-center gap-5 group">
                    <div className="w-12 h-12 rounded-2xl bg-surface border border-outline-variant/30 flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary group-hover:shadow-xl group-hover:shadow-primary/20 transition-all">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40 leading-none mb-1.5">{item.label}</p>
                      <p className="text-xs font-black text-on-surface tracking-widest">{item.value}</p>
                    </div>
                 </div>
               ))}
             </div>
             <div className="h-px bg-outline-variant/30" />
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Primary IP</span>
                  <span className="text-[11px] font-mono font-bold text-on-surface tracking-tighter">{account.ip || 'Pending...'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Nameserver 1</span>
                  <span className="text-[11px] font-bold text-primary tracking-tight">ns1.alaba.ng</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Nameserver 2</span>
                  <span className="text-[11px] font-bold text-primary tracking-tight">ns2.alaba.ng</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Created</span>
                  <span className="text-[11px] font-black text-on-surface tracking-widest lowercase">{new Date(account.createdAt).toLocaleDateString()}</span>
                </div>
             </div>
          </div>

          <div className="bg-primary p-10 rounded-[3.5rem] text-on-primary shadow-2xl shadow-primary/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:bg-white/20 transition-colors" />
            <h3 className="text-xl font-black tracking-tighter mb-2 relative z-10 lowercase">Need Support?</h3>
            <p className="text-[11px] font-medium opacity-70 mb-8 relative z-10 leading-relaxed lowercase">Our 24/7 infrastructure team is standing by to assist with your deployment needs.</p>
            <button className="w-full bg-white text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all relative z-10">
              Open Support Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
