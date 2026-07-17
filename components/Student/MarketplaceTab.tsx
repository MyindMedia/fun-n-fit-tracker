import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { Ic, DataIcon } from '../icons';
import { marketClient, MarketItem, MarketOrder } from '../../services/marketClient';

// Student-facing points marketplace: donated real-world prizes with limited
// quantity; redeeming spends points and issues a claim code the family shows
// at the front desk. Backend: convex/market.ts (ECONOMY_SPEC.md section 7).

// Item icons are stored as an Ic key ("Gift", "Tag") or a short label; DataIcon
// renders unknown strings as plain text so nothing ever breaks.
const ItemIcon: React.FC<{ icon: string; size?: number; className?: string }> = ({ icon, size = 40, className }) => {
  const Cmp = (Ic as Record<string, React.FC<{ size?: number | string; className?: string }>>)[icon];
  if (Cmp) return <Cmp size={size} className={className} />;
  return <DataIcon glyph={icon} size={size} className={className} />;
};

const STATUS_CHIP: Record<MarketOrder['status'], { label: string; cls: string }> = {
  PENDING: { label: 'Waiting for pickup', cls: 'bg-amber-500/15 text-amber-400' },
  FULFILLED: { label: 'Picked up', cls: 'bg-emerald-500/15 text-emerald-400' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-white/10 text-[#ABABAB]' },
};

const MarketplaceTab: React.FC<{ student: Student; onRefresh: () => void }> = ({ student, onRefresh }) => {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [confirmItem, setConfirmItem] = useState<MarketItem | null>(null);
  const [successOrder, setSuccessOrder] = useState<MarketOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u1 = marketClient.subscribeActiveItems(setItems);
    const u2 = marketClient.subscribeMyOrders(student.id, setOrders);
    return () => {
      u1();
      u2();
    };
  }, [student.id]);

  const handleRedeem = async () => {
    if (!confirmItem || busy) return;
    setBusy(true);
    try {
      const order = await marketClient.redeem(student.id, confirmItem.id);
      setConfirmItem(null);
      setSuccessOrder(order);
      setCopied(false);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'That did not go through, try again');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (order: MarketOrder) => {
    if (busyOrderId) return;
    if (!window.confirm(`Cancel ${order.itemName}? Your ${order.cost.toLocaleString()} points go right back.`)) return;
    setBusyOrderId(order.id);
    try {
      await marketClient.cancelOrder(order.id, student.fullName);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Could not cancel that order');
    } finally {
      setBusyOrderId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code stays on screen either way
    }
  };

  return (
    <div className="pz-scope space-y-4">
      {/* Hero */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl border border-[#CBFE1C]/40 flex items-center justify-center text-[#CBFE1C] flex-shrink-0" style={{ background: 'var(--pz-panel-2)' }}>
            <Ic.Gift size={26} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl text-white uppercase tracking-tight">Marketplace</h2>
            <p className="text-xs text-[#ABABAB]">Real prizes. Earned with points.</p>
          </div>
          <div className="ml-auto text-right flex-shrink-0">
            <div className="text-xl pz-display text-[#CBFE1C]">{student.points.toLocaleString()}</div>
            <div className="text-[9px] font-bold text-[#ABABAB] uppercase tracking-wider">Your points</div>
          </div>
        </div>
      </section>

      {/* Prize shelf */}
      {items.length === 0 ? (
        <section className="pz-card p-6 text-center">
          <Ic.Gift size={40} className="mx-auto mb-2 text-[#ABABAB] opacity-40" />
          <div className="text-sm font-medium text-[#ABABAB]">The shelf is empty right now</div>
          <div className="text-xs text-[#ABABAB]">New donated prizes drop here, keep earning!</div>
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const soldOut = item.qtyAvailable <= 0;
            const affordable = student.points >= item.pointCost;
            const needed = item.pointCost - student.points;
            return (
              <section key={item.id} className={`pz-card overflow-hidden flex flex-col ${soldOut ? 'opacity-60' : ''}`}>
                <div className="h-32 flex items-center justify-center relative" style={{ background: 'var(--pz-panel-2)' }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#CBFE1C]"><ItemIcon icon={item.icon} size={52} /></span>
                  )}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      soldOut ? 'bg-red-500/20 text-red-400' : 'bg-black/60 text-white'
                    }`}
                  >
                    {soldOut ? 'Sold out' : `x${item.qtyAvailable} left`}
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="font-black text-sm text-white break-words">{item.name}</div>
                  {item.donatedBy && (
                    <div className="text-[10px] text-[#ABABAB] mt-0.5 inline-flex items-center gap-1">
                      <Ic.Sparkle size={11} className="text-[#CBFE1C] flex-shrink-0" /> Donated by {item.donatedBy}
                    </div>
                  )}
                  <p className="text-xs text-[#ABABAB] mt-1.5 flex-grow">{item.description}</p>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="pz-display text-lg text-[#CBFE1C] flex-shrink-0">
                      {item.pointCost.toLocaleString()} <span className="text-[10px] uppercase">pts</span>
                    </div>
                    <button
                      onClick={() => setConfirmItem(item)}
                      disabled={soldOut || !affordable}
                      className="touch-btn focus-ring pz-btn min-h-[44px] px-4 py-2 text-[10px] disabled:opacity-40"
                    >
                      {soldOut
                        ? 'Sold out'
                        : affordable
                          ? 'Redeem'
                          : `You need ${needed.toLocaleString()} more points`}
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* My orders */}
      <section className="pz-card p-4 sm:p-6">
        <h3 className="text-sm text-white uppercase tracking-wide inline-flex items-center gap-2 mb-3">
          <Ic.ClipboardCheck size={16} className="text-[#CBFE1C]" /> My orders
        </h3>
        {orders.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#ABABAB]">
            Nothing yet. Redeem a prize and your claim code shows up here.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const chip = STATUS_CHIP[order.status];
              return (
                <div key={order.id} className="pz-card-sm p-3" style={{ background: 'var(--pz-panel-2)' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="px-3 py-1.5 rounded-lg border border-[#CBFE1C]/40 font-mono font-black text-sm tracking-[0.25em] text-[#CBFE1C] flex-shrink-0"
                      style={{ background: 'var(--pz-bg)' }}
                    >
                      {order.claimCode}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="text-xs font-black text-white break-words">{order.itemName}</div>
                      <div className="text-[10px] text-[#ABABAB]">
                        {order.cost.toLocaleString()} pts, {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0 ${chip.cls}`}>
                      {chip.label}
                    </span>
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={busyOrderId === order.id}
                        className="touch-btn focus-ring px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-black uppercase border border-red-500/30 disabled:opacity-50 flex-shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirm dialog */}
      {confirmItem && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setConfirmItem(null)} aria-hidden="true" />
          <div className="relative pz-card w-full sm:max-w-sm drop-shadow-2xl p-5 animate-slide-up">
            <div className="flex justify-center mb-3 text-[#CBFE1C]">
              {confirmItem.imageUrl ? (
                <img src={confirmItem.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <ItemIcon icon={confirmItem.icon} size={40} />
              )}
            </div>
            <h3 className="text-base text-white text-center uppercase tracking-tight mb-2 break-words">{confirmItem.name}</h3>
            <p className="text-xs text-[#ABABAB] text-center mb-4">
              This spends <span className="text-[#CBFE1C] font-black">{confirmItem.pointCost.toLocaleString()} points</span>.
              Pick up at the front desk and show your claim code.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmItem(null)}
                disabled={busy}
                className="touch-btn focus-ring flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-wide disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                onClick={handleRedeem}
                disabled={busy}
                className="touch-btn focus-ring pz-btn flex-1 min-h-[48px] px-4 py-2.5 text-[10px] disabled:opacity-50"
              >
                {busy ? 'Working' : `Spend ${confirmItem.pointCost.toLocaleString()} pts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success: the claim code */}
      {successOrder && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSuccessOrder(null)} aria-hidden="true" />
          <div className="relative pz-card w-full sm:max-w-sm drop-shadow-2xl p-6 text-center animate-slide-up">
            <div className="flex justify-center mb-3 text-[#CBFE1C]"><Ic.Confetti size={36} /></div>
            <div className="pz-eyebrow mb-1">Prize claimed</div>
            <h3 className="text-base text-white uppercase tracking-tight mb-4 break-words">{successOrder.itemName}</h3>
            <div
              className="mx-auto mb-2 px-6 py-4 rounded-2xl border-2 border-[#CBFE1C] font-mono font-black text-4xl tracking-[0.3em] text-[#CBFE1C]"
              style={{ background: 'var(--pz-bg)' }}
            >
              {successOrder.claimCode}
            </div>
            <button
              onClick={() => copyCode(successOrder.claimCode)}
              className="text-[10px] font-bold text-[#ABABAB] underline underline-offset-2 mb-4"
            >
              {copied ? 'Copied!' : 'Tap to copy the code'}
            </button>
            <p className="text-xs text-[#ABABAB] mb-5">
              Show this code at the front desk to pick up your prize. It also lives in My orders below.
            </p>
            <button
              onClick={() => setSuccessOrder(null)}
              className="touch-btn focus-ring pz-btn w-full min-h-[48px] px-4 py-2.5 text-[10px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceTab;
