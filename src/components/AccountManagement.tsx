/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink, 
  Pause, 
  Play, 
  Trash2,
  HardDrive,
  ShieldAlert,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Activity,
  Check,
  Clock,
  RefreshCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { type Account } from '../types';
import { AccountService } from '../services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export const AccountManagement: React.FC<{ 
  accounts: Account[], 
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>,
  onSelectAccount: (id: string) => void 
}> = ({ accounts, setAccounts, onSelectAccount }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'suspended'>('all');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [terminatingAccount, setTerminatingAccount] = useState<Account | null>(null);
  const [resettingPasswordAccount, setResettingPasswordAccount] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTerminate = async () => {
    if (!terminatingAccount || !confirmPassword) return;
    
    setIsProcessing(true);
    try {
      await AccountService.terminateAccount(terminatingAccount.id, confirmPassword);
      setAccounts(prev => prev.filter(a => a.id !== terminatingAccount.id));
      toast.success(`Subscription for ${terminatingAccount.domain} has been purged from the cluster.`);
      setTerminatingAccount(null);
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || "Termination failed. Verify administrative credentials.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingPasswordAccount || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match synchronization.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await AccountService.adminResetCustomerPassword(resettingPasswordAccount.id, newPassword);
      toast.success(`Identity credentials updated for ${resettingPasswordAccount.domain}.`);
      setResettingPasswordAccount(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || "Credential restoration failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setApproving(id);
    try {
      await AccountService.approveAccount(id);
      const updated = await AccountService.getAccounts();
      setAccounts(updated);
      toast.success("Hosting account provisioned and activation email sent.");
    } catch (err) {
      toast.error("Failed to approve account");
      console.error(err);
    } finally {
      setApproving(null);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = 
      acc.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.ip && acc.ip.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'pending') return matchesSearch && acc.status === 'pending';
    if (activeTab === 'suspended') return matchesSearch && acc.status === 'suspended';
    return matchesSearch;
  });

  const toggleStatus = async (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    
    const nextStatus = account.status === 'active' ? 'suspended' : 'active';
    try {
      await AccountService.updateAccount(id, { status: nextStatus });
      setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, status: nextStatus } : acc));
      toast.info(`Account ${account.domain} ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
    setActiveMenuId(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Hosting Subscriptions</h1>
          <p className="text-on-surface-variant">Manage hosting accounts, quotas, and service permissions.</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
          <span>Create New Account</span>
        </button>
      </header>

      {accounts.some(acc => acc.status === 'suspended') && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-error/10 border border-error/20 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <ShieldAlert size={120} />
          </div>
          <div className="w-16 h-16 rounded-[2rem] bg-error flex items-center justify-center text-white shrink-0 shadow-lg shadow-error/30 animate-pulse">
            <Ban size={32} />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1 relative z-10">
            <h3 className="text-xl font-display font-black tracking-tight text-error uppercase">Action Required: Cluster Lockdown</h3>
            <p className="text-sm font-medium text-error/80 leading-relaxed max-w-2xl">
              One or more accounts have been <span className="font-bold underline">suspended</span> due to resource abuse or billing issues. 
              Please review the accounts below and complete the mandatory audit to restore cluster-wide stability.
            </p>
          </div>
        <button 
          className="bg-error text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-error/20 whitespace-nowrap"
          onClick={() => toast.info("Audit report generated. Reviewing suspended subscriptions...")}
        >
          Start Global Audit
        </button>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex bg-surface-container rounded-2xl p-1 border border-outline-variant">
          {[
            { id: 'all', label: 'All Accounts' },
            { id: 'pending', label: 'Pending Approval' },
            { id: 'suspended', label: 'Suspended' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-primary text-on-primary shadow-lg" 
                  : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              {tab.label}
              {tab.id === 'pending' && accounts.filter(a => a.status === 'pending').length > 0 && (
                <span className="bg-error text-on-error px-1.5 py-0.5 rounded-full text-[8px] animate-pulse">
                  {accounts.filter(a => a.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search accounts by domain, user, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface outline-none"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-outline-variant bg-surface-container text-on-surface font-bold hover:bg-surface transition-colors">
          <Filter size={20} />
          <span>Filters</span>
        </button>
      </div>

      <div className="bg-surface-container rounded-2xl shadow-sm border border-outline-variant">
        <div className="overflow-x-visible md:overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-outline-variant">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Domain</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Owner</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">IP Address</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Package</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Disk Usage</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-on-surface-variant opacity-50">
                      <HardDrive size={48} strokeWidth={1} />
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest">No {activeTab !== 'all' ? activeTab : ''} subscriptions found</p>
                        <p className="text-xs font-medium">There are currently no {activeTab === 'all' ? 'active' : activeTab} records in the cluster database.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.map((account) => {
                const usagePercent = Math.round((account.diskUsage / account.diskLimit) * 100);
                const isHighUsage = usagePercent >= 80;

                return (
                  <tr 
                    key={account.id} 
                    className="hover:bg-primary-container/20 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      // Prevent navigation if clicking on any button, menu, or backdrop
                      if (target.closest('button') || target.closest('.z-\[110\]') || target.classList.contains('fixed')) {
                        return;
                      }
                      onSelectAccount(account.id);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface group-hover:text-primary transition-colors">{account.domain}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface text-xs">{account.customerEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">
                      {account.ip}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold",
                        account.package === 'Enterprise' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        account.package === 'Premium' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        {account.package}
                      </span>
                    </td>
                    <td className="px-6 py-4 min-w-[200px]">
                      <div className="space-y-1.5">
                        <div className={cn(
                          "flex justify-between text-[10px] font-bold",
                          isHighUsage ? "text-error" : "text-on-surface-variant"
                        )}>
                          <span>{(account.diskUsage/1024).toFixed(2)}GB / {(account.diskLimit/1024).toFixed(0)}GB</span>
                          <span>{usagePercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${usagePercent}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              isHighUsage ? "bg-error animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-primary"
                            )}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full transition-transform",
                          account.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        )} />
                        <span className={cn(
                          "text-xs font-bold capitalize",
                          account.status === 'active' ? "text-green-600" : "text-error"
                        )}>
                          {account.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 relative">
                        <button className="p-2 hover:bg-surface rounded-lg text-on-surface-variant hover:text-primary transition-colors">
                          <ExternalLink size={18} />
                        </button>
                        <div className="relative">
                          <button 
                            id={`kebab-${account.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === account.id ? null : account.id);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              activeMenuId === account.id ? "bg-primary text-on-primary shadow-lg" : "hover:bg-surface text-on-surface-variant hover:text-primary"
                            )}
                          >
                            <MoreVertical size={18} />
                          </button>
                          
                          <AnimatePresence>
                            {activeMenuId === account.id && (
                              <div 
                                className="fixed inset-0 z-[100]" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }}
                              >
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  style={{ 
                                    position: 'fixed',
                                    top: document.getElementById(`kebab-${account.id}`)?.getBoundingClientRect().bottom ? document.getElementById(`kebab-${account.id}`)!.getBoundingClientRect().bottom + 8 : 0,
                                    right: window.innerWidth - (document.getElementById(`kebab-${account.id}`)?.getBoundingClientRect().right || 0),
                                  }}
                                  className="w-56 bg-surface border border-outline-variant rounded-2xl shadow-2xl z-[110] p-2 overflow-hidden"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-3 py-2 mb-1 border-b border-outline-variant/30">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Account Actions</p>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStatus(account.id);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
                                      account.status === 'active' ? "text-error hover:bg-error/5" : "text-green-600 hover:bg-green-600/5"
                                    )}
                                  >
                                    {account.status === 'active' ? (
                                      <><Ban size={14} /> Suspend Account</>
                                    ) : (
                                      <><CheckCircle2 size={14} /> Reactivate Account</>
                                    )}
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setResettingPasswordAccount(account);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-all"
                                  >
                                    <RefreshCcw size={14} /> Force Password Reset
                                  </button>
                                  <div className="h-px bg-outline-variant/30 my-1" />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTerminatingAccount(account);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-error/60 hover:bg-error/5 hover:text-error transition-all"
                                  >
                                    <Trash2 size={14} /> Terminate Subscriptions
                                  </button>
                                </motion.div>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {terminatingAccount && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface border border-outline-variant rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <ShieldAlert size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight text-on-surface uppercase">Dangerous Action</h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed">
                    You are about to <span className="text-error font-black">TERMINATE</span> the subscription for <span className="font-bold text-primary">{terminatingAccount.domain}</span>.
                    This will permanently delete all associated files, databases, and emails from the multi-datacenter cluster.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block px-2">Verify Administrative Password</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-error/20 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                        setTerminatingAccount(null);
                        setConfirmPassword('');
                      }}
                      className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleTerminate}
                      disabled={!confirmPassword || isProcessing}
                      className="bg-error text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg shadow-error/30 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <RefreshCcw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      <span>Purge Account</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {resettingPasswordAccount && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface border border-outline-variant rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                    <RefreshCcw size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-on-surface uppercase">Reset Identity</h2>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Client: {resettingPasswordAccount.domain}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2">New Password</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2">Confirm New Password</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button 
                      onClick={() => {
                        setResettingPasswordAccount(null);
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleResetPassword}
                      disabled={!newPassword || !confirmPassword || isProcessing}
                      className="bg-primary text-on-primary px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <RefreshCcw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      <span>Apply Changes</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
