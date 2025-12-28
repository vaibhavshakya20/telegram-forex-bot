
import React, { useState } from 'react';
import { useBotStore } from './store';
import { NAVIGATION_ITEMS, DISCLAIMER } from './constants.tsx';
import DashboardOverview from './components/DashboardOverview';
import AdminTerminal from './components/AdminTerminal';
import BotSimulator from './components/BotSimulator';
import { Shield, ChevronRight, Menu, X, LogOut, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const { state, startTrial, addTradeResult, editTradeResult, deleteTradeResult, resetAll } = useBotStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentUser = state.users.length > 0 ? state.users[state.users.length - 1] : null;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview users={state.users} trades={state.trades} />;
      case 'admin':
        return (
          <AdminTerminal 
            onAdd={addTradeResult} 
            onEdit={editTradeResult} 
            onDelete={deleteTradeResult} 
            onReset={resetAll}
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
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
             <h2 className="text-xl font-bold mb-6 text-white">User Directory</h2>
             <div className="space-y-4">
                {state.users.map(u => (
                    <div key={u.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                            <p className="font-mono text-blue-400 text-sm">{u.id}</p>
                            <p className="text-xs text-slate-500 mt-1">Joined: {new Date(u.joinTimestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 block w-fit ml-auto ${u.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                                {u.status}
                             </span>
                             <p className="text-sm font-bold text-slate-200">{u.points} Points / {u.tradesCount} Trades</p>
                        </div>
                    </div>
                ))}
                {state.users.length === 0 && <p className="text-slate-500 italic text-center py-10">No users registered.</p>}
             </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500">
            <X size={48} className="mb-4 text-slate-700" />
            <p>Module under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
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
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Bot Manager</p>
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
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-bold uppercase">Persistence Alert</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-400">
                    Render Free instances lose files on restart. For permanent data, use MongoDB Atlas.
                </p>
            </div>
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
               <span className="text-xs text-slate-300 font-medium">System Online</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-rose-500 transition-colors">
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
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
