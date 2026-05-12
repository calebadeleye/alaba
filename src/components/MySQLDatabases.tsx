/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Trash2, 
  UserPlus, 
  Settings, 
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  DatabaseZap,
  Hammer,
  LineChart,
  ChevronRight,
  ShieldCheck,
  Plus,
  Key,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { Account } from '../types';
import { toast } from 'sonner';

export const MySQLDatabases: React.FC = () => {
  const [databases, setDatabases] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [newDbName, setNewDbName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserPassConfirm, setNewUserPassConfirm] = useState('');
  
  const [assignDbId, setAssignDbId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [selectedPrivileges, setSelectedPrivileges] = useState<string[]>(['ALL PRIVILEGES']);

  const PRIVILEGES_LIST = [
    'ALL PRIVILEGES',
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'INDEX',
    'ALTER'
  ];

  const togglePrivilege = (priv: string) => {
    if (priv === 'ALL PRIVILEGES') {
      setSelectedPrivileges(['ALL PRIVILEGES']);
      return;
    }
    
    setSelectedPrivileges(prev => {
      const next = prev.filter(p => p !== 'ALL PRIVILEGES');
      if (next.includes(priv)) {
        return next.filter(p => p !== priv);
      } else {
        return [...next, priv];
      }
    });
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log('[MySQL] Fetching databases and accounts...');
      
      // Fetch accounts first as they are needed for the dropdown even if DBs fail
      let accountsData: Account[] = [];
      try {
        accountsData = await AccountService.getAccounts();
        console.log('[MySQL] Accounts received:', accountsData);
        setAccounts(accountsData || []);
        if (accountsData && accountsData.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accountsData[0].id);
        }
      } catch (accErr: any) {
        console.error('[MySQL] getAccounts failed:', accErr);
        toast.error('Failed to load hosting accounts: ' + accErr.message);
      }

      // Fetch databases
      try {
        const dbData = await AccountService.getSQLDatabases();
        console.log('[MySQL] Databases received:', dbData);
        setDatabases(dbData.databases || []);
        setDbUsers(dbData.users || []);
      } catch (dbErr: any) {
        console.error('[MySQL] getSQLDatabases failed:', dbErr);
        toast.error('SQL Cluster update failed: ' + dbErr.message);
      }
      
    } catch (err: any) {
      console.error('[MySQL] Global fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDbs = databases.filter(db => {
    if (!selectedAccountId) return false;
    const dbAccountId = db.hosting_account_id.toString();
    const selectedId = selectedAccountId.startsWith('db-') ? selectedAccountId.replace('db-', '') : selectedAccountId;
    return dbAccountId === selectedId;
  });

  const filteredUsers = dbUsers.filter(u => {
    if (!selectedAccountId) return false;
    const userAccountId = u.hosting_account_id.toString();
    const selectedId = selectedAccountId.startsWith('db-') ? selectedAccountId.replace('db-', '') : selectedAccountId;
    return userAccountId === selectedId;
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreateDatabase = async () => {
    if (!selectedAccountId) {
      toast.error('No hosting account selected. Please select an account at the top of the page.');
      return;
    }
    if (!newDbName.trim()) {
      toast.error('Please enter a database name');
      return;
    }
    
    try {
      const res = await AccountService.createDatabase({
        name: newDbName,
        hosting_account_id: selectedAccountId
      });
      toast.success(`Database ${res.mysqlDbName} provisioned successfully`);
      setNewDbName('');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create database');
    }
  };

  const handleCreateUser = async () => {
    if (!selectedAccountId) {
      toast.error('No hosting account selected. Please select an account at the top of the page.');
      return;
    }
    if (!newUserName.trim()) {
      toast.error('Please enter a database username');
      return;
    }
    if (!newUserPass) {
      toast.error('Please enter a password for the database user');
      return;
    }
    if (newUserPass !== newUserPassConfirm) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      const res = await AccountService.createDatabaseUser({
        user: newUserName,
        password: newUserPass,
        hosting_account_id: selectedAccountId
      });
      toast.success(`User ${res.mysqlDbUser} created successfully`);
      setNewUserName('');
      setNewUserPass('');
      setNewUserPassConfirm('');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    }
  };

  const handleAssignUser = async () => {
    if (!assignDbId || !assignUserId) {
      toast.error('Select both a database and a user');
      return;
    }
    if (selectedPrivileges.length === 0) {
      toast.error('Select at least one privilege');
      return;
    }

    try {
      await AccountService.assignUserToDatabase({
        database_id: parseInt(assignDbId),
        db_user_id: parseInt(assignUserId),
        privileges: selectedPrivileges
      });
      toast.success('Privileges assigned successfully');
      setAssignDbId('');
      setAssignUserId('');
      setSelectedPrivileges(['ALL PRIVILEGES']);
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Assignment failed');
    }
  };

  const handleDeleteDb = async (id: number, name: string) => {
    if (!confirm(`Are you SURE you want to DROP the database ${name}? This action is permanent and irreversible.`)) return;
    try {
      await AccountService.deleteDatabase(id);
      toast.success('Database dropped');
      fetchAllData();
    } catch (err) {
      toast.error('Failed to delete database');
    }
  };

  const handleOpenPMA = async (dbName: string) => {
    try {
      toast.loading("Initializing SSO session...", { id: 'pma-sso' });
      const { url } = await AccountService.getSSOPhpMyAdmin(dbName);
      window.open(url, '_blank');
      toast.success("Gateway opened", { id: 'pma-sso' });
    } catch (err: any) {
      const errorMsg = err.message || "SSO failed";
      toast.error(errorMsg, { id: 'pma-sso' });
    }
  };

  const handleDeleteUser = async (id: number, name: string) => {
    if (!confirm(`Permanently delete user ${name}?`)) return;
    try {
      await AccountService.deleteDatabaseUser(id);
      toast.success('User removed');
      fetchAllData();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const currentAccount = accounts.find(a => a.id === selectedAccountId);
  const prefix = currentAccount?.user ? `${currentAccount.user}_` : '..._';

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex gap-2 text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mb-2">
            <span>Server Alpha</span>
            <ChevronRight size={10} />
            <span className="text-primary">Databases</span>
          </nav>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-display font-bold tracking-tight text-on-surface">Databases</h1>
            <select 
              value={selectedAccountId} 
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-surface-container-high border border-outline-variant px-4 py-2 rounded-xl text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.domain} ({acc.user})</option>
              ))}
            </select>
          </div>
          <p className="text-on-surface-variant max-w-2xl mt-2 leading-relaxed">
            Manage your website's data storage and access for <span className="font-bold text-primary">{currentAccount?.domain || 'your accounts'}</span>.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* DB Creation Section */}
        <section className="lg:col-span-5">
          <div className="bg-surface-container p-8 rounded-[2.5rem] shadow-sm border border-outline-variant relative overflow-hidden group h-full flex flex-col">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-[100%] transition-colors group-hover:bg-primary/10" />
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary-container rounded-2xl text-primary shadow-sm border border-primary/20">
                  <Database size={24} />
                </div>
                <h3 className="text-xl font-bold font-display text-on-surface">Create Database</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest pl-1">Database Name</label>
                  <div className="flex items-center group/input">
                    <span className="bg-surface-container-high px-5 py-4 rounded-l-2xl font-mono text-sm text-primary font-bold border border-outline-variant border-r-0 truncate max-w-[120px]">{prefix}</span>
                    <input 
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-r-2xl py-4 px-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface outline-none" 
                      placeholder="e.g. wordpress_db" 
                      type="text"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleCreateDatabase}
              disabled={loading}
              className="mt-12 w-full bg-primary text-on-primary font-bold py-4 rounded-2xl shadow-xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              <span>Create Database</span>
            </button>
          </div>
        </section>

        {/* DB List Section */}
        <section className="lg:col-span-7">
          <div className="bg-surface-container rounded-[2.5rem] shadow-sm border border-outline-variant h-full flex flex-col overflow-hidden min-h-[400px]">
            <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-surface-container-high/50">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-primary" />
                <h3 className="text-xl font-bold font-display text-on-surface tracking-tight">Databases</h3>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant/30">
                    <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Database</th>
                    <th className="px-4 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Assigned Users</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <AnimatePresence mode='popLayout'>
                    {filteredDbs.map((db) => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={db.id} 
                        className="hover:bg-primary-container/5 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{db.mysql_db_name}</span>
                            <span className="text-[10px] text-on-surface-variant/60 font-medium">Original: {db.db_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-wrap gap-2">
                            {db.assignedUsers && db.assignedUsers.length > 0 ? db.assignedUsers.map((u: any, j: number) => (
                              <span key={j} className="text-[9px] font-black uppercase bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/30 text-on-surface-variant" title={u.privileges}>
                                {u.mysql_db_user}
                              </span>
                            )) : <span className="text-[10px] font-medium text-on-surface-variant/40 italic">None assigned</span>}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenPMA(db.mysql_db_name)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-xl"
                              title="Open phpMyAdmin"
                            >
                              <Database size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteDb(db.id, db.mysql_db_name)}
                              className="p-2 text-on-surface-variant hover:text-error transition-all hover:bg-error/10 rounded-xl"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}

                    {databases.length === 0 && !loading && (
                      <tr>
                        <td colSpan={3} className="px-8 py-12 text-center text-on-surface-variant/50 text-sm italic">
                          No databases found for this cluster node.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-8">
        <div className="flex items-center gap-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-outline-variant/30" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">User Credential Manager</h3>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-outline-variant/30" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Create User */}
          <div className="bg-surface-container p-8 rounded-[2.5rem] border border-outline-variant shadow-sm group flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-secondary-container rounded-2xl text-secondary shadow-sm">
                  <UserPlus size={24} />
                </div>
                <h3 className="text-xl font-bold font-display text-on-surface">Add New User</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest pl-1">Username</label>
                  <div className="flex items-center group/input">
                    <span className="bg-surface-container-high px-4 py-3 rounded-l-2xl font-mono text-sm text-on-surface-variant border border-outline-variant border-r-0 truncate max-w-[100px]">{prefix}</span>
                    <input 
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-r-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-medium" 
                      placeholder="e.g. wp_admin" 
                      type="text"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant pl-1">Password</label>
                    <input 
                      value={newUserPass}
                      onChange={(e) => setNewUserPass(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none text-sm font-mono" 
                      placeholder="••••••••" 
                      type="password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant pl-1">Confirm</label>
                    <input 
                      value={newUserPassConfirm}
                      onChange={(e) => setNewUserPassConfirm(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none text-sm font-mono" 
                      placeholder="••••••••" 
                      type="password"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleCreateUser}
              className="mt-8 w-full border-2 border-primary text-primary font-bold py-3.5 rounded-2xl hover:bg-primary hover:text-on-primary transition-all shadow-sm active:scale-[0.98]"
            >
              Create Database User
            </button>
          </div>

          {/* Current Users List */}
          <div className="bg-surface-container p-0 rounded-[2.5rem] border border-outline-variant shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-primary" />
                <h3 className="text-xl font-bold font-display text-on-surface">MySQL Users</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[350px]">
              <table className="w-full text-left">
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-primary-container/5 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{user.mysql_db_user}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <button 
                            onClick={() => handleDeleteUser(user.id, user.mysql_db_user)}
                            className="p-2 text-on-surface-variant hover:text-error transition-all hover:bg-error/10 rounded-xl"
                          >
                            <Trash2 size={14} />
                          </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td className="px-8 py-12 text-center text-on-surface-variant/40 text-xs italic font-medium">No SQL users provisioned</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assign Privileges */}
          <div className="bg-surface-container p-8 rounded-[2.5rem] border border-outline-variant shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -mr-8 -mt-8 rotate-12" />
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary-container rounded-2xl text-primary shadow-sm relative z-10">
                  <LinkIcon size={24} />
                </div>
                <h3 className="text-xl font-bold font-display text-on-surface relative z-10">Assign Privileges</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-4 relative z-10 leading-relaxed font-medium">Connect a user to a database with fine-grained control.</p>
              <div className="space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant pl-1">User</label>
                    <select 
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-3.5 px-4 font-bold text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select User</option>
                      {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.mysql_db_user}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-on-surface-variant pl-1">Database</label>
                    <select 
                      value={assignDbId}
                      onChange={(e) => setAssignDbId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-3.5 px-4 font-bold text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Database</option>
                      {filteredDbs.map(d => <option key={d.id} value={d.id}>{d.mysql_db_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant pl-1">Selected Privileges</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIVILEGES_LIST.map(priv => (
                      <button
                        key={priv}
                        onClick={() => togglePrivilege(priv)}
                        className={cn(
                          "px-2 py-2 rounded-lg text-[9px] font-black uppercase transition-all border",
                          selectedPrivileges.includes(priv) 
                            ? "bg-primary text-on-primary border-primary shadow-sm" 
                            : "bg-surface border-outline-variant/30 text-on-surface-variant hover:border-primary/50"
                        )}
                      >
                        {priv}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleAssignUser}
              className="mt-8 w-full bg-primary text-on-primary font-bold py-4 rounded-2xl shadow-xl hover:shadow-primary/20 transition-all group active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                Save & Grant Access
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

