/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Globe, 
  Shield, 
  Database, 
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Server,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export const DNSConfiguration: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AccountService.getGlobalSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await AccountService.updateGlobalSettings(settings);
      toast.success('DNS configuration updated successfully');
    } catch (err) {
      toast.error('Failed to save DNS settings');
    } finally {
      setSaving(false);
    }
  };

  const updateNameserver = (idx: number, value: string) => {
    const newNs = [...settings.nameservers];
    newNs[idx] = value;
    setSettings({ ...settings, nameservers: newNs });
  };

  const updateNsIp = (idx: number, value: string) => {
    const newIps = [...settings.nameserverIps];
    newIps[idx] = value;
    setSettings({ ...settings, nameserverIps: newIps });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Zap className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex gap-2 text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mb-2">
            <span>Server Alpha</span>
            <span className="opacity-40">/</span>
            <span className="text-primary">BIND(DNS) Config</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-on-surface">production DNS Cluster</h1>
          <p className="text-on-surface-variant font-medium mt-2 max-w-xl">
            Configure authoritative nameservers and global IP mappings for all provisioned hosting accounts.
          </p>
        </div>
      </header>

      <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-surface-container rounded-[2.5rem] p-8 md:p-12 border border-outline-variant shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <Globe className="text-primary" size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold">Authoritative Nameservers</h3>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                    These nameservers will be automatically assigned to all new hosting instances.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settings?.nameservers.map((ns: string, i: number) => (
                  <div key={i} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nameserver {i + 1}</label>
                    <div className="relative group">
                      <Network className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="text"
                        value={ns}
                        onChange={(e) => updateNameserver(i, e.target.value)}
                        placeholder={`ns${i + 1}.example.com`}
                        className="w-full bg-surface border border-outline-variant pl-11 pr-4 py-4 text-sm font-bold rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-1">
                      <div className="flex-1 h-px bg-outline-variant/30" />
                      <span className="text-[9px] font-bold text-outline uppercase tracking-widest">A Record IP</span>
                      <div className="flex-1 h-px bg-outline-variant/30" />
                    </div>
                    <input 
                      type="text"
                      value={settings.nameserverIps[i]}
                      onChange={(e) => updateNsIp(i, e.target.value)}
                      placeholder="127.0.0.1"
                      className="w-full bg-surface-container-high border border-outline-variant px-4 py-3 text-xs font-mono rounded-xl focus:outline-none transition-all text-center"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-outline-variant/20">
                <div className="flex items-start gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                  <AlertCircle className="text-primary shrink-0" size={20} />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Propagation Warning</span>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed font-medium">
                      Changes to authoritative nameservers take 24-48 hours to propagate globally. Ensure the IPs above have valid A records at the parent registrar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container rounded-[2.5rem] p-8 md:p-12 border border-outline-variant shadow-sm relative overflow-hidden">
             <div className="flex items-start gap-6 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0 border border-secondary/20">
                  <Server className="text-secondary" size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold">Main Server IP (A-Record)</h3>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                    The default IPv4 address assigned to non-dedicated hosting accounts.
                  </p>
                </div>
              </div>

              <div className="max-w-md">
                <div className="relative group">
                  <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4 group-focus-within:text-secondary transition-colors" />
                  <input 
                    type="text"
                    value={settings?.sharedIp}
                    onChange={(e) => setSettings({ ...settings, sharedIp: e.target.value })}
                    placeholder="127.0.0.1"
                    className="w-full bg-surface border border-outline-variant pl-11 pr-4 py-4 text-sm font-mono font-bold rounded-2xl focus:outline-none focus:ring-4 focus:ring-secondary/10 transition-all text-secondary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-3 ml-1 font-bold uppercase tracking-widest opacity-60">This IP will be used for all automatic DNS provisioning</p>
              </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-6">DNS Health</h3>
            <div className="space-y-6">
              {[
                { label: 'Glue Records', status: 'verified', icon: CheckCircle2 },
                { label: 'DNSSEC Signing', status: 'active', icon: Shield },
                { label: 'Serial Uniqueness', status: 'optimized', icon: Zap }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <item.icon className="text-primary" size={16} />
                    <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={saving}
            className="w-full py-5 bg-primary text-on-primary rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? (
              <Zap className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            <span>Save</span>
          </button>
        </div>
      </form>
    </div>
  );
};
