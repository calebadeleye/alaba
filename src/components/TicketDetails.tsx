/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  User, 
  ShieldCheck, 
  Clock, 
  MessageSquare,
  RefreshCw,
  MoreVertical,
  Paperclip,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';
import { type SupportTicket, type TicketReply } from '../types';
import { toast } from 'sonner';

interface TicketDetailsProps {
  ticketId: number;
  onBack: () => void;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({ ticketId, onBack }) => {
  const [data, setData] = useState<{ ticket: SupportTicket; replies: TicketReply[] } | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.replies]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const res = await AccountService.getTicket(ticketId);
      setData(res);
    } catch (err) {
      toast.error("Failed to sync ticket communication.");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    try {
      await AccountService.replyTicket(ticketId, message);
      setMessage('');
      loadTicket();
    } catch (err) {
      toast.error("Transmission failed.");
    } finally {
      setIsSending(false);
    }
  };

  if (loading || !data) {
    return <div className="p-20 text-center animate-pulse font-mono text-[10px] uppercase tracking-widest text-primary">Synchronizing with support node...</div>;
  }

  const { ticket, replies } = data;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="w-12 h-12 bg-surface-container rounded-2xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all border border-outline-variant/30"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
               <h1 className="text-2xl font-display font-black tracking-tight">{ticket.subject}</h1>
               <span className="font-mono text-xs font-bold text-primary opacity-40">#ALABA-{ticket.id.toString().padStart(5, '0')}</span>
            </div>
            <div className="flex items-center gap-4 mt-1">
               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                  <Clock size={12} />
                  Opened: {new Date(ticket.created_at).toLocaleString()}
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary">
                  <MessageSquare size={12} />
                  Status: {ticket.status.toUpperCase()}
               </div>
            </div>
          </div>
        </div>
        <button className="p-3 hover:bg-surface-container rounded-xl transition-colors">
          <MoreVertical size={20} />
        </button>
      </header>

      <div className="flex-1 bg-surface-container rounded-[3rem] border border-outline-variant/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar"
        >
          {replies.map((reply) => {
            const isAdmin = reply.sender_type === 'admin';
            return (
              <motion.div 
                key={reply.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  isAdmin ? "" : "ml-auto flex-row-reverse"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                  isAdmin ? "bg-primary text-on-primary" : "bg-secondary text-on-secondary"
                )}>
                  {isAdmin ? <ShieldCheck size={20} /> : <User size={20} />}
                </div>
                <div className="space-y-2">
                  <div className={cn(
                    "p-6 rounded-[2rem] shadow-sm flex flex-col gap-2",
                    isAdmin ? "bg-surface border border-outline-variant/30 rounded-tl-sm text-on-surface" : "bg-primary text-on-primary rounded-tr-sm shadow-primary/20"
                  )}>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest self-end opacity-40",
                      isAdmin ? "text-on-surface-variant" : "text-on-primary"
                    )}>
                      {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={cn(
                    "text-[8px] font-black uppercase tracking-widest mx-2",
                    isAdmin ? "text-primary" : "text-right text-on-surface-variant"
                  )}>
                    {isAdmin ? 'System Representative' : 'Customer Account'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-surface/50 border-t border-outline-variant/30">
          <form 
            onSubmit={handleReply}
            className="relative"
          >
            <textarea 
              placeholder="Inject technical response..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={ticket.status === 'closed'}
              className="w-full bg-surface border-2 border-outline-variant/30 rounded-[2.5rem] px-8 py-6 pr-20 focus:border-primary focus:ring-0 transition-all outline-none font-medium resize-none min-h-[100px] shadow-inner"
            />
            <div className="absolute right-4 bottom-4 flex items-center gap-2">
              <button 
                type="button" 
                className="p-3 text-on-surface-variant hover:text-primary transition-colors"
                title="Attach System Logs"
              >
                <Paperclip size={20} />
              </button>
              <button 
                 disabled={isSending || ticket.status === 'closed'}
                 className="w-12 h-12 bg-primary text-on-primary rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
              >
                {isSending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
          </form>
          {ticket.status === 'closed' && (
             <div className="mt-4 flex items-center justify-center gap-2 text-amber-600">
               <ShieldCheck size={16} />
               <p className="text-[10px] font-black uppercase tracking-widest">Protocol finalized. Thread is read-only.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
