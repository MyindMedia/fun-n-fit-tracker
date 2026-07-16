import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { Ic } from '../icons';

interface StaffInvitation {
  id: string;
  email: string;
  status: string;
  createdAt: number;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  lastActiveAt: number | null;
}

interface StaffManagerProps {
  adminName: string;
}

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const StaffManager: React.FC<StaffManagerProps> = ({ adminName }) => {
  // ── Invite form ───────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Lists ─────────────────────────────────────────────────────────────────
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [inv, members] = await Promise.all([
        gameCenter.listStaffInvitations(),
        gameCenter.listStaff(),
      ]);
      setInvitations(inv);
      setStaff(members);
    } catch (err: any) {
      console.error('Failed to load staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target || sending) return;
    setSending(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await gameCenter.inviteStaff(target, adminName || 'Coach');
      setSuccessMsg(
        `Invite sent to ${target} — they'll get an email from Clerk. When they accept and sign in, they instantly get admin access.`
      );
      setEmail('');
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send invite. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (inv: StaffInvitation) => {
    if (revokingId) return;
    if (!window.confirm(`Revoke the invite for ${inv.email}? They won't be able to join with it anymore.`)) return;
    setRevokingId(inv.id);
    try {
      await gameCenter.revokeStaffInvitation(inv.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke invitation');
    } finally {
      setRevokingId(null);
    }
  };

  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const otherInvites = invitations.filter((i) => i.status !== 'pending');

  return (
    <div className="pz-scope space-y-4">
      {/* Explainer */}
      <section className="pz-card p-4 sm:p-5" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 text-[#CBFE1C] mt-0.5">
            <Ic.Info size={22} />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl text-white tracking-tight mb-1">How staff access works</h2>
            <p className="text-xs sm:text-sm text-[#ABABAB] leading-relaxed">
              Invite a coach by email below. They'll get an email from Clerk — once they accept and sign in
              through the same <span className="text-white font-bold">Portal</span> button with their invited
              email (or Google on that email), they instantly get admin access to this dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Invite form */}
      <section className="pz-card p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight mb-1 inline-flex items-center gap-2">
          <Ic.UserPlus size={22} className="text-[#CBFE1C]" />
          Invite Staff
        </h2>
        <p className="text-xs text-[#ABABAB] mb-4">Send a coach an invite to join the admin team</p>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@email.com"
            required
            disabled={sending}
            className="flex-grow min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] disabled:opacity-50 min-w-0"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="touch-btn focus-ring pz-btn min-h-[48px] px-6 py-3 text-xs flex items-center justify-center gap-2 disabled:opacity-40 flex-shrink-0"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0B0E13]/30 border-t-[#0B0E13] rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Ic.Mail size={16} />
                Send Invite
              </>
            )}
          </button>
        </form>

        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
            <span className="text-emerald-400 flex-shrink-0 mt-0.5">
              <Ic.CheckCircle size={16} />
            </span>
            <p className="text-emerald-300 text-xs sm:text-sm font-medium">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <span className="text-red-400 flex-shrink-0 mt-0.5">
              <Ic.Warning size={16} />
            </span>
            <p className="text-red-300 text-xs sm:text-sm font-medium">{errorMsg}</p>
          </div>
        )}
      </section>

      {/* Pending invites */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2">
            <Ic.Mail size={22} className="text-[#CBFE1C]" />
            Pending Invites
          </h2>
          {pendingInvites.length > 0 && (
            <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5">
              {pendingInvites.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-[#ABABAB]">Loading…</div>
        ) : pendingInvites.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <Ic.Mail size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">No pending invites</div>
            <div className="text-xs">Invites you send show up here until they're accepted</div>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="pz-card-sm flex items-center gap-3 p-3 sm:p-4"
                style={{ background: 'var(--pz-panel-2)', borderColor: 'rgba(245, 158, 11, 0.35)' }}
              >
                <span className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Ic.Mail size={18} />
                </span>
                <div className="flex-grow min-w-0">
                  <div className="font-black text-sm text-white truncate">{inv.email}</div>
                  <div className="text-[10px] text-[#ABABAB] mt-0.5">Sent {fmtDate(inv.createdAt)} · awaiting acceptance</div>
                </div>
                <button
                  onClick={() => handleRevoke(inv)}
                  disabled={revokingId === inv.id}
                  className="touch-btn focus-ring min-h-[44px] px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50 flex-shrink-0"
                >
                  {revokingId === inv.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}

        {otherInvites.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest">Past Invites</div>
            {otherInvites.map((inv) => (
              <div
                key={inv.id}
                className="pz-card-sm flex items-center gap-3 p-3 opacity-60"
                style={{ background: 'var(--pz-panel-2)' }}
              >
                <div className="flex-grow min-w-0">
                  <div className="font-bold text-sm text-white truncate">{inv.email}</div>
                  <div className="text-[10px] text-[#ABABAB] mt-0.5">Sent {fmtDate(inv.createdAt)}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[#ABABAB] text-[9px] font-black uppercase flex-shrink-0">
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Current staff */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2">
            <Ic.Users size={22} className="text-[#CBFE1C]" />
            Current Staff
          </h2>
          {staff.length > 0 && (
            <span className="bg-white/10 text-white text-[10px] font-black rounded-full px-2 py-0.5">
              {staff.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-[#ABABAB]">Loading…</div>
        ) : staff.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <Ic.Coach size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">No staff accounts yet</div>
            <div className="text-xs">Coaches appear here once they accept an invite and sign in</div>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((member) => (
              <div
                key={member.id}
                className="pz-card-sm flex items-center gap-3 p-3 sm:p-4"
                style={{ background: 'var(--pz-panel-2)' }}
              >
                {member.imageUrl ? (
                  <img
                    src={member.imageUrl}
                    alt=""
                    className="w-11 h-11 rounded-full border-2 border-[#CBFE1C]/40 object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-[#CBFE1C]/10 border-2 border-[#CBFE1C]/40 text-[#CBFE1C] flex items-center justify-center flex-shrink-0">
                    <Ic.Coach size={22} />
                  </span>
                )}
                <div className="flex-grow min-w-0">
                  <div className="font-black text-sm text-white truncate">{member.name}</div>
                  <div className="text-[11px] text-[#ABABAB] truncate">{member.email}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[9px] font-black text-[#ABABAB] uppercase tracking-wider">Last Active</div>
                  <div className="text-[11px] font-bold text-white">
                    {member.lastActiveAt ? fmtDate(member.lastActiveAt) : 'Not yet'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StaffManager;
