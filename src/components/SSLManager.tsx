/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  UploadCloud, 
  Zap, 
  AlertTriangle,
  History,
  Download,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  PieChart,
  ShieldAlert,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { toast } from 'sonner';

export const SSLManager: React.FC = () => {
  const [certificates, setCertificates] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [showInstallModal, setShowInstallModal] = React.useState(false);
  const [installData, setInstallData] = React.useState({
    hosting_account_id: '',
    domain: '',
    certificate: '',
    private_key: '',
    ca_bundle: ''
  });

  const [selectedCert, setSelectedCert] = React.useState<any>(null);

  const fetchCerts = async () => {
    try {
      const data = await AccountService.getSSLCertificates();
      setCertificates(data);
    } catch (err) {
      console.error('Failed to fetch certificates');
    }
  };

  const handleDownload = (cert: any) => {
    const content = `Certificate:\n${cert.certificate_text}\n\nPrivate Key:\n${cert.private_key_text}\n\nCA Bundle:\n${cert.ca_bundle_text || 'N/A'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssl-${cert.domain}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Certificate bundle downloaded');
  };

  const fetchAccounts = async () => {
    try {
      const data = await AccountService.getAccounts();
      setAccounts(data);
      if (data.length > 0 && !installData.hosting_account_id) {
        setInstallData(prev => ({ ...prev, hosting_account_id: data[0].id, domain: data[0].domain }));
      }
    } catch (err) {
      console.error('Failed to fetch accounts');
    }
  };

  React.useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchCerts(), fetchAccounts()]);
      setLoading(false);
    }
    init();
  }, []);

  const handleAutoSSL = async () => {
    if (accounts.length === 0) {
      toast.error('No accounts found to secure');
      return;
    }
    
    // For simplicity, we'll try to AutoSSL the first available account or show a selector if needed
    // Here we'll just use the first one for now or maybe better, iterate all?
    // Let's just do it for the first one for a demo.
    const account = accounts[0];
    try {
      setIsInstalling(true);
      toast.promise(AccountService.runAutoSSL(account.id), {
        loading: `Initiating AutoSSL for ${account.domain}...`,
        success: (res) => `AutoSSL task ${res.taskId} started. Certificate will be provisioned shortly.`,
        error: 'AutoSSL failed'
      });
      
      // Refresh after a delay
      setTimeout(fetchCerts, 6000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInstallCert = async () => {
    if (!installData.hosting_account_id || !installData.certificate || !installData.private_key) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsInstalling(true);
      await AccountService.installSSLCertificate(installData);
      toast.success('Certificate installed successfully');
      setShowInstallModal(false);
      fetchCerts();
    } catch (err: any) {
      toast.error(err.message || 'Installation failed');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-12 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Security Certificates</h1>
          <p className="text-on-surface-variant mt-1 max-w-xl">
            Keep your connection safe and private. Automatically manage security certificates for your domains.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleAutoSSL}
            disabled={isInstalling || loading}
            className="px-6 py-3 bg-surface-container text-primary font-bold text-sm rounded-xl border border-outline-variant hover:bg-surface-variant transition-all flex items-center gap-2 group disabled:opacity-50"
          >
            <Zap size={18} className={cn("group-hover:fill-primary transition-all", isInstalling && "animate-pulse")} />
            <span>Auto-Secure</span>
          </button>
          <button 
            onClick={() => setShowInstallModal(true)}
            className="px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <UploadCloud size={18} />
            <span>Install Certificate</span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container rounded-3xl w-full max-w-2xl overflow-hidden border border-outline-variant/30 shadow-2xl"
            >
              <div className="px-8 py-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">Install SSL Certificate</h2>
                    <p className="text-xs text-on-surface-variant">Paste your certificate details below</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInstallModal(false)}
                  className="p-2 hover:bg-surface-variant rounded-full transition-colors"
                  id="close-modal-btn"
                >
                  <MoreVertical size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Hosting Account</label>
                  <select 
                    value={installData.hosting_account_id}
                    onChange={(e) => {
                      const acc = accounts.find(a => a.id === e.target.value);
                      setInstallData({ ...installData, hosting_account_id: e.target.value, domain: acc?.domain || '' });
                    }}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.domain} ({acc.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Certificate (CRT)</label>
                  <textarea 
                    value={installData.certificate}
                    onChange={(e) => setInstallData({ ...installData, certificate: e.target.value })}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="w-full h-32 bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Private Key (KEY)</label>
                  <textarea 
                    value={installData.private_key}
                    onChange={(e) => setInstallData({ ...installData, private_key: e.target.value })}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    className="w-full h-32 bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Certificate Authority Bundle (Optional)</label>
                  <textarea 
                    value={installData.ca_bundle}
                    onChange={(e) => setInstallData({ ...installData, ca_bundle: e.target.value })}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="w-full h-32 bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                  />
                </div>
              </div>

              <div className="px-8 py-6 bg-surface-variant/5 border-t border-outline-variant/30 flex justify-end gap-3">
                <button 
                  onClick={() => setShowInstallModal(false)}
                  className="px-6 py-2.5 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-all rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleInstallCert}
                  disabled={isInstalling}
                  className="px-8 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isInstalling ? 'Installing...' : 'Install Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {selectedCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container rounded-3xl w-full max-w-2xl overflow-hidden border border-outline-variant/30 shadow-2xl"
            >
              <div className="px-8 py-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">Certificate Details</h2>
                    <p className="text-xs text-on-surface-variant">{selectedCert.domain}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCert(null)}
                  className="p-2 hover:bg-surface-variant rounded-full transition-colors"
                >
                  <MoreVertical size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-variant/10 p-4 rounded-xl border border-outline-variant/30">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">Issuer</span>
                    <span className="text-sm font-bold text-on-surface">{selectedCert.issuer}</span>
                  </div>
                  <div className="bg-surface-variant/10 p-4 rounded-xl border border-outline-variant/30">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">Expiry Date</span>
                    <span className="text-sm font-bold text-on-surface">{new Date(selectedCert.expiry_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Certificate Content</label>
                  <pre className="bg-surface-container-high p-4 rounded-xl border border-outline-variant text-[10px] text-on-surface-variant overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedCert.certificate_text || 'No certificate content stored.'}
                  </pre>
                </div>

                {selectedCert.ca_bundle_text && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">CA Bundle</label>
                    <pre className="bg-surface-container-high p-4 rounded-xl border border-outline-variant text-[10px] text-on-surface-variant overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">
                      {selectedCert.ca_bundle_text}
                    </pre>
                  </div>
                )}
              </div>

              <div className="px-8 py-6 bg-surface-variant/5 border-t border-outline-variant/30 flex justify-end gap-3">
                <button 
                  onClick={() => handleDownload(selectedCert)}
                  className="px-6 py-2.5 bg-surface-container text-primary font-bold text-sm rounded-xl border border-outline-variant hover:bg-surface-variant transition-all flex items-center gap-2"
                >
                  <Download size={18} />
                  <span>Download Bundle</span>
                </button>
                <button 
                  onClick={() => setSelectedCert(null)}
                  className="px-8 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 bg-surface-container p-8 rounded-3xl flex flex-col justify-between h-48 border border-outline-variant/30 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-[100%] transition-colors group-hover:bg-primary/10" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Active Coverage</span>
                <ShieldCheck className="text-primary" size={24} />
              </div>
              <div className="flex items-baseline gap-4 relative z-10">
                <span className="text-6xl font-display font-black text-primary leading-none tracking-tighter">
                  {certificates.length > 0 ? Math.round((certificates.filter(c => c.status === 'healthy').length / certificates.length) * 100) : 0}%
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface">Secure Domains</span>
                  <span className="text-xs text-on-surface-variant">{certificates.filter(c => c.status === 'healthy').length} of {certificates.length} domains secured</span>
                </div>
              </div>
            </div>

            <div className="bg-error-container/10 p-8 rounded-3xl flex flex-col justify-between h-48 border border-error/10 hover:bg-error-container/20 transition-all cursor-default group">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-widest text-error">Expiring Soon</span>
                <AlertTriangle className="text-error group-hover:animate-bounce" size={24} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-display font-black text-error leading-none tracking-tighter">
                  {certificates.filter(c => c.status === 'warning').length.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] font-black text-error mb-2 uppercase tracking-widest bg-error/10 px-2 py-0.5 rounded-full">Critical</span>
              </div>
            </div>

            <div className="bg-surface-container p-8 rounded-3xl flex flex-col justify-between h-48 border border-outline-variant/30 shadow-sm group">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Issuer Mix</span>
                <PieChart className="text-secondary" size={24} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {['LE', 'CS', '+'].map((init, i) => (
                    <div key={i} className={cn(
                      "w-10 h-10 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold transition-transform group-hover:translate-x-1",
                      i === 0 ? "bg-primary text-on-primary" : i === 1 ? "bg-secondary text-on-secondary" : "bg-surface-container-high text-on-surface-variant"
                    )}>
                      {init}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-bold text-on-surface-variant">Mixed Issuers</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container rounded-3xl border border-outline-variant/30 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-variant/10">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Domain Domain</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Issuer / Type</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Expiration</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant text-right">Protection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {certificates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-on-surface-variant italic">No SSL certificates found.</td>
                    </tr>
                  ) : (
                    certificates.map((cert, index) => (
                      <tr key={index} className="group hover:bg-surface-variant/5 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                              cert.status === 'healthy' ? "bg-green-500/10 text-green-600" : 
                              cert.status === 'warning' ? "bg-amber-500/10 text-amber-600" :
                              "bg-red-500/10 text-red-600"
                            )}>
                              <ShieldCheck size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-on-surface">{cert.domain}</div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-0.5">{cert.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-medium text-on-surface">{cert.issuer}</div>
                          <div className="text-xs text-on-surface-variant">{cert.type}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-medium text-on-surface">{new Date(cert.expiry_date).toLocaleDateString()}</div>
                          <div className={cn(
                            "text-[10px] font-bold mt-1 inline-block px-2 py-0.5 rounded-full",
                            cert.status === 'healthy' ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                          )}>
                            {cert.remaining}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             <button 
                               onClick={() => setSelectedCert(cert)}
                               className="p-2 hover:bg-surface-variant rounded-lg transition-colors text-on-surface-variant"
                               title="View Certificate Details"
                             >
                               <Info size={18} />
                             </button>
                             <button 
                               onClick={() => handleDownload(cert)}
                               className="p-2 hover:bg-surface-variant rounded-lg transition-colors text-on-surface-variant"
                               title="Download Certificate Bundle"
                             >
                               <Download size={18} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
