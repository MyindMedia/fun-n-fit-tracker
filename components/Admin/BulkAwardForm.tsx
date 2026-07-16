
import React, { useState, useMemo } from 'react';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';

interface BulkAwardFormProps {
  students: Student[];
  adminName: string;
  onComplete: () => void;
}

type AwardType = 'INDIVIDUAL' | 'HOUSE';
type ActionType = 'AWARD' | 'DEDUCT';

const BulkAwardForm: React.FC<BulkAwardFormProps> = ({ students, adminName, onComplete }) => {
  const [awardType, setAwardType] = useState<AwardType>('INDIVIDUAL');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedHouse, setSelectedHouse] = useState<HouseId | null>(null);
  const [houseFilter, setHouseFilter] = useState<HouseId | 'ALL'>('ALL');
  const [amount, setAmount] = useState(10);
  const [description, setDescription] = useState('');
  const [isAwarding, setIsAwarding] = useState(false);
  const [actionType, setActionType] = useState<ActionType>('AWARD');

  const filteredStudents = useMemo(() => {
    if (houseFilter === 'ALL') return students;
    return students.filter(s => s.houseId === houseFilter);
  }, [students, houseFilter]);

  const presentStudents = useMemo(() => {
    return filteredStudents.filter(s => s.isPresent);
  }, [filteredStudents]);

  const selectAllFiltered = () => {
    const ids = presentStudents.map(s => s.id);
    setSelectedStudents(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedStudents(new Set());
  };

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudents(newSet);
  };

  const handleAward = async () => {
    if (isAwarding) return;

    if (awardType === 'INDIVIDUAL' && selectedStudents.size === 0) {
      alert('Please select at least one student');
      return;
    }

    if (awardType === 'HOUSE' && !selectedHouse) {
      alert('Please select a house');
      return;
    }

    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    setIsAwarding(true);
    try {
      if (awardType === 'HOUSE') {
        if (actionType === 'DEDUCT') {
          const count = await supabaseService.deductHousePoints(selectedHouse!, amount, description || 'Manual House Deduction', adminName);
          alert(`✅ Deducted ${amount} points from ${count} students in ${HOUSES[selectedHouse!].name} house!`);
        } else {
          const count = await supabaseService.awardHouseBonus(selectedHouse!, amount, description, adminName);
          alert(`✅ Awarded ${amount} points to ${count} students in ${HOUSES[selectedHouse!].name} house!`);
        }
      } else {
        await supabaseService.addBatchPoints(Array.from(selectedStudents), actionType === 'DEDUCT' ? -amount : amount, description, adminName);
        const verb = actionType === 'DEDUCT' ? 'Deducted' : 'Awarded';
        alert(`✅ ${verb} ${amount} points ${actionType === 'DEDUCT' ? 'from' : 'to'} ${selectedStudents.size} students!`);
      }

      // Reset form
      setSelectedStudents(new Set());
      setSelectedHouse(null);
      setDescription('');
      setAmount(10);
      setActionType('AWARD');
      onComplete();
    } catch (err: any) {
      console.error('Bulk award failed:', err);
      alert(`❌ Failed to award points: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAwarding(false);
    }
  };

  return (
    <div className="pz-scope p-2 sm:p-4">
      <h2 className="text-3xl text-white mb-6 tracking-tight">Bulk Point Awards</h2>

      {/* Award Type Selector */}
      <div className="mb-6">
        <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Award Type</label>
        <div className="flex bg-white/5 p-1.5 border border-white/10">
          <button
            onClick={() => setAwardType('INDIVIDUAL')}
            className={`relative flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              awardType === 'INDIVIDUAL' ? 'bg-white/5 text-[#CBFE1C]' : 'text-white/40'
            }`}
          >
            Individual Students
            {awardType === 'INDIVIDUAL' && <span className="absolute left-2 right-2 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
          </button>
          <button
            onClick={() => setAwardType('HOUSE')}
            className={`relative flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              awardType === 'HOUSE' ? 'bg-white/5 text-[#CBFE1C]' : 'text-white/40'
            }`}
          >
            Entire House
            {awardType === 'HOUSE' && <span className="absolute left-2 right-2 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
          </button>
        </div>
      </div>

      {/* Action Type Selector */}
      <div className="mb-6">
        <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Action</label>
        <div className="flex bg-white/5 p-1.5 border border-white/10">
          <button
            onClick={() => setActionType('AWARD')}
            className={`relative flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              actionType === 'AWARD' ? 'bg-white/5 text-[#CBFE1C]' : 'text-white/40'
            }`}
          >
            Award
            {actionType === 'AWARD' && <span className="absolute left-2 right-2 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
          </button>
          <button
            onClick={() => setActionType('DEDUCT')}
            className={`relative flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              actionType === 'DEDUCT' ? 'bg-white/5 text-red-400' : 'text-white/40'
            }`}
          >
            Deduct
            {actionType === 'DEDUCT' && <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-red-500" />}
          </button>
        </div>
      </div>

      {/* House Selection (if HOUSE type) */}
      {awardType === 'HOUSE' && (
        <div className="mb-6">
          <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Select House</label>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(HOUSES).map(house => (
              <button
                key={house.id}
                onClick={() => setSelectedHouse(house.id)}
                className={`p-4 border-2 transition-all ${
                  selectedHouse === house.id
                    ? 'scale-105'
                    : 'border-white/10 hover:border-white/25'
                }`}
                style={{
                  borderColor: selectedHouse === house.id ? house.colorHex : undefined,
                  backgroundColor: selectedHouse === house.id ? `${house.colorHex}20` : '#171C27'
                }}
              >
                <div className="text-2xl font-black" style={{ color: house.colorHex }}>
                  {house.name}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--pz-text)' }}>
                  {students.filter(s => s.houseId === house.id && s.isPresent).length} present
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Individual Student Selection */}
      {awardType === 'INDIVIDUAL' && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Select Students</label>
            <div className="flex gap-2">
              <select
                value={houseFilter}
                onChange={(e) => setHouseFilter(e.target.value as HouseId | 'ALL')}
                className="px-3 py-1 text-xs font-bold border border-white/10 bg-[#171C27] text-white focus:outline-none focus:border-[#CBFE1C]"
              >
                <option value="ALL">All Houses</option>
                <option value="UNITY">Unity Only</option>
                <option value="SAGE">Sage Only</option>
                <option value="SPARK">Spark Only</option>
                <option value="VALOR">Valor Only</option>
              </select>
              <button
                onClick={selectAllFiltered}
                className="px-4 py-1 text-xs font-black bg-[#CBFE1C] text-[#0B0E13] hover:brightness-110 transition-all"
              >
                Select All Visible
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-1 text-xs font-black bg-white/10 text-white/60 border border-white/10 hover:bg-white/20 transition-all"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-white/10 p-4 space-y-2" style={{ background: 'var(--pz-panel)' }}>
            {presentStudents.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--pz-text)' }}>No present students found</div>
            ) : (
              presentStudents.map(student => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="w-5 h-5 accent-[#CBFE1C]"
                  />
                  <img src={student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white/10" />
                  <div className="flex-grow">
                    <div className="font-bold text-sm text-white">{student.fullName}</div>
                    <div className="text-xs" style={{ color: HOUSES[student.houseId].colorHex }}>{HOUSES[student.houseId].name}</div>
                  </div>
                  <div className="text-xs font-bold" style={{ color: 'var(--pz-text)' }}>{student.points} pts</div>
                </label>
              ))
            )}
          </div>

          <div className="mt-3 text-center text-sm font-bold text-white/70">
            Selected: {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Amount Selection */}
      <div className="mb-6">
        <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Point Amount</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[10, 25, 50, 100].map(preset => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-3 text-lg font-black transition-all ${
                amount === preset
                  ? 'bg-[#CBFE1C] text-[#0B0E13] scale-105'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {actionType === 'DEDUCT' ? `-${preset}` : `+${preset}`}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full px-4 py-3 text-center text-2xl font-black border border-white/10 bg-[#171C27] text-[#CBFE1C] placeholder-white/30 focus:outline-none focus:border-[#CBFE1C]"
          placeholder={actionType === 'DEDUCT' ? 'Custom deduction amount' : 'Custom award amount'}
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-3 border border-white/10 bg-[#171C27] text-white placeholder-white/40 font-bold focus:outline-none focus:border-[#CBFE1C]"
          placeholder="e.g., Great teamwork during practice"
        />
      </div>

      {/* Preview Summary */}
      <div className="mb-6 p-4 border border-white/10" style={{ background: 'var(--pz-panel-2)' }}>
        <div className="text-sm font-bold mb-1" style={{ color: 'var(--pz-text)' }}>Award Summary:</div>
        {awardType === 'HOUSE' && selectedHouse ? (
          <div className="text-lg font-black text-white">
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount} points × {students.filter(s => s.houseId === selectedHouse && s.isPresent).length} students in{' '}
            <span style={{ color: HOUSES[selectedHouse].colorHex }}>{HOUSES[selectedHouse].name}</span> ={' '}
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount * students.filter(s => s.houseId === selectedHouse && s.isPresent).length} total points
          </div>
        ) : awardType === 'INDIVIDUAL' ? (
          <div className="text-lg font-black text-white">
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount} points × {selectedStudents.size} students = {(actionType === 'DEDUCT' ? '-' : '+')}{amount * selectedStudents.size} total points
          </div>
        ) : (
          <div className="italic" style={{ color: 'var(--pz-text)' }}>Select students or house to see summary</div>
        )}
      </div>

      {/* Award Button */}
      <button
        onClick={handleAward}
        disabled={isAwarding || (awardType === 'INDIVIDUAL' && selectedStudents.size === 0) || (awardType === 'HOUSE' && !selectedHouse)}
        className={`w-full py-4 font-black text-lg uppercase tracking-widest transition-all ${
          isAwarding || (awardType === 'INDIVIDUAL' && selectedStudents.size === 0) || (awardType === 'HOUSE' && !selectedHouse)
            ? 'bg-white/10 text-white/30 cursor-not-allowed'
            : 'pz-btn active:scale-95'
        }`}
      >
        {isAwarding ? (actionType === 'DEDUCT' ? 'Deducting Points...' : 'Awarding Points...') : (actionType === 'DEDUCT' ? '➖ Deduct Points' : '🎁 Award Points')}
      </button>
    </div>
  );
};

export default BulkAwardForm;
