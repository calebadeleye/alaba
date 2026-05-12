import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  ArrowRight, 
  Download, 
  Globe, 
  Server, 
  LayoutGrid,
  Mail
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AccountService } from '../services/api';

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const domain = queryParams.get('domain') || 'your-domain.cloud';
  const plan = queryParams.get('plan') || 'Standard Flow';
  const [settings, setSettings] = React.useState<any>(null);

  useEffect(() => {
    toast.success('Payment Verified. Hosting Initialized.');
    AccountService.getGlobalSettings().then(setSettings);
  }, []);

  const nameservers = settings?.nameservers || [
    'ns1.alaba.ng',
    'ns2.alaba.ng'
  ];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 selection:bg-primary selection:text-on-primary">
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary rounded-full blur-[200px] -translate-y-1/2 translate-x-1/2 opacity-20" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-secondary rounded-full blur-[150px] translate-y-1/2 opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-2xl w-full bg-surface-container rounded-[3.5rem] shadow-2xl p-8 md:p-16 border border-outline-variant/30 text-center space-y-10 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
        
        <div className="space-y-6">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <CheckCircle2 size={48} />
            </motion.div>
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping opacity-30" />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase text-on-surface">Provisioning Successful</h1>
            <p className="text-on-surface-variant font-medium max-w-sm mx-auto">
              The Alaba cluster has successfully allocated resources for <span className="text-primary font-bold">{domain}</span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 p-6 bg-primary/5 border-2 border-primary/20 rounded-[2rem] text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Next Step: Nameserver Update</span>
              </div>
              <div className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded-md text-[8px] font-black uppercase tracking-widest">Awaiting Propagation</div>
            </div>
            <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
              To activate hosting for <span className="font-bold text-on-surface">{domain}</span>, you must update your current domain's nameservers at your registrar to pointing to Alaba DNS:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nameservers.map((ns, i) => (
                <div key={i} className="flex items-center justify-between bg-surface border border-outline-variant p-3 rounded-xl font-mono text-[10px]">
                  <span className="text-on-surface select-all">{ns}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(ns);
                      toast.success('Copied to clipboard');
                    }}
                    className="text-primary hover:scale-110 active:scale-95 transition-transform"
                  >
                    <LayoutGrid size={12} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-on-surface-variant/50 font-medium italic">
              * Propagation can take up to 48 hours. Alaba Edge SSL will activate automatically once propagated.
            </p>
          </div>
          <div className="p-6 bg-surface border border-outline-variant rounded-3xl text-left space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Server size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Active Tier</span>
            </div>
            <div className="text-lg font-display font-black uppercase text-on-surface">{plan}</div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant">
                <Globe size={12} /> Cluster Instance: alaba-ng-01
            </div>
          </div>
          <div className="p-6 bg-surface border border-outline-variant rounded-3xl text-left space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Mail size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Documentation</span>
            </div>
            <div className="text-xs font-medium leading-relaxed text-on-surface-variant">
                Login credentials and cluster documentation have been dispatched to your identity mailbox.
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <button 
             onClick={() => navigate('/')}
             className="w-full py-5 bg-primary text-on-primary rounded-2xl font-display font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Enter Management Console
            <ArrowRight size={18} />
          </button>
          
          <div className="flex gap-3">
             <button 
               onClick={() => {
                 const invoiceId = queryParams.get('invoiceId');
                 if (invoiceId) {
                   const url = `/api/invoices/${invoiceId}/download`;
                   window.location.href = url; // More direct for downloads
                   toast.success('Initiating invoice download...');
                 } else {
                   toast.error('Invoice ID not found. Please check your email.');
                 }
               }}
               className="flex-1 py-4 bg-surface-container-highest text-on-surface font-black uppercase text-[10px] tracking-widest rounded-2xl border border-outline-variant flex items-center justify-center gap-2 transition-all hover:bg-surface-variant active:scale-95"
             >
               <Download size={14} /> Download Invoice
             </button>
             <button className="flex-1 py-4 bg-surface-container-highest text-on-surface font-black uppercase text-[10px] tracking-widest rounded-2xl border border-outline-variant flex items-center justify-center gap-2 transition-all hover:bg-surface-variant">
               <LayoutGrid size={14} /> View All Subscriptions
             </button>
          </div>
        </div>

        <footer className="pt-4">
          <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Global Order ID: #ALB-{Math.random().toString(36).substring(7).toUpperCase()}</p>
        </footer>
      </motion.div>
    </div>
  );
};

export default SuccessPage;
