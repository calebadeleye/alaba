import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process restoration');
      }

      setSent(true);
      toast.success('Reset instructions sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request. Please try again.');
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

        <div className="flex justify-between items-center mb-8">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            User Login
          </Link>
          <Link 
            to="/admin" 
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors group"
          >
            Admin Login
            <RefreshCw size={12} className="group-hover:rotate-180 transition-transform" />
          </Link>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-display font-black tracking-tighter">Instructions Sent</h2>
              <p className="text-on-surface-variant font-medium text-sm">
                We've sent a secure reset link to <span className="text-primary font-bold">{email}</span>. Please check your inbox and follow the steps to restore access.
              </p>
            </div>
            <button 
              onClick={() => setSent(false)}
              className="w-full py-4 bg-surface-container-highest text-primary font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl border border-outline-variant hover:bg-primary hover:text-on-primary transition-all"
            >
              Didn't receive it? Resend
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface">Forgot Access?</h1>
              <p className="text-on-surface-variant font-medium text-sm">Enter your registered email to receive a restoration link.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Account Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    placeholder="john@example.com"
                    disabled={loading}
                  />
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
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {loading ? 'Processing...' : 'Send Recovery Link'}
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
