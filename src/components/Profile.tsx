/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  Mail, 
  Phone, 
  Globe,
  ChevronRight,
  Eye,
  EyeOff,
  Terminal,
  Zap,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AccountService } from '../services/api';

interface ProfileProps {
  onUpdateUser?: (user: any) => void;
}

export const Profile: React.FC<ProfileProps> = ({ onUpdateUser }) => {
  const navigate = useNavigate();
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!user?.two_factor_enabled);
  const [isToggling2FA, setIsToggling2FA] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await AccountService.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success("Password updated successfully. For security, please log in again.");
      
      // Logout logic
      setTimeout(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = user?.role === 'admin' ? '/admin' : '/login';
      }, 2000);
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    setIsToggling2FA(true);
    try {
      await AccountService.toggle2FA({ enabled: !twoFactorEnabled });
      
      // Update local storage and current component's user reference
      const updatedUser = { ...user, two_factor_enabled: !twoFactorEnabled ? 1 : 0 };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      if (onUpdateUser) onUpdateUser(updatedUser);
      setTwoFactorEnabled(!twoFactorEnabled);

      if (!twoFactorEnabled) {
        toast.success("2-Factor Authentication enabled. Secure login active.");
      } else {
        toast.info("2-Factor Authentication has been deactivated.");
      }
    } catch (err: any) {
      toast.error(err.message || "2FA modification failed");
    } finally {
      setIsToggling2FA(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-10">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
          Security & Identity
        </div>
        <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface">Account Profile</h1>
        <p className="text-on-surface-variant font-medium">Manage your security credentials and multi-factor authentication.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-container rounded-[2.5rem] p-8 border border-outline-variant/30 text-center space-y-6 shadow-xl"
          >
            <div className="relative inline-block">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-container rounded-[2rem] flex items-center justify-center text-on-primary font-display font-black text-3xl shadow-xl shadow-primary/20">
                {user?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 border-4 border-surface-container rounded-full" />
            </div>
            
            <div>
              <h2 className="text-xl font-display font-black tracking-tight">{user?.full_name}</h2>
              <p className="text-xs font-black uppercase tracking-widest text-primary mt-1">
                {user?.role === 'admin' ? 'System Administrator' : (user?.plan_name || 'Standard Flow')}
              </p>
            </div>

            <div className="space-y-4 pt-4 text-left">
              <div className="flex items-center gap-4 p-3 bg-surface rounded-2xl border border-outline-variant/30">
                <Mail size={18} className="text-primary opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Primary Email</p>
                  <p className="text-xs font-bold truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-surface rounded-2xl border border-outline-variant/30">
                <ShieldCheck size={18} className="text-primary opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Account Status</p>
                  <p className="text-xs font-bold truncate">Verified & Active</p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="bg-surface-container-highest p-8 rounded-[2.5rem] border border-outline-variant/30 space-y-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-display font-black tracking-tight">Security Score</h3>
            <p className="text-xs font-medium text-on-surface-variant leading-relaxed">Your account currently has <span className="text-primary font-bold">{twoFactorEnabled ? 'High' : 'Medium'}</span> security protection.</p>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: twoFactorEnabled ? '90%' : '45%' }}
                className={cn("h-full transition-all duration-1000", twoFactorEnabled ? "bg-green-500" : "bg-amber-500")}
              />
            </div>
          </div>
        </div>

        {/* Settings Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Password Change */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container rounded-[3rem] border border-outline-variant/30 shadow-2xl shadow-primary/5 overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-outline-variant/30 bg-surface/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-black tracking-tight">Access Credentials</h3>
                  <p className="text-xs font-medium text-on-surface-variant">Update your system login password</p>
                </div>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showCurrent ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      required
                      className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">New Password</label>
                  <div className="relative">
                    <input 
                      type={showNew ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      required
                      className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Confirm New Password</label>
                  <input 
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    required
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  disabled={isChangingPassword}
                  className="bg-primary text-on-primary px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {isChangingPassword ? <RefreshCw className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </motion.div>

          {/* 2FA Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container rounded-[3rem] border border-outline-variant/30 shadow-2xl shadow-primary/5 overflow-hidden"
          >
            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex gap-6 items-start">
                <div className={cn(
                  "w-16 h-16 rounded-[2rem] flex items-center justify-center shrink-0 shadow-lg transition-all",
                  twoFactorEnabled ? "bg-green-500 text-white shadow-green-500/20" : "bg-amber-100 text-amber-600 border border-amber-200"
                )}>
                  {twoFactorEnabled ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-display font-black tracking-tight">Multi-Factor Protocol</h3>
                  <p className="text-sm font-medium text-on-surface-variant max-w-sm leading-relaxed">
                    Elevate your account security by requiring a unique verification code sent to your email during authorization.
                  </p>
                </div>
              </div>

              <button 
                onClick={handleToggle2FA}
                disabled={isToggling2FA}
                className={cn(
                  "w-full md:w-auto px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                  twoFactorEnabled 
                    ? "bg-error/10 text-error hover:bg-error hover:text-white" 
                    : "bg-primary text-on-primary hover:scale-105 shadow-xl shadow-primary/20"
                )}
              >
                {isToggling2FA ? <RefreshCw className="animate-spin" size={16} /> : (twoFactorEnabled ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />)}
                <span>{twoFactorEnabled ? 'Deactivate 2FA' : 'Activate 2FA'}</span>
              </button>
            </div>

            {twoFactorEnabled && (
              <div className="px-8 pb-8">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Terminal size={14} />
                  </div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    2FA Status: <span className="font-black">Active Protection</span> • Verification codes will be sent to <span className="font-mono">{user?.email}</span>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
