/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AccountManagement } from './components/AccountManagement';
import { AccountDetails } from './components/AccountDetails';
import { ServiceManager } from './components/ServiceManager';
import { BackupsRecovery } from './components/BackupsRecovery';
import { TerminalShell } from './components/TerminalShell';
import { ConfigurationHub } from './components/ConfigurationHub';
import { IPManagement } from './components/IPManagement';
import { CPanelDashboard } from './components/CPanelDashboard';
import { FileManager } from './components/FileManager';
import { EmailManagement } from './components/EmailManagement';
import { MySQLDatabases } from './components/MySQLDatabases';
import { MultiPHPManager } from './components/MultiPHPManager';
import { SSLManager } from './components/SSLManager';
import { DNSZoneEditor } from './components/DNSZoneEditor';
import { CronJobs } from './components/CronJobs';
import { Profile } from './components/Profile';
import { SupportCenter } from './components/SupportCenter';
import { TicketDetails } from './components/TicketDetails';
import { RegistrationWizard } from './components/RegistrationWizard';
import { TawkToScript } from './components/TawkToScript';
import { DNSConfiguration } from './components/DNSConfiguration';
import { FinanceManagement } from './components/FinanceManagement';
import { PlansManagement } from './components/PlansManagement';
import { UserDashboard } from './components/UserDashboard';
import LoginPage from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import SuccessPage from './pages/SuccessPage';
import { type Screen, type AppMode, type Account } from './types';
import { AccountService } from './services/api';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { cn } from './lib/utils';

const AccountDetailsWrapper = ({ onBack }: { onBack: () => void }) => {
  const { id } = useParams<{ id: string }>();
  return <AccountDetails accountId={id || ''} onBack={onBack} />;
};

const CPanelDashboardRoute = ({ accounts, onNavigate }: { accounts: Account[], onNavigate: (aid: string, s: string) => void }) => {
  const { id } = useParams<{ id: string }>();
  const account = accounts.find(a => 
    String(a.id) === String(id) || 
    String(a.id).replace('db-', '') === String(id) ||
    String(id).replace('db-', '') === String(a.id)
  );
  if (!account) return <div className="p-8 text-on-surface-variant font-mono">Synchronizing environment state for node: {id}...</div>;
  return <CPanelDashboard account={account} onNavigate={(s) => onNavigate(id || '', s)} />;
};

const DNSZoneEditorRoute = ({ accounts }: { accounts: Account[] }) => {
  const { id } = useParams<{ id: string }>();
  const account = accounts.find(a => 
    String(a.id) === String(id) || 
    String(a.id).replace('db-', '') === String(id) ||
    String(id).replace('db-', '') === String(a.id)
  );
  if (!account) return <div className="p-8 text-on-surface-variant font-mono">Re-routing to regional DNS cluster...</div>;
  return <DNSZoneEditor account={account} />;
};

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'user' }) => {
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isAuthenticated = !!localStorage.getItem('auth_token');

  if (!isAuthenticated) {
    return <Navigate to={role === 'admin' ? "/admin" : "/login"} replace />;
  }

  // Allow admins to access user routes
  if (role === 'user' && user?.role === 'admin') {
    return <>{children}</>;
  }

  if (user?.role !== role) {
    return <Navigate to={role === 'admin' ? "/admin" : "/login"} replace />;
  }

  return <>{children}</>;
};

