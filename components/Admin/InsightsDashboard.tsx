
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabaseService } from '../../services/supabaseService';
import { Transaction, Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import {
  generateStudentReport,
  generateHouseReport,
  generateDrillHistory,
  generateTransactionReport
} from '../../utils/reportGenerator';

interface InsightsDashboardProps {
  students: Student[];
}

const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ students }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await supabaseService.getTransactions(30);
        const ranksData = await supabaseService.getRanks();
        const badgesData = await supabaseService.getBadges();
        const gamesData = await supabaseService.getGameHistory();
        setTransactions(data);
        setRanks(ranksData);
        setBadges(badgesData);
        setGames(gamesData);
      } catch (err) {
        console.error("Insights fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const processVelocityData = () => {
    const dailyPoints: Record<string, number> = {};
    transactions.forEach(tx => {
      const date = new Date(tx.createdAt).toLocaleDateString();
      dailyPoints[date] = (dailyPoints[date] || 0) + Math.abs(tx.amount);
    });
    return Object.entries(dailyPoints).map(([name, points]) => ({ name, points })).slice(-7);
  };

  const processHouseData = () => {
    const data: Record<string, number> = {};
    students.forEach(s => {
      data[s.houseId] = (data[s.houseId] || 0) + s.points;
    });
    return Object.entries(data).map(([id, value]) => ({
      name: HOUSES[id as HouseId].name,
      value,
      color: HOUSES[id as HouseId].colorHex
    }));
  };

  if (loading) return <div className="text-center py-20 text-slate-400 font-black uppercase tracking-widest animate-pulse">Loading Analytics Data...</div>;

  const velocityData = processVelocityData();
  const houseData = processHouseData();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Points Awarded</div>
           <div className="text-4xl font-display font-black text-slate-900">
             {transactions.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0).toLocaleString()}
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Athletes</div>
           <div className="text-4xl font-display font-black text-slate-900">
             {students.filter(s => s.isPresent).length} / {students.length}
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weekly Velocity</div>
           <div className="text-4xl font-display font-black text-brand-green">
             +{velocityData.reduce((sum, d) => sum + d.points, 0).toLocaleString()}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black mb-8 uppercase tracking-tight">Point Velocity (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip 
                   contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'black' }}
                />
                <Area type="monotone" dataKey="points" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorPoints)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black mb-8 uppercase tracking-tight">Point Distribution by House</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={houseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {houseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="hidden md:block space-y-2 ml-4">
              {houseData.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                  <span className="text-[10px] font-black text-slate-700 uppercase">{h.name}: {h.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export Reports Section */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
        <h3 className="text-xl font-black mb-6 uppercase tracking-tight">📊 Export Reports</h3>
        <p className="text-sm text-slate-500 font-medium mb-6">
          Download comprehensive CSV reports for record-keeping, parent updates, and data analysis.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => generateStudentReport(students, ranks, badges)}
            className="bg-brand-blue hover:bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            📈 Student Progress
          </button>
          <button
            onClick={async () => {
              const { houses } = await supabaseService.getLeaderboardData('ALL');
              generateHouseReport(houses);
            }}
            className="bg-brand-green hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            🏆 House Rankings
          </button>
          <button
            onClick={() => generateDrillHistory(games, students)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            📋 Game History
          </button>
          <button
            onClick={() => generateTransactionReport(students, transactions)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            💰 Transactions
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightsDashboard;
