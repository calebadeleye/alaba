/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings2, 
  Search, 
  Globe, 
  Terminal, 
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  Filter,
  Cpu
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { toast } from 'sonner';

export const MultiPHPManager: React.FC = () => {
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPHP() {
      try {
        const data = await AccountService.getPHPDomains();
        setDomains(data);
      } catch (err) {
        toast.error('Failed to load PHP configurations');
      } finally {
        setLoading(false);
      }
    }
    fetchPHP();
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 max-w-7xl mx-auto text-on-surface">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-10">
        <div className="max-w-2xl">
          <p className="font-display text-primary font-extrabold uppercase tracking-widest text-[10px] mb-2">System Infrastructure</p>
          <h1 className="text-3xl md:text-[3.5rem] font-black leading-none text-on-surface tracking-tighter mb-4">MultiPHP Manager</h1>
          <p className="text-on-surface-variant body-md leading-relaxed">
            Manage system-wide default PHP versions and handle per-domain configuration. 
            Changes are instantaneous and applied across selected cluster nodes.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-low p-3 pl-5 rounded-full border border-outline-variant/30">
          <Info className="text-primary" size={20} />
          <span className="text-xs font-bold text-on-surface pr-4">PHP 8.2 is the latest stable release.</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5">
          <div className="bg-surface-container-lowest p-8 rounded-3xl flex flex-col justify-between shadow-sm border border-outline-variant/10 h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100%] transition-colors group-hover:bg-primary/10" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <span className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ring-primary/20">Global Default</span>
                <Terminal className="text-primary/20" size={40} />
              </div>
              <h3 className="text-6xl font-display font-black text-on-surface mb-2 tracking-tighter">PHP 8.1.x</h3>
              <p className="text-on-surface-variant font-medium">Currently serving all inherited configurations.</p>
            </div>
            <div className="mt-12 pt-8 border-t border-outline-variant/10 flex items-center justify-between relative z-10">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Last Update: 14m ago</span>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">System Optimized</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7">
          <div className="bg-surface-container p-8 rounded-3xl border border-white/40 shadow-sm relative overflow-hidden h-full flex flex-col justify-center">
            <div className="absolute inset-0 bg-white/20 dark:bg-white/5 backdrop-blur-sm -z-10" />
            <h4 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <Settings2 size={24} className="text-primary" />
              <span>Modify Runtime Environment</span>
            </h4>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">New Runtime Target</label>
                <div className="relative group">
                  <select 
                    defaultValue="PHP 8.1.18 (ea-php81)"
                    className="w-full appearance-none bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-sm font-bold text-on-surface focus:ring-4 focus:ring-primary/10 cursor-pointer outline-none transition-all"
                  >
                    <option>PHP 7.4.33 (ea-php74) - End of Life</option>
                    <option>PHP 8.0.28 (ea-php80)</option>
                    <option>PHP 8.1.18 (ea-php81)</option>
                    <option>PHP 8.2.5 (ea-php82) - Recommended</option>
                    <option>PHP 8.3.0 (ea-php83) - Experimental</option>
                  </select>
                  <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant rotate-90" />
                </div>
              </div>
              <button className="px-10 py-4 bg-primary text-on-primary font-bold rounded-2xl shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                Apply Changes
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-5 italic opacity-80 flex items-center gap-2">
              <AlertTriangle size={12} className="text-amber-500" />
              Note: Changing global version affects all sites set to 'Inherit'.
            </p>
          </div>
        </section>
      </div>

      <section className="bg-surface-container rounded-3xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center bg-surface-container-high/50 border-b border-outline-variant/10">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-on-surface">Domain Configuration Mapping</h3>
            <div className="bg-primary/5 text-primary tracking-widest px-3 py-1 rounded-full text-[10px] font-black uppercase ring-1 ring-primary/20">12 DOMAINS ACTIVE</div>
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Filter domains..."
              className="bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2 text-xs w-64 focus:ring-2 focus:ring-primary/20 outline-none font-medium"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/30">
                <th className="px-8 py-4 w-12 text-center">
                  <input type="checkbox" className="rounded-md border-outline-variant text-primary focus:ring-primary/20" />
                </th>
                <th className="px-4 py-4 font-display text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Domain Entity</th>
                <th className="px-4 py-4 font-display text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Document Root</th>
                <th className="px-4 py-4 font-display text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">PHP Version</th>
                <th className="px-8 py-4 font-display text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {domains.map((domain, i) => (
                <tr key={i} className="group hover:bg-primary-container/10 transition-colors cursor-pointer">
                  <td className="px-8 py-5 text-center">
                    <input type="checkbox" className="rounded-md border-outline-variant text-primary focus:ring-primary/20" />
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-surface rounded-xl text-primary border border-outline-variant/10 group-hover:border-primary/20 transition-all">
                        <Globe size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-on-surface group-hover:text-primary transition-colors text-sm">{domain.name}</div>
                        <div className="text-[10px] font-mono text-on-surface-variant/60 tracking-tighter uppercase">ID: sov-8823-{i}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 font-mono text-[11px] text-on-surface-variant">{domain.root}</td>
                  <td className="px-4 py-5 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full font-bold font-mono text-[10px] uppercase",
                      domain.version.includes('Inherit') ? "bg-surface-container-high text-on-surface-variant" :
                      domain.version === 'ea-php74' ? "bg-error-container text-error" : "bg-primary-container text-primary"
                    )}>
                      {domain.version}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                      domain.status === 'optimal' ? "text-green-600" : "text-amber-600"
                    )}>
                      {domain.status === 'optimal' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      <span className="text-[10px] font-black uppercase tracking-tighter">{domain.status === 'optimal' ? 'Optimal' : 'Issues'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="px-8 py-4 flex justify-between items-center bg-surface-container-low border-t border-outline-variant/10">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Displaying 4 of 12 Records</p>
          <div className="flex gap-1.5">
            <button className="h-8 min-w-[32px] px-2 flex items-center justify-center rounded-xl bg-primary text-on-primary text-[10px] font-bold shadow-md">1</button>
            <button className="h-8 min-w-[32px] px-2 flex items-center justify-center rounded-xl bg-surface hover:bg-surface-variant text-on-surface-variant text-[10px] font-bold transition-all">2</button>
            <button className="h-8 min-w-[32px] px-2 flex items-center justify-center rounded-xl bg-surface hover:bg-surface-variant text-on-surface-variant text-[10px] font-bold transition-all">3</button>
          </div>
        </footer>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: Cpu, title: 'PHP Extensions', desc: 'Configure modules like OPcache, Imagick, and Memcached for selected runtimes.' },
          { icon: Terminal, title: 'FPM Management', desc: 'Optimized PHP-FPM execution with high-concurrency pools and rapid recycling.' },
          { icon: Settings2, title: 'Error Reporting', desc: 'Adjust memory limits and execution timeouts globally or per virtual host.' },
        ].map((item, i) => (
          <div key={i} className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm hover:border-primary/30 transition-all group">
            <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
              <item.icon size={26} />
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-3">{item.title}</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6 font-medium">{item.desc}</p>
            <button className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline decoration-2 underline-offset-4">Manage Node →</button>
          </div>
        ))}
      </div>
    </div>
  );
};
