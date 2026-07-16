import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Student } from '../types';
import StudentPortal from './StudentPortal';
import { HOUSES } from '../constants';
import { getStudentDisplayName } from '../utils/studentDisplay';
import { Ic } from './icons';

const StudentLogin: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    const data = await supabaseService.getStudents();
    setStudents(data);
    setLoading(false);
  };

  const filteredStudents = students.filter(s =>
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.gamerTag && s.gamerTag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (selectedStudent) {
    return (
      <StudentPortal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onRefresh={() => {
          loadStudents();
          supabaseService.getStudents().then(all => {
            const updated = all.find(s => s.id === selectedStudent.id);
            if (updated) setSelectedStudent(updated);
          });
        }}
      />
    );
  }

  // Pubzi theme: small notched cut-corner shape for inline elements
  const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

  return (
    <div className="min-h-screen pz-scope pz-arena flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 mx-auto mb-4 bg-white flex items-center justify-center shadow-lg"
            style={{ clipPath: NOTCH_SM }}
          >
            <img src="/fnfa-logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div className="pz-eyebrow mb-2">Student Portal</div>
          <h1 className="text-3xl text-white tracking-tight mb-2">Pick Your Player</h1>
          <p className="text-sm font-medium" style={{ color: 'var(--pz-text)' }}>Find your name to jump in</p>
        </div>

        <div className="pz-card p-5 sm:p-6">
          <div className="relative mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 flex items-center"><Ic.Search size={16} /></span>
            <input
              type="text"
              placeholder="Search your name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 font-bold text-white placeholder-white/40 focus:border-[#CBFE1C] focus:bg-white/10 outline-none transition-all"
              style={{ clipPath: NOTCH_SM }}
            />
          </div>

          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--pz-text)' }}>Loading players...</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No players found</div>
              ) : (
                filteredStudents.map(student => {
                  const displayName = getStudentDisplayName(student);
                  const house = HOUSES[student.houseId];
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="pz-card-sm relative w-full flex items-center gap-3 p-3 hover:border-[#CBFE1C] transition-all group text-left active:scale-[0.98]"
                      style={{ background: 'var(--pz-panel-2)' }}
                    >
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: house.colorHex }} />
                      <img
                        src={student.avatarUrl}
                        className="w-10 h-10 rounded-full border-2 object-cover shrink-0"
                        style={{ borderColor: house.colorHex }}
                        alt=""
                      />
                      <div className="flex-grow min-w-0">
                        <div className="font-bold text-white truncate">
                          {displayName.primary}
                        </div>
                        {displayName.secondary && (
                          <div className="text-[9px] truncate" style={{ color: 'var(--pz-text)' }}>{displayName.secondary}</div>
                        )}
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: house.colorHex }}>
                          {house.name}
                        </div>
                      </div>
                      <div
                        className="w-8 h-8 flex items-center justify-center text-white/40 border border-white/10 group-hover:bg-[#CBFE1C] group-hover:text-[#0B0E13] group-hover:border-[#CBFE1C] transition-all shrink-0"
                        style={{ clipPath: NOTCH_SM }}
                      >
                        <Ic.ChevronRight size={16} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
