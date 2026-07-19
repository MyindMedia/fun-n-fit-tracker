import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { Ic } from '../icons';

type Announcement = {
  id: string; title: string; excerpt: string; content: string; priority: string; publishedAt: number;
};
type Alert = {
  id: string; type: string; studentName: string; avatarUrl: string | null; message: string; timestamp: number;
};

const timeAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const alertIcon = (type: string) =>
  type === 'MEDAL' ? <Ic.Medal size={18} /> : type === 'RANK_UP' ? <Ic.Trophy size={18} /> : <Ic.Star size={18} />;

const ParentNews: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = gameCenter.subscribeParentNews((feed) => {
      setAnnouncements(feed.announcements);
      setAlerts(feed.alerts);
      setLoaded(true);
    });
    return unsub;
  }, []);

  return (
    <div className="pz-scope space-y-6">
      <section>
        <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>
          Announcements
        </h3>
        {announcements.length === 0 ? (
          <div className="pz-card-sm p-4 text-sm text-white/50">
            {loaded ? 'No announcements yet.' : 'Loading…'}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="pz-card-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  {a.priority === 'HIGH' && (
                    <span
                      className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5"
                      style={{ background: 'var(--pz-volt)', color: '#0B0E13' }}
                    >
                      Alert
                    </span>
                  )}
                  <span className="font-black text-white text-[15px]">{a.title}</span>
                </div>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{a.excerpt || a.content}</p>
                <div className="text-[11px] text-white/40 mt-2">{timeAgo(a.publishedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>
          Your Kids' Wins
        </h3>
        {alerts.length === 0 ? (
          <div className="pz-card-sm p-4 text-sm text-white/50">
            {loaded ? 'No wins yet — check back after the next session.' : 'Loading…'}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((al) => (
              <div key={al.id} className="pz-card-sm p-3 flex items-center gap-3">
                {al.avatarUrl ? (
                  <img
                    src={al.avatarUrl}
                    className="w-9 h-9 rounded-full border-2 border-white/10 object-cover flex-shrink-0"
                    alt=""
                  />
                ) : (
                  <span
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                    style={{ color: 'var(--pz-volt)' }}
                  >
                    {alertIcon(al.type)}
                  </span>
                )}
                <div className="flex-grow min-w-0">
                  <div className="text-sm text-white">{al.message}</div>
                  <div className="text-[11px] text-white/40">{timeAgo(al.timestamp)}</div>
                </div>
                <span className="flex-shrink-0" style={{ color: 'var(--pz-volt)' }}>
                  {alertIcon(al.type)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ParentNews;
