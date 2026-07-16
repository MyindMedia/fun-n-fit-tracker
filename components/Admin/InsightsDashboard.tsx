
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
import { Ic } from '../icons';

interface InsightsDashboardProps {
  students: Student[];
}

// Pubzi dark chart chrome
const CHART_GRID = 'rgba(255,255,255,0.08)';
const CHART_TICK = { fontSize: 10, fontWeight: 900, fill: '#ABABAB' };
const CHART_TOOLTIP: React.CSSProperties = {
  background: '#171C27',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '0.5rem',
  color: '#ffffff',
  fontWeight: 'bold'
};

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

  if (loading) return <div className="pz-scope text-center py-20 text-[#ABABAB] font-black uppercase tracking-widest animate-pulse">Loading Analytics Data...</div>;

  const velocityData = processVelocityData();
  const houseData = processHouseData();

  return (
    <div className="pz-scope space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="pz-card p-8">
           <div className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-1">Total Points Awarded</div>
           <div className="text-4xl pz-display text-white">
             {transactions.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0).toLocaleString()}
           </div>
        </div>
        <div className="pz-card p-8">
           <div className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-1">Active Athletes</div>
           <div className="text-4xl pz-display text-white">
             {students.filter(s => s.isPresent).length} / {students.length}
           </div>
        </div>
        <div className="pz-card p-8" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
           <div className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-1">Weekly Velocity</div>
           <div className="text-4xl pz-display text-[#CBFE1C]">
             +{velocityData.reduce((sum, d) => sum + d.points, 0).toLocaleString()}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="pz-card p-8">
          <h3 className="text-xl text-white mb-8 uppercase tracking-tight">Point Velocity (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CBFE1C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CBFE1C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                <Tooltip
                   contentStyle={CHART_TOOLTIP}
                   labelStyle={{ color: '#ABABAB' }}
                   itemStyle={{ color: '#CBFE1C' }}
                />
                <Area type="monotone" dataKey="points" stroke="#CBFE1C" strokeWidth={4} fillOpacity={1} fill="url(#colorPoints)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pz-card p-8">
          <h3 className="text-xl text-white mb-8 uppercase tracking-tight">Point Distribution by House</h3>
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
                  stroke="#12161F"
                >
                  {houseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  labelStyle={{ color: '#ABABAB' }}
                  itemStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="hidden md:block space-y-2 ml-4">
              {houseData.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                  <span className="text-[10px] font-black text-white uppercase">{h.name}: {h.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export Reports Section */}
      <div className="pz-card p-8">
        <h3 className="text-xl text-white mb-6 uppercase tracking-tight inline-flex items-center gap-2.5"><Ic.Chart size={22} className="text-[#CBFE1C]" /> Export Reports</h3>
        <p className="text-sm text-[#ABABAB] font-medium mb-6">
          Download comprehensive CSV reports for record-keeping, parent updates, and data analysis.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => generateStudentReport(students, ranks, badges)}
            className="min-h-[52px] bg-[#0ea5e9] hover:bg-sky-400 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Ic.Chart size={16} /> Student Progress
          </button>
          <button
            onClick={async () => {
              const { houses } = await supabaseService.getLeaderboardData('ALL');
              generateHouseReport(houses);
            }}
            className="min-h-[52px] bg-[#10b981] hover:bg-emerald-400 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Ic.Trophy size={16} /> House Rankings
          </button>
          <button
            onClick={() => generateDrillHistory(games, students)}
            className="min-h-[52px] bg-[#f97316] hover:bg-orange-400 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Ic.ClipboardCheck size={16} /> Game History
          </button>
          <button
            onClick={() => generateTransactionReport(students, transactions)}
            className="min-h-[52px] bg-[#8b5cf6] hover:bg-violet-400 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Ic.Coin size={16} /> Transactions
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightsDashboard;
