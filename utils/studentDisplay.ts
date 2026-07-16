
import { Student } from '../types';

/**
 * Get the display name for a student, honoring their leaderboard preference:
 * - GAMER_TAG: tag primary, real name small underneath
 * - FULL_NAME: real name primary, tag small underneath (if set)
 * - INITIALS: initials only (privacy mode)
 * - unset: legacy behavior — tag primary when it exists
 */
export const getStudentDisplayName = (student: Student): { primary: string; secondary?: string } => {
  const tag = student.gamerTag?.trim();
  switch (student.displayPreference) {
    case 'FULL_NAME':
      return { primary: student.fullName, secondary: tag || undefined };
    case 'INITIALS':
      return { primary: getInitials(student.fullName) };
    case 'GAMER_TAG':
      if (tag) return { primary: tag, secondary: student.fullName };
      return { primary: student.fullName };
    default:
      if (tag) return { primary: tag, secondary: student.fullName };
      return { primary: student.fullName };
  }
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
