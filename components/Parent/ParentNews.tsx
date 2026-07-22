// News inbox — announcements and kid wins only; coach messages live in the
// Messages tab and are counted there. Unread items carry a volt bar; tap opens
// the full detail sheet (and marks it read). Select mode adds checkboxes,
// Select All and Mark as Read.
import React, { useEffect, useMemo, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { NewsItem } from '../../types';
import { Ic } from '../icons';
import { PZ } from './shared';

const timeAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fullTime = (ts: number): string =>
  new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

const kindIcon = (item: NewsItem) =>
  item.kind === 'ANNOUNCEMENT' ? <Ic.Megaphone size={18} /> : <Ic.Trophy size={18} />;

const kindLabel = (item: NewsItem): string =>
  item.kind === 'ANNOUNCEMENT' ? 'Announcement' : 'Win';

const ParentNews: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<NewsItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = gameCenter.subscribeParentNews((feed) => {
      setItems(feed.items);
      setLoaded(true);
      // Drop selections for items that fell out of the feed.
      setSelected((prev) => {
        if (prev.size === 0) return prev;
        const live = new Set(feed.items.map((i) => i.id));
        const next = new Set([...prev].filter((id) => live.has(id)));
        return next.size === prev.size ? prev : next;
      });
    });
    return unsub;
  }, []);

  const unreadIds = useMemo(() => items.filter((i) => !i.read).map((i) => i.id), [items]);
  const allSelected = items.length > 0 && selected.size === items.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const markSelectedRead = async () => {
    const ids = [...selected];
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      await gameCenter.markNewsRead(ids);
      setSelected(new Set());
      setSelectMode(false);
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    if (unreadIds.length === 0 || busy) return;
    setBusy(true);
    try {
      await gameCenter.markNewsRead(unreadIds);
    } finally {
      setBusy(false);
    }
  };

  const openItem = (item: NewsItem) => {
    setOpen(item);
    if (!item.read) gameCenter.markNewsRead([item.id]).catch(() => {});
  };

  const markOpenUnread = async () => {
    if (!open) return;
    await gameCenter.markNewsUnread([open.id]).catch(() => {});
    setOpen(null);
  };

  return (
    <div className="pz-scope">
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        flexWrap: 'wrap', marginBottom: '0.85rem',
      }}>
        <span className="pz-eyebrow" style={{ marginRight: 'auto', color: PZ.muted }}>
          Inbox{unreadIds.length > 0 ? ` · ${unreadIds.length} new` : ''}
        </span>
        {selectMode ? (
          <>
            <button onClick={toggleSelectAll} style={toolbarBtn}>
              {allSelected ? 'Clear All' : 'Select All'}
            </button>
            <button
              onClick={markSelectedRead}
              disabled={selected.size === 0 || busy}
              className="pz-btn"
              style={{ ...toolbarBtn, ...toolbarPrimary, opacity: selected.size === 0 || busy ? 0.45 : 1 }}
            >
              Mark as Read{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button
              onClick={() => { setSelectMode(false); setSelected(new Set()); }}
              style={toolbarBtn}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <button
              onClick={markAllRead}
              disabled={unreadIds.length === 0 || busy}
              style={{ ...toolbarBtn, opacity: unreadIds.length === 0 || busy ? 0.45 : 1 }}
            >
              Mark All Read
            </button>
            <button onClick={() => setSelectMode(true)} style={toolbarBtn}>Select</button>
          </>
        )}
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div className="pz-card-sm p-4 text-sm text-white/50">
          {loaded ? 'No news yet — announcements and your kids’ wins land here.' : 'Loading…'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => (selectMode ? toggle(item.id) : openItem(item))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectMode ? toggle(item.id) : openItem(item);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
                  padding: '0.8rem', cursor: 'pointer', textAlign: 'left',
                  background: item.read ? PZ.panel : 'rgba(203, 254, 28, 0.06)',
                  border: `1px solid ${isSelected ? PZ.volt : PZ.border}`,
                  borderLeft: `3px solid ${item.read ? 'transparent' : PZ.volt}`,
                  borderRadius: '6px',
                }}
              >
                {selectMode && (
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0, width: '20px', height: '20px', marginTop: '2px',
                      borderRadius: '4px', border: `2px solid ${isSelected ? PZ.volt : PZ.border}`,
                      background: isSelected ? PZ.volt : 'transparent',
                      color: PZ.bg, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {isSelected && <Ic.Check size={14} />}
                  </span>
                )}

                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt=""
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.1)', flexShrink: 0,
                    }}
                  />
                ) : (
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)', color: PZ.volt,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {kindIcon(item)}
                  </span>
                )}

                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                    {item.priority === 'HIGH' && (
                      <span style={{
                        fontSize: '0.5625rem', fontWeight: 900, textTransform: 'uppercase',
                        letterSpacing: '0.08em', padding: '1px 5px',
                        background: PZ.volt, color: PZ.bg,
                      }}>
                        Alert
                      </span>
                    )}
                    <span style={{
                      fontSize: '0.9375rem', color: PZ.white, minWidth: 0,
                      fontWeight: item.read ? 600 : 900,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.title}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.8125rem', color: item.read ? PZ.muted : 'rgba(255,255,255,0.8)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.preview}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: PZ.faint, marginTop: '0.25rem' }}>
                    {kindLabel(item)} · {timeAgo(item.timestamp)}
                  </div>
                </div>

                {!selectMode && (
                  <span style={{ flexShrink: 0, color: PZ.faint, marginTop: '0.4rem' }}>
                    <Ic.ChevronRight size={16} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail sheet */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 260,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setOpen(null)}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={open.title}
            style={{
              position: 'relative', width: '100%', maxWidth: '560px',
              maxHeight: '82vh', display: 'flex', flexDirection: 'column',
              background: PZ.panel, border: `1px solid ${PZ.border}`,
              borderRadius: '12px 12px 0 0',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '1rem', borderBottom: `1px solid ${PZ.border}`, flexShrink: 0,
            }}>
              <span style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', color: PZ.volt,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {kindIcon(open)}
              </span>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: PZ.white }}>{open.title}</div>
                <div style={{ fontSize: '0.6875rem', color: PZ.faint, marginTop: '0.15rem' }}>
                  {kindLabel(open)} · {fullTime(open.timestamp)}
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                style={{
                  flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${PZ.border}`,
                  color: PZ.muted, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ic.XMark size={18} />
              </button>
            </div>

            <div style={{
              flexGrow: 1, overflowY: 'auto', padding: '1rem',
              fontSize: '0.9375rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {open.body}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', flexShrink: 0 }}>
              <button onClick={markOpenUnread} style={{ ...toolbarBtn, minHeight: '46px' }}>
                Mark Unread
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const toolbarBtn: React.CSSProperties = {
  minHeight: '40px', padding: '0 0.8rem', cursor: 'pointer',
  background: 'transparent', border: `1px solid ${PZ.border}`, borderRadius: '4px',
  color: PZ.text, fontFamily: 'inherit', fontSize: '0.6875rem', fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
};

const toolbarPrimary: React.CSSProperties = {
  background: PZ.volt, border: `1px solid ${PZ.volt}`, color: PZ.bg,
};

export default ParentNews;
