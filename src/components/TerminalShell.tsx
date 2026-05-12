/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  TerminalSquare, 
  Trash2, 
  Copy,
  ChevronRight,
  Maximize2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

import { AccountService } from '../services/api';

interface LogEntry {
  type: 'input' | 'output' | 'system';
  content: string;
}

export const TerminalShell: React.FC = () => {
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: 'system', content: 'Connecting to alaba-prod-node-01...' },
    { type: 'system', content: 'Authentication successful. Welcome to Alaba Shell.' },
    { type: 'system', content: 'Last login: Mon Mar 25 14:22:15 2024 from 185.22.41.112' },
  ]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (instant = false) => {
    logEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom(logs.length <= 5); // Instant for first few, smooth for others
  }, [logs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Command output copied to clipboard", {
      icon: <Check size={14} className="text-green-500" />
    });
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const cmd = input.trim();
    const currentInput = cmd;
    setLogs(prev => [...prev, { type: 'input', content: currentInput }]);
    setInput('');
    setIsExecuting(true);
    
    // Commands that don't need backend
    const lowCmd = cmd.toLowerCase();
    if (lowCmd === 'clear') {
      setLogs([]);
      setIsExecuting(false);
      return;
    }
    if (lowCmd === 'help') {
      setLogs(prev => [...prev, { type: 'output', content: 'Commonly used: help, status, uptime, ls, pwd, df -h, free -m, whoami, clear' }]);
      setIsExecuting(false);
      return;
    }

    try {
      const { output } = await AccountService.executeTerminalCommand(cmd);
      setLogs(prev => [...prev, { type: 'output', content: output || ' ' }]);
    } catch (err: any) {
      setLogs(prev => [...prev, { type: 'output', content: `Error: ${err.message}` }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const highlightOutput = (content: string) => {
    // Basic syntax highlighting for terminal output
    if (!content) return null;

    // Pattern for paths/directories (starting with /)
    const highlighted = content.split('\n').map((line, lineIdx) => {
      const parts = line.split(/(\s+)/).map((part, partIdx) => {
        // Highlight flags (-h, --force)
        if (part.startsWith('-')) {
          return <span key={partIdx} className="text-amber-400">{part}</span>;
        }
        // Highlight absolute paths
        if (part.startsWith('/')) {
          return <span key={partIdx} className="text-blue-400 font-bold">{part}</span>;
        }
        // Highlight numbers followed by unit (Size/Used column)
        if (/\d+[GMBK]/.test(part)) {
          return <span key={partIdx} className="text-primary">{part}</span>;
        }
        // Highlight percentages
        if (/\d+%/.test(part)) {
          const val = parseInt(part);
          return <span key={partIdx} className={cn(val > 80 ? "text-error font-black" : "text-green-500 font-bold")}>{part}</span>;
        }
        // Highlight "UP" or "Success"
        if (['UP', 'healthy', 'successful'].includes(part)) {
          return <span key={partIdx} className="text-green-400 font-black">{part}</span>;
        }
        return part;
      });
      return <div key={lineIdx}>{parts}</div>;
    });

    return highlighted;
  };

  return (
    <div className="p-4 md:p-8 h-[calc(100vh-4rem)] flex flex-col gap-4 md:gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-on-surface">Terminal Shell</h1>
          <p className="text-on-surface-variant text-xs md:text-base">Direct root access to the hosting control plane.</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><Maximize2 size={20} /></button>
          <button onClick={() => setLogs([])} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-error"><Trash2 size={20} /></button>
        </div>
      </header>

      <div className="flex-1 bg-black rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 font-mono">
        <div className="bg-white/5 px-6 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <TerminalIcon size={16} className="text-on-tertiary/60" />
            <span className="text-xs font-bold text-on-tertiary/60 uppercase tracking-widest">root@alaba:~</span>
          </div>
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/30 border border-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/30 border border-green-500/50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {logs.map((log, i) => (
            <div key={i} className="group relative">
              <div className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap transition-opacity duration-200 pr-10",
                log.type === 'input' ? "text-white" : 
                log.type === 'system' ? "text-blue-300" : "text-green-400 opacity-90"
              )}>
                {log.type === 'input' && (
                  <span className="text-green-500 mr-2 font-bold font-mono">root@alaba:~$</span>
                )}
                {log.type === 'output' ? highlightOutput(log.content) : log.content}
              </div>
              
              <button 
                onClick={() => copyToClipboard(log.content)}
                className="absolute right-0 top-0 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl backdrop-blur-sm border border-white/5"
                title="Copy contents"
              >
                <Copy size={12} />
              </button>
            </div>
          ))}
          <div ref={logEndRef} className="h-4" />
        </div>

        <form onSubmit={handleCommand} className="p-4 bg-white/5 border-t border-white/10 flex items-center gap-3">
          <ChevronRight size={20} className="text-green-500" />
          <input 
            autoFocus
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder:text-white/20"
            placeholder="Type a command (help)..."
          />
        </form>
      </div>
    </div>
  );
};
