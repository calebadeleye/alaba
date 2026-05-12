/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Activity, 
  Database, 
  Terminal as TerminalIcon,
  HelpCircle,
  Menu,
  ChevronRight,
  FolderOpen,
  Mail,
  ShieldCheck,
  Network,
  Settings2,
  CalendarClock,
  UserPlus,
  Banknote,
  Package,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { type Screen, type AppMode } from '../types';
import { useNavigate } from 'react-router-dom';
import { AlabaIcon } from '../lib/utils';

interface SidebarProps {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
  isOpen: boolean;
  toggle: () => void;
  mode: AppMode;
  onExitCPanel: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentScreen, 
  setScreen, 
  isOpen, 
  toggle, 
  mode, 
  onExitCPanel 
}) => {
  const navigate = useNavigate();
  const whmItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Server Dashboard', adminOnly: true },
    { id: 'accounts', icon: Users, label: 'Account Management', adminOnly: false },
    { id: 'ips', icon: Globe, label: 'Internet Addresses', adminOnly: true },
    { id: 'dns-config', icon: Network, label: 'DNS Cluster', adminOnly: true },
    { id: 'configuration', icon: Settings, label: 'System Settings', adminOnly: true },
    { id: 'finance', icon: Banknote, label: 'Financial Records', adminOnly: true },
    { id: 'plans', icon: Package, label: 'Service Plans', adminOnly: true },
    { id: 'services', icon: Activity, label: 'Service Status', adminOnly: true },
    { id: 'backups', icon: Database, label: 'Backups & Recovery', adminOnly: false },
    { id: 'terminal', icon: TerminalIcon, label: 'Terminal Shell', adminOnly: true },
  ];

  const cpanelItems = [
    { id: 'cpanel-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'file-manager', icon: FolderOpen, label: 'File Manager' },
    { id: 'databases', icon: Database, label: 'Databases' },
    { id: 'email-accounts', icon: Mail, label: 'Email Accounts' },
    { id: 'ssl-manager', icon: ShieldCheck, label: 'Security Certificates' },
    { id: 'dns-editor', icon: Network, label: 'Domain Setup' },
    { id: 'php-config', icon: Settings2, label: 'Engine Versions' },
    { id: 'cron-jobs', icon: CalendarClock, label: 'Auto-Commands' },
  ];

  // Get user from localStorage to filter roles
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user?.role === 'admin';

  // Admin gets EVERYTHING in WHM mode. 
  // Customers only get WHM items marked with adminOnly: false (like Accounts if they have multiple, or Backups)
  // Actually, customers should probably only see 'accounts' in WHM mode if we use it as their dashboard.
  let menuItems = mode === 'whm' 
    ? whmItems.filter(item => isAdmin || !item.adminOnly) 
    : cpanelItems;

  // For admins in CPanel mode, we actually want to show WHM items as well for easy jumping
  // but we should categorize them or just prepend them.
  const displayItems = (mode === 'cpanel' && isAdmin) 
    ? [...whmItems, { type: 'divider', label: 'Account Management' }, ...cpanelItems]
    : menuItems;

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-outline-variant/10 transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-20",
        !isOpen && "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex items-center h-16 px-6 gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg overflow-hidden border border-white/10">
          <AlabaIcon className="w-full h-full" />
        </div>
        {isOpen && (
          <div className="flex flex-col">
            <span className="text-on-sidebar font-display font-bold text-lg tracking-tight leading-none">Alaba</span>
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1">{mode === 'whm' ? 'Hosting Admin' : 'Client'} Interface</span>
          </div>
        )}
      </div>

      <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-8">
        {displayItems.map((item: any, idx) => {
          if (item.type === 'divider') {
            return isOpen ? (
              <div key={`divider-${idx}`} className="px-3 pt-6 pb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-sidebar/40 leading-none">
                  {item.label}
                </p>
              </div>
            ) : (
              <div key={`divider-${idx}`} className="mx-4 my-4 border-t border-outline-variant/10" />
            );
          }

          const isActive = currentScreen === item.id || (item.id === 'accounts' && (currentScreen as string) === 'details');
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'cpanel-dashboard') {
                   setScreen('cpanel' as Screen);
                } else {
                   setScreen(item.id as Screen);
                }
              }}
              className={cn(
                "w-full flex items-center h-12 gap-4 px-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "bg-primary text-on-primary shadow-lg" 
                  : "text-on-sidebar hover:bg-on-sidebar/10"
              )}
            >
              <item.icon className={cn("w-5 h-5 min-w-[20px] transition-all", isActive ? "scale-110" : "opacity-80 group-hover:scale-110")} />
              {isOpen && (
                <span className="flex-1 text-left font-medium text-sm whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              )}
              {isActive && isOpen && <ChevronRight className="w-4 h-4 opacity-50" />}
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-on-primary rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-outline-variant/10 space-y-1 shrink-0">
        {mode === 'cpanel' && isAdmin && (
          <button 
            onClick={onExitCPanel}
            className="w-full flex items-center h-12 gap-4 px-3 rounded-xl text-primary font-bold hover:bg-primary/10 transition-all duration-200 mb-2"
          >
            <Menu className="w-5 h-5 opacity-80" />
            {isOpen && <span className="text-sm uppercase tracking-widest leading-none translate-y-[1px]">Return to Admin</span>}
          </button>
        )}
        <button 
          onClick={() => {
            setScreen('support' as Screen);
            navigate(user?.role === 'admin' ? '/admin/support' : '/accounts/support');
          }}
          className="w-full flex items-center h-12 gap-4 px-3 rounded-xl text-on-sidebar/60 hover:text-on-sidebar hover:bg-on-sidebar/5 transition-all duration-200"
        >
          <HelpCircle className="w-5 h-5 opacity-80" />
          {isOpen && <span className="font-medium text-sm">Support Center</span>}
        </button>
      </div>
    </aside>
  );
};
