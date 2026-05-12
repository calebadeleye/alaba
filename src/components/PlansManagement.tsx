import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  CircleDollarSign as DollarSign, 
  Globe, 
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Coins
} from 'lucide-react';
import { AccountService } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import { Plan, GlobalSettings } from '../types';

export const PlansManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  const [newPlan, setNewPlan] = useState<Omit<Plan, 'id'>>({
    name: '',
    price: 0,
    specs: [''],
    currency: 'USD',
    disk_space_mb: 5120,
    bandwidth_mb: 10240,
    max_databases: 5,
    max_db_users: 5,
    max_email_accounts: 10,
    max_ftp_accounts: 10,
    max_addon_domains: 1,
    max_subdomains: 5,
    free_ssl: true,
    litespeed_enabled: true,
    redis_enabled: false,
    dedicated_ip_allowed: false,
    backups_enabled: true
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansData, settingsData] = await Promise.all([
        AccountService.getPlans(),
        AccountService.getGlobalSettings()
      ]);
      // Sync numerical fields from DB row properties or parse fallback from specs if needed
      setPlans(plansData);
      setSettings(settingsData);
    } catch (err) {
      toast.error('Failed to load plans and settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePlan = async () => {
    const validSpecs = newPlan.specs.filter(s => s.trim() !== '');
    
    if (!newPlan.name.trim()) {
      toast.error('Plan name cannot be empty');
      return;
    }
    if (newPlan.price <= 0) {
      toast.error('Price must be a positive number');
      return;
    }
    if (validSpecs.length === 0) {
      toast.error('At least one specification is required');
      return;
    }

    try {
      const created = await AccountService.createPlan({
        ...newPlan,
        specs: validSpecs
      });
      setPlans([...plans, created]);
      setIsAdding(false);
      setNewPlan({ name: '', price: 0, specs: [''], currency: settings?.defaultCurrency || 'USD' });
      toast.success('Plan created successfully');
    } catch (err) {
      toast.error('Failed to create plan');
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    
    const validSpecs = editingPlan.specs.filter(s => s.trim() !== '');

    if (!editingPlan.name.trim()) {
      toast.error('Plan name cannot be empty');
      return;
    }
    if (editingPlan.price <= 0) {
      toast.error('Price must be a positive number');
      return;
    }
    if (validSpecs.length === 0) {
      toast.error('At least one specification is required');
      return;
    }

    try {
      const updated = await AccountService.updatePlan(editingPlan.id, {
        ...editingPlan,
        specs: validSpecs
      });
      setPlans(plans.map(p => p.id === updated.id ? updated : p));
      setEditingPlan(null);
      toast.success('Plan updated successfully');
    } catch (err) {
      toast.error('Failed to update plan');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) return;
    try {
      await AccountService.deletePlan(id);
      setPlans(plans.filter(p => p.id !== id));
      toast.success('Plan deleted successfully');
    } catch (err) {
      toast.error('Failed to delete plan');
    }
  };

  const handleUpdateSettings = async (updates: Partial<GlobalSettings>) => {
    try {
      const updated = await AccountService.updateGlobalSettings(updates);
      setSettings(updated);
      toast.success('Global settings updated');
    } catch (err) {
      toast.error('Failed to update settings');
    }
  };

  const addSpecField = () => {
    if (editingPlan) {
      setEditingPlan({ ...editingPlan, specs: [...editingPlan.specs, ''] });
    } else {
      setNewPlan({ ...newPlan, specs: [...newPlan.specs, ''] });
    }
  };

  const updateSpec = (index: number, value: string) => {
    if (editingPlan) {
      const newSpecs = [...editingPlan.specs];
      newSpecs[index] = value;
      setEditingPlan({ ...editingPlan, specs: newSpecs });
    } else {
      const newSpecs = [...newPlan.specs];
      newSpecs[index] = value;
      setNewPlan({ ...newPlan, specs: newSpecs });
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-black tracking-tight text-on-surface uppercase">Plan Management</h1>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Configure service tiers and international pricing.</p>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={() => setIsAdding(!isAdding)}
             className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            {isAdding ? <AlertCircle size={14} /> : <Plus size={14} />}
            {isAdding ? 'Cancel Entry' : 'Create New Plan'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                <Globe size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Regional Pricing</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Service tiers are displayed in the Global Ledger currency ({settings?.defaultCurrency}).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Coins size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Automated Markup</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Currency equivalents are calculated automatically based on the user's detected region.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans List / Form */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {(isAdding || editingPlan) ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface border-2 border-primary/20 rounded-[3rem] p-8 md:p-10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 text-primary opacity-5 pointer-events-none">
                  <Package size={160} />
                </div>

                <div className="relative z-10 space-y-8">
                  <header>
                    <h3 className="text-2xl font-display font-black tracking-tighter uppercase">{editingPlan ? 'Edit Service Plan' : 'New Service Plan'}</h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">Populating node resources for deployment.</p>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Plan Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Alaba Pro Max"
                        value={editingPlan ? editingPlan.name : newPlan.name}
                        onChange={(e) => editingPlan 
                          ? setEditingPlan({ ...editingPlan, name: e.target.value })
                          : setNewPlan({ ...newPlan, name: e.target.value })
                        }
                        className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Price ({settings?.defaultCurrency})</label>
                      <div className="relative">
                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={editingPlan ? editingPlan.price : (newPlan.price || '')}
                          onChange={(e) => editingPlan
                            ? setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) })
                            : setNewPlan({ ...newPlan, price: parseFloat(e.target.value) })
                          }
                          className="w-full bg-surface border border-outline-variant rounded-2xl pl-10 pr-5 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* New Resource Limits Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Disk Space (MB)</label>
                      <input 
                        type="number"
                        value={editingPlan ? editingPlan.disk_space_mb : newPlan.disk_space_mb}
                        onChange={(e) => editingPlan 
                          ? setEditingPlan({ ...editingPlan, disk_space_mb: parseInt(e.target.value) || 0 })
                          : setNewPlan({ ...newPlan, disk_space_mb: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Bandwidth (MB)</label>
                      <input 
                        type="number"
                        value={editingPlan ? editingPlan.bandwidth_mb : newPlan.bandwidth_mb}
                        onChange={(e) => editingPlan 
                          ? setEditingPlan({ ...editingPlan, bandwidth_mb: parseInt(e.target.value) || 0 })
                          : setNewPlan({ ...newPlan, bandwidth_mb: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Databases Limit</label>
                      <input 
                        type="number"
                        value={editingPlan ? editingPlan.max_databases : newPlan.max_databases}
                        onChange={(e) => editingPlan 
                          ? setEditingPlan({ ...editingPlan, max_databases: parseInt(e.target.value) || 0 })
                          : setNewPlan({ ...newPlan, max_databases: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Mailboxes Limit</label>
                      <input 
                        type="number"
                        value={editingPlan ? editingPlan.max_email_accounts : newPlan.max_email_accounts}
                        onChange={(e) => editingPlan 
                          ? setEditingPlan({ ...editingPlan, max_email_accounts: parseInt(e.target.value) || 0 })
                          : setNewPlan({ ...newPlan, max_email_accounts: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Feature Flags */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-3 rounded-2xl bg-surface-variant/5 border border-outline-variant/30 px-5">
                    {[
                      { label: 'SSL', key: 'free_ssl' },
                      { label: 'Litespeed', key: 'litespeed_enabled' },
                      { label: 'Redis', key: 'redis_enabled' },
                      { label: 'Static IP', key: 'dedicated_ip_allowed' },
                      { label: 'Backups', key: 'backups_enabled' },
                    ].map((feature) => {
                      const isChecked = !!(editingPlan ? (editingPlan as any)[feature.key] : (newPlan as any)[feature.key]);
                      return (
                        <label key={feature.key} className="flex items-center gap-2.5 cursor-pointer group">
                          <div className="relative inline-flex items-center">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const val = e.target.checked;
                                if (editingPlan) {
                                  setEditingPlan({ ...editingPlan, [feature.key]: val });
                                } else {
                                  setNewPlan({ ...newPlan, [feature.key]: val });
                                }
                              }}
                              className="sr-only"
                            />
                            <div className={cn("w-7 h-4 rounded-full transition-colors", isChecked ? "bg-primary" : "bg-outline-variant")} />
                            <div className={cn("absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform", isChecked ? "translate-x-3" : "translate-x-0")} />
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant group-hover:text-primary transition-colors whitespace-nowrap">{feature.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Plan Features</label>
                      <button 
                        onClick={addSpecField}
                        className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 hover:underline"
                      >
                        <Plus size={12} /> Add Feature
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(editingPlan ? editingPlan.specs : newPlan.specs).map((spec, idx) => (
                        <div key={idx} className="relative group">
                          <input 
                            type="text"
                            placeholder="e.g. 50GB NVMe"
                            value={spec}
                            onChange={(e) => updateSpec(idx, e.target.value)}
                            className="w-full bg-surface-variant/20 border border-outline-variant/50 rounded-xl px-4 py-3 text-xs font-medium focus:ring-4 focus:ring-primary/5 outline-none transition-all pr-10"
                          />
                          {idx > 0 && (
                            <button 
                              onClick={() => {
                                if (editingPlan) {
                                  setEditingPlan({ ...editingPlan, specs: editingPlan.specs.filter((_, i) => i !== idx) });
                                } else {
                                  setNewPlan({ ...newPlan, specs: newPlan.specs.filter((_, i) => i !== idx) });
                                }
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button 
                      onClick={editingPlan ? handleUpdatePlan : handleCreatePlan}
                      className="flex-1 bg-primary text-on-primary py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      {editingPlan ? 'Save Changes' : 'Save'}
                    </button>
                    <button 
                      onClick={() => {
                        setIsAdding(false);
                        setEditingPlan(null);
                      }}
                      className="px-8 bg-surface border border-outline-variant rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-surface-variant transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group relative"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Package size={24} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-70">Starting at</p>
                        <h4 className="text-2xl font-display font-black tracking-tighter text-on-surface">
                          {formatCurrency(plan.price, settings?.defaultCurrency)}
                        </h4>
                      </div>
                    </div>

                    <h3 className="text-xl font-display font-black tracking-tight mb-2 uppercase">{plan.name}</h3>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 bg-surface-variant/10 p-3 rounded-2xl">
                      <div className="text-[9px] font-black uppercase text-on-surface-variant">
                        Disk: <span className="text-primary">{plan.disk_space_mb}MB</span>
                      </div>
                      <div className="text-[9px] font-black uppercase text-on-surface-variant">
                        BW: <span className="text-primary">{plan.bandwidth_mb}MB</span>
                      </div>
                      <div className="text-[9px] font-black uppercase text-on-surface-variant">
                        DBs: <span className="text-primary">{plan.max_databases}</span>
                      </div>
                      <div className="text-[9px] font-black uppercase text-on-surface-variant">
                        Emails: <span className="text-primary">{plan.max_email_accounts}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-8">
                      {plan.specs.map((spec, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-on-surface-variant font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                          {spec}
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-outline-variant/30 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 size={12} /> Active Tier
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingPlan(plan)}
                          className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2.5 text-on-surface-variant hover:text-error hover:bg-error/5 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {plans.length === 0 && (
                  <div className="col-span-full py-20 bg-surface-variant/20 rounded-[3rem] border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center">
                    <Package size={48} className="text-on-surface-variant mb-4 opacity-20" />
                    <h3 className="font-display font-black text-xl text-on-surface-variant uppercase tracking-tighter">No Active Tiers</h3>
                    <p className="text-sm text-on-surface-variant/60 font-medium">Create your first hosting plan to begin onboarding.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
