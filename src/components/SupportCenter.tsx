/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Send,
  Search,
  Filter,
  LifeBuoy,
  ShieldAlert,
  Headphones,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { type SupportTicket } from '../types';
import { toast } from 'sonner';

interface SupportCenterProps {
  onViewTicket: (id: number) => void;
}

export const SupportCenter: React.FC<SupportCenterProps> = ({ onViewTicket }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newTicket, setNewTicket] = useState({
    subject: '',
    department: 'Technical Support',
    priority: 'medium',
    message: ''
  });

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await AccountService.getTickets();
      setTickets(data);
    } catch (err) {
      toast.error("Failed to load support records.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.message) {
      toast.error("Please provide both subject and detailed message.");
      return;
    }

    try {
      await AccountService.createTicket(newTicket);
      toast.success("Support ticket localized. A technician will be assigned shortly.");
      setIsCreating(false);
      setNewTicket({ subject: '', department: 'Technical Support', priority: 'medium', message: '' });
      loadTickets();
    } catch (err) {
      toast.error("Transmission failed. Please attempt again.");
    }
  };

  const statusIcons = {
    'open': { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', label: 'Awaiting tech' },
    'answered': { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-500/10', label: 'Response ready' },
    'customer-reply': { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Reply pending' },
    'closed': { icon: CheckCircle2, color: 'text-on-surface-variant/40', bg: 'bg-surface-variant', label: 'Resolved' }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toString().includes(searchQuery)
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
            Protocol Support
          </div>
          <h1 className="text-4xl font-display font-black tracking-tighter text-on-surface">Client Support Center</h1>
          <p className="text-on-surface-variant font-medium">Real-time troubleshooting and priority technical assistance.</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-primary text-on-primary px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-primary/20 self-start"
          >
            <Plus size={16} />
            <span>Open Ticket</span>
          </button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-surface-container rounded-[3rem] border border-outline-variant/30 shadow-2xl p-10 max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                    <Headphones size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black tracking-tight">Technical Request</h2>
                    <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Initialize standard protocol</p>
                  </div>
               </div>
               <button onClick={() => setIsCreating(false)} className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Cancel</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-2">Request Subject</label>
                <input 
                  type="text"
                  placeholder="Summarize your technical challenge..."
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-2">Department Path</label>
                  <select 
                    value={newTicket.department}
                    onChange={(e) => setNewTicket({...newTicket, department: e.target.value})}
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium appearance-none"
                  >
                    <option>Technical Support</option>
                    <option>Billing & Finance</option>
                    <option>Abuse & Security</option>
                    <option>Migration Desk</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-2">Priority Tier</label>
                  <select 
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium appearance-none"
                  >
                    <option value="low">Low (Standard)</option>
                    <option value="medium">Medium (Priority)</option>
                    <option value="high">High (Immediate)</option>
                    <option value="critical">Critical (Infrastructure)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-2">Detail Logs / Message</label>
                <textarea 
                  rows={6}
                  placeholder="Describe your issue with as much technical detail as possible..."
                  value={newTicket.message}
                  onChange={(e) => setNewTicket({...newTicket, message: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-3xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium resize-none"
                />
              </div>

              <button className="w-full bg-primary text-on-primary py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20">
                <Send size={18} />
                <span>Transmit Secure Request</span>
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Tracking ID or keyword..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/30 pl-12 pr-4 py-4 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                 {['All', 'Open', 'Answered', 'Closed'].map(filter => (
                   <button key={filter} className={cn(
                     "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                     filter === 'All' ? "bg-primary text-on-primary shadow-lg" : "bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant"
                   )}>
                     {filter}
                   </button>
                 ))}
              </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-surface-container rounded-[2.5rem] border border-outline-variant/30 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface/50 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                      <th className="px-8 py-6 text-left">Tracking ID</th>
                      <th className="px-8 py-6 text-left">Brief Subject</th>
                      <th className="px-8 py-6 text-left">Department</th>
                      <th className="px-8 py-6 text-left">Status Loop</th>
                      <th className="px-8 py-6 text-left">Last Sync</th>
                      <th className="px-8 py-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                       [...Array(3)].map((_, i) => (
                         <tr key={i} className="animate-pulse">
                            <td colSpan={6} className="px-8 py-6 h-20 bg-surface/10 border-t border-outline-variant/10" />
                         </tr>
                       ))
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-20 text-center space-y-4">
                          <div className="w-20 h-20 bg-surface rounded-[2.5rem] flex items-center justify-center mx-auto text-on-surface-variant/30">
                            <LifeBuoy size={40} />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-black tracking-tight">Clear Log</h3>
                            <p className="text-on-surface-variant font-medium max-w-sm mx-auto">No support protocols found for this account. Your infrastructure is performing optimally.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((ticket) => {
                        const Status = statusIcons[ticket.status] || statusIcons.open;
                        return (
                          <motion.tr 
                            key={ticket.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group hover:bg-primary/5 transition-colors cursor-pointer border-t border-outline-variant/30"
                            onClick={() => onViewTicket(ticket.id)}
                          >
                            <td className="px-8 py-6">
                              <span className="font-mono text-xs font-bold text-primary">#ALABA-{ticket.id.toString().padStart(5, '0')}</span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="space-y-1">
                                <p className="font-bold text-on-surface max-w-xs truncate">{ticket.subject}</p>
                                <div className={cn(
                                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                  ticket.priority === 'critical' ? "bg-error text-on-error" : 
                                  ticket.priority === 'high' ? "bg-amber-500 text-white" : "bg-primary/10 text-primary"
                                )}>
                                  {ticket.priority}
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-xs font-medium text-on-surface-variant">{ticket.department}</span>
                            </td>
                            <td className="px-8 py-6">
                               <div className={cn("inline-flex items-center gap-3 px-4 py-2 rounded-2xl", Status.bg)}>
                                  <Status.icon size={16} className={Status.color} />
                                  <div className="text-left">
                                    <p className={cn("text-[9px] font-black uppercase tracking-widest", Status.color)}>{ticket.status.replace('-', ' ')}</p>
                                    <p className="text-[9px] font-bold text-on-surface-variant/60">{Status.label}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-xs font-bold text-on-surface-variant">{new Date(ticket.updated_at).toLocaleDateString()}</span>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="w-10 h-10 rounded-xl bg-surface-container-highest group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center transition-all inline-flex">
                                 <ChevronRight size={18} />
                               </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Contact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
               <div className="p-8 bg-surface-container rounded-[2.5rem] border border-outline-variant/30 space-y-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <LifeBuoy size={24} />
                  </div>
                  <h3 className="text-lg font-display font-black tracking-tight">Knowledge Base</h3>
                  <p className="text-xs font-medium text-on-surface-variant leading-relaxed">Access 500+ secure guides and infrastructure documentation.</p>
                  <button className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">Explore Docs <ChevronRight size={14} /></button>
               </div>
               <div className="p-8 bg-surface-container rounded-[2.5rem] border border-outline-variant/30 space-y-4">
                  <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-lg font-display font-black tracking-tight">Network Status</h3>
                  <p className="text-xs font-medium text-on-surface-variant leading-relaxed">All Alaba data centers are currently operating at 100% capacity.</p>
                  <button className="text-[10px] font-black uppercase tracking-widest text-green-600 flex items-center gap-2">Live Status <ChevronRight size={14} /></button>
               </div>
               <div className="p-8 bg-surface-container rounded-[2.5rem] border border-outline-variant/30 space-y-4">
                  <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center text-error">
                    <ShieldAlert size={24} />
                  </div>
                  <h3 className="text-lg font-display font-black tracking-tight">Security Alerts</h3>
                  <p className="text-xs font-medium text-on-surface-variant leading-relaxed">View recent threat detection reports and localized firewall logs.</p>
                  <button className="text-[10px] font-black uppercase tracking-widest text-error flex items-center gap-2">Report Breach <ChevronRight size={14} /></button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
