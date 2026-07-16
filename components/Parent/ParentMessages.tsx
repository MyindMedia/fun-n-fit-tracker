// Messages tab — live staff↔parent thread via gameCenter.subscribeParentThread.
// PARENT bubbles right-aligned, STAFF bubbles left with sender name.
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { cleanErr, fmtDateTime, pStyles } from './shared';

const ParentMessages: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = gameCenter.subscribeParentThread(({ conversation, messages: msgs }) => {
            setMessages(msgs);
            setLoaded(true);
            // Tab is open — clear the unread counter as messages arrive
            if (conversation && conversation.unreadForParent > 0) {
                gameCenter.markThreadReadAsParent().catch(() => {});
            }
        });
        gameCenter.markThreadReadAsParent().catch(() => {});
        return unsubscribe;
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length]);

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        setError(null);
        try {
            await gameCenter.sendMessageAsParent(body);
            setDraft('');
        } catch (e: any) {
            setError(cleanErr(e, 'Message failed to send — please try again'));
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div style={{ ...pStyles.card, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
            <h2 style={{ ...pStyles.sectionTitle, marginBottom: '0.75rem' }}>💬 Messages</h2>

            {/* Thread */}
            <div style={{
                flex: 1, overflowY: 'auto', minHeight: '300px', maxHeight: '55vh',
                display: 'flex', flexDirection: 'column', gap: '0.6rem',
                padding: '0.5rem 0.25rem', background: '#f8fafc',
                border: '1px solid #f1f5f9', borderRadius: '12px',
            }}>
                {!loaded ? (
                    <p style={{ ...pStyles.mutedText, textAlign: 'center', margin: 'auto' }}>Loading…</p>
                ) : messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
                        <p style={{ ...pStyles.mutedText, fontWeight: 600 }}>
                            Message the Fun 'N Fit team — we'll reply here.
                        </p>
                    </div>
                ) : (
                    messages.map(m => {
                        const mine = m.senderType === 'PARENT';
                        return (
                            <div key={m.id} style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: mine ? 'flex-end' : 'flex-start',
                                padding: '0 0.5rem',
                            }}>
                                {!mine && (
                                    <span style={{
                                        fontSize: '0.6875rem', fontWeight: 800, color: '#4f46e5',
                                        margin: '0 0 0.15rem 0.5rem',
                                    }}>
                                        {m.senderName || 'Fun ’N Fit Team'}
                                    </span>
                                )}
                                <div style={{
                                    maxWidth: '82%',
                                    background: mine ? '#4f46e5' : '#ffffff',
                                    color: mine ? '#ffffff' : '#0f172a',
                                    border: mine ? 'none' : '1px solid #e2e8f0',
                                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    padding: '0.6rem 0.875rem',
                                    fontSize: '0.9375rem', fontWeight: 500,
                                    lineHeight: 1.4, wordBreak: 'break-word',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                }}>
                                    {m.body}
                                </div>
                                <span style={{
                                    fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8',
                                    margin: mine ? '0.15rem 0.5rem 0 0' : '0.15rem 0 0 0.5rem',
                                }}>
                                    {fmtDateTime(m.createdAt)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={endRef} />
            </div>

            {error && <div style={{ ...pStyles.errorBox, marginTop: '0.75rem' }}>⚠️ {error}</div>}

            {/* Composer */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'flex-end' }}>
                <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    style={{
                        ...pStyles.input,
                        flex: 1, resize: 'none', minHeight: '48px', maxHeight: '120px',
                        padding: '0.75rem 1rem',
                    }}
                />
                <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    style={{
                        ...pStyles.btnPrimary,
                        padding: '0.75rem 1.125rem', height: '48px',
                        opacity: sending || !draft.trim() ? 0.5 : 1,
                        flexShrink: 0,
                    }}
                >
                    {sending ? '…' : 'Send ➤'}
                </button>
            </div>
        </div>
    );
};

export default ParentMessages;
