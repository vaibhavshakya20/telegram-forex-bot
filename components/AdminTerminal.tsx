
import React, { useState } from 'react';
import { Send, Edit3, Trash2, AlertCircle, RefreshCcw, Terminal } from 'lucide-react';
import { TradeResult } from '../types';

interface AdminTerminalProps {
  onAdd: (id: string, pair: string, res: string) => void;
  onEdit: (id: string, res: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  recentTrades: TradeResult[];
}

const AdminTerminal: React.FC<AdminTerminalProps> = ({ onAdd, onEdit, onDelete, onReset, recentTrades }) => {
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<string[]>(['Admin session started...', 'Use /add [pts] or /add sl']);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();

    if (cmd === '/add' && parts.length === 2) {
      const res = parts[1];
      const tid = `T${recentTrades.length + 101}`;
      onAdd(tid, 'CHANNEL_SIGNAL', res);
      addLog(`Added: ${tid} with ${res} pts.`);
      setCommand('');
    } else if (cmd === '/users') {
      addLog(`Listing users (View directory tab for visual list)`);
      setCommand('');
    } else if (cmd === '/edit' && parts.length === 3) {
      const [, id, res] = parts;
      onEdit(id, res);
      addLog(`Edited ${id} to ${res}`);
      setCommand('');
    } else if (cmd === '/delete' && parts.length === 2) {
      const [, id] = parts;
      onDelete(id);
      addLog(`Deleted trade ${id}`);
      setCommand('');
    } else {
      addLog(`Error: Invalid command format.`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <Terminal className="text-blue-400" size={20} />
            Command Terminal
          </h2>
          <form onSubmit={handleCommand} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Command Input</label>
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
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Success</p>
                  <code className="text-xs text-blue-400">/add 3</code>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">SL Hit</p>
                  <code className="text-xs text-rose-400">/add sl</code>
                </div>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Run Command
            </button>
          </form>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex-1 flex flex-col min-h-[300px]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
            <RefreshCcw className="text-emerald-400" size={20} />
            Execution Logs
          </h2>
          <div className="flex-1 overflow-y-auto bg-slate-950 rounded-lg p-4 font-mono text-xs space-y-1.5 border border-slate-900 shadow-inner">
            {logs.map((log, i) => (
              <div key={i} className={log.includes('Error') ? 'text-rose-400' : 'text-emerald-400 opacity-90'}>
                <span className="text-slate-600 mr-2">{'>'}</span>{log}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col h-full shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <AlertCircle className="text-blue-400" size={20} />
          Channel Trade History
        </h2>
        <div className="flex-1 overflow-y-auto pr-2">
          <table className="w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="pb-2 px-3">ID</th>
                <th className="pb-2 px-3">Result</th>
                <th className="pb-2 px-3">Pts</th>
                <th className="pb-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.slice().reverse().map((trade) => (
                <tr key={trade.tradeId} className="bg-slate-900/50 group hover:bg-slate-900 transition-colors">
                  <td className="py-3 px-3 rounded-l-lg font-mono text-blue-400">{trade.tradeId}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.result.toLowerCase() === 'sl' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {trade.result}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">{trade.points > 0 ? `+${trade.points}` : trade.points}</td>
                  <td className="py-3 px-3 rounded-r-lg text-right">
                    <button onClick={() => onDelete(trade.tradeId)} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
           <p className="text-[10px] text-slate-500 font-bold uppercase">System: Polling Mode Active</p>
           <button onClick={onReset} className="text-rose-500 text-[10px] font-bold uppercase hover:underline">Reset System</button>
        </div>
      </div>
    </div>
  );
};

export default AdminTerminal;
