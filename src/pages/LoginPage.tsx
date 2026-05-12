import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Globe,
  LayoutGrid,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AccountService } from '../services/api';

interface LoginPageProps {
  onLogin?: (user: any) => void;
  isAdmin?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isAdmin = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password: show2FA ? undefined : password,
          code: show2FA ? twoFactorCode : undefined
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 202 && result.twoFactorRequired) {
        setShow2FA(true);
        toast.info(result.message || "Multi-Factor Authentication required. Check your email for a verification code.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'Invalid email or password');
      }

      const { user, token } = result;

      // Special check for /admin entry point
      if (isAdmin && user.role !== 'admin') {
        const adminError = 'Privileged access required for this entry point.';
        setError(adminError);
        toast.error(adminError);
        return;
      }

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (onLogin) onLogin(user);
      
      toast.success(`Welcome back, ${user.full_name}. Access Granted.`);
      
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/accounts/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Identity Mismatch. Authentication Failed.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex selection:bg-primary selection:text-on-primary">
      {/* Left Decoration - Branding */}
      <div className={cn(
        "hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-20",
        isAdmin ? "bg-primary/5 shadow-inner" : "bg-surface-container-high"
      )}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary rounded-full blur-[200px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary rounded-full blur-[150px] translate-y-1/2 -translate-x-1/3" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-xl shadow-primary/20">
              <Cpu size={24} />
            </div>
            <span className="text-2xl font-display font-black tracking-tighter uppercase text-on-surface">Alaba</span>
          </div>
          
          <h1 className="text-7xl font-display font-black tracking-tighter text-on-surface leading-[0.9] mb-8">
            {isAdmin ? "OPERATOR\nCONSOLE\nACCESS." : "QUANTUM\nHOSTING\nFABRIC."}
          </h1>
          
          <div className="space-y-6 max-w-sm">
            <div className="flex gap-4">
              <div className="p-3 bg-surface border border-outline-variant rounded-2xl shrink-0">
                <Globe size={20} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                Global Anycast network spans 120+ edge locations for sub-30ms latency.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="p-3 bg-surface border border-outline-variant rounded-2xl shrink-0">
                <ShieldCheck size={20} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                Identity-aware access control and automated threat neutralization.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-10 items-center">
            <div className="space-y-1">
                <div className="text-2xl font-display font-black text-on-surface">{isAdmin ? "ROOT" : "99.9%"}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{isAdmin ? "Access Level" : "Cluster Uptime"}</div>
            </div>
            <div className="space-y-1">
                <div className="text-2xl font-display font-black text-on-surface">{isAdmin ? "ENCRYPTED" : "1.2ms"}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{isAdmin ? "Channel" : "Response Core"}</div>
            </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-surface">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-10"
        >
          <header className="text-center lg:text-left space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2">
              {isAdmin ? "Admin Gateway" : "User Portal"}
            </div>
            <h2 className="text-4xl font-display font-black tracking-tighter uppercase text-on-surface">Authentication</h2>
            <p className="text-on-surface-variant font-medium leading-relaxed">
              {isAdmin 
                ? "Verify your administrative keys to access the Alaba cluster management interface."
                : "Securely sign in to manage your hosting clusters and service subscriptions."}
            </p>
          </header>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {!show2FA ? (
                  <motion.div 
                    key="login-fields"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
                      <div className="relative overflow-hidden group">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={20} />
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded-[1.5rem] pl-14 pr-6 py-5 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                          placeholder={isAdmin ? "admin@alaba.cloud" : "your@email.com"}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Password</label>
                        <Link to="/forgot-password" title="Restore Identity Access" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Forgot Password?</Link>
                      </div>
                      <div className="relative overflow-hidden group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={20} />
                        <input 
                          type="password" 
                          required={!show2FA}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded-[1.5rem] pl-14 pr-6 py-5 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="2fa-field"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Verification Code (2FA)</label>
                    <div className="relative overflow-hidden group">
                      <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={20} />
                      <input 
                        type="text" 
                        required
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant rounded-[1.5rem] pl-14 pr-6 py-5 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all tracking-[0.5em] text-center"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                    <div className="flex flex-col gap-1 px-1">
                      <p className="text-[10px] font-medium text-on-surface-variant italic leading-relaxed">
                        Enter the 6-digit synchronization code sent to your email. 
                      </p>
                      <button type="button" onClick={() => setShow2FA(false)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline self-end mt-1">Back to Login</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-primary text-on-primary rounded-[1.5rem] font-display font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{show2FA ? "Validating Code..." : "Verifying Identity..."}</span>
                </>
              ) : (
                <>
                  {show2FA ? "Verify Code" : (isAdmin ? "Unlock Operator Panel" : "Establish Connection")}
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-error">
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <footer className="text-center pt-10 border-t border-outline-variant/30">
            <p className="text-xs font-bold text-on-surface-variant mb-4 uppercase tracking-widest">Global Node Access</p>
            <div className="flex justify-center gap-6">
              {[
                { label: 'E-Register', icon: LayoutGrid, path: '/register' },
                isAdmin ? { label: 'User Login', icon: User, path: '/login' } : { label: 'Admin Access', icon: ShieldCheck, path: '/admin' },
                { label: 'Reset Access', icon:RefreshCw, path: '/forgot-password' }
              ].filter((i): i is any => !!i).map((link) => (
                <button 
                  key={link.label}
                  onClick={() => link.path !== '#' && navigate(link.path)}
                  className="flex items-center gap-2 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                    <link.icon size={14} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{link.label}</span>
                </button>
              ))}
            </div>
          </footer>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
