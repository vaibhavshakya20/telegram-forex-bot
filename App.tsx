
import React, { useState } from 'react';
import { useBotStore } from './store';
import { NAVIGATION_ITEMS, DISCLAIMER } from './constants.tsx';
import DashboardOverview from './components/DashboardOverview';
import AdminTerminal from './components/AdminTerminal';
import BotSimulator from './components/BotSimulator';
import { Shield, ChevronRight, Menu, X, LogOut, AlertTriangle, MessageSquare, Send } from 'lucide-react';

const App: React.FC = () => {
  const { state, startTrial, reactivateUser, addTradeResult, editTradeResult, deleteTradeResult, resetAll } = useBotStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Message Modal State
  const [msgModal, setMsgModal] = useState<{ isOpen: boolean, targetId: string, text: string }>({
    isOpen: false,
    targetId: '',
    text: ''
  });

  const currentUser = state.users.length > 0 ? state.users[state.users.length - 1] : null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`[Simulation] Message sent to ${msgModal.targetId}: ${msgModal.text}`);
    setMsgModal({ ...msgModal, isOpen: false, text: '' });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview users={state.users} trades={state.trades} onMessageUser={(id) => setMsgModal({ isOpen: true, targetId: id, text: '' })} />;
      case 'admin':
        return (
          <AdminTerminal 
            onAdd={addTradeResult} 
            onEdit={editTradeResult} 
            onDelete={deleteTradeResult} 
            onReset={resetAll}
            onRejoin={reactivateUser}
            recentTrades={state.trades}
          />
        );
      case 'simulator':
        return (
          <BotSimulator 
            currentUser={currentUser} 
            onStart={startTrial} 
          />
        );
      case 'users':
        return (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
             <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
               <Shield className="text-blue-400" size={20} />
               User Directory
             </h2>
             <div className="space-y-4">
                {state.users.map(u => (
                    <div key={u.id} className="bg-slate-900/50 p-5 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-600 transition-all">
                        <div>
                            <p className="font-mono text-blue-400 text-sm font-bold">{u.id}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Joined: {new Date(u.joinTimestamp).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                             <div className="text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 block w-fit ml-auto ${u.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                                    {u.status}
                                </span>
                                <p className="text-sm font-bold text-slate-200">{u.points} Pts / {u.tradesCount} Trades</p>
                             </div>
                             <div className="flex gap-2">
                               <button 
                                  onClick={() => setMsgModal({ isOpen: true, targetId: u.id, text: '' })}
                                  className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white p-2.5 rounded-lg transition-all"
                                  title="Message User"
                               >
                                 <MessageSquare size={18} />
                               </button>
                               {u.status === 'exited' && (
                                 <button 
                                  onClick={() => reactivateUser(u.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
                                 >
                                   Reactivate
                                 </button>
                               )}
                             </div>
                        </div>
                    </div>
                ))}
                {state.users.length === 0 && (
                  <div className="text-center py-20 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                    <p className="text-slate-500 italic">No users registered yet.</p>
                  </div>
                )}
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Messaging Modal */}
      {msgModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-400" />
                Message User: <span className="text-blue-400 font-mono text-xs">{msgModal.targetId}</span>
              </h3>
              <button onClick={() => setMsgModal({ ...msgModal, isOpen: false })} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-4 space-y-4">
              <textarea 
                autoFocus
                className="w-full h-32 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Type your message here..."
                value={msgModal.text}
                onChange={(e) => setMsgModal({ ...msgModal, text: e.target.value })}
                required
              />
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                <Send size={18} /> Send Message
              </button>
            </form>
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-white">TradeFlow</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Admin Control</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {NAVIGATION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group
                  ${activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                `}
              >
                <span className={`${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                {item.label}
                {activeTab === item.id && <ChevronRight size={14} className="ml-auto" />}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-4">
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">Disclaimer</p>
              <p className="text-[10px] leading-relaxed text-slate-600 italic">{DISCLAIMER}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-lg text-slate-200 capitalize">
              {NAVIGATION_ITEMS.find(n => n.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-xs text-slate-300 font-medium">Admin Master Active</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 relative">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
