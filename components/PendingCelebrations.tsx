import React, { useEffect, useRef, useState } from 'react';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import { gameCenter, PendingCelebration } from '../services/gameCenter';

interface Props {
  // The kids whose queued congrats this surface should show.
  students: Array<{ id: string; name: string; avatarUrl?: string }>;
}

// Queued big-moment congrats (Volt level ups, house reveals): shown one at a
// time when the portal opens, then marked seen so they never repeat.
const PendingCelebrations: React.FC<Props> = ({ students }) => {
  const [queue, setQueue] = useState<PendingCelebration[]>([]);
  const dismissed = useRef<Set<string>>(new Set());

  const key = students.map((s) => s.id).sort().join(',');
  useEffect(() => {
    if (!key) return;
    return gameCenter.subscribeCelebrations(key.split(','), (rows) => {
      setQueue(rows);
    });
  }, [key]);

  const current = queue.find((r) => !dismissed.current.has(r.id)) ?? null;
  if (!current) return null;

  const student = students.find((s) => s.id === current.studentId);
  const avatar = student?.avatarUrl || undefined;
  const celebration: Celebration = {
    type: current.kind === 'LEVEL_UP' ? 'RANK_UP' : 'BADGE_EARNED',
    studentName: student?.name ?? "Fun 'N Fit Athlete",
    achievement: current.title,
    // No profile photo? Lead with the house logo instead so the card has art.
    studentAvatar: avatar ?? current.icon ?? undefined,
    badgeIcon: avatar ? current.icon ?? undefined : undefined,
    label: current.kind === 'HOUSE_REVEAL' ? 'Drafted into' : undefined,
  };

  const dismiss = () => {
    dismissed.current.add(current.id);
    setQueue((q) => q.filter((r) => r.id !== current.id));
    void gameCenter.markCelebrationsSeen([current.id]);
  };

  return <CelebrationOverlay key={current.id} celebration={celebration} onDismiss={dismiss} />;
};

export default PendingCelebrations;
