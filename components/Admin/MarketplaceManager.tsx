import React, { useEffect, useState } from 'react';
import { Ic, DataIcon } from '../icons';
import {
  marketClient,
  MarketItem,
  MarketQueue,
  MarketQueueRow,
} from '../../services/marketClient';

// In-kind donation marketplace admin: pickup queue (claim-code Confirm /
// Cancel + refund) and the donated-items editor. Backend: convex/market.ts
// (ECONOMY_SPEC.md section 7). Visual language follows RedemptionQueue +
// PartnerManager.

const ICON_CHOICES = ['Gift', 'Tag', 'Star', 'Trophy', 'Controller', 'Shirt', 'Coin', 'Sparkle', 'Store', 'Music', 'Camera', 'Dice'];

const ItemIcon: React.FC<{ icon: string; size?: number; className?: string }> = ({ icon, size = 24, className }) => {
  const Cmp = (Ic as Record<string, React.FC<{ size?: number | string; className?: string }>>)[icon];
  if (Cmp) return <Cmp size={size} className={className} />;
  return <DataIcon glyph={icon} size={size} className={className} />;
};

const timeAgo = (ts: number): string => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

interface ItemForm {
  id?: string;
  name: string;
  description: string;
  donatedBy: string;
  icon: string;
  imageUrl: string;
  pointCost: number;
  qtyAvailable: number;
  active: boolean;
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  donatedBy: '',
  icon: 'Gift',
  imageUrl: '',
  pointCost: 500,
  qtyAvailable: 1,
  active: true,
};

