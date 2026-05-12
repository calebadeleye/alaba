/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Network,
  Search, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  Link as LinkIcon, 
  Mail, 
  FileText,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Filter,
  ArrowUpRight,
  Activity,
  History,
  Lock,
  Zap,
  Key,
  ShieldAlert,
  ChevronDown,
  Copy,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { type Account } from '../types';

interface DSRecord {
  keyTag: number;
  algorithm: number;
  digestType: number;
  digest: string;
}

export const DNSZoneEditor: React.FC<{ account?: Account }> = ({ account }) => {
  const [isDNSSECEnabled, setIsDNSSECEnabled] = useState(false);
  const [showDNSSECModal, setShowDNSSECModal] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDNS = async () => {
    setLoading(true);
    try {
      const data = await AccountService.getDNSRecords(account?.domain);
      setRecords(data);
    } catch (err) {
      toast.error('Failed to load DNS records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDNS();
  }, [account?.domain]);

  const dsRecords: DSRecord[] = [
    { keyTag: 12345, algorithm: 13, digestType: 2, digest: 'E2D3C4B5A697887766554433221100FFEE99887766554433221100AABBCCDDEE' },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{ record: any; index: number } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<{ name: string; index: number } | null>(null);
  const [newRecordState, setNewRecordState] = useState({
    name: '',
    ttl: 3600,
    class: 'IN',
    type: 'A',
    record: '',
    status: 'Active'
  });

  const filteredRecords = records.filter(rec => {
    const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.record.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.status.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || rec.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const toggleDNSSEC = () => {
    const nextState = !isDNSSECEnabled;
    setIsDNSSECEnabled(nextState);
    toast.success(`DNSSEC ${nextState ? 'enabled' : 'disabled'}`, {
      description: nextState ? "Security keys have been generated. Please update your DS records at your registrar." : "DNSSEC signatures will be removed from your zone."
    });
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordState.name || !newRecordState.record) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (!account?.domain) {
      toast.error("No active domain context found");
      return;
    }

    try {
      await AccountService.createDNSRecord({
        domain: account.domain,
        type: newRecordState.type,
        name: newRecordState.name,
        content: newRecordState.record,
        ttl: newRecordState.ttl
      });
      
      toast.success("DNS Record added successfully");
      setShowAddRecordModal(false);
      fetchDNS();
      
      setNewRecordState({
        name: '',
        ttl: 3600,
        class: 'IN',
        type: 'A',
        record: '',
        status: 'Active'
      });
    } catch (err) {
      toast.error("Failed to add record to DNS infrastructure");
    }
  };

  const handleEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !account?.domain) return;

    try {
      await AccountService.updateDNSRecord(account.domain, editingRecord.record.id, {
        type: editingRecord.record.type,
        name: editingRecord.record.name,
        content: editingRecord.record.record,
        ttl: editingRecord.record.ttl,
        status: editingRecord.record.status
      });
      
      toast.success("DNS Record updated successfully");
      setEditingRecord(null);
      fetchDNS();
    } catch (err) {
      toast.error("Failed to update DNS record");
    }
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete !== null && account?.domain) {
      const record = records[recordToDelete.index];
      if (!record.id) {
        toast.error("Record ID missing, cannot delete from remote.");
        return;
      }
      
      try {
        await AccountService.deleteDNSRecord(account.domain, record.id);
        toast.success(`DNS Record for ${recordToDelete.name} removed from infrastructure`);
        setRecordToDelete(null);
        fetchDNS();
      } catch (err) {
        toast.error("Failed to delete record from DNS infrastructure");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <nav className="flex gap-2 text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-2">
            <span>Cluster Alpha</span>
            <ChevronRight size={10} />
            <span className="text-primary">Zone Editor</span>
          </nav>
          <h1 className="text-2xl md:text-4xl font-display font-black tracking-tight text-on-surface">Domain Setup</h1>
          <p className="text-on-surface-variant mt-1 max-w-xl font-medium">
            Manage your website's routing and connection settings for <span className="text-primary underline decoration-2 underline-offset-4">{account?.domain || 'your domain'}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddRecordModal(true)}
            className="px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2 group"
          >
            <PlusCircle size={18} className="group-hover:rotate-90 transition-transform" />
            <span>Add New Record</span>
          </button>
        </div>
      </header>

      {/* DNSSEC Modal Overlay and Cards removed per user request */}

      {/* Edit Record Modal */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRecord(null)}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Edit Zone Record</h3>
                  <p className="text-xs text-on-surface-variant font-medium">Updating resource for {editingRecord.record.name}</p>
                </div>
              </div>

              <form onSubmit={handleEditRecord} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Name</label>
                    <input 
                      type="text"
                      value={editingRecord.record.name}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        record: { ...editingRecord.record, name: e.target.value }
                      })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Type</label>
                    <select 
                      value={editingRecord.record.type}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        record: { ...editingRecord.record, type: e.target.value }
                      })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="SRV">SRV</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">TTL (Seconds)</label>
                    <input 
                      type="number"
                      value={editingRecord.record.ttl}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        record: { ...editingRecord.record, ttl: parseInt(e.target.value) }
                      })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Status</label>
                    <select 
                      value={editingRecord.record.status}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        record: { ...editingRecord.record, status: e.target.value }
                      })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                      <option value="Active">Active</option>
                      <option value="Expiring Soon">Expiring Soon</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Record Data</label>
                  <input 
                    type="text"
                    value={editingRecord.record.record}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      record: { ...editingRecord.record, record: e.target.value }
                    })}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Record Confirmation Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRecordToDelete(null)}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Delete Record?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Are you sure you want to delete this record? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-error text-white font-bold text-sm rounded-xl shadow-lg shadow-error/20 hover:opacity-90 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Record Modal */}
      <AnimatePresence>
        {showAddRecordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddRecordModal(false)}
              className="absolute inset-0 bg-surface-dim/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <PlusCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Add Zone Record</h3>
                  <p className="text-xs text-on-surface-variant font-medium">New resource record for example-domain.com</p>
                </div>
              </div>

              <form onSubmit={handleAddRecord} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Name</label>
                    <input 
                      type="text"
                      value={newRecordState.name}
                      onChange={(e) => setNewRecordState({ ...newRecordState, name: e.target.value })}
                      placeholder="e.g. mail"
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Type</label>
                    <select 
                      value={newRecordState.type}
                      onChange={(e) => setNewRecordState({ ...newRecordState, type: e.target.value })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="SRV">SRV</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">TTL (Seconds)</label>
                    <input 
                      type="number"
                      value={newRecordState.ttl}
                      onChange={(e) => setNewRecordState({ ...newRecordState, ttl: parseInt(e.target.value) })}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Class</label>
                    <input 
                      type="text"
                      readOnly
                      value={newRecordState.class}
                      className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface-variant cursor-not-allowed outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Record Data</label>
                  <input 
                    type="text"
                    value={newRecordState.record}
                    onChange={(e) => setNewRecordState({ ...newRecordState, record: e.target.value })}
                    placeholder="e.g. 192.168.1.1"
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddRecordModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                  >
                    Add Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 bg-surface-container-low p-1.5 rounded-2xl flex items-center gap-1.5 border border-outline-variant/30">
          {[
            { icon: ArrowUpRight, label: 'ADD A RECORD', type: 'A' },
            { icon: LinkIcon, label: 'ADD CNAME', type: 'CNAME' },
            { icon: Mail, label: 'ADD MX', type: 'MX' },
            { icon: FileText, label: 'ADD TXT', type: 'TXT' },
          ].map((btn, i) => (
            <button 
              key={i} 
              onClick={() => {
                setNewRecordState({ ...newRecordState, type: btn.type });
                setShowAddRecordModal(true);
              }}
              className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black tracking-widest transition-all bg-surface text-on-surface-variant hover:bg-surface-variant hover:text-primary"
            >
              <btn.icon size={16} />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="bg-surface-container rounded-3xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="p-6 flex justify-between items-center border-b border-outline-variant/10 bg-surface-container-high/50">
          <div className="flex items-center gap-3">
             <Activity className="text-primary" size={20} />
             <h3 className="font-bold text-lg text-on-surface">Existing DNS Records</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface border border-outline-variant pl-10 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none w-48 md:w-64 transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 w-3 h-3" />
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-surface border border-outline-variant pl-8 pr-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="A">A</option>
                  <option value="AAAA">AAAA</option>
                  <option value="CNAME">CNAME</option>
                  <option value="MX">MX</option>
                  <option value="TXT">TXT</option>
                </select>
              </div>
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Showing <span className="text-primary">{filteredRecords.length}</span> records</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high">
                <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">TTL</th>
                <th className="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Class</th>
                <th className="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Record / Address</th>
                <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredRecords.map((rec) => {
                const originalIndex = records.findIndex(r => r === rec);
                return (
                  <tr key={originalIndex} className="hover:bg-primary-container/10 transition-colors group cursor-default">
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{rec.name}</span>
                    </td>
                    <td className="px-6 py-5 text-sm font-mono text-on-surface-variant/70">{rec.ttl}</td>
                    <td className="px-4 py-5 text-sm font-bold text-on-surface-variant/40">{rec.class}</td>
                    <td className="px-4 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase ring-1 ring-inset transition-all group-hover:shadow-sm",
                        rec.type === 'A' ? "bg-primary-container text-primary ring-primary/20" :
                        rec.type === 'MX' ? "bg-secondary-container text-secondary ring-secondary/20" :
                        rec.type === 'CNAME' ? "bg-tertiary-container text-on-tertiary-container ring-tertiary-container" :
                        "bg-surface-variant text-on-surface-variant ring-outline-variant/30"
                      )}>
                        {rec.type}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-mono text-xs text-on-surface break-all">{rec.record}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
                          rec.status === 'Active' ? "bg-green-500/10 text-green-500 ring-green-500/20" :
                          rec.status === 'Expiring Soon' ? "bg-amber-500/10 text-amber-500 ring-amber-500/20" :
                          "bg-red-500/10 text-red-500 ring-red-500/20"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            rec.status === 'Active' ? "bg-green-500 animate-pulse" :
                            rec.status === 'Expiring Soon' ? "bg-amber-500" :
                            "bg-red-500"
                          )} />
                          {rec.status}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right w-32">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingRecord({ record: { ...rec }, index: originalIndex })}
                          className="p-2 hover:bg-surface rounded-xl text-primary transition-colors hover:shadow-sm"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => setRecordToDelete({ name: rec.name, index: originalIndex })}
                          className="p-2 hover:bg-error-container/20 rounded-xl text-error transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="p-6 bg-surface-container-low/30 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-high/20">
          <div className="flex gap-2">
            {[1, 2, 3, '...', 12].map((n, i) => (
              <button 
                key={i} 
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all",
                  n === 1 ? "bg-primary text-on-primary shadow-lg" : "bg-surface hover:bg-surface-variant text-on-surface-variant hover:text-primary border border-outline-variant/20"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-primary hover:bg-primary-container rounded-xl transition-all group">
            <span>View More Records</span>
            <ChevronRight size={18} className="translate-y-[1px] group-hover:translate-x-1 transition-transform" />
          </button>
        </footer>
      </section>

      {/* Section removed per user request: DNSSEC State, TTL Rec, Recent Audit cards */}
    </div>
  );
};
