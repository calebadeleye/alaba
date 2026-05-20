import React, { useState, useEffect } from 'react';
import { Database, Server, User, Key, Globe, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, AlabaIcon } from '../lib/utils';

export default function SetupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [config, setConfig] = useState({
    host: 'db',
    port: '3306',
    user: 'alaba_user',
    password: 'alaba_secret_pass',
    database: 'alaba_cluster'
  });

  const [adminConfig, setAdminConfig] = useState({
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    domain: 'alaba.ng'
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
        
        if (!data.setupMode) {
          window.location.href = '/login';
          return;
        }

        if (data.dbConnected) {
          // Skip database setup since it is pre-configured and connected!
          setStep(2);
        }
      } catch (err) {
        console.error('Failed to check setup status');
      }
    }
    checkStatus();
  }, []);

  const handleDbSetup = async (e: React.FormEvent) => {
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
        setStatus('idle');
        setStep(2);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to configure database');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred');
    }
  };

  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminConfig.password !== adminConfig.confirmPassword) {
      setStatus('error');
      setErrorMessage('Passwords do not match.');
      return;
    }
    setStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminConfig.email,
          fullName: adminConfig.fullName,
          password: adminConfig.password,
          domain: adminConfig.domain
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2500);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to configure administrator account');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred during admin setup');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <header className="text-center mb-8 space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border border-primary/20 p-2">
              <AlabaIcon className="w-full h-full" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-black tracking-tighter text-on-surface uppercase">Alaba Cluster Setup</h1>
          <p className="text-on-surface-variant font-medium text-xs tracking-wide max-w-sm mx-auto">
            {step === 1 
              ? "Link your local cloud node to a high-perf SQL Cluster."
              : "Instantiate the primary administrator core credentials and default namespaces."}
          </p>
        </header>

        {/* Wizard Progress Indication */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs font-bold text-outline">
          <span className={cn(
            "px-3 py-1.5 rounded-full transition-colors",
            step === 1 ? "bg-primary text-on-primary" : "bg-primary/20 text-primary"
          )}>
            1. SQL Setup
          </span>
          <ArrowRight size={14} className="text-outline-variant" />
          <span className={cn(
            "px-3 py-1.5 rounded-full transition-colors",
            step === 2 ? "bg-primary text-on-primary" : "bg-surface-container text-outline"
          )}>
            2. Admin Credentials
          </span>
        </div>

        <motion.div 
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
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
                <h2 className="text-2xl font-bold text-on-surface">Configuration Saved!</h2>
                <p className="text-on-surface-variant font-medium">Administrative node instantiated. Initializing portal...</p>
              </div>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary opacity-50" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form 
                  key="db-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleDbSetup} 
                  className="space-y-6"
                >
                  <div className="flex items-center gap-2 text-primary border-b border-outline-variant pb-3 mb-2">
                    <Database size={18} />
                    <h3 className="text-sm font-black uppercase tracking-wider">Database Connection Settings</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Database Host</label>
                      <div className="relative">
                        <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="text" 
                          required
                          value={config.host}
                          onChange={(e) => setConfig({...config, host: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="db"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Port</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="text" 
                          required
                          value={config.port}
                          onChange={(e) => setConfig({...config, port: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="3306"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Database Name</label>
                    <div className="relative">
                      <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                      <input 
                        type="text" 
                        required
                        value={config.database}
                        onChange={(e) => setConfig({...config, database: e.target.value})}
                        className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                        placeholder="alaba_db"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">DB Username</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="text" 
                          required
                          value={config.user}
                          onChange={(e) => setConfig({...config, user: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="root"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">DB Password</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="password" 
                          value={config.password}
                          onChange={(e) => setConfig({...config, password: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
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
                        Testing Connection...
                      </>
                    ) : (
                      'Save & Proceed'
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form 
                  key="admin-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleAdminSetup} 
                  className="space-y-5"
                >
                  <div className="flex items-center gap-2 text-primary border-b border-outline-variant pb-3 mb-2">
                    <ShieldCheck size={18} />
                    <h3 className="text-sm font-black uppercase tracking-wider">Primary Admin & System Domain</h3>
                  </div>

                  {/* Pre-configured DB Alert */}
                  {serverStatus?.dbConnected && (
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-start gap-3 mb-2">
                      <Database className="text-primary shrink-0 mt-0.5 animate-pulse" size={18} />
                      <div className="text-xs">
                        <p className="font-bold text-primary">Database Pre-Configured Successfully</p>
                        <p className="text-on-surface-variant font-medium mt-0.5">
                          A healthy connection to `alaba_cluster` was auto-detected from server environment.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Main Application Domain</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                      <input 
                        type="text" 
                        required
                        value={adminConfig.domain}
                        onChange={(e) => setAdminConfig({...adminConfig, domain: e.target.value})}
                        className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                        placeholder="alaba.ng or myhosting.io"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Admin Email Address</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="email" 
                          required
                          value={adminConfig.email}
                          onChange={(e) => setAdminConfig({...adminConfig, email: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="admin@alaba.ng"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Admin Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="text" 
                          required
                          value={adminConfig.fullName}
                          onChange={(e) => setAdminConfig({...adminConfig, fullName: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="System Admin"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Admin Password</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="password" 
                          required
                          minLength={6}
                          value={adminConfig.password}
                          onChange={(e) => setAdminConfig({...adminConfig, password: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Confirm Password</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                        <input 
                          type="password" 
                          required
                          value={adminConfig.confirmPassword}
                          onChange={(e) => setAdminConfig({...adminConfig, confirmPassword: e.target.value})}
                          className="w-full bg-surface border border-outline-variant pl-12 pr-4 py-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
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
                        Provisioning Core...
                      </>
                    ) : (
                      'Instantiate Account'
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          )}
        </motion.div>

        <footer className="mt-8 text-center text-[10px] uppercase text-outline">
          <p className="font-black tracking-[0.3em] text-on-surface-variant mb-2">Automated Container Deployment Active</p>
          <p className="text-on-surface-variant font-medium leading-relaxed max-w-sm mx-auto normal-case">
            Completing this instantiation will secure the control node, provision your root admin domain settings, and link files.
          </p>
        </footer>
      </div>
    </div>
  );
}
