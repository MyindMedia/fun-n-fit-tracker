
import React, { useState, useMemo, useEffect } from 'react';
import { Student, HouseId, Rank } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import StudentAvatar from '../StudentAvatar';

interface RosterListProps {
  students: Student[];
  adminName: string;
  onOpenEdit: (student: Student) => void;
  onRefresh?: () => void;
}

const RosterList: React.FC<RosterListProps> = ({ students, adminName, onOpenEdit, onRefresh }) => {
  const [viewMode, setViewMode] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [list, setList] = useState<Student[]>(students);

  useEffect(() => {
    supabaseService.getRanks().then(setRanks);
  }, []);

  useEffect(() => {
    setList(students);
  }, [students]);

  const groupedStudents = useMemo(() => {
    const groups: Record<HouseId, Student[]> = {
      [HouseId.UNITY]: [],
      [HouseId.SAGE]: [],
      [HouseId.SPARK]: [],
      [HouseId.VALOR]: [],
    };
    list.forEach(s => groups[s.houseId].push(s));
    return groups;
  }, [list]);

  const houseStats = useMemo(() => {
    return Object.values(HOUSES).map(house => {
      const members = groupedStudents[house.id];
      const points = members.reduce((sum, s) => sum + s.points, 0);
      return { ...house, points, memberCount: members.length };
    });
  }, [groupedStudents]);

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-900 uppercase tracking-tight">Athlete Roster</h2>
          <p className="text-slate-400 font-medium text-sm">Review profiles and manage houses.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setViewMode('INDIVIDUAL')}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'INDIVIDUAL' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-400'}`}
          >
            Individual
          </button>
          <button
            onClick={() => setViewMode('TEAM')}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TEAM' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-400'}`}
          >
            Houses
          </button>
        </div>
      </div>

      <div className="pr-2">
        {viewMode === 'INDIVIDUAL' ? (
          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic font-medium">No athletes enrolled yet.</div>
            ) : (
              list.map(s => {
                const studentRank = ranks.find(r => r.id === s.rankId);
                return (
                  <div key={s.id} className="p-4 bg-white border-2 border-slate-50 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 group hover:border-brand-blue/20 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-6 flex-grow min-w-0">
                      <StudentAvatar
                        student={s}
                        rank={studentRank}
                        size="md"
                        showPresence={true}
                      />
                      <div className="truncate">
                        <div className="font-display font-black text-slate-900 text-lg leading-tight truncate">{s.fullName}</div>
                        {s.gamerTag && (
                          <div className="text-slate-400 text-xs truncate">@{s.gamerTag}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white shadow-sm" style={{ backgroundColor: HOUSES[s.houseId].colorHex }}>
                            {HOUSES[s.houseId].name}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.gender}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right mr-2">
                        <div className="text-[8px] font-black text-slate-400 uppercase">Points</div>
                        <div className="text-xl font-display font-black text-brand-blue leading-none">{s.points.toLocaleString()}</div>
                      </div>

                      <button
                        onClick={() => onOpenEdit(s)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black hover:scale-105 active:scale-95 transition-all"
                      >
                        Edit
                      </button>

                      <button
                        onClick={async () => {
                          if (busyId) return;
                          setBusyId(s.id);
                          const next = !s.isPresent;
                          setList(prev => prev.map(p => p.id === s.id ? { ...p, isPresent: next } : p));
                          try {
                            await supabaseService.markPresent(s.id, next, adminName);
                            onRefresh && onRefresh();
                          } catch {
                            setList(prev => prev.map(p => p.id === s.id ? { ...p, isPresent: !next } : p));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        title={s.isPresent ? "Mark Inactive" : "Mark Active"}
                        aria-label={s.isPresent ? "Mark Inactive" : "Mark Active"}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${s.isPresent ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-700'} ${busyId === s.id ? 'opacity-60 cursor-wait' : 'hover:shadow'}`}
                      >
                        {busyId === s.id ? 'Updating…' : (s.isPresent ? 'Active' : 'Inactive')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-12 pb-10">
            {houseStats.map(house => (
              <div key={house.id} className="space-y-6">
                <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                  <div className="flex items-center gap-4">
                    <img src={house.customIcon} className="w-14 h-14 object-contain drop-shadow-md" />
                    <div>
                      <h3 className="text-2xl font-display font-black uppercase tracking-tight" style={{ color: house.colorHex }}>{house.name} House</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{house.memberCount} Athletes • {house.mascot} Mascot</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">House Score</div>
                    <div className="text-3xl font-display font-black" style={{ color: house.colorHex }}>{house.points.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {groupedStudents[house.id].length === 0 ? (
                    <div className="col-span-2 text-center py-6 bg-slate-50 rounded-2xl text-slate-400 text-xs italic">No athletes assigned to this house.</div>
                  ) : (
                    groupedStudents[house.id].map(s => {
                      const studentRank = ranks.find(r => r.id === s.rankId);
                      return (
                        <div
                          key={s.id}
                          onClick={() => onOpenEdit(s)}
                          className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-brand-blue/30 hover:bg-white transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <StudentAvatar
                              student={s}
                              rank={studentRank}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-800 truncate">{s.fullName}</div>
                              {s.gamerTag && (
                                <div className="text-[9px] text-slate-400 truncate">@{s.gamerTag}</div>
                              )}
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.points} pts</div>
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${s.isPresent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RosterList;
