
import { Student } from '../types';

/**
 * Get the display name for a student
 * If gamerTag exists, it's the primary name with fullName as secondary
 * Otherwise, just show fullName
 */
export const getStudentDisplayName = (student: Student): { primary: string; secondary?: string } => {
  if (student.gamerTag && student.gamerTag.trim()) {
    return {
      primary: student.gamerTag,
      secondary: student.fullName
    };
  }
  return { primary: student.fullName };
};

/**
 * Get initials from a name (for fallback displays)
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
