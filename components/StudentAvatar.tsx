import React from 'react';
import { Student, Rank } from '../types';
import AvatarRig from './avatar/AvatarRig';
import { voltLevelForXp } from '../voltCatalog';

// Pointy-top hexagon for the Volt level tag pinned to the avatar circle
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

interface StudentAvatarProps {
  student: Student;
  rank?: Rank;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  showVoltLevel?: boolean;
  className?: string;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  rank,
  size = 'md',
  showPresence = false,
  showVoltLevel = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const rankIconSizes = {
    sm: 'w-4 h-4 -bottom-0 -right-0',
    md: 'w-6 h-6 -bottom-1 -right-1',
    lg: 'w-10 h-10 -bottom-1 -right-1',
    xl: 'w-12 h-12 -bottom-2 -right-2'
  };

  const presenceSizes = {
    sm: 'w-3 h-3 -bottom-0 -right-0',
    md: 'w-4 h-4 -bottom-0.5 -right-0.5',
    lg: 'w-6 h-6 -bottom-1 -right-1',
    xl: 'w-8 h-8 -bottom-1 -right-1'
  };

  // Volt level tag: bottom-left corner (rank icon owns bottom-right)
  const voltTagSizes = {
    sm: 'w-4 h-5 -bottom-0.5 -left-0.5 text-[8px]',
    md: 'w-5 h-6 -bottom-1 -left-1 text-[10px]',
    lg: 'w-7 h-8 -bottom-1 -left-1 text-xs',
    xl: 'w-8 h-9 -bottom-1 -left-1 text-sm'
  };

  const useRig = student.avatarMode === 'AVATAR';

  return (
    <div className={`relative shrink-0 ${className}`}>
      {useRig ? (
        <div
          className={`${sizeClasses[size]} rounded-full border-4 border-white shadow-md overflow-hidden flex items-end justify-center`}
          style={{ background: 'radial-gradient(circle at 50% 30%, #232B3B 0%, #14171E 80%)' }}
        >
          <AvatarRig look={student.avatarLook} size="100%" />
        </div>
      ) : (
        <img
          src={student.avatarUrl}
          alt={student.fullName}
          className={`${sizeClasses[size]} rounded-full object-cover border-4 border-white shadow-md`}
        />
      )}

      {rank && rank.icon && (
        <div className={`absolute ${rankIconSizes[size]} rounded-full bg-white border-2 border-white shadow-lg overflow-hidden`}>
          <img
            src={rank.icon}
            alt={rank.name}
            className="w-full h-full object-cover"
            title={rank.name}
          />
        </div>
      )}

      {showPresence && (
        <div
          className={`absolute ${presenceSizes[size]} rounded-full border-2 border-white shadow-sm ${
            student.isPresent ? 'bg-emerald-500' : 'bg-slate-500'
          }`}
          style={rank && rank.icon ? { bottom: 'auto', top: '-2px', right: '-2px' } : {}}
        />
      )}

      {showVoltLevel && (
        <div
          className={`absolute ${voltTagSizes[size]}`}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.65))' }}
          title={`Volt Level ${voltLevelForXp(student.totalXp ?? 0)}`}
        >
          <div className="w-full h-full flex items-center justify-center" style={{ clipPath: HEX, background: '#CBFE1C' }}>
            <div
              className="flex items-center justify-center font-black leading-none"
              style={{
                clipPath: HEX,
                background: '#14171E',
                color: '#CBFE1C',
                width: 'calc(100% - 3px)',
                height: 'calc(100% - 3px)',
              }}
            >
              {voltLevelForXp(student.totalXp ?? 0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAvatar;
