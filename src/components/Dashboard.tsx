/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  Zap, 
  Cpu, 
  HardDrive, 
  Globe, 
  ShieldCheck, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Rocket,
  RefreshCw,
  Copy,
  Link as LinkIcon,
  User
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const data = [
  { name: '00:00', cpu: 45, ram: 32, disk: 12, bandwidth: 2.1 },
  { name: '04:00', cpu: 32, ram: 30, disk: 12, bandwidth: 1.5 },
  { name: '08:00', cpu: 65, ram: 45, disk: 13, bandwidth: 4.8 },
  { name: '12:00', cpu: 82, ram: 58, disk: 15, bandwidth: 8.2 },
  { name: '16:00', cpu: 70, ram: 52, disk: 16, bandwidth: 6.5 },
  { name: '20:00', cpu: 55, ram: 48, disk: 16, bandwidth: 3.9 },
  { name: '23:59', cpu: 40, ram: 35, disk: 17, bandwidth: 2.4 },
];

const StatCard = ({ title, value, unit, icon: Icon, trend, trendValue }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant flex flex-col gap-4"
  >
    <div className="flex items-start justify-between">
      <div className="p-2 rounded-xl bg-primary-container text-primary">
        <Icon size={24} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
          {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trendValue}%
        </div>
      )}
    </div>
    <div>
      <p className="text-on-surface-variant text-sm font-medium">{title}</p>
      <h3 className="text-3xl font-display font-bold mt-1 text-on-surface">
        {value}
        <span className="text-lg font-normal text-on-surface-variant ml-1">{unit}</span>
      </h3>
    </div>
  </motion.div>
);

export const Dashboard: React.FC<{ onNavigate: (screen: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsData, logsData, historyData] = await Promise.all([
          AccountService.getServerStats(),
          AccountService.getEnforcementLogs(),
          AccountService.getGlobalHistory()
        ]);
        setStats(statsData);
        setLogs(logsData);
        
        // Transform history into Recharts format
        const chartData = historyData.cpu.map((_, i) => ({
          name: `${i * 5}m`,
          cpu: historyData.cpu[i],
          ram: historyData.ram[i],
          bandwidth: historyData.bw[i]
        }));
        setHistory(chartData);
      } catch (err) {
        console.error('Data fetch failed');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Platform Analytics</h1>
          <p className="text-on-surface-variant text-sm">Comprehensive performance monitoring and environment health metrics.</p>
        </div>
        
        <div className="flex items-center gap-4">
           {stats && (
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-xl border border-outline-variant/30">
               <RefreshCw size={12} className="text-primary animate-spin-slow" />
               <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Live Feedback</span>
             </div>
           )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="CPU Usage" value={stats?.cpu || "42"} unit="%" icon={Cpu} trend="up" trendValue="12" />
        <StatCard title="Memory Load" value={stats?.ram || "5.8"} unit={stats ? "%" : "GB"} icon={Zap} trend="down" trendValue="4" />
        <StatCard title="Disk Space" value="1.2" unit="TB" icon={HardDrive} trend="up" trendValue="0.5" />
        <StatCard title="Active Accounts" value={stats?.accounts || "128"} unit="" icon={Globe} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
              <LinkIcon size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Cloud Enrollment Portal</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Provide this secure link to new clients for automated environment provisioning.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-1.5 bg-surface rounded-xl border border-outline-variant max-w-full overflow-hidden">
            <code className="text-[10px] md:text-xs font-mono text-primary px-3 truncate max-w-[200px] md:max-w-md">
              {window.location.origin}/register
            </code>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/register`);
                toast.success("Registration link copied to clipboard");
              }}
              className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors shrink-0"
              title="Copy registration link"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <User size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Secure Customer Portal</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Dedicated access point for users to manage their deployed hosting nodes.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-1.5 bg-surface rounded-xl border border-outline-variant max-w-full overflow-hidden">
            <code className="text-[10px] md:text-xs font-mono text-primary px-3 truncate max-w-[200px] md:max-w-md">
              {window.location.origin}/login
            </code>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/login`);
                toast.success("Login link copied to clipboard");
              }}
              className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors shrink-0"
              title="Copy login link"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Performance History</h2>
              <p className="text-sm text-on-surface-variant">Server load over the last 24 hours</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs font-medium text-on-surface-variant">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-xs font-medium text-on-surface-variant">RAM</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-on-surface-variant">BW</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.length > 0 ? history : data}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.2} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-surface-container)',
                    borderRadius: '12px', 
                    border: '1px solid var(--color-outline-variant)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: 'var(--color-on-surface)'
                  }} 
                  itemStyle={{ color: 'var(--color-on-surface)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#colorCpu)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="ram" 
                  stroke="var(--color-secondary)" 
                  fillOpacity={1} 
                  fill="url(#colorRam)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="bandwidth" 
                  stroke="#f59e0b" 
                  fillOpacity={0.1} 
                  fill="#f59e0b" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary text-on-primary p-8 rounded-2xl flex flex-col justify-between overflow-hidden relative shadow-lg">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl opacity-20" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl opacity-20" />
          
          <div className="relative z-10">
            <div className="p-3 bg-white/10 w-fit rounded-xl mb-6">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Security Status</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              System is currently protected. No vulnerabilities detected in the last scan (15m ago).
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-sm font-medium">Firewall</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-sm font-medium">SSL Certificates</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Verified</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-sm font-medium">Malware Scan</span>
                <span className="px-2 py-0.5 bg-white/10 text-white/50 text-[10px] font-bold rounded-full uppercase tracking-wider">Scheduled</span>
              </div>
            </div>
          </div>

          <button className="relative z-10 mt-8 w-full py-3 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-colors shadow-sm">
            Run Deep Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Resource Load Breakdown</h2>
              <p className="text-sm text-on-surface-variant">Comparative analysis of system resources (Last 24h)</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.2} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-surface-container)',
                    borderRadius: '12px', 
                    border: '1px solid var(--color-outline-variant)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: 'var(--color-on-surface)'
                  }} 
                  itemStyle={{ color: 'var(--color-on-surface)' }}
                />
                <Bar dataKey="cpu" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="CPU %" />
                <Bar dataKey="ram" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} name="RAM %" />
                <Bar dataKey="disk" fill="var(--color-tertiary)" radius={[4, 4, 0, 0]} name="Disk Usage" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-on-surface">Recent Cluster Enforcement</h2>
            <button className="text-primary text-sm font-bold hover:underline">Audits</button>
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {logs.length > 0 ? logs.slice(0, 10).map((log, i) => (
              <div key={i} className="flex items-center gap-4 p-3 hover:bg-surface rounded-xl transition-colors border-l-4 border-transparent hover:border-primary">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  log.action === 'SUSPENDED' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                  log.action === 'WARNING' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                  'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-on-surface">{log.domain}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant opacity-60">•</span>
                    <span className={cn(
                      "text-[10px] font-black tracking-widest uppercase",
                      log.action === 'SUSPENDED' ? 'text-red-500' : 'text-amber-500'
                    )}>{log.action}</span>
                  </div>
                  <p className="text-[11px] font-medium text-on-surface-variant lowercase mt-0.5">{log.reason}</p>
                </div>
                <span className="text-[10px] text-on-surface-variant font-mono opacity-40">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )) : (
              <div className="p-8 text-center text-on-surface-variant/40 italic text-sm">
                No recent enforcement actions recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
