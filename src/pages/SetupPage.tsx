import React, { useState, useEffect } from 'react';
import { Database, Server, User, Key, Globe, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, AlabaIcon } from '../lib/utils';
import { AccountService } from '../services/api';

export default function SetupPage() {
  const [config, setConfig] = useState({
    host: 'db',
    port: '3306',
    user: '',
    password: '',
    database: 'alaba_cluster'
  });

  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverStatus, setServerStatus] = useState<any>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        setServerStatus(data);
        if (!data.setupMode && data.dbConfigured) {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Failed to check setup status');
      }
    }
    checkStatus();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/setup/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to configure database');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <header className="text-center mb-10 space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border border-primary/20 p-2">
              <AlabaIcon className="w-full h-full" />
            </div>
          </div>
          <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface uppercase">Alaba Setup</h1>
          <p className="text-on-surface-variant font-medium text-sm tracking-wide">
            Link your Alaba node to a high-performance MySQL cluster.
          </p>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "bg-surface-container rounded-3xl p-8 border transition-colors duration-500",
            status === 'success' ? "border-primary/50 shadow-2xl shadow-primary/10" : "border-outline-variant shadow-xl"
          )}
        >
          {status === 'success' ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center mx-auto shadow-xl shadow-primary/30">
                <CheckCircle2 size={40} className="animate-in zoom-in duration-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-on-surface">Configuration Synchronized</h2>
                <p className="text-on-surface-variant font-medium">Node state has been persistent. Redirecting to gateway portal...</p>
              </div>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary opacity-50" />
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">DB Host</label>
                  <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                    <input 
                      type="text" 
                      value={config.host}
                      onChange={(e) => setConfig({...config, host: e.target.value})}
                      className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="db or localhost"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Port</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                    <input 
                      type="text" 
                      value={config.port}
                      onChange={(e) => setConfig({...config, port: e.target.value})}
                      className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Shared Cluster Name (DB Name)</label>
                <div className="relative">
                  <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                  <input 
                    type="text" 
                    value={config.database}
                    onChange={(e) => setConfig({...config, database: e.target.value})}
                    className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="alaba_db"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                    <input 
                      type="text" 
                      value={config.user}
                      onChange={(e) => setConfig({...config, user: e.target.value})}
                      className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="alaba_user"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Password</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                    <input 
                      type="password" 
                      value={config.password}
                      onChange={(e) => setConfig({...config, password: e.target.value})}
                      className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {status === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-error/10 border border-error/20 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <AlertCircle className="text-error shrink-0 mt-0.5" size={18} />
                    <p className="text-error text-xs font-bold leading-relaxed">{errorMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={status === 'testing'}
                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
              >
                {status === 'testing' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Synchronizing...
                  </>
                ) : (
                  'Instantiate Environment'
                )}
              </button>
            </form>
          )}
        </motion.div>

        <footer className="mt-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant mb-2">Build Environment Version 4.0</p>
          <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed max-w-sm mx-auto">
            Configuring these parameters will automatically initialize the MySQL schema and establish persistent node connectivity.
          </p>
        </footer>
      </div>
    </div>
  );
}
