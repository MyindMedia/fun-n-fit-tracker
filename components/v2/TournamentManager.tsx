import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Tournament, TournamentType, TournamentParticipant, TournamentMatch, Student } from '../../types';

const TournamentManager: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [details, setDetails] = useState<{
    tournament: Tournament;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
  } | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchStudent, setSearchStudent] = useState('');

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TournamentType>('SINGLE_ELIM');
  const [newMaxParticipants, setNewMaxParticipants] = useState<number>(16);

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      loadDetails(selectedTournament);
      loadStudents();
    }
  }, [selectedTournament]);

  const loadTournaments = async () => {
    setLoading(true);
    const data = await supabaseService.getTournaments();
    setTournaments(data);
    setLoading(false);
  };

  const loadStudents = async () => {
    const data = await supabaseService.getStudents();
    setAllStudents(data);
  };

  const loadDetails = async (id: string) => {
    const data = await supabaseService.getTournamentDetails(id);
    setDetails(data);
  };

  const handleCreate = async () => {
    if (!newName) return;
    try {
      await supabaseService.createTournament(newName, newType, newMaxParticipants);
      setShowCreate(false);
      setNewName('');
      loadTournaments();
    } catch (e) {
      console.error(e);
      alert('Failed to create tournament');
    }
  };

  const handleJoin = async (studentId: string) => {
    if (!selectedTournament) return;
    try {
      await supabaseService.joinTournament(selectedTournament, studentId);
      loadDetails(selectedTournament);
    } catch (e) {
      console.error(e);
      alert('Failed to add participant');
    }
  };

  const handleGenerateBracket = async () => {
    if (!selectedTournament) return;
    if (!window.confirm('Generate bracket? This will lock seeding and start the tournament.')) return;
    try {
      await supabaseService.generateBracket(selectedTournament);
      loadDetails(selectedTournament);
    } catch (e) {
      console.error(e);
      alert('Failed to generate bracket');
    }
  };

  const handleMatchUpdate = async (matchId: string, winnerId: string, score1: number, score2: number) => {
    try {
      await supabaseService.updateMatchResult(matchId, winnerId, score1, score2);
      if (selectedTournament) loadDetails(selectedTournament);
    } catch (e) {
      console.error(e);
      alert('Failed to update match');
    }
  };

  // --- RENDER HELPERS ---

  if (selectedTournament && details) {
    const { tournament, participants, matches } = details;
    const availableStudents = allStudents.filter(s => !participants.some(p => p.studentId === s.id));
    const filteredAvailable = availableStudents.filter(s => s.fullName.toLowerCase().includes(searchStudent.toLowerCase()));

    return (
      <div className="pz-scope space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedTournament(null)}
            className="w-10 h-10 rounded-full bg-[#171C27] border border-white/10 flex items-center justify-center font-bold text-white"
          >
            ←
          </button>
          <div>
            <h2 className="text-2xl text-white uppercase tracking-tight">{tournament.name}</h2>
            <div className="flex gap-2 text-xs font-bold text-[#ABABAB] uppercase">
              <span>{tournament.type.replace('_', ' ')}</span>
              <span>•</span>
              <span className={tournament.status === 'ACTIVE' ? 'text-[#CBFE1C]' : ''}>{tournament.status}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Participants */}
          <div className="lg:col-span-1 space-y-4">
            <div className="pz-card p-4">
              <h3 className="text-white tracking-wide mb-4 flex justify-between">
                <span>Roster ({participants.length}/{tournament.maxParticipants || '∞'})</span>
              </h3>

              {tournament.status === 'REGISTRATION' && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchStudent}
                    onChange={e => setSearchStudent(e.target.value)}
                    className="w-full p-2 text-sm rounded-lg border border-white/10 bg-[#171C27] text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] mb-2"
                  />
                  {searchStudent && (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredAvailable.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleJoin(s.id)}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-white/5 rounded-lg flex justify-between"
                        >
                          <span>{s.fullName}</span>
                          <span className="text-[#CBFE1C]">+ Add</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#171C27] border border-white/10">
                    <span className="text-xs font-black text-[#ABABAB] w-6 text-center">{p.seedPosition || i + 1}</span>
                    {p.student?.avatarUrl && (
                      <img src={p.student.avatarUrl} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                    )}
                    <span className="text-sm font-bold text-white truncate">{p.student?.fullName || 'Unknown'}</span>
                  </div>
                ))}
              </div>

              {tournament.status === 'REGISTRATION' && participants.length >= 2 && (
                <button
                  onClick={handleGenerateBracket}
                  className="w-full mt-4 pz-btn py-3 text-xs active:scale-95"
                >
                  Start Tournament
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Matches */}
          <div className="lg:col-span-2 space-y-4">
             {matches.length === 0 ? (
               <div className="rounded-2xl border-2 border-dashed border-white/10 p-12 text-center text-[#ABABAB]" style={{ background: 'var(--pz-panel)' }}>
                 No matches scheduled yet.
               </div>
             ) : (
               <div className="space-y-4">
                 {/* Group by Round */}
                 {Array.from(new Set(matches.map(m => m.roundNumber))).sort().map(round => (
                   <div key={round}>
                     <h3 className="text-center text-xs text-[#ABABAB] tracking-widest mb-3">Round {round}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {matches.filter(m => m.roundNumber === round).sort((a,b) => a.matchNumber - b.matchNumber).map(m => (
                         <div key={m.id} className={`pz-card-sm p-3 ${m.status === 'COMPLETED' ? 'opacity-60' : ''}`} style={m.status === 'COMPLETED' ? undefined : { borderColor: 'rgba(203, 254, 28, 0.45)' }}>
                           <div className="flex justify-between items-center text-[10px] font-bold text-[#ABABAB] uppercase mb-2">
                             <span>Match {m.matchNumber}</span>
                             <span className={m.status === 'COMPLETED' ? '' : 'text-[#CBFE1C]'}>{m.status}</span>
                           </div>

                           {/* Player 1 */}
                           <div className={`flex items-center justify-between p-2 rounded-lg mb-1 ${m.winnerId === m.participant1Id ? 'bg-[#CBFE1C]/10 text-[#CBFE1C]' : 'bg-[#171C27] text-white'}`}>
                             <div className="flex items-center gap-2">
                               <span className="text-xs font-black text-white/30">{m.p1 ? (participants.find(p => p.studentId === m.p1?.id)?.seedPosition) : '-'}</span>
                               <span className="font-bold text-sm">{m.p1?.fullName || 'TBD'}</span>
                             </div>
                             {m.status === 'SCHEDULED' && m.p1 && m.p2 ? (
                               <input
                                 type="number"
                                 className="w-12 p-1 text-center border border-white/10 rounded bg-[#0B0E13] text-white outline-none focus:border-[#CBFE1C]"
                                 placeholder="-"
                                 id={`score-${m.id}-1`}
                               />
                             ) : (
                               <span className="font-black">{m.score1}</span>
                             )}
                           </div>

                           {/* Player 2 */}
                           <div className={`flex items-center justify-between p-2 rounded-lg ${m.winnerId === m.participant2Id ? 'bg-[#CBFE1C]/10 text-[#CBFE1C]' : 'bg-[#171C27] text-white'}`}>
                             <div className="flex items-center gap-2">
                               <span className="text-xs font-black text-white/30">{m.p2 ? (participants.find(p => p.studentId === m.p2?.id)?.seedPosition) : '-'}</span>
                               <span className="font-bold text-sm">{m.p2?.fullName || 'TBD'}</span>
                             </div>
                             {m.status === 'SCHEDULED' && m.p1 && m.p2 ? (
                               <input
                                 type="number"
                                 className="w-12 p-1 text-center border border-white/10 rounded bg-[#0B0E13] text-white outline-none focus:border-[#CBFE1C]"
                                 placeholder="-"
                                 id={`score-${m.id}-2`}
                               />
                             ) : (
                               <span className="font-black">{m.score2}</span>
                             )}
                           </div>

                           {/* Action Buttons */}
                           {m.status === 'SCHEDULED' && m.p1 && m.p2 && (
                             <button
                               onClick={() => {
                                 const s1 = Number((document.getElementById(`score-${m.id}-1`) as HTMLInputElement).value);
                                 const s2 = Number((document.getElementById(`score-${m.id}-2`) as HTMLInputElement).value);
                                 if (isNaN(s1) || isNaN(s2)) return;
                                 const winner = s1 > s2 ? m.participant1Id : m.participant2Id;
                                 if (winner) handleMatchUpdate(m.id, winner, s1, s2);
                               }}
                               className="w-full mt-2 pz-btn py-1.5 text-xs"
                             >
                               Submit Result
                             </button>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---

  return (
    <div className="pz-scope space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl text-white uppercase tracking-tight">Tournaments</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="pz-btn px-4 py-2 text-sm"
        >
          + New Tournament
        </button>
      </div>

      {showCreate && (
        <div className="pz-card p-4 animate-fade-in" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
          <h3 className="text-white mb-3">Create Tournament</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-[#ABABAB] uppercase mb-1">Tournament Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/10 bg-[#171C27] text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                placeholder="e.g. Winter Showdown"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#ABABAB] uppercase mb-1">Format</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as TournamentType)}
                className="w-full p-3 rounded-xl border border-white/10 bg-[#171C27] text-white outline-none focus:border-[#CBFE1C]"
              >
                <option value="SINGLE_ELIM">Single Elimination</option>
                <option value="DOUBLE_ELIM">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="HOUSE_BATTLE">House Battle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#ABABAB] uppercase mb-1">Max Participants</label>
              <input
                type="number"
                value={newMaxParticipants}
                onChange={e => setNewMaxParticipants(Number(e.target.value))}
                className="w-full p-3 rounded-xl border border-white/10 bg-[#171C27] text-white outline-none focus:border-[#CBFE1C]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-[#ABABAB] font-bold">Cancel</button>
            <button onClick={handleCreate} className="pz-btn px-4 py-2 text-sm">Create</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {tournaments.map(t => (
          <div key={t.id} className="pz-card p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg text-white">{t.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black ${
                  t.status === 'ACTIVE' ? 'bg-[#CBFE1C]/15 text-[#CBFE1C]' :
                  t.status === 'COMPLETED' ? 'bg-white/10 text-[#ABABAB]' :
                  'bg-sky-500/15 text-sky-400'
                }`}>
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-[#ABABAB] font-medium">
                {t.type.replace('_', ' ')} • {t.maxParticipants} Players Max
              </div>
            </div>
            <button
              onClick={() => setSelectedTournament(t.id)}
              className="pz-btn-ghost px-3 py-2 text-xs"
            >
              Manage
            </button>
          </div>
        ))}
        {tournaments.length === 0 && !loading && (
          <div className="text-center py-12 text-[#ABABAB]">No tournaments found.</div>
        )}
      </div>
    </div>
  );
};

export default TournamentManager;
