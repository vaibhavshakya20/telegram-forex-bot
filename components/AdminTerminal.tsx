
import React, { useState } from 'react';
import { Send, Edit3, Trash2, AlertCircle, RefreshCcw, Terminal, UserPlus, Image as ImageIcon, Megaphone } from 'lucide-react';
import { TradeResult } from '../types';

interface AdminTerminalProps {
  onAdd: (id: string, pair: string, res: string) => void;
  onEdit: (id: string, res: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onRejoin?: (uid: string) => void;
  recentTrades: TradeResult[];
}

const AdminTerminal: React.FC<AdminTerminalProps> = ({ onAdd, onEdit, onDelete, onReset, onRejoin, recentTrades }) => {
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<string[]>(['Master terminal ready...', 'Workflow: Channel SS -> Bot /add']);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();

    if ((cmd === '/add' || cmd === '/result') && parts.length >= 2) {
      const res = parts[parts.length - 1]; // Last part is usually the result
      const tid = `T${recentTrades.length + 101}`;
      onAdd(tid, 'CHANNEL_SIGNAL', res);
      addLog(`Success: ${tid} recorded with ${res} pts.`);
      setCommand('');
    } else if (cmd === '/all' && parts.length > 1) {
      addLog(`Broadcast: Sending text to all active users...`);
      setCommand('');
    } else if (cmd === '/rejoin' && parts.length === 2) {
      const uid = parts[1];
      if (onRejoin) onRejoin(uid);
      addLog(`Action: Reactivated user ${uid}`);
      setCommand('');
    } else {
      addLog(`Error: Try /add 3 or /all Hello Team`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <Terminal className="text-blue-400" size={20} />
            Command & Control
          </h2>
          
          <div className="mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
              <Megaphone size={12} /> Admin Guide
            </h3>
            <ul className="text-xs space-y-2 text-slate-300">
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span> 
                <span>`/add 3` : Update result for all users.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span> 
                <span>`/all Message` : Send text to all active users.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span> 
                <span>**Send Photo** : Directly broadcast any screenshot.</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleCommand} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Execute Command</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pl-10 font-mono text-emerald-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-700"
                  placeholder="/add 3"
                />
                <div className="absolute left-3 top-3.5 text-slate-600">
                  <Terminal size={18} />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/40">
              Execute Command
            </button>
          </form>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex-1 flex flex-col min-h-[250px]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <RefreshCcw className="text-emerald-400" size={20} />
            Output Logs
          </h2>
          <div className="flex-1 overflow-y-auto bg-slate-950 rounded-lg p-4 font-mono text-xs space-y-1.5 border border-slate-900 shadow-inner">
            {logs.map((log, i) => (
              <div key={i} className="text-emerald-400/90 flex gap-2">
                <span className="text-slate-700 font-bold">{'>'}</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col h-full shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <AlertCircle className="text-blue-400" size={20} />
          Bot Result History
        </h2>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <table className="w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="pb-2 px-3">ID</th>
                <th className="pb-2 px-3">Result</th>
                <th className="pb-2 px-3 text-right">Delete</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.slice().reverse().map((trade) => (
                <tr key={trade.tradeId} className="bg-slate-900/50 group hover:bg-slate-900 transition-all">
                  <td className="py-3 px-3 rounded-l-lg font-mono text-blue-400">{trade.tradeId}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.points > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {trade.points > 0 ? `+${trade.points} RR` : 'SL HIT'}
                    </span>
                  </td>
                  <td className="py-3 px-3 rounded-r-lg text-right">
                    <button onClick={() => onDelete(trade.tradeId)} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {recentTrades.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-20 text-slate-600 italic">No trades recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
           <p className="text-[10px] text-slate-500 font-bold uppercase">Master Access: Enabled</p>
           <button onClick={onReset} className="text-rose-500 text-[10px] font-bold uppercase hover:underline opacity-50 hover:opacity-100 transition-opacity">Full System Wipe</button>
        </div>
      </div>
    </div>
  );
};

export default AdminTerminal;
