import React from 'react';
import { Student, Rank } from '../types';
import AvatarRig from './avatar/AvatarRig';

interface StudentAvatarProps {
  student: Student;
  rank?: Rank;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  className?: string;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  rank,
  size = 'md',
  showPresence = false,
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
    </div>
  );
};

export default StudentAvatar;
