import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { Redemption } from '../../types';
import { Ic, DataIcon } from '../icons';

interface PendingRow {
  redemption: Redemption;
  studentName: string;
}

interface RedemptionQueueProps {
  adminName: string;
}

const RedemptionQueue: React.FC<RedemptionQueueProps> = ({ adminName }) => {
  const coach = adminName || 'Coach';
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = gameCenter.subscribePendingRedemptions(setPending);
    return unsub;
  }, []);

  const handleFulfill = async (redemptionId: string) => {
    if (busyId) return;
    setBusyId(redemptionId);
    try {
      await gameCenter.fulfillRedemption(redemptionId, coach);
    } catch (err: any) {
      alert(err?.message || 'Failed to fulfill redemption');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (row: PendingRow) => {
    if (busyId) return;
    if (
      !window.confirm(
        `Cancel "${row.redemption.rewardName}" for ${row.studentName}? Their ${row.redemption.cost} points will be refunded.`
      )
    )
      return;
    setBusyId(row.redemption.id);
    try {
      await gameCenter.cancelRedemption(row.redemption.id, coach);
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel redemption');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="pz-scope pz-card p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
          <Ic.Gift size={24} className="text-[#CBFE1C]" /> Redemptions
        </h2>
        {pending.length > 0 && (
          <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5">
            {pending.length}
          </span>
        )}
      </div>
      <p className="text-xs text-[#ABABAB] -mt-2 mb-4">
        Real-world perks kids have claimed and are waiting to pick up
      </p>

      {pending.length === 0 ? (
        <div className="text-center py-12 text-[#ABABAB]">
          <Ic.Confetti size={40} className="mx-auto mb-2 opacity-40" />
          <div className="text-sm font-medium">Nothing to fulfill</div>
          <div className="text-xs">Pending perk redemptions show up here in real time</div>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((row) => {
            const { redemption, studentName } = row;
            return (
              <div
                key={redemption.id}
                className="pz-card-sm p-4"
                style={{ background: 'var(--pz-panel-2)' }}
              >
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-[#CBFE1C]" style={{ background: 'var(--pz-bg)' }}>
                    {redemption.rewardIcon ? <DataIcon glyph={redemption.rewardIcon} size={26} /> : <Ic.Gift size={26} />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-black text-sm text-white">{redemption.rewardName}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-black uppercase">
                        {redemption.cost} pts
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white/80">for {studentName}</div>
                    <div className="text-[10px] text-[#ABABAB] mt-0.5">
                      Requested {new Date(redemption.createdAt).toLocaleDateString()}{' '}
                      {new Date(redemption.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' · '}via {redemption.requestedVia === 'PARENT' ? 'parent portal' : 'student portal'}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleFulfill(redemption.id)}
                      disabled={busyId === redemption.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.Check size={14} /> Fulfill
                    </button>
                    <button
                      onClick={() => handleCancel(row)}
                      disabled={busyId === redemption.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.XMark size={14} /> Cancel & Refund
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RedemptionQueue;
