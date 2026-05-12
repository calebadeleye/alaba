/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  CalendarClock, 
  Search, 
  Trash2, 
  Edit3, 
  Plus, 
  Play, 
  CheckCircle2, 
  XCircle,
  Terminal,
  Activity,
  History,
  Timer,
  ChevronRight,
  MoreVertical,
  Filter,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export const CronJobs: React.FC = () => {
  const [jobs, setJobs] = React.useState([
    { id: '1', command: '/usr/bin/php /home/admin/backup.php', schedule: '0 0 * * *', lastRun: '2h 14m ago', status: 'success' },
    { id: '2', command: 'python3 /scripts/health_check.py', schedule: '*/15 * * * *', lastRun: '6m ago', status: 'success' },
    { id: '3', command: 'rm -rf /tmp/cache/*', schedule: '0 1 * * 0', lastRun: '3d ago', status: 'failed' },
  ]);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [jobToDelete, setJobToDelete] = React.useState<{ id: string, command: string } | null>(null);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.command.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         job.schedule.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || 
                         (statusFilter === 'SUCCESS' && job.status === 'success') ||
                         (statusFilter === 'FAILED' && job.status === 'failed');
    return matchesSearch && matchesStatus;
  });

  const handleDeleteJob = () => {
    if (jobToDelete) {
      setJobs(jobs.filter(j => j.id !== jobToDelete.id));
      toast.success(`Automated task removed successfully`);
      setJobToDelete(null);
    }
  };

  const handleRunManually = (command: string) => {
    toast.info(`Manual execution started: ${command}`, {
      description: "You will be notified once the process completes.",
      icon: <Play size={14} className="text-primary" />
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 max-w-[1600px] mx-auto">
      <header className="bg-primary relative overflow-hidden rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 text-on-primary shadow-2xl">
        <CalendarClock className="absolute right-0 top-1/2 -translate-y-1/2 w-48 md:w-96 h-48 md:h-96 text-white opacity-5 rotate-12 scale-150" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-500/30">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>Task Scheduler: Operational</span>
          </div>
          <h1 className="text-3xl md:text-[3.5rem] font-display font-black leading-none tracking-tighter">Scheduled Tasks</h1>
          <p className="text-white/70 max-w-2xl text-base md:text-lg leading-relaxed font-medium">
            Automate routine server operations with precision. Use the Alaba cron manager to schedule backups, system cleanups, and custom scripts.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-surface-container p-8 rounded-3xl shadow-sm border border-outline-variant group">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary-container rounded-2xl text-primary shadow-sm group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
              <h2 className="text-xl font-bold font-display text-on-surface">Add New Cron Job</h2>
            </div>
            <form className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Common Settings</label>
                  <select className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-sm font-bold text-on-surface focus:ring-4 focus:ring-primary/10 cursor-pointer outline-none transition-all">
                    <option>-- Presets --</option>
                    <option>Once a minute (* * * * *)</option>
                    <option>Every 5 minutes (*/5 * * * *)</option>
                    <option>Twice a day (0 0,12 * * *)</option>
                    <option>Every Sunday at Midnight (0 0 * * 0)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Command String</label>
                  <input className="w-full bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-sm font-mono text-primary font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="php /path/to/script.php" type="text"/>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: 'Minute', range: 60, start: 0 },
                  { label: 'Hour', range: 24, start: 0 },
                  { label: 'Day', range: 31, start: 1 },
                  { label: 'Month', range: 12, start: 1 },
                  { label: 'Weekday', range: 7, start: 0, names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <label className="text-[9px] font-black text-on-surface-variant uppercase text-center block tracking-tighter">{item.label}</label>
                    <select 
                      className="w-full bg-surface border border-outline-variant rounded-xl text-center py-3 text-[10px] font-bold font-mono focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                      defaultValue="*"
                    >
                      <option value="*">Every {item.label}</option>
                      {Array.from({ length: item.range }, (_, i) => i + item.start).map((val) => (
                        <option key={val} value={val}>
                          {item.names ? item.names[val % 7] : val}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <button className="px-10 py-4 bg-primary text-on-primary rounded-2xl font-bold text-sm shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                  Create Automated Task
                </button>
              </div>
            </form>
          </div>

          <div className="bg-surface-container rounded-3xl shadow-sm border border-outline-variant overflow-hidden flex-1">
            <div className="px-8 py-6 bg-surface-container-high border-b border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <Activity className="text-primary" size={20} />
                <h2 className="text-sm font-black font-display text-on-surface uppercase tracking-[0.2em]">Active Execution Nodes</h2>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={14} />
                  <input 
                    type="text"
                    placeholder="Search commands..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface border border-outline-variant pl-9 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={12} />
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-surface border border-outline-variant pl-8 pr-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="ALL">All States</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-8 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Command String</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Schedule</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Last Update</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredJobs.map((job, i) => (
                    <tr key={job.id} className="hover:bg-primary-container/10 transition-colors group cursor-default">
                      <td className="px-8 py-5 shrink-0">
                        <div className="flex items-center gap-3">
                          <Terminal className="text-on-surface-variant/40 shrink-0" size={16} />
                          <span className="font-mono text-xs text-primary font-bold truncate max-w-[250px]">{job.command}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <span className="px-3 py-1 bg-surface rounded-full border border-outline-variant text-[10px] font-black font-mono text-on-surface-variant">
                            {job.schedule}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            job.status === 'success' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          )} />
                          <span className="text-xs font-bold text-on-surface-variant">{job.lastRun}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-2 hover:bg-surface rounded-xl text-primary transition-colors hover:shadow-sm"
                            title="Edit Schedule"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleRunManually(job.command)}
                            className="p-2 hover:bg-surface rounded-xl text-primary transition-colors hover:shadow-sm"
                            title="Run Manually"
                          >
                            <Play size={16} />
                          </button>
                          <button 
                            onClick={() => setJobToDelete({ id: job.id, command: job.command })}
                            className="p-2 hover:bg-error-container/20 rounded-xl text-error transition-colors"
                            title="Delete Job"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <Search size={48} />
                          <p className="text-sm font-bold uppercase tracking-widest">No matching tasks found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Deletion Confirmation Modal */}
        <AnimatePresence>
          {jobToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setJobToDelete(null)}
                className="absolute inset-0 bg-surface-dim/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-on-surface">Remove Task?</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Are you sure you want to delete this scheduled task? This operation cannot be reversed.
                  </p>
                  <div className="p-3 bg-surface rounded-xl border border-outline-variant/30 mt-4">
                    <p className="text-[10px] font-mono text-primary font-bold truncate">
                      {jobToDelete.command}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setJobToDelete(null)}
                    className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteJob}
                    className="flex-1 py-3 bg-error text-white font-bold text-sm rounded-xl shadow-lg shadow-error/20 hover:opacity-90 transition-all font-display"
                  >
                    Delete Task
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <aside className="lg:col-span-4 space-y-8 flex flex-col">
          <div className="bg-surface-container p-8 rounded-3xl border border-outline-variant shadow-sm border-l-8 border-l-primary flex-1">
            <h3 className="text-[11px] font-black font-display text-primary mb-8 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={16} />
              Performance Metrics
            </h3>
            <div className="space-y-10">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-xs font-bold text-on-surface-variant uppercase">Success rate</span>
                  <span className="text-3xl font-display font-black text-on-surface tracking-tighter">99.2%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-outline-variant/10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '99.2%' }}
                    className="h-full bg-primary rounded-full" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase opacity-60">Impact</p>
                  <p className="text-xl font-bold text-on-surface">Minimal</p>
                  <p className="text-[10px] font-medium text-green-600 uppercase">0.04 Load</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase opacity-60">Avg Duration</p>
                  <p className="text-xl font-bold text-on-surface">1.4s</p>
                  <p className="text-[10px] font-medium text-on-surface-variant uppercase">-0.2%</p>
                </div>
              </div>

              <div className="p-5 bg-primary-container/10 border border-primary/10 rounded-2xl italic">
                <p className="text-[11px] leading-relaxed text-on-primary-container font-medium">
                  "Cluster recommendation: Systems with &gt;50 concurrent tasks should deploy dedicated scheduler nodes for disk I/O stability."
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container p-8 rounded-3xl shadow-sm border border-outline-variant h-[450px] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <History className="text-on-surface-variant" size={18} />
                <h2 className="text-sm font-black font-display text-on-surface uppercase tracking-widest">Logs</h2>
              </div>
              <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline underline-offset-4">Reset</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              {[
                { time: '14:00:01', name: 'backup.php', status: 'Success' },
                { time: '13:45:00', name: 'health_check.py', status: 'Success' },
                { time: '13:30:00', name: 'update_assets.sh', status: 'Failed', error: true },
                { time: '13:15:01', name: 'health_check.py', status: 'Success' },
                { time: '13:00:01', name: 'health_check.py', status: 'Success' },
                { time: '12:45:01', name: 'health_check.py', status: 'Success' },
                { time: '12:30:01', name: 'health_check.py', status: 'Success' },
              ].map((log, i) => (
                <div key={i} className="group flex items-center justify-between p-3 bg-surface hover:bg-surface-variant transition-colors rounded-xl font-mono text-[10px]">
                  <div className="flex items-center gap-3">
                    <span className="text-on-surface-variant/50">{log.time}</span>
                    <span className="text-on-surface font-bold">{log.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-black uppercase text-[8px]",
                      log.error ? "bg-error-container text-error" : "bg-green-100 text-green-700"
                    )}>{log.status}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-primary"><Search size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="bg-on-surface rounded-[2rem] p-8 flex items-center justify-between shadow-2xl relative overflow-hidden group">
        <Timer className="absolute -left-12 -bottom-12 w-64 h-64 text-white opacity-5 -rotate-12 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative z-10 flex items-center gap-8">
           <div className="w-16 h-16 rounded-2xl bg-white/10 flex flex-col items-center justify-center border border-white/20">
              <span className="text-[10px] font-black text-white/50 uppercase leading-none mb-1">Next T-</span>
              <span className="text-2xl font-black text-white leading-none tracking-tighter">02:14</span>
           </div>
           <div>
              <h4 className="text-xl font-bold text-white font-display mb-1">Queue Inspection</h4>
              <p className="text-white/50 text-sm font-medium">Coming up: <span className="text-white">Database Backup Script</span> on cluster Alpha-1</p>
           </div>
        </div>
        <button className="relative z-10 px-8 py-3 bg-white text-on-surface font-bold rounded-xl hover:bg-white/90 transition-colors shadow-lg shadow-white/5">
          View Master Queue
        </button>
      </div>
    </div>
  );
};
