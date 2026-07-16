
import React, { useState, useRef } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Student } from '../../types';

interface AttendanceScannerProps {
  students: Student[];
  adminName: string;
  onOpenQRScanner: () => void;
}

const AttendanceScanner: React.FC<AttendanceScannerProps> = ({ students, adminName, onOpenQRScanner }) => {
  return (
    <button
      type="button"
      aria-label="Open QR scanner"
      onClick={onOpenQRScanner}
      className="bg-slate-900 text-white px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 rounded-2xl font-black uppercase text-xs md:text-sm tracking-wider flex items-center gap-2 md:gap-3 shadow-xl hover:bg-black transition-all active:scale-95"
    >
      <span className="text-base md:text-lg">📱</span>
      <span className="hidden sm:inline">QR Check-in</span>
      <span className="sm:hidden">QR</span>
    </button>
  );
};

export default AttendanceScanner;
