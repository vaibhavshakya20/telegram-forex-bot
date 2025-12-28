
import React from 'react';
import { User, TradeResult, UserStatus } from '../types';
import { Users, Target, Zap, Clock, ShieldCheck, XCircle, MessageCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardOverviewProps {
  users: User[];
  trades: TradeResult[];
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ users, trades }) => {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  const exitedUsers = users.filter(u => u.status === UserStatus.EXITED);
  
  const totalPoints = users.reduce((acc, u) => acc + u.points, 0);
  const avgPoints = users.length ? (totalPoints / users.length).toFixed(1) : 0;

  const data = [
    { name: 'Active', value: activeUsers.length, color: '#10b981' },
    { name: 'Exited', value: exitedUsers.length, color: '#f43f5e' },
  ];

  const StatCard = ({ icon, label, value, subtext, colorClass }: any) => (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-start gap-4 shadow-lg shadow-slate-900/20">
      <div className={`p-3 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <h3 className="text-2xl font-bold mt-1 text-white">{value}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Users size={24} />} 
          label="Total Leads" 
          value={users.length} 
          subtext={`${activeUsers.length} Users Active`}
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatCard 
          icon={<Zap size={24} />} 
          label="Signals Sent" 
          value={trades.length} 
          subtext="Total results posted"
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatCard 
          icon={<Target size={24} />} 
          label="Avg Score" 
          value={avgPoints} 
          subtext="Trial avg points"
          colorClass="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard 
          icon={<ShieldCheck size={24} />} 
          label="Finishers" 
          value={exitedUsers.length} 
          subtext="Completed trial"
          colorClass="bg-purple-500/10 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-1 shadow-xl">
          <h3 className="font-bold mb-6 flex items-center gap-2 text-white">
            <Zap size={18} className="text-amber-400" />
            Active vs Exited
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                  cursor={{ fill: '#ffffff08' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-2 overflow-hidden shadow-xl">
          <h3 className="font-bold mb-6 flex items-center gap-2 text-white">
            <Clock size={18} className="text-blue-400" />
            Recent Activity Log
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-3 px-2 font-bold uppercase text-[10px] tracking-wider">User ID</th>
                  <th className="pb-3 px-2 font-bold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="pb-3 px-2 font-bold uppercase text-[10px] tracking-wider">Points</th>
                  <th className="pb-3 px-2 font-bold uppercase text-[10px] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice().reverse().slice(0, 10).map(user => (
                  <tr key={user.id} className="bg-slate-900/40 hover:bg-slate-900/60 transition-colors group">
                    <td className="py-4 px-2 rounded-l-lg font-mono text-blue-400 text-xs">{user.id}</td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${user.status === UserStatus.ACTIVE ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className={`text-xs font-bold uppercase ${user.status === UserStatus.ACTIVE ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                       <span className="text-sm font-bold text-slate-200">{user.points} Pts</span>
                       <span className="text-[10px] text-slate-500 ml-2">({user.tradesCount}/10 T)</span>
                    </td>
                    <td className="py-4 px-2 rounded-r-lg text-right">
                       <button className="p-2 text-slate-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
                         <MessageCircle size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                   <tr>
                    <td colSpan={4} className="text-center py-20 text-slate-600 italic">Database is currently empty.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
