
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
    <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100">
      <h2 className="text-3xl font-display font-black text-slate-900 mb-6 uppercase tracking-tight">Bulk Point Awards</h2>

      {/* Award Type Selector */}
      <div className="mb-6">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Award Type</label>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setAwardType('INDIVIDUAL')}
            className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              awardType === 'INDIVIDUAL' ? 'bg-white text-brand-blue shadow-lg' : 'text-slate-400'
            }`}
          >
            Individual Students
          </button>
          <button
            onClick={() => setAwardType('HOUSE')}
            className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              awardType === 'HOUSE' ? 'bg-white text-brand-blue shadow-lg' : 'text-slate-400'
            }`}
          >
            Entire House
          </button>
        </div>
      </div>

      {/* Action Type Selector */}
      <div className="mb-6">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Action</label>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setActionType('AWARD')}
            className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              actionType === 'AWARD' ? 'bg-white text-brand-blue shadow-lg' : 'text-slate-400'
            }`}
          >
            Award
          </button>
          <button
            onClick={() => setActionType('DEDUCT')}
            className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              actionType === 'DEDUCT' ? 'bg-white text-brand-blue shadow-lg' : 'text-slate-400'
            }`}
          >
            Deduct
          </button>
        </div>
      </div>

      {/* House Selection (if HOUSE type) */}
      {awardType === 'HOUSE' && (
        <div className="mb-6">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Select House</label>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(HOUSES).map(house => (
              <button
                key={house.id}
                onClick={() => setSelectedHouse(house.id)}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  selectedHouse === house.id
                    ? 'border-4 shadow-lg scale-105'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                style={{
                  borderColor: selectedHouse === house.id ? house.colorHex : undefined,
                  backgroundColor: selectedHouse === house.id ? `${house.colorHex}20` : 'white'
                }}
              >
                <div className="text-2xl font-black" style={{ color: house.colorHex }}>
                  {house.name}
                </div>
                <div className="text-xs text-slate-400 mt-1">
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
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Students</label>
            <div className="flex gap-2">
              <select
                value={houseFilter}
                onChange={(e) => setHouseFilter(e.target.value as HouseId | 'ALL')}
                className="px-3 py-1 text-xs font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-brand-blue"
              >
                <option value="ALL">All Houses</option>
                <option value="UNITY">Unity Only</option>
                <option value="SAGE">Sage Only</option>
                <option value="SPARK">Spark Only</option>
                <option value="VALOR">Valor Only</option>
              </select>
              <button
                onClick={selectAllFiltered}
                className="px-4 py-1 text-xs font-black bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-all"
              >
                Select All Visible
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-1 text-xs font-black bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border-2 border-slate-100 rounded-2xl p-4 space-y-2">
            {presentStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No present students found</div>
            ) : (
              presentStudents.map(student => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="w-5 h-5 accent-brand-blue"
                  />
                  <img src={student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white shadow" />
                  <div className="flex-grow">
                    <div className="font-bold text-sm">{student.fullName}</div>
                    <div className="text-xs text-slate-400">{HOUSES[student.houseId].name}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-400">{student.points} pts</div>
                </label>
              ))
            )}
          </div>

          <div className="mt-3 text-center text-sm font-bold text-slate-600">
            Selected: {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Amount Selection */}
      <div className="mb-6">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Point Amount</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[10, 25, 50, 100].map(preset => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-3 rounded-xl text-lg font-black transition-all ${
                amount === preset
                  ? 'bg-brand-blue text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          className="w-full px-4 py-3 text-center text-2xl font-black border-2 border-slate-200 rounded-xl focus:outline-none focus:border-brand-blue"
          placeholder={actionType === 'DEDUCT' ? 'Custom deduction amount' : 'Custom award amount'}
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-brand-blue"
          placeholder="e.g., Great teamwork during practice"
        />
      </div>

      {/* Preview Summary */}
      <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
        <div className="text-sm font-bold text-slate-600 mb-1">Award Summary:</div>
        {awardType === 'HOUSE' && selectedHouse ? (
          <div className="text-lg font-black text-slate-900">
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount} points × {students.filter(s => s.houseId === selectedHouse && s.isPresent).length} students in{' '}
            <span style={{ color: HOUSES[selectedHouse].colorHex }}>{HOUSES[selectedHouse].name}</span> ={' '}
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount * students.filter(s => s.houseId === selectedHouse && s.isPresent).length} total points
          </div>
        ) : awardType === 'INDIVIDUAL' ? (
          <div className="text-lg font-black text-slate-900">
            {(actionType === 'DEDUCT' ? '-' : '+')}{amount} points × {selectedStudents.size} students = {(actionType === 'DEDUCT' ? '-' : '+')}{amount * selectedStudents.size} total points
          </div>
        ) : (
          <div className="text-slate-400 italic">Select students or house to see summary</div>
        )}
      </div>

      {/* Award Button */}
      <button
        onClick={handleAward}
        disabled={isAwarding || (awardType === 'INDIVIDUAL' && selectedStudents.size === 0) || (awardType === 'HOUSE' && !selectedHouse)}
        className={`w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest transition-all ${
          isAwarding || (awardType === 'INDIVIDUAL' && selectedStudents.size === 0) || (awardType === 'HOUSE' && !selectedHouse)
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl active:scale-95'
        }`}
      >
        {isAwarding ? (actionType === 'DEDUCT' ? 'Deducting Points...' : 'Awarding Points...') : (actionType === 'DEDUCT' ? '➖ Deduct Points' : '🎁 Award Points')}
      </button>
    </div>
  );
};

export default BulkAwardForm;