const MarketplaceManager: React.FC<{ adminName: string }> = ({ adminName }) => {
  const coach = adminName || 'Coach';
  const [queue, setQueue] = useState<MarketQueue>({ pending: [], resolved: [] });
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = async () => {
    try {
      setItems(await marketClient.adminItems());
    } catch (err) {
      console.error('Failed to load market items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadItems();
    const unsub = marketClient.subscribeAdminQueue(setQueue);
    return unsub;
  }, []);

  // ── Queue actions ───────────────────────────────────────────────────────────

  const handleConfirm = async (row: MarketQueueRow) => {
    if (busyId) return;
    setBusyId(row.order.id);
    try {
      await marketClient.confirmOrder(row.order.id, coach);
      await loadItems();
    } catch (err: any) {
      alert(err?.message || 'Failed to confirm the handover');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelOrder = async (row: MarketQueueRow) => {
    if (busyId) return;
    if (
      !window.confirm(
        `Cancel "${row.order.itemName}" for ${row.studentName}? Their ${row.order.cost.toLocaleString()} points will be refunded and the prize goes back on the shelf.`
      )
    )
      return;
    setBusyId(row.order.id);
    try {
      await marketClient.cancelOrder(row.order.id, coach);
      await loadItems();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel the order');
    } finally {
      setBusyId(null);
    }
  };

  // ── Item editor actions ─────────────────────────────────────────────────────

  const updateField = <K extends keyof ItemForm>(field: K, value: ItemForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      alert('Please enter a prize name');
      return;
    }
    setSaving(true);
    try {
      await marketClient.upsertItem({
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim() || 'Gift',
        imageUrl: form.imageUrl.trim() || null,
        pointCost: Math.max(1, Math.round(Number(form.pointCost) || 1)),
        qtyAvailable: Math.max(0, Math.round(Number(form.qtyAvailable) || 0)),
        donatedBy: form.donatedBy.trim() || null,
        active: form.active,
      });
      await loadItems();
      setForm(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save the prize');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: MarketItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await marketClient.upsertItem({
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        imageUrl: item.imageUrl ?? null,
        pointCost: item.pointCost,
        qtyAvailable: item.qtyAvailable,
        donatedBy: item.donatedBy ?? null,
        active: !item.active,
      });
      await loadItems();
    } catch (err: any) {
      alert(err?.message || 'Failed to update the prize');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (item: MarketItem) => {
    if (!window.confirm(`Remove "${item.name}" from the marketplace? Existing orders keep their history.`)) return;
    setBusyId(item.id);
    try {
      await marketClient.removeItem(item.id);
      await loadItems();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove the prize');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pz-scope space-y-4">
      {/* Pickup queue */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
            <Ic.Cart size={24} className="text-[#CBFE1C]" /> Pickup queue
          </h2>
          {queue.pending.length > 0 && (
            <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5">
              {queue.pending.length}
            </span>
          )}
        </div>
        <p className="text-xs text-[#ABABAB] -mt-2 mb-4">
          The family shows the claim code at the desk. Match it here and confirm the handover.
        </p>

        {queue.pending.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <Ic.Confetti size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">Nothing waiting for pickup</div>
            <div className="text-xs">New marketplace orders land here in real time</div>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.pending.map((row) => (
              <div key={row.order.id} className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <div
                    className="flex-shrink-0 px-3 py-2 rounded-xl border border-[#CBFE1C]/50 font-mono font-black text-xl tracking-[0.25em] text-[#CBFE1C]"
                    style={{ background: 'var(--pz-bg)' }}
                  >
                    {row.order.claimCode}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-black text-sm text-white break-words">{row.order.itemName}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-black uppercase">
                        {row.order.cost.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white/80 break-words">
                      for {row.studentName}
                      {row.gamerTag && <span className="text-[#ABABAB] font-medium"> ({row.gamerTag})</span>}
                    </div>
                    <div className="text-[10px] text-[#ABABAB] mt-0.5">
                      Requested {timeAgo(row.order.createdAt)}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleConfirm(row)}
                      disabled={busyId === row.order.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.Check size={14} /> Confirm handover
                    </button>
                    <button
                      onClick={() => handleCancelOrder(row)}
                      disabled={busyId === row.order.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.XMark size={14} /> Cancel & Refund
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {queue.resolved.length > 0 && (
          <div className="mt-5">
            <div className="pz-eyebrow mb-2">Recently resolved</div>
            <div className="space-y-1.5">
              {queue.resolved.map((row) => (
                <div
                  key={row.order.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl"
                  style={{ background: 'var(--pz-panel-2)' }}
                >
                  <span className="font-mono font-black text-xs tracking-[0.2em] text-[#ABABAB] flex-shrink-0">
                    {row.order.claimCode}
                  </span>
                  <span className="text-xs text-white break-words min-w-0 flex-grow">
                    {row.studentName}, {row.order.itemName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0 ${
                      row.order.status === 'FULFILLED'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/10 text-[#ABABAB]'
                    }`}
                  >
                    {row.order.status === 'FULFILLED' ? 'Picked up' : 'Cancelled'}
                  </span>
                  <span className="text-[10px] text-[#ABABAB] flex-shrink-0">
                    {timeAgo(row.order.resolvedAt ?? row.order.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Items editor */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
            <Ic.Gift size={24} className="text-[#CBFE1C]" /> Donated prizes
          </h2>
          <button
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="touch-btn focus-ring pz-btn min-h-[44px] px-4 py-2 text-xs"
          >
            + Add donated prize
          </button>
        </div>
        <p className="text-xs text-[#ABABAB] -mt-2 mb-4">
          Real items donated by sponsors and families. Kids buy them with points only.
        </p>

        <div className="space-y-2">
          {loadingItems ? (
            <div className="text-center py-10 text-[#ABABAB]">Loading</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-[#ABABAB]">
              <Ic.Gift size={40} className="mx-auto mb-2 opacity-40" />
              <div className="text-sm font-medium">No prizes on the shelf yet</div>
              <div className="text-xs">Add the first donated prize so kids have something to chase</div>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`pz-card-sm p-4 transition-all ${item.active ? '' : 'opacity-60'}`}
                style={{ background: 'var(--pz-panel-2)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-[#CBFE1C] overflow-hidden"
                    style={{ background: 'var(--pz-bg)' }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ItemIcon icon={item.icon} size={24} />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-sm text-white break-words">{item.name}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-black uppercase">
                        {item.pointCost.toLocaleString()} pts
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          item.qtyAvailable > 0 ? 'bg-sky-500/15 text-sky-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {item.qtyAvailable > 0 ? `x${item.qtyAvailable} left` : 'Sold out'}
                      </span>
                    </div>
                    {item.description && <div className="text-xs text-[#ABABAB] mb-0.5">{item.description}</div>}
                    {item.donatedBy && (
                      <div className="text-[10px] text-[#ABABAB] inline-flex items-center gap-1">
                        <Ic.Sparkle size={11} /> Donated by {item.donatedBy}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(item)}
                    disabled={busyId === item.id}
                    className={`touch-btn focus-ring px-3 py-1 rounded-lg text-[9px] font-black uppercase flex-shrink-0 disabled:opacity-50 ${
                      item.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-[#ABABAB]'
                    }`}
                  >
                    {item.active ? 'Active' : 'Hidden'}
                  </button>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        description: item.description,
                        donatedBy: item.donatedBy || '',
                        icon: item.icon,
                        imageUrl: item.imageUrl || '',
                        pointCost: item.pointCost,
                        qtyAvailable: item.qtyAvailable,
                        active: item.active,
                      })
                    }
                    className="touch-btn focus-ring pz-btn-ghost px-3 py-2 text-[10px] inline-flex items-center gap-1.5"
                  >
                    <Ic.Edit size={14} /> Edit
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    disabled={busyId === item.id}
                    className="touch-btn focus-ring px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Ic.Trash size={14} /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)} aria-hidden="true" />
          <div className="relative pz-card w-full sm:max-w-md drop-shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <button onClick={() => setForm(null)} className="touch-btn text-[#ABABAB] font-bold text-sm px-2 py-1">
                Cancel
              </button>
              <h3 className="text-sm text-white uppercase tracking-wide">
                {form.id ? 'Edit Prize' : 'New Donated Prize'}
              </h3>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="touch-btn text-[#CBFE1C] font-black text-sm px-2 py-1 disabled:opacity-30"
              >
                {saving ? '...' : 'Save'}
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Prize Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Angels Game Tickets (Pair)"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What it is and how pickup works"
                  rows={2}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Donated By
                </label>
                <input
                  type="text"
                  value={form.donatedBy}
                  onChange={(e) => updateField('donatedBy', e.target.value)}
                  placeholder="e.g. Community sponsor"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                    Point Price
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.pointCost}
                    onChange={(e) => updateField('pointCost', Number(e.target.value))}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white outline-none focus:border-[#CBFE1C]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.qtyAvailable}
                    onChange={(e) => updateField('qtyAvailable', Number(e.target.value))}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white outline-none focus:border-[#CBFE1C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Icon
                </label>
                <div className="flex items-center gap-2">
                  <span className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-[#CBFE1C] flex-shrink-0" style={{ background: 'var(--pz-bg)' }}>
                    <ItemIcon icon={form.icon} size={20} />
                  </span>
                  <select
                    value={ICON_CHOICES.includes(form.icon) ? form.icon : 'Gift'}
                    onChange={(e) => updateField('icon', e.target.value)}
                    className="flex-grow min-h-[48px] px-3 py-2 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white outline-none focus:border-[#CBFE1C]"
                  >
                    {ICON_CHOICES.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-[#ABABAB] mt-1">Used when the prize has no photo</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Image URL (optional)
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-white/10" style={{ background: 'var(--pz-panel-2)' }}>
                <div>
                  <div className="text-xs font-black text-white">Visible to kids</div>
                  <div className="text-[10px] text-[#ABABAB]">Hidden prizes stay in this list only</div>
                </div>
                <button
                  onClick={() => updateField('active', !form.active)}
                  className={`touch-btn focus-ring px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${
                    form.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-[#ABABAB]'
                  }`}
                >
                  {form.active ? 'Active' : 'Hidden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceManager;
