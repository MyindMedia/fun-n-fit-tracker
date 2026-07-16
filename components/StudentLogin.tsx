import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Student } from '../types';
import StudentPortal from './StudentPortal';
import { HOUSES } from '../constants';
import { getStudentDisplayName } from '../utils/studentDisplay';

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-brand-blue p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <img src="/fnfa-logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Student Portal</h1>
            <p className="text-blue-100 text-sm font-medium">Find your name to login</p>
          </div>
        </div>

        <div className="p-6">
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search your name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-900 focus:border-brand-blue focus:bg-white outline-none transition-all"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading students...</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No students found</div>
              ) : (
                filteredStudents.map(student => {
                  const displayName = getStudentDisplayName(student);
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group text-left"
                    >
                      <img
                        src={student.avatarUrl}
                        className="w-10 h-10 rounded-full border-2 object-cover"
                        style={{ borderColor: HOUSES[student.houseId].colorHex }}
                        alt=""
                      />
                      <div className="flex-grow min-w-0">
                        <div className="font-black text-slate-900 truncate group-hover:text-brand-blue transition-colors">
                          {displayName.primary}
                        </div>
                        {displayName.secondary && (
                          <div className="text-[9px] text-slate-400 truncate">{displayName.secondary}</div>
                        )}
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {HOUSES[student.houseId].name}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all">
                        ➜
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
