
import React, { useState, useEffect, useRef } from 'react';
import { User, UserStatus } from '../types';
import { Send, Shield } from 'lucide-react';

interface BotSimulatorProps {
  currentUser: User | null;
  onStart: (id: string, name: string) => void;
}

const BotSimulator: React.FC<BotSimulatorProps> = ({ currentUser, onStart }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ text: string, type: 'user' | 'bot', timestamp: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { text: msg, type: 'user', timestamp: Date.now() }]);
    setInput('');

    setTimeout(() => {
      if (msg === '/start') {
        if (currentUser) {
          setMessages(prev => [...prev, { text: "Welcome back!\nAapka trial pehle se chal raha hai.\nEk user sirf ek baar join kar sakta hai.", type: 'bot', timestamp: Date.now() }]);
        } else {
          onStart(`USR_${Date.now()}`, 'Trader');
          setMessages(prev => [...prev, { text: "Welcome 👋\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1 Point\n• Target 1:N = N Points\n\nChannel dekhte rahein.", type: 'bot', timestamp: Date.now() }]);
        }
      } else if (msg === '/profile') {
        if (!currentUser) {
          setMessages(prev => [...prev, { text: "Send /start first.", type: 'bot', timestamp: Date.now() }]);
        } else {
          const hist = currentUser.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.points > 0 ? '+' : ''}${h.points}`).join('\n');
          setMessages(prev => [...prev, { 
            text: `📊 Profile\nJoined: ${new Date(currentUser.joinTimestamp).toLocaleDateString()}\nTrades: ${currentUser.tradesCount}\nPoints: ${currentUser.points}\nStatus: ${currentUser.status.toUpperCase()}\n\nHistory:\n${hist || "No trades."}`, 
            type: 'bot', 
            timestamp: Date.now() 
          }]);
        }
      } else {
        setMessages(prev => [...prev, { text: "Use /start or /profile", type: 'bot', timestamp: Date.now() }]);
      }
    }, 400);
  };

  return (
    <div className="flex flex-col h-[600px] max-w-md mx-auto bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
            <Shield size={16} />
          </div>
          <div>
            <span className="font-bold text-sm block">TradeFlow Private Bot</span>
            <span className="text-[10px] text-emerald-500 font-bold uppercase">bot</span>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950 scroll-smooth">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${m.type === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          placeholder="Message bot..."
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-colors shadow-lg shadow-blue-900/40">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default BotSimulator;
