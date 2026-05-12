/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Power, 
  Activity, 
  Terminal as TerminalIcon,
  Search,
  CheckCircle2,
  XCircle,
  RotateCw,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { type ServiceStatus } from '../types';

import { AccountService } from '../services/api';

export const ServiceManager: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = async () => {
    try {
      const data = await AccountService.getMonitoredServices();
      setServices(data);
    } catch (err) {
      console.error('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async (id: string, name: string) => {
    setServices(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'RESTARTING' } : s
    ));
    
    toast.info(`Restarting ${name}...`, {
      description: "Server is initializing the service environment."
    });

    try {
      await AccountService.restartService(id);
      await fetchServices();
      toast.success(`${name} restarted successfully`, {
        icon: <CheckCircle2 className="text-green-500" size={18} />
      });
    } catch (err) {
      toast.error(`Failed to restart ${name}`);
      fetchServices();
    }
  };

  const handleGlobalRestart = async () => {
    const promise = Promise.all(services.map(s => AccountService.restartService(s.id)));
    toast.promise(promise, {
      loading: 'Restarting all core services...',
      success: 'All services processed successfully',
      error: 'Failed to restart some services',
    });
    
    try {
      await promise;
    } catch (err) {
      console.error('Global restart error:', err);
    }
    fetchServices();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-on-surface">Service Manager</h1>
          <p className="text-on-surface-variant">Monitor and control core server daemons and services.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGlobalRestart}
            className="px-6 py-3 rounded-xl border border-outline-variant bg-surface-container text-on-surface font-bold hover:bg-surface transition-colors flex items-center gap-2"
          >
            <RotateCw size={20} className="text-primary" />
            <span>Restart All</span>
          </button>
          <button 
            onClick={fetchServices}
            className="px-6 py-3 rounded-xl border border-outline-variant bg-surface-container text-on-surface font-bold hover:bg-surface transition-colors flex items-center gap-2"
          >
            <RefreshCw size={20} className="text-primary" />
            <span>Refresh Status</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {services.map((service) => (
          <div key={service.id} className="bg-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant hover:border-primary/30 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-primary font-display font-bold text-xl group-hover:bg-primary-container transition-colors">
                {service.initial}
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                service.status === 'UP' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                service.status === 'RESTARTING' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {service.status === 'UP' ? <CheckCircle2 size={12} /> : 
                 service.status === 'RESTARTING' ? <RefreshCw size={12} /> : 
                 <XCircle size={12} />}
                {service.status}
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-0.5 text-on-surface">{service.name}</h3>
              <p className="text-xs text-on-surface-variant font-mono">v{service.version}</p>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-outline-variant/30 mb-6 font-medium">
              <span className="text-xs text-on-surface-variant">Uptime</span>
              <span className="text-xs font-mono font-bold text-on-surface">{service.uptime}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleRestart(service.id, service.name)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-outline-variant hover:bg-surface transition-colors text-sm font-bold text-on-surface disabled:opacity-50"
                disabled={service.status === 'RESTARTING'}
              >
                <Power size={16} />
                Restart
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-outline-variant hover:bg-surface transition-colors text-sm font-bold text-on-surface">
                <TerminalIcon size={16} />
                Logs
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      <div className="bg-tertiary text-on-tertiary p-8 rounded-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/10 rounded-xl">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Automatic Recovery</h2>
            <p className="text-on-tertiary/60 text-sm">Service monitoring is active. Will attempt restart if failure occurs.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs font-medium text-on-tertiary/50 mb-1">Last Recovery Event</p>
            <p className="font-bold">No events in last 24h</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs font-medium text-on-tertiary/50 mb-1">Monitoring Delay</p>
            <p className="font-bold">60 seconds</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs font-medium text-on-tertiary/50 mb-1">Max Restart Attempts</p>
            <p className="font-bold">5 per hour</p>
          </div>
        </div>
      </div>
    </div>
  );
};
