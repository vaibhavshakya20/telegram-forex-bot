
import React, { useState, useEffect, useRef } from 'react';
import { User, UserStatus } from '../types';
import { Send, User as UserIcon, Shield, CheckCircle2 } from 'lucide-react';
import { getPerformanceInsights } from '../services/geminiService';

interface BotSimulatorProps {
  currentUser: User | null;
  onStart: (id: string, name: string) => void;
  onSendProfile: () => void;
}

const BotSimulator: React.FC<BotSimulatorProps> = ({ currentUser, onStart, onSendProfile }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ text: string, type: 'user' | 'bot', timestamp: number }[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, { text, type: 'bot', timestamp: Date.now() }]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { text: userMsg, type: 'user', timestamp: Date.now() }]);
    setInput('');

    if (userMsg.toLowerCase() === '/start') {
      if (currentUser) {
        addBotMessage("You have already started your trial. Access allowed only once.");
      } else {
        const userId = `USR_${Math.floor(Math.random() * 100000)}`;
        onStart(userId, 'Test User');
        addBotMessage(`Welcome 👋
Trades yahin milenge.
Aapka free trial start ho chuka hai.

Rules:
• SL = -1
• RR jitna mile, utne points
• 10 trades + 10 points = trial complete (one-time)

Status:
Trades: 0 / 10
Points: 0 / 10`);
      }
    } else if (userMsg.toLowerCase() === '/profile') {
      if (!currentUser) {
        addBotMessage("Please send /start to begin.");
      } else {
        const historyText = currentUser.history.length > 0 
          ? currentUser.history.map((h, i) => `${i + 1}) ${h.pair} | ${h.result} | ${h.points > 0 ? '+' : ''}${h.points}`).join('\n')
          : "No history yet.";

        addBotMessage(`Your Trade Profile

Joined On: ${new Date(currentUser.joinTimestamp).toLocaleString()}

Trades Since Joining: ${currentUser.tradesCount} / 10
Total Points: ${currentUser.points} / 10

Trade History:
${historyText}

Status: ${currentUser.status.charAt(0).toUpperCase() + currentUser.status.slice(1)}`);
      }
    } else if (userMsg.toLowerCase() === '/ai') {
        if (!currentUser) {
          addBotMessage("Please send /start to begin.");
        } else {
          addBotMessage("Generating AI performance review...");
          const res = await getPerformanceInsights(currentUser);
          addBotMessage(`🤖 AI Performance Coach:\n\n${res}`);
        }
    } else {
      addBotMessage("Unknown command. Try /start, /profile, or /ai.");
    }
  };

  // Watch for trial exit
  useEffect(() => {
    if (currentUser?.status === UserStatus.EXITED) {
      const alreadyMessaged = messages.some(m => m.text.includes("Free Trial Completed"));
      if (!alreadyMessaged) {
        addBotMessage(`🚫 Free Trial Completed
Your access has ended permanently.
To continue, please upgrade / join via Exness Social Trading.`);
      }
    }
  }, [currentUser]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">TradeFlow Private Bot</h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              bot is running
            </span>
          </div>
        </div>
        {currentUser && (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full text-xs font-mono border border-slate-700">
                <span className="text-slate-400">Pts:</span>
                <span className={currentUser.points >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {currentUser.points}
                </span>
                <span className="text-slate-600 ml-1">|</span>
                <span className="text-slate-400 ml-1">Trades:</span>
                <span className="text-blue-400">{currentUser.tradesCount}/10</span>
            </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-90">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center mb-4 text-slate-600 border border-slate-700">
                <MessageSquare size={40} />
            </div>
            <p className="text-slate-500 font-medium">Send /start to begin your trial</p>
            <p className="text-xs text-slate-600 mt-2 px-10">This is a simulation of the private Telegram interaction.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm whitespace-pre-wrap ${
              m.type === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
            }`}>
              {m.text}
              <div className={`text-[10px] mt-1 ${m.type === 'user' ? 'text-blue-200' : 'text-slate-500'} text-right`}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2 relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={currentUser?.status === UserStatus.EXITED}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={currentUser?.status === UserStatus.EXITED ? "Access Ended" : "Type /start, /profile, /ai..."}
          />
          <button 
            type="submit"
            disabled={!input.trim() || currentUser?.status === UserStatus.EXITED}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors disabled:opacity-50 disabled:bg-slate-700"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

const MessageSquare = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

export default BotSimulator;
