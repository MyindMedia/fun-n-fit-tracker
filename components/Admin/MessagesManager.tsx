import React, { useEffect, useMemo, useRef, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { parentAuth } from '../../services/parentAuth';
import { ChatMessage, StaffInboxEntry } from '../../types';
import { Ic } from '../icons';

interface ParentLite {
  id: string;
  fullName: string;
  email: string;
}

interface SelectedThread {
  conversationId: string | null; // null = brand-new thread, created on first send
  parent: ParentLite;
}

const relTime = (ms: number) => {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
};

interface MessagesManagerProps {
  adminName: string;
}

const MessagesManager: React.FC<MessagesManagerProps> = ({ adminName }) => {
  const coach = adminName || 'Coach';

  // ── Inbox (live) ────────────────────────────────────────────────────────
  const [inbox, setInbox] = useState<StaffInboxEntry[]>([]);
  useEffect(() => {
    const unsub = gameCenter.subscribeStaffInbox(setInbox);
    return unsub;
  }, []);

  // ── Selected thread (live) ──────────────────────────────────────────────
  const [selected, setSelected] = useState<SelectedThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    if (!selected?.conversationId) return;
    const unsub = gameCenter.subscribeConversation(selected.conversationId, setMessages);
    gameCenter.markThreadReadAsStaff(selected.conversationId).catch((err) => {
      console.warn('Failed to mark thread read:', err);
    });
    return unsub;
  }, [selected?.conversationId]);

  // A "new message" thread has no conversation yet — adopt it once the first
  // send makes it appear in the inbox.
  useEffect(() => {
    if (!selected || selected.conversationId) return;
    const match = inbox.find((e) => e.parent.id === selected.parent.id);
    if (match) setSelected({ conversationId: match.conversation.id, parent: match.parent });
  }, [inbox, selected]);

  // Keep the open thread marked read as new parent messages stream in.
  useEffect(() => {
    if (!selected?.conversationId) return;
    const entry = inbox.find((e) => e.conversation.id === selected.conversationId);
    if (entry && entry.conversation.unreadForStaff > 0) {
      gameCenter.markThreadReadAsStaff(selected.conversationId).catch(() => {});
    }
  }, [inbox, selected?.conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // ── Composer ────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selected || sending) return;
    setSending(true);
    try {
      await gameCenter.sendMessageAsStaff(selected.parent.id, body, coach);
      setDraft('');
    } catch (err: any) {
      alert(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ── New message flow ────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [allParents, setAllParents] = useState<ParentLite[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [parentSearch, setParentSearch] = useState('');

  useEffect(() => {
    if (!showPicker || allParents.length > 0) return;
    setParentsLoading(true);
    parentAuth
      .listParents()
      .then((rows) =>
        setAllParents(rows.map((p) => ({ id: p.id, fullName: p.fullName, email: p.email })))
      )
      .catch((err: any) => console.error('Failed to load parents:', err))
      .finally(() => setParentsLoading(false));
  }, [showPicker, allParents.length]);

  const filteredParents = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    if (!q) return allParents;
    return allParents.filter(
      (p) => p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [allParents, parentSearch]);

  const pickParent = (parent: ParentLite) => {
    const existing = inbox.find((e) => e.parent.id === parent.id);
    setSelected(
      existing
        ? { conversationId: existing.conversation.id, parent: existing.parent }
        : { conversationId: null, parent }
    );
    setShowPicker(false);
    setParentSearch('');
  };

  const totalUnread = inbox.reduce((sum, e) => sum + e.conversation.unreadForStaff, 0);

  return (
    <div className="pz-scope flex flex-col md:flex-row gap-3 h-full min-h-0">
      {/* Conversation list */}
      <section
        className={`${selected ? 'hidden md:flex' : 'flex'} flex-col flex-grow md:flex-grow-0 md:w-80 md:flex-shrink-0 pz-card overflow-hidden min-h-0`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg text-white tracking-tight inline-flex items-center gap-2">
            <Ic.Chat size={20} className="text-[#CBFE1C]" /> Inbox
            {totalUnread > 0 && (
              <span className="ml-2 bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5 align-middle">
                {totalUnread}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowPicker(true)}
            className="touch-btn focus-ring pz-btn px-3 py-2 text-[10px]"
          >
            + New
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
          {inbox.length === 0 ? (
            <div className="text-center py-12 text-[#ABABAB] px-4">
              <Ic.Mail size={40} className="mx-auto mb-2 opacity-40" />
              <div className="text-sm font-medium">No conversations yet</div>
              <div className="text-xs">Start one with “+ New”</div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {inbox.map(({ conversation, parent }) => {
                const unread = conversation.unreadForStaff > 0;
                const isActive = selected?.conversationId === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelected({ conversationId: conversation.id, parent })}
                    className={`touch-btn w-full text-left p-3 transition-all border-l-2 ${
                      isActive
                        ? 'bg-[#171C27] border-l-[#CBFE1C]'
                        : unread
                          ? 'bg-[#CBFE1C]/5 border-l-[#CBFE1C]'
                          : 'bg-transparent border-l-transparent'
                    } active:bg-white/5`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-grow min-w-0">
                        <div className={`text-sm truncate ${unread ? 'font-black text-white' : 'font-bold text-white/80'}`}>
                          {parent.fullName}
                        </div>
                        <div className="text-[10px] text-[#ABABAB] truncate">{parent.email}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[9px] font-bold text-[#ABABAB]">
                          {relTime(conversation.lastMessageAt)}
                        </span>
                        {unread && (
                          <span className="bg-[#CBFE1C] text-[#0B0E13] text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {conversation.unreadForStaff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-xs truncate mt-1 ${unread ? 'text-white font-bold' : 'text-[#ABABAB]'}`}>
                      {conversation.lastMessagePreview}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Thread */}
      <section
        className={`${selected ? 'flex' : 'hidden md:flex'} flex-col flex-grow pz-card overflow-hidden min-h-0`}
      >
        {!selected ? (
          <div className="flex-grow flex flex-col items-center justify-center text-[#ABABAB] p-6">
            <Ic.Chat size={44} className="mb-3 opacity-40" />
            <div className="text-sm font-bold">Pick a conversation</div>
            <div className="text-xs">Messages with parents appear here in real time</div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
              <button
                onClick={() => setSelected(null)}
                aria-label="Back to inbox"
                className="touch-btn focus-ring md:hidden px-3 py-2 bg-[#171C27] border border-white/10 rounded-xl text-white active:bg-white/10"
              >
                <Ic.ArrowLeft size={18} />
              </button>
              <div className="bg-[#CBFE1C] text-[#0B0E13] w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">
                {(selected.parent.fullName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm text-white truncate">{selected.parent.fullName}</div>
                <div className="text-[10px] text-[#ABABAB] truncate">{selected.parent.email}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2" style={{ background: 'rgba(11, 14, 19, 0.5)' }}>
              {messages.length === 0 ? (
                <div className="text-center py-10 text-[#ABABAB] text-xs font-medium">
                  {selected.conversationId
                    ? 'No messages yet'
                    : `Start the conversation with ${selected.parent.fullName}`}
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderType === 'STAFF';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 ${
                          mine
                            ? 'bg-[#CBFE1C]/15 border border-[#CBFE1C]/30 text-white rounded-br-md'
                            : 'bg-[#171C27] text-white border border-white/10 rounded-bl-md'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                        <div
                          className={`text-[9px] font-bold mt-1 ${mine ? 'text-[#CBFE1C]' : 'text-[#ABABAB]'}`}
                        >
                          {m.senderName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-white/10 flex-shrink-0">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${selected.parent.fullName}…`}
                className="flex-grow min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] min-w-0"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="touch-btn focus-ring pz-btn min-h-[48px] px-5 py-3 text-xs disabled:opacity-40 flex-shrink-0"
              >
                {sending ? '…' : 'Send'}
              </button>
            </form>
          </>
        )}
      </section>

      {/* Parent picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPicker(false)}
            aria-hidden="true"
          />
          <div className="relative pz-card w-full sm:max-w-md drop-shadow-2xl flex flex-col max-h-[80vh] animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-sm text-white uppercase tracking-wide">New Message</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="touch-btn focus-ring w-11 h-11 rounded-full bg-white/5 border border-white/10 text-[#ABABAB] active:bg-white/10"
                aria-label="Close"
              >
                <Ic.XMark size={18} />
              </button>
            </div>
            <div className="p-4 flex-shrink-0">
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder="Search parents by name or email…"
                autoFocus
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
              />
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar px-4 pb-4">
              {parentsLoading ? (
                <div className="text-center py-8 text-[#ABABAB] text-sm">Loading parents…</div>
              ) : filteredParents.length === 0 ? (
                <div className="text-center py-8 text-[#ABABAB] text-sm">No parents found</div>
              ) : (
                <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
                  {filteredParents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickParent(p)}
                      className="touch-btn w-full text-left flex items-center gap-3 p-3 bg-[#171C27] active:bg-white/10"
                    >
                      <div className="bg-white/10 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0">
                        {(p.fullName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate">{p.fullName}</div>
                        <div className="text-[10px] text-[#ABABAB] truncate">{p.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesManager;
