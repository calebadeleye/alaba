/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Globe, 
  Shield, 
  Database, 
  Mail, 
  Cpu, 
  HardDrive, 
  Lock,
  Search,
  ChevronRight,
  TrendingUp,
  RefreshCcw,
  Save
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { toast } from 'sonner';

const CONFIG_SECTIONS = [
// ... existing sections ...
  { 
    id: 'server', 
    title: 'Server Information', 
    icon: Settings, 
    items: ['Basic Config', 'Tweak Settings', 'Change Hostname', 'Statistics Software Configuration'] 
  },
  { 
    id: 'network', 
    title: 'Networking Setup', 
    icon: Globe, 
    items: ['Configure IPv6', 'Nameserver Setup', 'Resolver Configuration', 'Bandwidth Queries'] 
  },
  { 
    id: 'security', 
    title: 'Security Center', 
    icon: Shield, 
    items: ['cPHulk Brute Force Protection', 'ModSecurity Configuration', 'Two-Factor Authentication', 'SSH Password Auth Tweak'] 
  },
  { 
    id: 'database', 
    title: 'SQL Services', 
    icon: Database, 
    items: ['MySQL/MariaDB Upgrade', 'Database Query Monitor', 'Manage Database Users', 'Repair Database'] 
  },
  { 
    id: 'mail', 
    title: 'Email Settings', 
    icon: Mail, 
    items: ['Exim Configuration Manager', 'Mail Deliverability', 'Spam Filters', 'Mailing List Manager'] 
  },
  { 
    id: 'performance', 
    title: 'Resources & Performance', 
    icon: Cpu, 
    items: ['Apache Configuration', 'PHP INI Editor', 'Resource Usage', 'Memcached Configuration'] 
  },
];

export const ConfigurationHub: React.FC = () => {
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
      toast.success('Global settings updated successfully');
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateRate = (currency: string, rate: number) => {
    setSettings((prev: any) => ({
      ...prev,
      exchangeRates: {
        ...prev.exchangeRates,
        [currency]: rate
      }
    }));
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
              <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Settings Center</h1>
          <p className="text-on-surface-variant font-medium">Global environment controls and performance optimization.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search settings..."
              className="w-full bg-white border border-outline-variant pl-10 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="p-2 border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CONFIG_SECTIONS.slice(0, 4).map((section) => (
              <div key={section.id} className="bg-surface-container rounded-2xl shadow-sm border border-outline-variant overflow-hidden group hover:border-primary/30 transition-all">
                <div className="p-6 border-b border-outline-variant bg-surface/50 group-hover:bg-primary-container/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-container rounded-xl shadow-sm border border-outline-variant">
                      <section.icon className="text-primary" size={20} />
                    </div>
                    <h3 className="font-bold text-base text-on-surface">{section.title}</h3>
                  </div>
                </div>
                <div className="p-2">
                  {section.items.map((item, i) => (
                    <button 
                      key={i} 
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-surface transition-colors flex items-center justify-between group/item"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant group-hover/item:text-primary transition-colors">{item}</span>
                      <ChevronRight size={14} className="text-outline-variant opacity-0 group-hover/item:opacity-100 -translate-x-2 group-hover/item:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm space-y-6">
            <h3 className="font-display font-bold text-lg">Third-Party Integrations</h3>
            <div className="space-y-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Tawk.to Property ID</label>
                 <input 
                   type="text" 
                   value={settings?.tawkPropertyId || ''}
                   onChange={(e) => updateField('tawkPropertyId', e.target.value)}
                   placeholder="e.g. 5f0.../default"
                   className="w-full bg-surface border border-outline-variant px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                 />
                 <p className="text-[9px] text-on-surface-variant italic">Find this in your Tawk.to dashboard under Property Settings &gt; Property ID.</p>
               </div>
               <button 
                 disabled={saving}
                 onClick={handleUpdate}
                 className="w-full py-3 bg-primary text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
               >
                 {saving ? <RefreshCcw className="animate-spin" size={14} /> : <Save size={14} />}
                 <span>Synchronize Integration</span>
               </button>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-6">Quick Toggles</h3>
            <div className="space-y-6">
              {[
                { label: 'Maintenance Mode', active: settings?.maintenanceMode, key: 'maintenanceMode' },
                { label: 'Auto-Update Core', active: true },
                { label: 'Hosting Watchdog', active: false },
                { label: 'Verbose Logging', active: false }
              ].map((toggle, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-widest">{toggle.label}</span>
                  <button 
                    onClick={() => toggle.key && updateField(toggle.key, !toggle.active)}
                    className={cn(
                      "w-12 h-6 rounded-full relative p-1 transition-colors cursor-pointer",
                      toggle.active ? "bg-primary" : "bg-outline-variant/30"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                      toggle.active ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-outline-variant/30">
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Security Recommendation</span>
                </div>
                <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                  Nameservers are currently pointing to Hosting Edge. Ensure all DNSSEC records are signed before deployment.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary text-on-primary p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
              <h2 className="text-xl font-display font-black mb-2">Hosting Environment Integration</h2>
              <p className="text-white/70 text-[11px] font-medium mb-6 leading-relaxed">
                Connect your service to external providers for automated scaling and hybrid storage solutions.
              </p>
              <button className="w-full py-3 bg-white text-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg">
                Link Workspace
              </button>
            </div>
            <Lock className="absolute -right-4 -bottom-4 text-white/5 rotate-12" size={120} />
          </div>
        </div>
      </div>
    </div>
  );
};
