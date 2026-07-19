
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
    <div className="pz-card p-8 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 shrink-0">
        <div>
          <h2 className="text-3xl text-white tracking-tight">Athlete Roster</h2>
          <p className="font-medium text-sm" style={{ color: 'var(--pz-text)' }}>Review profiles and manage houses.</p>
        </div>
        <div className="flex bg-white/5 p-1.5 border border-white/10">
          <button
            onClick={() => setViewMode('INDIVIDUAL')}
            className={`relative px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'INDIVIDUAL' ? 'bg-white/5 text-[#CBFE1C]' : 'text-white/40'}`}
          >
            Individual
            {viewMode === 'INDIVIDUAL' && <span className="absolute left-2 right-2 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
          </button>
          <button
            onClick={() => setViewMode('TEAM')}
            className={`relative px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TEAM' ? 'bg-white/5 text-[#CBFE1C]' : 'text-white/40'}`}
          >
            Houses
            {viewMode === 'TEAM' && <span className="absolute left-2 right-2 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
          </button>
        </div>
      </div>

      <div className="pr-2">
        {viewMode === 'INDIVIDUAL' ? (
          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="text-center py-20 italic font-medium" style={{ color: 'var(--pz-text)' }}>No athletes enrolled yet.</div>
            ) : (
              list.map(s => {
                const studentRank = ranks.find(r => r.id === s.rankId);
                return (
                  <div key={s.id} className="pz-card-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4 group hover:border-[#CBFE1C]/40 transition-all" style={{ background: 'var(--pz-panel-2)' }}>
                    <div
                      className="flex items-center gap-6 flex-grow min-w-0 cursor-pointer"
                      onClick={() => onOpenEdit(s)}
                      title="View full stats report"
                    >
                      <StudentAvatar
                        student={s}
                        rank={studentRank}
                        size="md"
                        showPresence={true}
                      />
                      <div className="truncate">
                        <div className="pz-display text-white text-lg leading-tight truncate">{s.fullName}</div>
                        {s.gamerTag && (
                          <div className="text-xs truncate" style={{ color: 'var(--pz-text)' }}>@{s.gamerTag}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white shadow-sm" style={{ backgroundColor: HOUSES[s.houseId].colorHex }}>
                            {HOUSES[s.houseId].name}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>{s.gender}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right mr-2">
                        <div className="text-[8px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>Points</div>
                        <div className="pz-display text-xl text-[#CBFE1C] leading-none">{s.points.toLocaleString()}</div>
                      </div>

                      <button
                        onClick={() => onOpenEdit(s)}
                        className="pz-btn-ghost px-6 py-3 text-[10px] hover:scale-105 active:scale-95 transition-all"
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
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border ${s.isPresent ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-white/50'} ${busyId === s.id ? 'opacity-60 cursor-wait' : 'hover:border-white/30'}`}
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
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-4">
                    <img src={house.customIcon} className="w-14 h-14 object-contain drop-shadow-md" />
                    <div>
                      <h3 className="text-2xl tracking-tight" style={{ color: house.colorHex }}>{house.name} House</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--pz-text)' }}>{house.memberCount} Athletes • {house.mascot} Mascot</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-text)' }}>House Score</div>
                    <div className="pz-display text-3xl" style={{ color: house.colorHex }}>{house.points.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {groupedStudents[house.id].length === 0 ? (
                    <div className="col-span-2 text-center py-6 bg-white/5 text-xs italic" style={{ color: 'var(--pz-text)' }}>No athletes assigned to this house.</div>
                  ) : (
                    groupedStudents[house.id].map(s => {
                      const studentRank = ranks.find(r => r.id === s.rankId);
                      return (
                        <div
                          key={s.id}
                          onClick={() => onOpenEdit(s)}
                          className="pz-card-sm relative p-4 hover:border-[#CBFE1C]/40 hover:bg-white/5 transition-all cursor-pointer flex items-center justify-between group"
                          style={{ background: 'var(--pz-panel-2)' }}
                        >
                          <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: house.colorHex }} />
                          <div className="flex items-center gap-4">
                            <StudentAvatar
                              student={s}
                              rank={studentRank}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-black text-white truncate">{s.fullName}</div>
                              {s.gamerTag && (
                                <div className="text-[9px] truncate" style={{ color: 'var(--pz-text)' }}>@{s.gamerTag}</div>
                              )}
                              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>{s.points} pts</div>
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${s.isPresent ? 'bg-emerald-500' : 'bg-white/20'}`} />
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
