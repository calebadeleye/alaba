/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Settings,
  Smartphone,
  Eye,
  AtSign,
  ArrowRight,
  Plus,
  RefreshCw,
  X,
  Check,
  Link,
  Users,
  Lock,
  Server,
  Cloud,
  Cpu,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';

interface EmailAccount {
  id: string;
  email: string;
  type: string;
  usage: number;
  total: number;
  status: 'active' | 'warning' | 'suspended';
  forwarding?: string;
  aliases: string[];
  incoming_enabled?: boolean;
  outgoing_enabled?: boolean;
  restrict_inbox?: boolean;
  hosting_account_id: string;
}

export const EmailManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdjustingQuota, setIsAdjustingQuota] = useState<string | null>(null);
  const [isManagingAliases, setIsManagingAliases] = useState<string | null>(null);
  const [isEditingAccount, setIsEditingAccount] = useState<EmailAccount | null>(null);
  const [newQuota, setNewQuota] = useState<number>(5);
  const [newAlias, setNewAlias] = useState('');
  const [inlineAliasInput, setInlineAliasInput] = useState<string | null>(null);
  const [inlineAliasValue, setInlineAliasValue] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newForwarding, setNewForwarding] = useState('');
  const [restrictInbox, setRestrictInbox] = useState(false);
  const [incomingEnabled, setIncomingEnabled] = useState(true);
  const [outgoingEnabled, setOutgoingEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'account' | 'alias'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [hostingAccounts, setHostingAccounts] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchHostingAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccounts(selectedAccountId);
    }
  }, [selectedAccountId]);

  const fetchHostingAccounts = async () => {
    try {
      const data = await AccountService.getAccounts();
      setHostingAccounts(data);
      if (data.length > 0) setSelectedAccountId(data[0].id);
    } catch (err) {
      console.error('Failed to load hosting accounts:', err);
    }
  };

  const currentHostingAccount = hostingAccounts.find(a => a.id === selectedAccountId);
  const activeDomain = currentHostingAccount?.domain || 'alaba-node.io';
  // Dynamic storage calculation from plan (diskLimit is in MB)
  const clusterStorageLimit = currentHostingAccount ? (Number(currentHostingAccount.diskLimit) / 1024) || 0 : 50;
  const clusterStorageUsed = Array.isArray(accounts) ? accounts.reduce((acc, curr) => acc + (Number(curr.usage) || 0), 0) : 0;

  const fetchAccounts = async (accountId: string) => {
    try {
      setLoading(true);
      const data = await AccountService.getEmailAccounts(accountId);
      setAccounts(data);
    } catch (err) {
      toast.error('Failed to load email accounts');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    // Identity integrity: only show emails belonging to the selected hosting account
    // Normalize comparison to handle db- prefix mismatch
    const accId = String(acc.hosting_account_id || '').replace('db-', '');
    const selId = String(selectedAccountId || '').replace('db-', '');
    const matchesAccount = accId === selId;
    
    // Search filtering with null safety
    const emailStr = (acc.email || '').toLowerCase();
    const typeStr = (acc.type || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = emailStr.includes(q) || typeStr.includes(q);
    
    return matchesAccount && matchesSearch;
  });

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix || !newPassword) {
      toast.error("Please provide both mailbox name and password");
      return;
    }

    try {
      const email = `${newPrefix}@${activeDomain}`;
      const newAccount = await AccountService.createEmailAccount({ 
        email, 
        password: newPassword,
        quota: newQuota,
        type: 'Standard User',
        forwarding: newForwarding,
        hosting_account_id: selectedAccountId,
        restrict_inbox: restrictInbox,
        incoming_enabled: incomingEnabled,
        outgoing_enabled: outgoingEnabled
      });
      
      // Reset local state first
      setNewPrefix('');
      setNewPassword('');
      setNewForwarding('');
      setRestrictInbox(false);
      setIncomingEnabled(true);
      setOutgoingEnabled(true);
      
      toast.success(`Account ${email} provisioned successfully`);
      
      // Refresh list with a slight delay
      setTimeout(() => fetchAccounts(selectedAccountId), 300);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create account';
      if (errorMsg.toLowerCase().includes('already exists')) {
        toast.error(`The address ${newPrefix}@${activeDomain} is already in use.`);
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingAccount) return;

    try {
      const updated = await AccountService.updateEmailAccount(isEditingAccount.id, {
        total: isEditingAccount.total,
        forwarding: isEditingAccount.forwarding,
        incoming_enabled: isEditingAccount.incoming_enabled,
        outgoing_enabled: isEditingAccount.outgoing_enabled,
        restrict_inbox: isEditingAccount.restrict_inbox,
        password: newPassword || undefined
      });
      setAccounts(accounts.map(a => a.id === isEditingAccount.id ? updated : a));
      setIsEditingAccount(null);
      setNewPassword('');
      toast.success('Account updated successfully');
    } catch (err) {
      toast.error('Failed to update account');
    }
  };

  const handleUpdateQuota = async () => {
    if (!isAdjustingQuota) return;
    try {
      const updated = await AccountService.updateEmailAccount(isAdjustingQuota, { total: newQuota });
      setAccounts(accounts.map(a => a.id === isAdjustingQuota ? updated : a));
      setIsAdjustingQuota(null);
      toast.success('Storage quota updated');
    } catch (err) {
      toast.error('Failed to update quota');
    }
  };

  const handleAddAlias = async () => {
    if (!isManagingAliases || !newAlias) return;
    const account = accounts.find(a => a.id === isManagingAliases);
    if (!account) return;

    try {
      const email = newAlias.includes('@') ? newAlias : `${newAlias}@${activeDomain || 'alaba-node.io'}`;
      const updated = await AccountService.updateEmailAccount(isManagingAliases, { 
        aliases: [...account.aliases, email] 
      });
      setAccounts(accounts.map(acc => acc.id === isManagingAliases ? updated : acc));
      setNewAlias('');
      toast.success(`Alias ${email} added`);
    } catch (err) {
      toast.error('Failed to add alias');
    }
  };

  const removeAlias = async (accountId: string, alias: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    try {
      const updated = await AccountService.updateEmailAccount(accountId, { 
        aliases: account.aliases.filter(a => a !== alias) 
      });
      setAccounts(accounts.map(acc => acc.id === accountId ? updated : acc));
      toast.info('Alias removed');
    } catch (err) {
      toast.error('Failed to remove alias');
    }
  };

  const handleAddInlineAlias = async (accountId: string) => {
    if (!inlineAliasValue) return;
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    try {
      const email = inlineAliasValue.includes('@') ? inlineAliasValue : `${inlineAliasValue}@${activeDomain || 'alaba-node.io'}`;
      const updated = await AccountService.updateEmailAccount(accountId, { 
        aliases: [...account.aliases, email] 
      });
      setAccounts(accounts.map(acc => acc.id === accountId ? updated : acc));
      setInlineAliasValue('');
      setInlineAliasInput(null);
      toast.success(`Alias ${email} added`);
    } catch (err) {
      toast.error('Failed to add alias');
    }
  };

  const toggleAccountStatus = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    try {
      const newStatus = account.status === 'suspended' ? 'active' : 'suspended';
      const updated = await AccountService.updateEmailAccount(accountId, { status: newStatus });
      setAccounts(accounts.map(acc => acc.id === accountId ? updated : acc));
      toast.info(`Account ${account.email} is now ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email account?')) return;
    try {
      await AccountService.deleteEmailAccount(id);
      setAccounts(accounts.filter(a => a.id !== id));
      toast.error('Account deleted permanently');
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  const handleOpenWebmail = async (email: string) => {
    try {
      toast.loading("Initializing Webmail session...", { id: 'webmail-sso' });
      const { url } = await AccountService.getSSOWebmail(email);
      window.open(url, '_blank');
      toast.success("Webmail opened", { id: 'webmail-sso' });
    } catch (err: any) {
      const errorMsg = err.message || "Webmail SSO failed";
      toast.error(errorMsg, { id: 'webmail-sso' });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-display font-black tracking-tight text-on-surface">Email Accounts</h1>
          <p className="text-on-surface-variant max-w-lg mt-1 font-medium opacity-80 text-xs md:text-base">Set up and manage professional email addresses for your business</p>
        </div>
        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-3xl border border-outline-variant/30 shadow-sm transition-all hover:border-primary/20">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 leading-none mb-1">Server Storage</p>
            <p className="text-2xl font-black text-on-surface tracking-tighter">
              {clusterStorageUsed.toFixed(1)} GB <span className="text-sm font-bold text-on-surface-variant opacity-40">/ {clusterStorageLimit.toFixed(0)} GB</span>
            </p>
          </div>
          <div className="w-px h-10 bg-outline-variant/20" />
          <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
            <ShieldCheck size={24} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form and Stats */}
        <section className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container p-8 rounded-[2.5rem] shadow-sm border border-outline-variant/30 relative overflow-hidden group">
            <AtSign className="absolute -right-12 -top-12 w-64 h-64 text-primary opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
            
            <div className="flex bg-surface-container-high/50 p-1.5 rounded-2xl mb-8 relative z-10 w-fit">
              <button 
                onClick={() => setActiveTab('account')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'account' ? "bg-primary text-on-primary shadow-md" : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                New Address
              </button>
              <button 
                onClick={() => setActiveTab('alias')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'alias' ? "bg-primary text-on-primary shadow-md" : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                Alias
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'account' ? (
                <motion.div 
                  key="account"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="relative z-10 space-y-5"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/5 rounded-xl text-primary">
                      <UserPlus size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-on-surface">Provision Master Inbox</h3>
                  </div>
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1 opacity-70">Associated Website</label>
                      <select 
                        value={selectedAccountId} 
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                      >
                        {hostingAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.domain}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 group/field">
                      <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1 opacity-70">Email Address</label>
                      <div className="flex gap-2">
                        <input 
                          value={newPrefix}
                          onChange={(e) => setNewPrefix(e.target.value)}
                          className="flex-1 bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 text-on-surface font-medium outline-none transition-all placeholder:opacity-30" 
                          placeholder="e.g. support" 
                          type="text"
                        />
                        <div className="bg-surface-container-high px-4 flex items-center rounded-2xl text-xs font-bold text-primary border border-outline-variant/30 ring-1 ring-inset ring-primary/5 whitespace-nowrap">
                          @{activeDomain}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1 opacity-70">Password</label>
                        <input 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 text-on-surface font-medium outline-none transition-all placeholder:opacity-30" 
                          placeholder="Secure Pass" 
                          type="password"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1 opacity-70">Storage Limit (GB)</label>
                        <input 
                          value={newQuota}
                          onChange={(e) => setNewQuota(Number(e.target.value))}
                          className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 text-on-surface font-medium outline-none transition-all" 
                          type="number"
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-outline-variant/30">
                         <input 
                           type="checkbox" 
                           id="stop-inbox" 
                           checked={restrictInbox}
                           onChange={(e) => setRestrictInbox(e.target.checked)}
                           className="rounded-md border-outline-variant text-primary focus:ring-primary/20" 
                         />
                         <label htmlFor="stop-inbox" className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tight cursor-pointer">Stop Spam</label>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-outline-variant/30">
                         <input 
                           type="checkbox" 
                           id="incoming" 
                           checked={incomingEnabled}
                           onChange={(e) => setIncomingEnabled(e.target.checked)}
                           className="rounded-md border-outline-variant text-primary focus:ring-primary/20" 
                         />
                         <label htmlFor="incoming" className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tight cursor-pointer">Receiving</label>
                      </div>
                    </div>

                    <button className="w-full bg-primary text-on-primary py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98] mt-2">
                      <span>Create</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div 
                  key="alias"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="relative z-10 space-y-5"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-secondary/5 rounded-xl text-secondary">
                      <AtSign size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-on-surface">Email Aliases & Routing</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Create virtual aliases to route mail without exposing primary credentials.</p>
                  
                  <div className="space-y-4 pt-2">
                    <select 
                      value={isManagingAliases || ''}
                      onChange={(e) => setIsManagingAliases(e.target.value)}
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                    >
                      <option value="">Select Target Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.email}</option>
                      ))}
                    </select>

                    <div className="flex gap-2">
                      <input 
                        value={newAlias}
                        onChange={(e) => setNewAlias(e.target.value)}
                        className="flex-1 bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium outline-none" 
                        placeholder="new-proxy" 
                        type="text"
                      />
                      <button 
                         onClick={handleAddAlias}
                         className="bg-secondary text-on-secondary px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                      >
                         Add
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Global Health</h4>
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-on-surface-variant">Active Instances</span>
                <span className="font-black text-on-surface">{accounts.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-on-surface-variant">Cluster Load</span>
                <span className="font-black text-green-500">Low</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Account List */}
        <section className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-surface-container rounded-[2.5rem] shadow-sm border border-outline-variant/30 flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <AtSign size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-surface">Email Accounts</h2>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant opacity-40 tracking-widest leading-none mt-1">Management Console</p>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 w-4 h-4" />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="text" 
                  placeholder="Filter accounts..."
                  className="bg-surface border border-outline-variant/40 pl-11 pr-4 py-2.5 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all w-full md:w-72 font-medium outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-high/30">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">Account</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">Logic & Routing</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">Capacity</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredAccounts.map((account) => (
                    <tr key={account.id} className="group hover:bg-primary-container/10 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-all group-hover:rotate-6 shadow-sm",
                            account.status === 'active' ? "bg-primary/10 text-primary border border-primary/20" : 
                            account.status === 'warning' ? "bg-warning/10 text-warning border border-warning/20" :
                            "bg-error/10 text-error border border-error/20"
                          )}>
                            {(account.type || '').includes('Admin') ? <ShieldCheck size={24} /> : 
                             (account.type || '').includes('API') ? <Cpu size={24} /> :
                             (account.type || '').includes('Shared') ? <Users size={24} /> :
                             <Mail size={24} />}
                          </div>
                          <div>
                            <div className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">{account.email}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <span className={cn(
                                 "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border",
                                 (account.type || '').includes('Admin') ? "border-primary/20 text-primary/70 bg-primary/5" :
                                 "border-on-surface-variant/10 text-on-surface-variant/60"
                               )}>
                                 {account.type}
                               </span>
                               {account.status !== 'active' && (
                                 <span className={cn(
                                   "flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                                   account.status === 'warning' ? "bg-warning/10 text-warning" : "bg-error/10 text-error"
                                 )}>
                                   {account.status === 'warning' ? <ShieldAlert size={10} /> : <Lock size={10} />} {account.status}
                                 </span>
                               )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-col gap-2 items-start">
                            <button 
                              onClick={() => setIsManagingAliases(account.id)}
                              className="w-fit flex items-center gap-2 text-[10px] font-black bg-surface-container-high/50 hover:bg-primary/10 hover:text-primary px-3 py-1.5 rounded-full transition-all border border-outline-variant/20 uppercase tracking-tighter"
                            >
                               <Users size={12} /> {account.aliases.length} ALIASES
                            </button>
                            
                            <AnimatePresence>
                              {inlineAliasInput === account.id ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className="flex items-center gap-1"
                                >
                                  <input 
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddInlineAlias(account.id);
                                      if (e.key === 'Escape') setInlineAliasInput(null);
                                    }}
                                    value={inlineAliasValue}
                                    onChange={(e) => setInlineAliasValue(e.target.value)}
                                    placeholder="new-alias"
                                    className="text-[10px] font-mono bg-surface border border-primary/30 rounded-lg px-2 py-1 outline-none w-24 text-on-surface"
                                  />
                                  <button onClick={() => handleAddInlineAlias(account.id)} className="text-primary hover:bg-primary/10 p-1 rounded transition-colors">
                                    <Check size={12} />
                                  </button>
                                  <button onClick={() => {
                                    setInlineAliasInput(null);
                                    setInlineAliasValue('');
                                  }} className="text-on-surface-variant/40 hover:bg-surface-variant p-1 rounded transition-colors">
                                    <X size={12} />
                                  </button>
                                </motion.div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setInlineAliasInput(account.id);
                                    setInlineAliasValue('');
                                  }}
                                  className="flex items-center gap-1 text-[9px] font-black text-primary uppercase opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/5 px-2 py-0.5 rounded-full"
                                >
                                  <Plus size={10} /> Quick Add Alias
                                </button>
                              )}
                            </AnimatePresence>

                            {account.forwarding ? (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant opacity-60">
                                <ArrowRight size={12} className="text-primary" />
                                <span className="truncate max-w-[120px]">{account.forwarding}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-on-surface-variant/40 lowercase italic">local delivery only</span>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="max-w-[180px] w-full">
                          <div className="flex justify-between text-[10px] font-black text-on-surface-variant mb-2">
                            <span>{account.usage} GB <span className="opacity-30">/ {account.total} GB</span></span>
                            <span className={cn(
                              (account.usage / account.total) > 0.9 ? "text-error" : "text-primary"
                            )}>{Math.round((account.usage / account.total) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-outline-variant/10">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(account.usage / account.total) * 100}%` }}
                              className={cn(
                                "h-full rounded-full transition-all duration-1000 shadow-sm",
                                (account.usage / account.total) > 0.9 ? "bg-error shadow-error/40" : "bg-primary shadow-primary/40"
                              )}
                            />
                          </div>
                          <button 
                            onClick={() => {
                              setIsAdjustingQuota(account.id);
                              setNewQuota(account.total);
                            }}
                            className="mt-3 text-[9px] font-black text-primary uppercase tracking-widest hover:underline underline-offset-4 flex items-center gap-1"
                          >
                             Adjust Capacity <Edit3 size={10} />
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right relative">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === account.id ? null : account.id);
                            }}
                            className={cn(
                              "p-2.5 rounded-2xl transition-all",
                              activeMenu === account.id ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant"
                            )}
                          >
                            <MoreVertical size={18} />
                          </button>

                          <AnimatePresence>
                            {activeMenu === account.id && (
                              <>
                                <div className="fixed inset-0 z-[100]" onClick={() => setActiveMenu(null)} />
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                  className="absolute right-24 top-1/2 -translate-y-1/2 z-[110] bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl p-2 flex flex-row gap-1"
                                >
                                  <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleOpenWebmail(account.email);
                                       setActiveMenu(null);
                                     }}
                                     className="p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-all flex items-center gap-2"
                                     title="Open Webmail"
                                  >
                                     <Mail size={16} />
                                  </button>
                                  <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setIsEditingAccount(account);
                                       setActiveMenu(null);
                                     }}
                                     className="p-2.5 bg-surface-container hover:bg-primary/10 hover:text-primary rounded-xl transition-all text-on-surface-variant flex items-center gap-2"
                                     title="Edit Account"
                                  >
                                     <Edit3 size={16} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAccountStatus(account.id);
                                      setActiveMenu(null);
                                    }}
                                    className={cn(
                                      "px-3 py-2.5 text-[9px] font-black tracking-[0.1em] rounded-xl transition-all flex items-center gap-2",
                                      account.status === 'suspended' ? "bg-primary/10 text-primary hover:bg-primary hover:text-on-primary" : "bg-error/10 text-error hover:bg-error hover:text-on-error"
                                    )}
                                  >
                                    {account.status === 'suspended' ? 'WAKE' : 'SUSPEND'}
                                  </button>
                                  <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleDeleteAccount(account.id);
                                       setActiveMenu(null);
                                     }}
                                     className="p-2.5 bg-surface-container hover:bg-error/10 hover:text-error rounded-xl transition-all text-on-surface-variant"
                                     title="Delete Account"
                                  >
                                     <Trash2 size={16} />
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAccounts.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-20">
                          <AtSign size={48} />
                          <p className="font-bold text-sm tracking-widest uppercase">No identities found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="mt-auto bg-surface-container-low px-8 py-6 flex items-center justify-between border-t border-outline-variant/10">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] leading-none opacity-40">Email Accounts v2.4</span>
                <div className="h-4 w-px bg-outline-variant/20" />
                <span className="text-[10px] font-bold text-primary">Showing {filteredAccounts.length} of {accounts.length}</span>
              </div>
              <div className="flex gap-2">
                <button className="h-10 w-10 flex items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant hover:bg-primary hover:text-on-primary transition-all shadow-sm"><ChevronLeft size={18} /></button>
                <button className="h-10 w-10 flex items-center justify-center rounded-2xl bg-primary text-on-primary text-xs font-black shadow-lg shadow-primary/20">1</button>
                <button className="h-10 w-10 flex items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant hover:bg-primary hover:text-on-primary transition-all shadow-sm"><ChevronRight size={18} /></button>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {/* Quota Adjustment Modal */}
      <AnimatePresence>
        {isAdjustingQuota && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-xl"
              onClick={() => setIsAdjustingQuota(null)}
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-[3rem] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="flex justify-between items-start">
                <div className="p-4 bg-primary text-on-primary rounded-[1.5rem] shadow-lg shadow-primary/20">
                  <Cpu size={32} />
                </div>
                <button onClick={() => setIsAdjustingQuota(null)} className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div>
                <h3 className="text-3xl font-display font-black tracking-tight text-on-surface">Storage Quota</h3>
                <p className="text-on-surface-variant font-medium mt-1">Adjust limit for <span className="text-primary">{accounts.find(a => a.id === isAdjustingQuota)?.email}</span></p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-3">
                  {[1, 5, 10, 25].map((val) => (
                    <button
                      key={val}
                      onClick={() => setNewQuota(val)}
                      className={cn(
                        "py-3 rounded-2xl text-sm font-black transition-all border",
                        newQuota === val 
                          ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20" 
                          : "bg-surface border-outline-variant/30 text-on-surface-variant hover:border-primary/50"
                      )}
                    >
                      {val}G
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <input 
                    type="range"
                    min="1"
                    max="100"
                    value={newQuota}
                    onChange={(e) => setNewQuota(parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-3 text-[10px] font-black uppercase text-on-surface-variant/40 tracking-widest">
                    <span>1 GB MIN</span>
                    <span className="text-primary opacity-100">{newQuota} GB SELECTED</span>
                    <span>100 GB MAX</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsAdjustingQuota(null)}
                  className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={handleUpdateQuota}
                  className="flex-[2] bg-primary text-on-primary px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 transition-all font-mono"
                >
                  Apply Scaling
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alias Management Modal */}
      <AnimatePresence>
        {isManagingAliases && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-xl"
              onClick={() => setIsManagingAliases(null)}
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-xl bg-surface-container border border-outline-variant/30 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary/10 rounded-2xl text-secondary">
                    <AtSign size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">Alias Configurator</h2>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Account: {accounts.find(a => a.id === isManagingAliases)?.email}</p>
                  </div>
                </div>
                <button onClick={() => setIsManagingAliases(null)} className="p-2 hover:bg-surface-variant rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant ml-1">New Alias / Proxy</label>
                  <div className="flex gap-2">
                    <input 
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      className="flex-1 bg-surface border border-outline-variant/40 rounded-2xl px-4 py-3 text-sm font-medium outline-none text-on-surface" 
                      placeholder="e.g. sales" 
                      type="text"
                    />
                    <button 
                      onClick={handleAddAlias}
                      className="bg-secondary text-on-secondary px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-40">Active Routing Rules</p>
                  <div className="space-y-2">
                    {accounts.find(a => a.id === isManagingAliases)?.aliases.map((alias, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-surface-container-high/50 flex items-center justify-center text-on-surface-variant/40">
                             <AtSign size={14} />
                          </div>
                          <span className="text-sm font-bold text-on-surface">{alias}</span>
                        </div>
                        <button 
                          onClick={() => removeAlias(isManagingAliases as string, alias)}
                          className="p-2 text-on-surface-variant/30 hover:text-error transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {accounts.find(a => a.id === isManagingAliases)?.aliases.length === 0 && (
                      <div className="text-center py-8 opacity-30 italic text-sm text-on-surface-variant">No active aliases configured.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-end">
                <button 
                  onClick={() => setIsManagingAliases(null)}
                  className="px-8 py-3 bg-surface-container-highest text-on-surface font-black uppercase text-[10px] tracking-widest rounded-2xl border border-outline-variant/20 transition-all hover:bg-surface"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Account Modal */}
      <AnimatePresence>
        {isEditingAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-xl"
              onClick={() => setIsEditingAccount(null)}
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-lg bg-surface-container border border-outline-variant/30 rounded-[3rem] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="flex justify-between items-start">
                <div className="p-4 bg-primary text-on-primary rounded-[1.5rem] shadow-lg shadow-primary/20">
                  <Edit3 size={32} />
                </div>
                <button onClick={() => setIsEditingAccount(null)} className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div>
                <h3 className="text-3xl font-display font-black tracking-tight text-on-surface">Update Mailbox</h3>
                <p className="text-on-surface-variant font-medium mt-1">Updates for <span className="text-primary">{isEditingAccount.email}</span></p>
              </div>

              <form onSubmit={handleUpdateAccount} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1">New Password</label>
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep"
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1">Storage (GB)</label>
                    <input 
                      type="number"
                      value={isEditingAccount.total}
                      onChange={(e) => setIsEditingAccount({ ...isEditingAccount, total: Number(e.target.value) })}
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant ml-1">Forwarding Address</label>
                  <input 
                    type="email"
                    value={isEditingAccount.forwarding || ''}
                    onChange={(e) => setIsEditingAccount({ ...isEditingAccount, forwarding: e.target.value })}
                    placeholder="e.g. personal@gmail.com"
                    className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsEditingAccount({ ...isEditingAccount, incoming_enabled: !isEditingAccount.incoming_enabled })}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                      isEditingAccount.incoming_enabled ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface border-outline-variant opacity-60"
                    )}
                  >
                    Incoming
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsEditingAccount({ ...isEditingAccount, outgoing_enabled: !isEditingAccount.outgoing_enabled })}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                      isEditingAccount.outgoing_enabled ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface border-outline-variant opacity-60"
                    )}
                  >
                    Outgoing
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsEditingAccount({ ...isEditingAccount, restrict_inbox: !isEditingAccount.restrict_inbox })}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                      isEditingAccount.restrict_inbox ? "bg-warning/10 border-warning/30 text-warning" : "bg-surface border-outline-variant opacity-60"
                    )}
                  >
                    Protected
                  </button>
                </div>

                <div className="flex gap-3 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsEditingAccount(null)}
                    className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-all font-mono"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-primary text-on-primary px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 transition-all font-bold"
                  >
                    Update
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
