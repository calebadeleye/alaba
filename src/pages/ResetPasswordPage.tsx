import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowLeft, RefreshCw, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing restoration token');
      navigate('/login');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to restore password');
      }

      setCompleted(true);
      toast.success('Password restored successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore access. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,var(--primary-container),transparent_40%),radial-gradient(circle_at_bottom_left,var(--secondary-container),transparent_40%)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface-container p-10 rounded-[2.5rem] shadow-2xl border border-outline-variant/30 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/20">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: loading ? '100%' : '0%' }}
            className="h-full bg-primary"
            transition={{ duration: 2, ease: "linear" }}
          />
        </div>

        {completed ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-display font-black tracking-tighter text-on-surface">Access Restored</h2>
              <p className="text-on-surface-variant font-medium text-sm">
                Your password has been updated securely. Redirecting you to login in a few seconds...
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Link 
                to="/login"
                className="w-full py-4 bg-surface-container-highest text-primary font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl flex items-center justify-center border border-outline-variant hover:bg-primary hover:text-on-primary transition-all shadow-sm"
              >
                User Login
              </Link>
              <Link 
                to="/admin"
                className="w-full py-4 bg-primary text-on-primary font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20"
              >
                Admin Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface">Secure Reset</h1>
              <p className="text-on-surface-variant font-medium text-sm">Please define a new strong password for your Alaba Cloud identity.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-12 pr-12 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black uppercase text-[10px] tracking-[0.2em] shadow-xl",
                  loading 
                    ? "bg-surface-variant text-on-surface-variant" 
                    : "bg-primary text-on-primary hover:scale-[1.02] active:scale-[0.98] shadow-primary/20"
                )}
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                {loading ? 'Restoring Access...' : 'Restore Access'}
              </button>
            </form>

            <div className="text-center">
              <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">
                Secure Identity Restoration Protocol v.4.0
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
