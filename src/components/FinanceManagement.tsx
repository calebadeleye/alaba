import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  CircleDollarSign, 
  PieChart, 
  ArrowUpRight,
  RefreshCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  XCircle,
  Settings,
  Percent,
  Calculator,
  Save,
  Activity,
  Coins,
  Download
} from 'lucide-react';
import { AccountService } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const FinanceManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<{ stats: any, records: any[] } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'gateways' | 'coupons' | 'pending'>('overview');
  const [gateways, setGateways] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);

  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    expiry_date: '',
    usage_limit: ''
  });

  const handleDownloadInvoice = (record: any) => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(0, 53, 68);
      doc.text("ALABA HOSTING - RECEIPT", 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Official Financial Settlement Record", 20, 32);
      
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`Customer: ${record.customerEmail}`, 20, 50);
      doc.text(`Domain: ${record.domain}`, 20, 57);
      doc.text(`Reference: ${record.id}`, 20, 64);
      doc.text(`Date: ${new Date(record.createdAt).toLocaleDateString()}`, 20, 71);
      
      autoTable(doc, {
        startY: 85,
        head: [['Description', 'Plan', 'Total']],
        body: [
          [`Hosting Subscription`, record.plan, `${formatCurrency(record.amountPaid, record.currency || 'USD')}`],
          [`VAT (7.5%)`, '-', `${formatCurrency(record.vat, record.currency || 'USD')}`],
          [`Transaction Fee`, '-', `${formatCurrency(record.transactionFee || 0, record.currency || 'USD')}`]
        ],
        foot: [['Grand Total', '', `${formatCurrency(Number(record.amountPaid) + Number(record.vat) + Number(record.transactionFee || 0), record.currency || 'USD')}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 53, 68] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      
      doc.save(`Alaba_Receipt_${record.domain}_${record.id}.pdf`);
      toast.success("Financial record exported to PDF");
    } catch (err) {
      console.error("Ledger export failed:", err);
      toast.error("Failed to generate PDF receipt");
    }
  };

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const financeData = await AccountService.getFinanceData();
      setData(financeData);
      const globalSettings = await AccountService.getGlobalSettings();
      setSettings(globalSettings);
      const gatewaySettings = await AccountService.getPaymentGateways();
      setGateways(gatewaySettings);
      const couponData = await AccountService.getCoupons();
      setCoupons(couponData);
      const pending = await AccountService.getPendingTransfers();
      setPendingTransfers(pending);
    } catch (err) {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to approve this manual settlement? This will initiate hosting cluster provisioning.")) return;
    try {
       await AccountService.approveTransfer(taskId);
       toast.success('Transfer approved. Provisioning initiated.');
       fetchFinance(); // Refresh
    } catch (err) {
       toast.error('Approval protocol failed');
    }
  };

  const handleRevert = async (taskId: string) => {
    if (!window.confirm("ARE YOU SURE? Reverting this approval will PURGE all provisioned records and halt any active setup for this domain.")) return;
    try {
       await AccountService.revertTransfer(taskId);
       toast.success('Approval reverted successfully.');
       fetchFinance(); // Refresh
    } catch (err) {
       toast.error('Reversion protocol failed');
    }
  };

  const updateSetting = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateGateway = (name: string, field: string, value: any) => {
    setGateways(prev => prev.map(g => g.name === name ? { ...g, [field]: value } : g));
  };

  const handleSaveGateway = async (gateway: any) => {
    try {
      await AccountService.updatePaymentGateway(gateway.name, gateway);
      toast.success(`${gateway.display_name} configuration updated`);
    } catch (err) {
      toast.error(`Failed to update ${gateway.display_name}`);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await AccountService.updateGlobalSettings(settings);
      toast.success('Configuration updated');
    } catch (err) {
      toast.error('Failed to update configurations');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCoupon = async () => {
    try {
      await AccountService.createCoupon(newCoupon);
      toast.success('Coupon created');
      setNewCoupon({ code: '', discount_type: 'percentage', discount_value: 0, expiry_date: '', usage_limit: '' });
      fetchFinance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create coupon');
    }
  };

  const handleDeleteCoupon = async (id: number) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await AccountService.deleteCoupon(id);
      toast.success('Coupon deleted');
      fetchFinance();
    } catch (err) {
      toast.error('Failed to delete coupon');
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const filteredRecords = data?.records.filter(r => 
    r.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.plan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-black tracking-tight text-on-surface">Financial Records</h1>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all",
                activeTab === 'overview' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              Overview & Ledger
            </button>
            <button 
              onClick={() => setActiveTab('gateways')}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all",
                activeTab === 'gateways' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              Payment Methods
            </button>
            <button 
              onClick={() => setActiveTab('coupons')}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all",
                activeTab === 'coupons' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              Discount Codes
            </button>
            <button 
              onClick={() => setActiveTab('pending')}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all",
                activeTab === 'pending' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              Pending Settlements
            </button>
          </div>
        </div>
        <button 
          onClick={fetchFinance}
          disabled={loading}
          className="flex items-center gap-2 bg-surface border border-outline-variant px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface-variant transition-all disabled:opacity-50"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Stats
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* ... stats grid ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary rounded-[2.5rem] p-8 text-on-primary shadow-xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform text-white">
                  <Coins size={80} strokeWidth={1} />
                </div>
                <div className="relative z-10 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">Total Income</p>
                  <h2 className="text-4xl font-display font-black tracking-tighter">{formatCurrency(data?.stats.totalNetProfit || 0, settings?.defaultCurrency || 'USD')}</h2>
                  <div className="flex items-center gap-2 text-[10px] bg-white/10 w-fit px-2 py-1 rounded-full border border-white/20">
                    <ArrowUpRight size={12} />
                    <span>+12.5% from last month</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 text-primary opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingUp size={80} strokeWidth={1} />
                </div>
                <div className="relative z-10 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Most Popular Package</p>
                  <h2 className="text-4xl font-display font-black tracking-tighter text-on-surface">{data?.stats.bestSelling}</h2>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">Majority Cluster Base</p>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 text-secondary opacity-10 group-hover:scale-110 transition-transform">
                  <PieChart size={80} strokeWidth={1} />
                </div>
                <div className="relative z-10 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary">Projected Income</p>
                  <h2 className="text-4xl font-display font-black tracking-tighter text-on-surface">{formatCurrency(data?.stats.expectedRevenue || 0, settings?.defaultCurrency || 'USD')}</h2>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">Fiscal Q2 Projection</p>
                </div>
              </motion.div>
            </div>

            {/* Global Config Section */}
            <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg leading-none">Global Ledger Config</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">Currency & Regional Standards</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Default System Currency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['USD', 'NGN', 'GBP', 'EUR'].map(curr => (
                      <button
                        key={curr}
                        onClick={() => updateSetting('defaultCurrency', curr)}
                        className={cn(
                          "py-3 rounded-xl border text-[10px] font-black transition-all",
                          settings?.defaultCurrency === curr
                            ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20"
                            : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-variant"
                        )}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center bg-surface-container rounded-2xl border border-dashed border-outline-variant p-6">
                   <div className="text-center">
                      <Activity size={24} className="text-primary/40 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Currency: {settings?.defaultCurrency}</p>
                   </div>
                </div>
              </div>
            </div>

            {/* Tax & Fee Configuration Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                      <Percent size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg leading-none">VAT Configuration</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">Value Added Tax Protocol</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateSetting('vatEnabled', !settings?.vatEnabled)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      settings?.vatEnabled 
                        ? "bg-green-500/10 text-green-600 border border-green-500/20" 
                        : "bg-error/5 text-error border border-error/20"
                    )}
                  >
                    {settings?.vatEnabled ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => updateSetting('vatType', 'percentage')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                        settings?.vatType === 'percentage' 
                          ? "bg-secondary/5 border-secondary text-secondary shadow-lg shadow-secondary/5" 
                          : "bg-surface border-outline-variant text-on-surface-variant grayscale"
                      )}
                    >
                      <Percent size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Percentage</span>
                    </button>
                    <button 
                      onClick={() => updateSetting('vatType', 'flat')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                        settings?.vatType === 'flat' 
                          ? "bg-secondary/5 border-secondary text-secondary shadow-lg shadow-secondary/5" 
                          : "bg-surface border-outline-variant text-on-surface-variant grayscale"
                      )}
                    >
                      <CircleDollarSign size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Flat Rate</span>
                    </button>
                  </div>

                  <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 mb-2 block">Tax Magnitude ({settings?.defaultCurrency})</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="number"
                        step="0.01"
                        value={settings?.vatAmount || 0}
                        onChange={(e) => updateSetting('vatAmount', parseFloat(e.target.value))}
                        className="flex-1 bg-transparent border-none p-0 text-3xl font-display font-black focus:ring-0 outline-none"
                      />
                      <div className="text-sm font-black text-on-surface-variant uppercase tracking-widest p-2 bg-surface rounded-xl border border-outline-variant min-w-[3rem] text-center">
                        {settings?.vatType === 'percentage' ? '%' : (settings?.defaultCurrency || 'USD')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Calculator size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg leading-none">Transaction Fee</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">Processing Fee Protocol</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateSetting('feeEnabled', !settings?.feeEnabled)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      settings?.feeEnabled 
                        ? "bg-green-500/10 text-green-600 border border-green-500/20" 
                        : "bg-error/5 text-error border border-error/20"
                    )}
                  >
                    {settings?.feeEnabled ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => updateSetting('feeType', 'percentage')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                        settings?.feeType === 'percentage' 
                          ? "bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5" 
                          : "bg-surface border-outline-variant text-on-surface-variant grayscale"
                      )}
                    >
                      <Percent size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Percentage</span>
                    </button>
                    <button 
                      onClick={() => updateSetting('feeType', 'flat')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                        settings?.feeType === 'flat' 
                          ? "bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5" 
                          : "bg-surface border-outline-variant text-on-surface-variant grayscale"
                      )}
                    >
                      <CircleDollarSign size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Flat Rate</span>
                    </button>
                  </div>

                  <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 mb-2 block">Fee Weight ({settings?.defaultCurrency})</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="number"
                        step="0.01"
                        value={settings?.feeAmount || 0}
                        onChange={(e) => updateSetting('feeAmount', parseFloat(e.target.value))}
                        className="flex-1 bg-transparent border-none p-0 text-3xl font-display font-black focus:ring-0 outline-none"
                      />
                      <div className="text-sm font-black text-on-surface-variant uppercase tracking-widest p-2 bg-surface rounded-xl border border-outline-variant">
                        {settings?.feeType === 'percentage' ? '%' : (settings?.defaultCurrency || 'USD')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pr-8">
              <button 
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex items-center gap-2 bg-primary text-on-primary px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-2xl hover:shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>

            <div className="bg-surface border border-outline-variant rounded-[3rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-outline-variant/50 bg-surface-variant/20 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-none">Transaction Log</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">Direct Account Ledger</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
                    <input 
                      type="text"
                      placeholder="Find account or plan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-surface border border-outline-variant pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                  </div>
                  <button className="p-2.5 bg-surface border border-outline-variant rounded-2xl hover:bg-surface-variant transition-all text-on-surface-variant">
                    <Filter size={18} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-variant/10">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap">Domain / Status</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap">Plan Tier</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap text-right">Amount Paid</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap text-right">VAT</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap text-right">Fee</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap text-right">Total</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap">Renewal Date</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {filteredRecords && filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-surface-variant/5 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <ArrowUpRight size={14} />
                              </div>
                              <div>
                                <p className="font-bold text-sm tracking-tight">{record.domain}</p>
                                <p className="text-[10px] text-on-surface-variant font-medium">ID: {record.accountId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-sm font-medium text-on-surface">
                            <span className="bg-surface-variant/50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-outline-variant/40">
                              {record.plan}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right font-display font-black text-on-surface">
                            {formatCurrency(record.amountPaid, record.currency || 'USD')}
                          </td>
                          <td className="px-8 py-6 text-right font-display font-bold text-on-surface-variant">
                            {formatCurrency(record.vat, record.currency || 'USD')}
                          </td>
                          <td className="px-8 py-6 text-right font-display font-bold text-on-surface-variant">
                            {formatCurrency(record.transactionFee || 0, record.currency || 'USD')}
                          </td>
                          <td className="px-8 py-6 text-right font-display font-black text-primary">
                            {formatCurrency(Number(record.amountPaid) + Number(record.vat) + Number(record.transactionFee || 0), record.currency || 'USD')}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-on-surface-variant">
                              <AlertCircle size={12} />
                              <span className="text-xs font-bold leading-none">{record.nextRenewal}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {record.refund > 0 ? (
                              <div className="flex items-center gap-2 text-error bg-error/5 px-3 py-1.5 rounded-xl border border-error/10 w-fit">
                                <RefreshCcw size={12} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Refunded: {formatCurrency(record.refund, record.currency || 'USD')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600 bg-green-500/10 px-3 py-1.5 rounded-xl border border-green-500/20 w-fit">
                                <CheckCircle2 size={12} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Settled</span>
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button
                               onClick={() => handleDownloadInvoice(record)}
                               className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                               title="Download PDF Receipt"
                             >
                                <Download size={16} />
                                Receipt
                             </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-8 py-20 text-center text-on-surface-variant text-xs font-medium italic opacity-50">
                          No financial transactions recorded in the ledger yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'coupons' && (
          <motion.div
            key="coupons"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-surface border border-outline-variant rounded-[2.5rem] p-8 shadow-sm">
               <h3 className="text-xl font-bold mb-6">Manage Promo Coupons</h3>
               <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1">Code</label>
                    <input 
                      type="text" 
                      value={newCoupon.code}
                      onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                      placeholder="ALABA50"
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-xs font-bold" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1">Type</label>
                    <select 
                      value={newCoupon.discount_type}
                      onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-xs font-bold"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="flat">Fixed Amount</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1">Value</label>
                    <input 
                      type="number" 
                      value={newCoupon.discount_value}
                      onChange={e => setNewCoupon({...newCoupon, discount_value: parseFloat(e.target.value) || 0})}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-xs font-bold" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1">Expiry</label>
                    <input 
                      type="date" 
                      value={newCoupon.expiry_date}
                      onChange={e => setNewCoupon({...newCoupon, expiry_date: e.target.value})}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-xs font-bold" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1">Usage Limit</label>
                    <input 
                      type="number" 
                      value={newCoupon.usage_limit}
                      onChange={e => setNewCoupon({...newCoupon, usage_limit: e.target.value})}
                      placeholder="∞"
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-xs font-bold" 
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={handleAddCoupon}
                      className="w-full bg-primary text-on-primary py-2 rounded-xl text-xs font-black uppercase tracking-widest"
                    >
                      Add Coupon
                    </button>
                  </div>
               </div>

               <div className="overflow-hidden border border-outline-variant rounded-2xl">
                  <table className="w-full text-left">
                    <thead className="bg-surface-variant/20">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Code</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Discount</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Uses</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Expiry</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {coupons.map(coupon => (
                        <tr key={coupon.id} className="hover:bg-surface-variant/5">
                          <td className="px-6 py-4 font-bold text-sm">{coupon.code}</td>
                          <td className="px-6 py-4 text-xs font-medium">
                            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${formatCurrency(coupon.discount_value, settings?.defaultCurrency || 'USD')}`}
                          </td>
                          <td className="px-6 py-4 text-xs font-medium">{coupon.times_used} / {coupon.usage_limit || '∞'}</td>
                          <td className="px-6 py-4 text-xs font-medium">{coupon.expiry_date ? new Date(coupon.expiry_date).toLocaleDateString() : 'Never'}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteCoupon(coupon.id)} className="text-error hover:underline text-[10px] font-black uppercase tracking-widest">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'gateways' && (
          <motion.div
            key="gateways"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {gateways.map((gateway) => (
                <div key={gateway.name} className="bg-surface border border-outline-variant rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col">
                  {/* ... gateway content ... */}
                  <div className="p-8 border-b border-outline-variant/30 flex justify-between items-center bg-surface-variant/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Coins size={24} />
                      </div>
                      <div>
                        <h4 className="font-display font-black text-xl">{gateway.display_name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Gateway Status</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => updateGateway(gateway.name, 'enabled', !gateway.enabled)}
                      className={cn(
                        "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        gateway.enabled 
                          ? "bg-green-500 text-white shadow-lg shadow-green-500/20" 
                          : "bg-surface-variant text-on-surface-variant border border-outline-variant"
                      )}
                    >
                      {gateway.enabled ? 'Live & Active' : 'Offline'}
                    </button>
                  </div>

                  <div className="p-8 space-y-6 flex-1">
                    {gateway.name !== 'bank_transfer' ? (
                      <>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Public Key</label>
                            <input 
                              type="text"
                              value={gateway.public_key || ''}
                              onChange={(e) => updateGateway(gateway.name, 'public_key', e.target.value)}
                              className="w-full bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 text-xs font-mono focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                              placeholder="pk_live_..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Secret Key</label>
                            <input 
                              type="password"
                              value={gateway.secret_key || ''}
                              onChange={(e) => updateGateway(gateway.name, 'secret_key', e.target.value)}
                              className="w-full bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 text-xs font-mono focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                              placeholder="sk_live_..."
                            />
                          </div>
                          {gateway.name === 'remita' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Merchant Contract Code</label>
                              <input 
                                type="text"
                                value={gateway.config?.contract_code || ''}
                                onChange={(e) => updateGateway(gateway.name, 'config', { ...gateway.config, contract_code: e.target.value })}
                                className="w-full bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 text-xs font-mono focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                placeholder="2938481..."
                              />
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="bg-surface-container-high rounded-2xl p-6 border border-outline-variant border-dashed">
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                          Bank transfer uses global nameservers as reference markers. Ensure nameserver settings are verified before activation.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-8 pb-8">
                    <button 
                      onClick={() => handleSaveGateway(gateway)}
                      className="w-full py-4 bg-surface-variant hover:bg-primary hover:text-on-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group"
                    >
                      <Save size={14} className="group-hover:scale-110 transition-transform" />
                      Save Settings
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-surface border border-outline-variant rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-outline-variant bg-surface-container/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center text-warning">
                    <Coins size={20} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-none">Awaiting Review</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">Verification Pending</p>
                  </div>
                </div>
                <div className="p-3 bg-warning/5 rounded-xl border border-warning/10">
                   <AlertCircle size={20} className="text-warning" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container/50">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant">Initiated</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant">Customer / Domain</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant text-right">Approval Status</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {pendingTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center text-on-surface-variant text-xs font-medium italic opacity-50">
                          No pending manual settlements detected in the current orchestration queue.
                        </td>
                      </tr>
                    ) : (
                      pendingTransfers.map((task) => (
                        <tr key={task.id} className="hover:bg-surface-variant/20 transition-colors">
                          <td className="px-8 py-6">
                            <p className="text-[10px] font-bold text-on-surface uppercase tracking-widest leading-none">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-[9px] text-on-surface-variant font-mono mt-1 opacity-60">ID: {task.id}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-bold text-on-surface leading-none">{task.data.user}</p>
                            <p className="text-xs text-primary font-mono mt-1 lowercase">{task.data.domain}</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className={cn(
                               "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                               task.manualApproved ? "bg-green-500/10 text-green-600" : "bg-warning/10 text-warning"
                             )}>
                                {task.manualApproved ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
                                {task.manualApproved ? 'Verified' : 'Awaiting'}
                             </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             {!task.manualApproved ? (
                               <button 
                                 onClick={() => handleApprove(task.id)}
                                 className="px-6 py-2 bg-primary text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                               >
                                 Approve & Provision
                               </button>
                             ) : (
                               <button 
                                 onClick={() => handleRevert(task.id)}
                                 className="px-6 py-2 bg-error text-on-error rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-error/20"
                               >
                                 Cancel Approval
                               </button>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant border-dashed">
              <div className="flex gap-4 items-start">
                 <AlertCircle className="text-primary shrink-0" size={20} />
                 <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface mb-1">Approval Protocol</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                       Clicking "Approve & Provision" confirms that the funds have been successfully settled in the organization's bank accounts. This action is irreversible and immediately initiates the hosting cluster provisioning sequence for the target domain.
                    </p>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
