
import React from 'react';
import { User, TradeResult, UserStatus } from '../types';
import { Users, Target, Zap, Clock, ShieldCheck, XCircle } from 'lucide-react';
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
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <h3 className="text-2xl font-bold mt-1">{value}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Users size={24} />} 
          label="Total Users" 
          value={users.length} 
          subtext={`${activeUsers.length} Currently Active`}
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatCard 
          icon={<Zap size={24} />} 
          label="Total Trades Posted" 
          value={trades.length} 
          subtext="Across all trials"
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatCard 
          icon={<Target size={24} />} 
          label="Avg User Pts" 
          value={avgPoints} 
          subtext="Target is 10+"
          colorClass="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard 
          icon={<ShieldCheck size={24} />} 
          label="Completion Rate" 
          value={`${users.length ? Math.round((exitedUsers.length / users.length) * 100) : 0}%`} 
          subtext={`${exitedUsers.length} Users Finished`}
          colorClass="bg-purple-500/10 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-1">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            User Status Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-2 overflow-hidden">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-400" />
            Latest Trial Activity
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="pb-3 font-medium">User ID</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Progress</th>
                  <th className="pb-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.slice().reverse().slice(0, 5).map(user => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-4 font-mono text-blue-400">{user.id}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5">
                        {user.status === UserStatus.ACTIVE ? (
                          <ShieldCheck size={14} className="text-emerald-500" />
                        ) : (
                          <XCircle size={14} className="text-slate-500" />
                        )}
                        <span className={user.status === UserStatus.ACTIVE ? 'text-emerald-500' : 'text-slate-500'}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-900 rounded-full max-w-[100px]">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${Math.min((user.tradesCount / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{user.tradesCount}/10</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-500 text-xs">
                      {new Date(user.joinTimestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                   <tr>
                   <td colSpan={4} className="text-center py-10 text-slate-500 italic">No users in simulation.</td>
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
