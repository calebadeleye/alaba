import React from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  ShieldCheck, 
  ShieldAlert, 
  CreditCard, 
  Activity, 
  HardDrive, 
  Cpu, 
  Database, 
  Mail,
  ExternalLink,
  ChevronRight,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { type Account } from '../types';
import { useNavigate } from 'react-router-dom';

interface UserDashboardProps {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ accounts, onSelectAccount }) => {
  const navigate = useNavigate();

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-surface-container-highest rounded-[2.5rem] flex items-center justify-center mx-auto text-on-surface-variant/30">
          <Globe size={40} />
        </div>
        <h2 className="text-2xl font-display font-black tracking-tight">No Active Hosting</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">Your order is being processed. New registrations are typically activated within 24 hours of invoice clearance.</p>
        <button 
          onClick={() => navigate('/register/1')}
          className="bg-primary text-on-primary px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto hover:scale-105 transition-all shadow-xl shadow-primary/20"
        >
          <Zap size={16} />
          <span>Add New Hosting</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
            User Hub
          </div>
          <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface">My Hosting Dashboard</h1>
          <p className="text-on-surface-variant font-medium">Real-time status and control panel access for your deployed accounts.</p>
        </div>
        <button 
          onClick={() => navigate('/register/1')}
          className="bg-primary text-on-primary px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-primary/20 self-start md:self-center"
        >
          <Zap size={16} />
          <span>Add New Hosting</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {accounts.map((account) => (
          <motion.div 
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container rounded-[3rem] border border-outline-variant/30 shadow-2xl shadow-primary/5 overflow-hidden"
          >
            {/* Status Header */}
            <div className={cn(
              "px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6",
              account.status === 'active' ? "bg-primary/5" : account.status === 'suspended' ? "bg-error/5" : "bg-secondary/5"
            )}>
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-lg transition-all",
                  account.status === 'active' ? "bg-primary text-on-primary shadow-primary/20" : 
                  account.status === 'suspended' ? "bg-error text-on-error shadow-error/20" : 
                  "bg-secondary text-on-secondary shadow-secondary/20"
                )}>
                  {account.status === 'active' ? <Globe size={32} /> : 
                   account.status === 'suspended' ? <ShieldAlert size={32} /> : 
                   <Clock size={32} />}
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black tracking-tight text-on-surface">{account.domain}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      account.status === 'active' ? "bg-green-500 animate-pulse" : 
                      account.status === 'suspended' ? "bg-error" : "bg-amber-500"
                    )} />
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      account.status === 'active' ? "text-green-600" : 
                      account.status === 'suspended' ? "text-error" : "text-amber-600"
                    )}>
                      {account.status} {account.status === 'active' ? '• Service Online' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {account.status !== 'active' && (
                <div className="flex items-center gap-4 bg-surface px-6 py-3 rounded-2xl border border-outline-variant shadow-sm max-w-sm">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    account.status === 'suspended' ? "bg-error/10 text-error" : "bg-amber-100 text-amber-600"
                  )}>
                   {account.statusReason?.includes('Invoice') ? <CreditCard size={20} /> : <ShieldAlert size={20} />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Account Status: {account.status.toUpperCase()}</p>
                    <p className="text-xs font-bold text-on-surface">{account.statusReason || 'Awaiting activation protocol'}</p>
                  </div>
                </div>
              )}

              <button 
                onClick={() => onSelectAccount(account.id)}
                disabled={account.status !== 'active'}
                className={cn(
                  "px-8 py-4 rounded-2xl font-display font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all",
                  account.status === 'active' 
                    ? "bg-primary text-on-primary hover:scale-105 shadow-xl shadow-primary/20" 
                    : "bg-surface-variant text-on-surface-variant opacity-50 cursor-not-allowed"
                )}
              >
                Access Hosting <ExternalLink size={14} />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { 
                  label: 'Disk Usage', 
                  val: account.status === 'pending' ? '0.00GB' : `${((account.disk_usage || account.diskUsage || 0)/1024).toFixed(2)}GB`, 
                  limit: account.status === 'pending' ? '--' : `${((account.disk_limit || account.diskLimit || 1024)/1024).toFixed(0)}GB`, 
                  percent: account.status === 'pending' ? 0 : ((account.disk_usage || account.diskUsage || 0) / (account.disk_limit || account.diskLimit || 1)) * 100, 
                  icon: HardDrive 
                },
                { 
                  label: 'Bandwidth', 
                  val: account.status === 'pending' ? '0GB' : `${account.bw_usage || account.bwUsage || 0}GB`, 
                  limit: account.status === 'pending' ? '--' : `${account.bw_limit || account.bwLimit || 100}GB`, 
                  percent: account.status === 'pending' ? 0 : ((account.bw_usage || account.bwUsage || 0) / (account.bw_limit || account.bwLimit || 1)) * 100, 
                  icon: Activity 
                },
                { 
                  label: 'Database Count', 
                  val: account.status === 'pending' ? '0' : (account.db_count || account.dbCount || 0), 
                  limit: account.status === 'pending' ? '--' : (account.max_databases || '5'), 
                  percent: account.status === 'pending' ? 0 : (Number(account.db_count || account.dbCount || 0) / (Number(account.max_databases) || 5)) * 100, 
                  icon: Database 
                },
                { 
                  label: 'Email Units', 
                  val: account.status === 'pending' ? '0' : (account.email_count || account.emailCount || 0), 
                  limit: account.status === 'pending' ? '--' : (account.max_email_accounts || '10'), 
                  percent: account.status === 'pending' ? 0 : (Number(account.email_count || account.emailCount || 0) / (Number(account.max_email_accounts) || 10)) * 100, 
                  icon: Mail 
                },
              ].map((m, i) => (
                <div key={i} className="p-6 bg-surface border border-outline-variant rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center text-primary/60">
                      <m.icon size={20} />
                    </div>
                    <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{m.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xl font-display font-black text-on-surface">{m.val}</span>
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">/ {m.limit}</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${m.percent}%` }}
                        className={cn(
                          "h-full rounded-full",
                          m.percent > 85 ? "bg-error" : "bg-primary"
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Account Details Footer */}
            <div className="px-8 py-4 bg-surface border-t border-outline-variant/30 flex flex-wrap gap-x-10 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Cluster IP:</span>
                <span className="text-xs font-mono font-bold text-primary">{account.ip}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Package Tier:</span>
                <span className="text-xs font-bold text-on-surface">{account.package}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Provisioned:</span>
                <span className="text-xs font-bold text-on-surface">{new Date(account.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Promotion/Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-primary to-primary-container p-10 rounded-[3rem] text-on-primary relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Cpu size={180} />
          </div>
          <div className="relative z-10 space-y-6">
            <h3 className="text-3xl font-display font-black tracking-tighter leading-none">Need More Power?</h3>
            <p className="font-medium opacity-80 max-w-sm">Upgrade to our Dedicated Cluster nodes with isolated CPU cores and NVMe Gen5 storage.</p>
            <button className="bg-white text-primary px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl">
              Upgrade Subscription
            </button>
          </div>
        </div>

        <div className="bg-surface-container-highest p-10 rounded-[3rem] border border-outline-variant/30 relative flex flex-col justify-between">
           <div className="space-y-4">
             <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
               <ShieldCheck size={24} />
             </div>
             <h3 className="text-2xl font-display font-black tracking-tight">Enterprise Compliance</h3>
             <p className="text-sm font-medium text-on-surface-variant">Your hosting environment is fully compliant with ISO 27001 and GDPR standards. Managed by Alaba Quantum Security layers.</p>
           </div>
           <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline mt-8">
             View Compliance Reports <ChevronRight size={14} />
           </button>
        </div>
      </div>
    </div>
  );
};
