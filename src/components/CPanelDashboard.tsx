/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Globe, 
  FolderOpen, 
  Database, 
  Mail, 
  ShieldCheck, 
  Zap, 
  Activity,
  HardDrive,
  Cpu,
  ArrowUpRight,
  ChevronRight,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { type Account, type Screen } from '../types';

interface CPanelDashboardProps {
  account: Account;
  onNavigate: (screen: Screen) => void;
}

export const CPanelDashboard: React.FC<CPanelDashboardProps> = ({ account, onNavigate }) => {
  // Admin check
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 max-w-[1600px] mx-auto">
      {isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <ShieldCheck size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Administrative Context Active</p>
                <p className="text-sm font-bold text-on-surface">You are viewing {account.domain} with Super Admin privileges.</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Cluster Permissions: Full Access</span>
          </div>
        </motion.div>
      )}

      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full ring-1 ring-primary/20">
              Account Dashboard
            </span>
          </div>
          <h1 className="text-4xl md:text-[3.5rem] font-black leading-none text-on-surface tracking-tighter break-all">
            {account.domain}
          </h1>
          <p className="text-on-surface-variant text-base md:text-lg font-medium opacity-80">
            Welcome back. Your serenity starts with a well-managed infrastructure.
          </p>
        </div>

        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/30 flex items-center justify-center md:justify-end gap-8 shadow-sm">
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant opacity-60">System Health</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                <span className="text-xl font-bold text-on-surface">Operational</span>
              </div>
           </div>
           <div className="h-10 w-px bg-outline-variant/20" />
           <div className="flex flex-col items-center">
              <button className="p-3 bg-primary text-on-primary rounded-2xl shadow-lg hover:scale-105 transition-transform active:scale-95">
                <Smartphone size={20} />
              </button>
              <span className="text-[9px] font-black uppercase mt-2 text-primary opacity-60">Mobile Connect</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Disk Usage', value: `${(account.diskUsage/1024).toFixed(3)} GB`, total: account.package ? `${(account.diskLimit/1024).toFixed(2)} GB` : 'N/A', icon: HardDrive, progress: account.package ? (account.diskUsage/account.diskLimit)*100 : 0 },
          { label: 'Bandwidth', value: `${(account.bwUsage/1024).toFixed(2)} GB`, total: account.package ? `${(account.bwLimit/1024).toFixed(0)} GB` : 'N/A', icon: Activity, progress: account.package ? (account.bwUsage/account.bwLimit)*100 : 0 },
          { label: 'RAM Usage', value: `${(account.ramUsage/1024).toFixed(1)} GB`, total: account.package ? `${(account.ramLimit/1024).toFixed(0)} GB` : 'N/A', icon: Cpu, progress: account.package ? (account.ramUsage/account.ramLimit)*100 : 0 },
          { label: 'CPU Load', value: `${account.cpuUsage}%`, total: account.package ? '100%' : 'N/A', icon: Cpu, progress: account.package ? account.cpuUsage : 0 },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-container p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm flex flex-col gap-4 group hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-primary/5 rounded-2xl text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                <stat.icon size={22} />
              </div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="mt-2">
              <h3 className="text-3xl font-black text-on-surface tracking-tighter">{account.package ? stat.value : '---'}</h3>
              <p className={cn("text-[10px] font-bold mt-1", !account.package ? "text-error uppercase tracking-widest" : "text-on-surface-variant")}>
                {account.package ? `OF ${stat.total}` : 'No active hosting plan found'}
              </p>
            </div>
            <div className="mt-auto h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-outline-variant/10">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${stat.progress}%` }}
                 className={cn("h-full rounded-full", !account.package ? "bg-outline/20" : "bg-primary")}
               />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 relative overflow-hidden group">
               <FolderOpen className="absolute -right-8 -bottom-8 w-48 h-48 text-primary opacity-5 group-hover:scale-110 transition-transform duration-700" />
               <h3 className="text-2xl font-bold mb-4 relative z-10">Assets Library</h3>
               <p className="text-on-surface-variant text-sm mb-8 leading-relaxed relative z-10">
                 Manage your core site files, media, and configurations with our serene file management engine.
               </p>
               <button 
                onClick={() => onNavigate('file-manager')}
                className="relative z-10 flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest hover:underline underline-offset-8"
               >
                  Browse Files
                  <ArrowUpRight size={14} />
               </button>
            </div>

            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 relative overflow-hidden group">
               <Mail className="absolute -right-8 -bottom-8 w-48 h-48 text-secondary opacity-5 group-hover:scale-110 transition-transform duration-700" />
               <h3 className="text-2xl font-bold mb-4 relative z-10">Mail Hub</h3>
               <p className="text-on-surface-variant text-sm mb-8 leading-relaxed relative z-10">
                 Configure professional communications. Manage mailboxes, forwarders, and encrypted routing.
               </p>
               <button 
                onClick={() => onNavigate('email-accounts')}
                className="relative z-10 flex items-center gap-2 text-secondary font-black text-xs uppercase tracking-widest hover:underline underline-offset-8"
               >
                  Open Inbox
                  <ArrowUpRight size={14} />
               </button>
            </div>
          </div>

          <div className="bg-surface-container rounded-[2.5rem] p-8 border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold">Quick Launch Pad</h3>
                <p className="text-sm text-on-surface-variant">Instant access to specialized nodes</p>
              </div>
              <button className="text-primary font-bold text-xs uppercase tracking-widest hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: FolderOpen, label: 'File Manager', screen: 'file-manager', tooltip: 'Navigate and manage server file structure.' },
                { icon: Mail, label: 'Email Accounts', screen: 'email-accounts', tooltip: 'Configure professional communications and mailboxes.' },
                { icon: Database, label: 'Databases', screen: 'databases', tooltip: 'Manage high-performance relational databases.' },
                { icon: ShieldCheck, label: 'SSL Manager', screen: 'ssl-manager', tooltip: 'Secure your domains with AES-256 encryption.' },
                { icon: Globe, label: 'DNS Editor', screen: 'dns-editor', tooltip: 'Configure domain routing and records.' },
                { icon: Zap, label: 'PHP Config', screen: 'php-config', tooltip: 'Manage PHP versions and configuration.' },
                { icon: Smartphone, label: 'Cron Jobs', screen: 'cron-jobs', tooltip: 'Automate routine server tasks with precision.' },
                { icon: ExternalLink, label: 'Site Builder', screen: 'cpanel-dashboard', tooltip: 'Design and deploy responsive web interfaces.' },
              ].map((tool, i) => (
                <div key={i} className="group relative">
                  <button 
                    onClick={() => tool.screen && onNavigate(tool.screen as Screen)}
                    className="w-full flex flex-col items-center justify-center p-6 bg-surface-container-lowest rounded-2xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group/btn h-full"
                  >
                    <tool.icon className="text-on-surface-variant/40 group-hover/btn:text-primary transition-colors mb-3" size={28} />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant group-hover/btn:text-on-surface text-center leading-tight">{tool.label}</span>
                  </button>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-on-surface text-surface text-[10px] rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                    <div className="font-bold border-b border-surface/20 pb-1 mb-1 uppercase tracking-widest">{tool.label}</div>
                    <div className="opacity-70 font-medium leading-relaxed">{tool.tooltip}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-on-surface" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-xl shadow-on-surface/5 border border-outline-variant/10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant mb-8 flex items-center justify-between leading-none">
              General Info
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}>
                <Zap size={12} className="text-primary" />
              </motion.span>
            </h3>
            <div className="space-y-6">
               {[
                 { label: 'Current User', value: account.user },
                 { label: 'Hosting Plan', value: account.package && account.package !== 'No Plan Assigned' ? account.package : 'Active Subscription' },
                 { label: 'Primary IP', value: account.ip && account.ip !== 'Pending Provision' ? account.ip : 'Awaiting Assignment...' },
                 { label: 'Home Dir', value: `/home/${account.user}`, mono: true },
                 { label: 'Primary Domain', value: account.domain },
                 { label: 'Status', value: account.status.toUpperCase() },
               ].map((item, i) => (
                 <div key={i} className="flex flex-col gap-1 border-b border-outline-variant/10 pb-4 last:border-0 last:pb-0">
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{item.label}</span>
                   <span className={cn(
                     "text-sm font-bold text-on-surface", 
                     item.mono && "font-mono text-xs text-primary",
                     item.label === 'Hosting Plan' && (!account.package || account.package === 'No Plan Assigned') && "text-primary italic"
                   )}>
                     {item.value}
                   </span>
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-primary p-8 rounded-[2rem] text-on-primary relative overflow-hidden group shadow-2xl">
             <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
             <div className="relative z-10 space-y-6">
                <h4 className="text-2xl font-display font-bold leading-tight tracking-tight">Need expert help?</h4>
                <p className="text-on-primary font-medium text-sm leading-relaxed opacity-90">
                  Our serene support team is available 24/7 to assist with migrations, optimizations, and technical deep-dives.
                </p>
                <button className="w-full py-4 bg-on-primary text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg hover:shadow-white/5 active:scale-95 transition-all">
                  Open Support Thread
                </button>
             </div>
          </div>
        </aside>
      </div>

      <footer className="pt-12 border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-[0.2em]">
          Powered by naitalk v4.2
        </p>
        <div className="flex gap-8">
           {['DOCS', 'API', 'STATUS'].map(link => (
             <a key={link} href="#" className="text-[10px] font-black text-on-surface-variant/40 hover:text-primary transition-colors tracking-widest">{link}</a>
           ))}
        </div>
      </footer>
    </div>
  );
};