const MainLayout = ({ 
  children, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  currentScreen, 
  setCurrentScreen, 
  navigate, 
  mode, 
  user, 
  activeAccount, 
  theme, 
  toggleTheme, 
  isUserMenuOpen, 
  setIsUserMenuOpen,
  handleExitCPanel
}: { 
  children: React.ReactNode,
  isSidebarOpen: boolean,
  setIsSidebarOpen: (o: boolean) => void,
  currentScreen: Screen,
  setCurrentScreen: (s: Screen) => void,
  navigate: any,
  mode: AppMode,
  user: any,
  activeAccount: Account | null | undefined,
  theme: string,
  toggleTheme: () => void,
  isUserMenuOpen: boolean,
  setIsUserMenuOpen: (o: boolean) => void,
  handleExitCPanel: () => void
}) => (
  <div className="flex min-h-screen bg-surface selection:bg-primary/10 selection:text-primary transition-colors duration-300">
    <Sidebar 
      currentScreen={currentScreen} 
      setScreen={(screen) => {
        if (mode === 'cpanel' && activeAccount) {
          const cpanelScreens = ['cpanel-dashboard', 'file-manager', 'databases', 'email-accounts', 'ssl-manager', 'dns-editor', 'php-config', 'cron-jobs'];
          if (cpanelScreens.includes(screen)) {
            navigate(`/accounts/account/${activeAccount.id}/${screen}`);
          } else {
            navigate(user?.role === 'admin' ? `/admin/${screen}` : `/accounts/dashboard`);
          }
        } else {
          navigate(user?.role === 'admin' ? `/admin/${screen}` : `/accounts/dashboard`);
        }
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }} 
      isOpen={isSidebarOpen} 
      toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
      mode={mode}
      onExitCPanel={handleExitCPanel}
    />

    <AnimatePresence>
      {isSidebarOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        />
      )}
    </AnimatePresence>

    <main className={cn("flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0", isSidebarOpen ? "md:ml-64" : "md:ml-20")}>
      <header className="h-16 border-b border-outline-variant bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-surface-variant rounded-lg transition-colors text-on-surface-variant">
            <Menu size={20} />
          </button>
          <div className="relative hidden md:block">
            {mode === 'cpanel' && activeAccount && (
              <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mr-4", activeAccount.status === 'active' ? "bg-primary text-on-primary" : "bg-error text-on-error")}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", activeAccount.status === 'active' ? "bg-white" : "bg-white")} />
                Context: {activeAccount.domain}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search your dashboard..." 
                className="bg-surface-container border border-outline-variant pl-10 pr-4 py-2 rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all w-64 font-medium" 
                onChange={(e) => {
                  const query = e.target.value.toLowerCase();
                  if (!query) return;
                  
                  // Feature Search Logic
                  const features = [
                    { name: 'Accounts', id: 'accounts' },
                    { name: 'IPs', id: 'ips' },
                    { name: 'Services', id: 'services' },
                    { name: 'Backups', id: 'backups' },
                    { name: 'Finance', id: 'finance' },
                    { name: 'Plans', id: 'plans' },
                    { name: 'Files', id: 'file-manager' },
                    { name: 'Database', id: 'databases' },
                    { name: 'Email', id: 'email-accounts' },
                    { name: 'SSL', id: 'ssl-manager' },
                    { name: 'DNS', id: 'dns-editor' }
                  ];
                  
                  const found = features.find(f => f.name.toLowerCase().includes(query));
                  if (found) {
                    const savedUser = localStorage.getItem('user');
                    const user = savedUser ? JSON.parse(savedUser) : null;
                    if (user?.role === 'admin') {
                      navigate(`/admin/${found.id}`);
                    } else {
                      // Customers might need to be in a cPanel context for some
                      const cpanelScreens = ['file-manager', 'databases', 'email-accounts', 'ssl-manager', 'dns-editor', 'php-config', 'cron-jobs'];
                      if (cpanelScreens.includes(found.id) && activeAccount) {
                        navigate(`/accounts/account/${activeAccount.id}/${found.id}`);
                      } else {
                        navigate(`/accounts/dashboard`);
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2.5 hover:bg-surface-variant rounded-full transition-all text-on-surface-variant group relative">
            {theme === 'light' && <Sun size={20} />}
            {theme === 'dark' && <Moon size={20} />}
            {theme === 'gentle' && <Cloud size={20} />}
          </button>

          <button className="p-2.5 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant relative">
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-surface" />
          </button>
          
          <div className="h-8 w-px bg-outline-variant mx-2" />
          
          <div className="relative">
            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 p-1.5 hover:bg-surface-variant rounded-xl transition-colors">
              <div className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center font-bold text-sm">
                {user?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold leading-none">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest">{user?.role === 'admin' ? 'Super Admin' : 'Customer Account'}</p>
              </div>
              <ChevronDown size={14} className={cn("transition-transform duration-200", isUserMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-56 bg-surface-container rounded-2xl shadow-xl border border-outline-variant p-2 z-50">
                  <button 
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate(user?.role === 'admin' ? '/admin/profile' : '/accounts/profile');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface text-sm font-medium transition-colors"
                  >
                    <User size={18} />
                    Profile Settings
                  </button>
                  <hr className="my-2 border-outline-variant" />
                  <button onClick={() => { localStorage.removeItem('auth_token'); localStorage.removeItem('user'); window.location.href = user?.role === 'admin' ? '/admin' : '/login'; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-error/5 text-error text-sm font-bold transition-colors"><LogOut size={18} />Logout</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex-1">
        {children}
      </div>
    </main>
    <Toaster theme={theme === 'dark' ? 'dark' : theme === 'gentle' ? 'light' : 'light'} position="top-right" expand={true} richColors />
  </div>
);

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsAuthChecking(false);
  }, []);

  useEffect(() => {
    const isAuthenticated = !!localStorage.getItem('auth_token');
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function init() {
      try {
        const token = localStorage.getItem('auth_token');
        console.log(`[App] Initializing with token: ${token ? 'PRESENT' : 'MISSING'}`);
        const data = await AccountService.getAccounts();
        setAccounts(data);
      } catch (err: any) {
        // If 401, clear the invalid token
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        }
        console.error('Failed to load accounts');
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user?.email]);

  useEffect(() => {
    // Start closed on mobile, open on desktop
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const [mode, setMode] = useState<AppMode>('whm');
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'gentle'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved as 'light' | 'dark' | 'gentle';
      return 'dark'; // Set dark as default
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'gentle');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'gentle';
      return 'light';
    });
  };

  const location = useLocation();
  const navigate = useNavigate();

  // Sync screen with URL and determine mode/selectedAccount
  useEffect(() => {
    const path = location.pathname;
    
    if (path.includes('/admin/')) {
      setMode('whm');
      setSelectedAccountId(null);
      const screen = path.split('/admin/')[1] || 'dashboard';
      setCurrentScreen(screen as Screen);
    } else if (path.includes('/accounts/')) {
      const segments = path.split('/').filter(Boolean);
      // /accounts/dashboard OR /accounts/account/:id/screen
      if (segments[1] === 'dashboard') {
        setMode('whm');
        setSelectedAccountId(null);
        setCurrentScreen('accounts');
      } else if (segments[1] === 'account' && segments[2]) {
        const aid = segments[2];
        setSelectedAccountId(aid);
        setMode('cpanel');
        const screen = segments[3] || 'cpanel-dashboard';
        setCurrentScreen(screen as Screen);
      } else {
        // Fallback for /accounts
        setMode('whm');
        setSelectedAccountId(null);
        setCurrentScreen('accounts');
      }
    } else if (path === '/admin') {
       // login page handles this
    } else if (path === '/login') {
       // login page handles this
    }
  }, [location.pathname]);

  const handleSelectAccount = (id: string) => {
    if (user?.role === 'admin') {
      navigate(`/admin/account/${id}/details`);
    } else {
      navigate(`/accounts/account/${id}/cpanel-dashboard`);
    }
  };

  const handleExitCPanel = () => {
    if (user?.role === 'admin') {
      navigate('/admin/accounts');
    } else {
      navigate('/accounts/dashboard');
    }
  };

  const activeAccount = selectedAccountId ? accounts.find(a => String(a.id) === String(selectedAccountId)) : null;

  if (isAuthChecking) {
    return <div className="min-h-screen bg-surface flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-primary animate-pulse">Initializing Security Protocol...</div>;
  }

  return (
    <>
      <TawkToScript />
      <Routes>
        <Route path="/register/:step" element={<RegistrationWizard />} />
      <Route path="/register" element={<Navigate to="/register/1" replace />} />
      <Route path="/login" element={<LoginPage isAdmin={false} onLogin={(u) => setUser(u)} />} />
      <Route path="/admin" element={<LoginPage isAdmin={true} onLogin={(u) => setUser(u)} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/success" element={<SuccessPage />} />

      {/* Admin Protected Routes */}
      <Route path="/admin/*" element={
        <ProtectedRoute role="admin">
          <MainLayout
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            currentScreen={currentScreen}
            setCurrentScreen={setCurrentScreen}
            navigate={navigate}
            mode={mode}
            user={user}
            activeAccount={activeAccount}
            theme={theme}
            toggleTheme={toggleTheme}
            isUserMenuOpen={isUserMenuOpen}
            setIsUserMenuOpen={setIsUserMenuOpen}
            handleExitCPanel={handleExitCPanel}
          >
            <Routes>
              <Route path="dashboard" element={<Dashboard onNavigate={(s) => navigate(`/admin/${s}`)} />} />
              <Route path="accounts" element={<AccountManagement accounts={accounts} setAccounts={setAccounts} onSelectAccount={handleSelectAccount} />} />
              <Route path="account/:id/details" element={<AccountDetailsWrapper onBack={() => navigate('/admin/accounts')} />} />
              <Route path="services" element={<ServiceManager />} />
              <Route path="backups" element={<BackupsRecovery />} />
              <Route path="terminal" element={<TerminalShell />} />
              <Route path="configuration" element={<ConfigurationHub />} />
              <Route path="ips" element={<IPManagement />} />
              <Route path="dns-config" element={<DNSConfiguration />} />
              <Route path="finance" element={<FinanceManagement />} />
              <Route path="plans" element={<PlansManagement />} />
              <Route path="profile" element={<Profile onUpdateUser={setUser} />} />
              <Route path="support" element={<SupportCenter onViewTicket={(id) => navigate(`/admin/tickets/${id}`)} />} />
              <Route path="tickets/:id" element={<TicketDetails ticketId={Number(window.location.pathname.split('/').pop())} onBack={() => navigate('/admin/support')} />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </MainLayout>
        </ProtectedRoute>
      } />

      {/* User Protected Routes */}
      <Route path="/accounts/*" element={
        <ProtectedRoute role="user">
          <MainLayout
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            currentScreen={currentScreen}
            setCurrentScreen={setCurrentScreen}
            navigate={navigate}
            mode={mode}
            user={user}
            activeAccount={activeAccount}
            theme={theme}
            toggleTheme={toggleTheme}
            isUserMenuOpen={isUserMenuOpen}
            setIsUserMenuOpen={setIsUserMenuOpen}
            handleExitCPanel={handleExitCPanel}
          >
            <Routes>
              <Route path="dashboard" element={<UserDashboard accounts={accounts} onSelectAccount={handleSelectAccount} />} />
              <Route path="account/:id/cpanel-dashboard" element={<CPanelDashboardRoute accounts={accounts} onNavigate={(aid, s) => navigate(`/accounts/account/${aid}/${s}`)} />} />
              <Route path="account/:id/file-manager" element={<FileManager />} />
              <Route path="account/:id/email-accounts" element={<EmailManagement />} />
              <Route path="account/:id/databases" element={<MySQLDatabases />} />
              <Route path="account/:id/php-config" element={<MultiPHPManager />} />
              <Route path="account/:id/ssl-manager" element={<SSLManager />} />
              <Route path="account/:id/dns-editor" element={<DNSZoneEditorRoute accounts={accounts} />} />
              <Route path="account/:id/cron-jobs" element={<CronJobs />} />
              <Route path="profile" element={<Profile onUpdateUser={setUser} />} />
              <Route path="support" element={<SupportCenter onViewTicket={(id) => navigate(`/accounts/tickets/${id}`)} />} />
              <Route path="tickets/:id" element={<TicketDetails ticketId={Number(window.location.pathname.split('/').pop())} onBack={() => navigate('/accounts/support')} />} />
              <Route path="backups" element={<BackupsRecovery />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </MainLayout>
        </ProtectedRoute>
      } />

      {/* Root Redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
