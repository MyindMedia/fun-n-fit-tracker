
import React, { useState, useRef } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Student } from '../../types';
import { Ic } from '../icons';

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
      className="pz-btn px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 text-xs md:text-sm flex items-center gap-2 md:gap-3 transition-all active:scale-95"
    >
      <Ic.QrCode size={18} />
      <span className="hidden sm:inline">QR Check-in</span>
      <span className="sm:hidden">QR</span>
    </button>
  );
};

export default AttendanceScanner;
