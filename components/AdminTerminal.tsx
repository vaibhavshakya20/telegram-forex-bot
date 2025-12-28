
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
  const [pair, setPair] = useState('XAUUSD');
  const [logs, setLogs] = useState<string[]>(['Admin session started...', 'Ready for commands.']);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();

    if (cmd === '/result' && parts.length === 3) {
      const [, id, res] = parts;
      onAdd(id, pair, res);
      addLog(`Added result for ${id}: ${res}`);
      setCommand('');
    } else if (cmd === '/edit' && parts.length === 3) {
      const [, id, res] = parts;
      onEdit(id, res);
      addLog(`Edited trade ${id} to ${res}`);
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
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Send className="text-blue-400" size={20} />
            Post Trade Result
          </h2>
          <form onSubmit={handleCommand} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Trading Pair (Internal)</label>
              <input 
                type="text" 
                value={pair} 
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="e.g. BTCUSD"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Command Input</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 pl-10 font-mono text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="/result T001 1:3"
                />
                <div className="absolute left-3 top-2.5 text-slate-500">
                  <Terminal size={18} />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 font-mono">
                Formats: /result ID RR | /edit ID RR | /delete ID
              </p>
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
            >
              Execute Command
            </button>
          </form>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex-1 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <RefreshCcw className="text-amber-400" size={20} />
              Command Logs
            </h2>
            <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300 underline">Clear Logs</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-950 rounded-lg p-4 font-mono text-sm space-y-2 border border-slate-900">
            {logs.map((log, i) => (
              <div key={i} className={log.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col h-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="text-amber-400" size={20} />
          Recent Global Trades
        </h2>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2 font-medium">Trade ID</th>
                <th className="pb-2 font-medium">Pair</th>
                <th className="pb-2 font-medium">Result</th>
                <th className="pb-2 font-medium">Pts</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.slice().reverse().map((trade) => (
                <tr key={trade.tradeId} className="bg-slate-900/50 group hover:bg-slate-900 transition-colors">
                  <td className="py-3 px-3 rounded-l-lg font-mono text-blue-400">{trade.tradeId}</td>
                  <td className="py-3 px-3 font-medium">{trade.pair}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.result === 'SL' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {trade.result}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">{trade.points > 0 ? `+${trade.points}` : trade.points}</td>
                  <td className="py-3 px-3 rounded-r-lg">
                    <div className="flex gap-2">
                      <button onClick={() => onDelete(trade.tradeId)} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recentTrades.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 italic">No trades posted yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-700">
          <button 
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 py-2 text-rose-500 hover:bg-rose-500/10 rounded-lg border border-rose-500/30 transition-all text-sm font-bold"
          >
            <RefreshCcw size={16} />
            Wipe Simulation Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminTerminal;
