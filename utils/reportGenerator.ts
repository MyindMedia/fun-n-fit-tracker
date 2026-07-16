import { Student, House, GameSession, Rank, Badge } from '../types';

/**
 * Downloads a CSV file with the given content and filename
 */
const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Escapes CSV values to handle commas, quotes, and newlines
 */
const escapeCSV = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape double quotes by doubling them and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Generates a CSV report for student progress
 */
export const generateStudentReport = (students: Student[], ranks: Rank[], badges: Badge[]) => {
  const headers = ['Name', 'House', 'Gender', 'Points', 'Rank', 'Badges Earned', 'Attendance Status'];

  const rows = students.map(student => {
    const rank = ranks.find(r => r.id === student.rankId);
    const studentBadges = (student.badges || [])
      .map(badgeId => badges.find(b => b.id === badgeId)?.name)
      .filter(Boolean)
      .join('; ');

    return [
      escapeCSV(student.fullName),
      escapeCSV(student.houseId),
      escapeCSV(student.gender || 'N/A'),
      escapeCSV(student.points),
      escapeCSV(rank?.name || 'Unknown'),
      escapeCSV(studentBadges || 'None'),
      escapeCSV(student.isPresent ? 'Present' : 'Absent')
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `student-progress-report-${date}.csv`);
};

/**
 * Generates a CSV report for house rankings
 */
export const generateHouseReport = (houses: House[]) => {
  const headers = ['Rank', 'House Name', 'Total Points', 'Color'];

  const sorted = [...houses].sort((a, b) => b.totalPoints - a.totalPoints);
  const rows = sorted.map((house, index) => [
    escapeCSV(index + 1),
    escapeCSV(house.name),
    escapeCSV(house.totalPoints),
    escapeCSV(house.colorHex)
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `house-rankings-${date}.csv`);
};

/**
 * Generates a CSV report for drill/game history
 */
export const generateDrillHistory = (games: GameSession[], students: Student[]) => {
  const headers = [
    'Game Title',
    'Started By',
    'Start Time',
    'End Time',
    'Duration (minutes)',
    'Participants',
    'Status',
    'Winning House',
    'Winning Score',
    'MVP Student'
  ];

  const rows = games.map(game => {
    const startDate = new Date(game.startTime).toLocaleString();
    const endDate = new Date(game.endTime).toLocaleString();
    const duration = Math.round((game.endTime - game.startTime) / 60000);
    const participants = game.roster
      .map(id => students.find(s => s.id === id)?.fullName)
      .filter(Boolean)
      .join('; ');

    const winningHouse = game.results?.winningHouseId || 'N/A';
    const winningScore = game.results?.winningHouseScore || 'N/A';
    const mvpStudent = game.results?.mvpStudentId
      ? students.find(s => s.id === game.results?.mvpStudentId)?.fullName || 'N/A'
      : 'N/A';

    return [
      escapeCSV(game.title),
      escapeCSV(game.startedBy || 'Unknown'),
      escapeCSV(startDate),
      escapeCSV(endDate),
      escapeCSV(duration),
      escapeCSV(participants),
      escapeCSV(game.isActive ? 'Active' : 'Completed'),
      escapeCSV(winningHouse),
      escapeCSV(winningScore),
      escapeCSV(mvpStudent)
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `drill-history-${date}.csv`);
};

/**
 * Generates a comprehensive CSV report with all students and their transaction history
 */
export const generateTransactionReport = (
  students: Student[],
  transactions: Array<{ studentId: string; amount: number; description: string; createdAt: string | Date }>
) => {
  const headers = ['Student Name', 'House', 'Points Earned', 'Transaction Type', 'Description', 'Date'];

  const rows = transactions.map(tx => {
    const student = students.find(s => s.id === tx.studentId);
    const date = new Date(tx.createdAt).toLocaleString();

    return [
      escapeCSV(student?.fullName || 'Unknown'),
      escapeCSV(student?.houseId || 'N/A'),
      escapeCSV(tx.amount),
      escapeCSV(tx.amount > 0 ? 'Points Awarded' : 'Points Deducted'),
      escapeCSV(tx.description),
      escapeCSV(date)
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `transaction-history-${date}.csv`);
};
