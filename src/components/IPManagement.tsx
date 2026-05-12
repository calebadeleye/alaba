/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  XCircle, 
  RefreshCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface IPRecord {
  id: number;
  ip_address: string;
  status: 'available' | 'assigned' | 'reserved';
  assigned_to: string | null;
  created_at: string;
}

export const IPManagement: React.FC = () => {
  const [ips, setIps] = useState<IPRecord[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newIp, setNewIp] = useState('');
  const [assignToAccountId, setAssignToAccountId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchIps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ips', {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      setIps(data);
    } catch (err) {
      toast.error('Failed to fetch IP pool');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts', {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts for IP assignment');
    }
  };

  useEffect(() => {
    fetchIps();
    fetchAccounts();
  }, []);

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp) return;

    try {
      const res = await fetch('/api/admin/ips', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          ip_address: newIp,
          assign_to: assignToAccountId || null
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success(`IP ${newIp} added ${assignToAccountId ? 'and assigned' : 'to pool'}`);
      setNewIp('');
      setAssignToAccountId('');
      setShowAddModal(false);
      fetchIps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add IP');
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this IP assignment? This will mark it as available.')) return;

    try {
      const res = await fetch(`/api/admin/ips/${id}/revoke`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success('IP assignment revoked');
      fetchIps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke IP');
    }
  };

  const handleDelete = async (id: number) => {
    const ip = ips.find(i => i.id === id);
    if (!ip) return;

    if (ip.status === 'assigned') {
      const proceed = confirm(
        `CRITICAL WARNING: This IP (${ip.ip_address}) is currently ASSIGNED to ${ip.assigned_to}.\n\n` +
        `Deleting this IP will leave the host account without a valid routing address, causing the website and services to go offline.\n\n` +
        `Do you absolutely want to proceed with deletion?`
      );
      if (!proceed) return;
    } else {
      if (!confirm('Permanently delete this IP from pool?')) return;
    }

    try {
      const res = await fetch(`/api/admin/ips/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success('IP deleted from pool');
      fetchIps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete IP');
    }
  };

  const filteredIps = ips.filter(ip => 
    ip.ip_address.includes(searchQuery) || 
    (ip.assigned_to && ip.assigned_to.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-on-surface flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Globe className="text-primary" size={28} />
            </div>
            IP Management Pool
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage dedicated IP addresses, assignments, and global cluster routing.</p>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-on-primary px-8 py-3 rounded-2xl font-bold flex items-center gap-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95"
        >
          <Plus size={20} />
          <span>Provision New IP</span>
        </button>
      </header>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-10 space-y-8"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 text-primary rounded-3xl">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-on-surface tracking-tighter">Provision IP</h3>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-60">Global Cluster Resource</p>
                </div>
              </div>

              <form onSubmit={handleAddIp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest pl-1">IP Address (IPv4)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 45.79.123.10" 
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    required
                    className="w-full bg-surface border border-outline-variant px-5 py-4 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest pl-1">Assign to Account (Optional)</label>
                  <select 
                    value={assignToAccountId}
                    onChange={(e) => setAssignToAccountId(e.target.value)}
                    className="w-full bg-surface border border-outline-variant px-5 py-4 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Keep in Pool (Available) --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.domain} ({acc.user})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-[0.2em] hover:bg-surface-variant rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-on-primary font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Confirm Provision
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total IPs', value: ips.length, icon: Globe, color: 'text-primary bg-primary/10' },
          { label: 'Available', value: ips.filter(i => i.status === 'available').length, icon: CheckCircle2, color: 'text-green-600 bg-green-600/10' },
          { label: 'Assigned', value: ips.filter(i => i.status === 'assigned').length, icon: ShieldCheck, color: 'text-amber-600 bg-amber-600/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface-container p-6 rounded-3xl border border-outline-variant flex items-center gap-6"
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-display font-black text-on-surface mt-1">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-surface-container rounded-[2.5rem] border border-outline-variant overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
            <input 
              type="text" 
              placeholder="Filter by IP or assignment..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant pl-10 pr-4 py-2.5 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchIps} className="p-2.5 hover:bg-surface rounded-xl text-on-surface-variant transition-all hover:rotate-180 duration-500">
              <RefreshCcw size={18} />
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-[10px] uppercase font-black tracking-widest text-on-surface-variant hover:bg-surface transition-all">
              <Filter size={14} />
              Filter Pool
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface border-b border-outline-variant">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">IP Address</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Assigned To</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Created At</th>
                <th className="px-8 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6 h-16 bg-surface-variant/10"></td>
                  </tr>
                ))
              ) : filteredIps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-on-surface-variant/50">
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle size={48} strokeWidth={1} />
                      <p className="font-bold text-sm uppercase tracking-widest">No IP addresses found in the cluster pool</p>
                    </div>
                  </td>
                </tr>
              ) : filteredIps.map((ip) => (
                <tr key={ip.id} className="hover:bg-primary-container/10 transition-colors">
                  <td className="px-8 py-5">
                    <span className="font-mono font-bold text-on-surface">{ip.ip_address}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ring-inset",
                      ip.status === 'available' ? "bg-green-100 text-green-700 ring-green-600/20" : 
                      ip.status === 'assigned' ? "bg-blue-100 text-blue-700 ring-blue-600/20" : 
                      "bg-slate-100 text-slate-700 ring-slate-600/20"
                    )}>
                      {ip.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-medium text-on-surface-variant">
                      {ip.assigned_to || <span className="opacity-30 italic">None</span>}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs text-on-surface-variant opacity-60">
                    {new Date(ip.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {ip.status === 'assigned' && (
                        <button 
                          onClick={() => handleRevoke(ip.id)}
                          className="p-2 hover:bg-amber-100/50 text-amber-600 rounded-lg transition-all"
                          title="Revoke Assignment"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(ip.id)}
                        className="p-2 rounded-lg transition-all hover:bg-error/10 text-error"
                        title="Delete from Pool"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
