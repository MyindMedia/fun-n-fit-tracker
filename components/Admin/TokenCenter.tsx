import React, { useEffect, useMemo, useState } from 'react';
import { Student } from '../../types';
import { Ic } from '../icons';
import {
  fitTokensClient,
  FitTokenPack,
  PendingPurchaseRow,
  TokenBalanceRow,
} from '../../services/fitTokensClient';

// FitTokens admin (ECONOMY_SPEC.md section 1): pending purchase queue
// (credit/cancel), pack CRUD, per-student balances + manual adjust.
// Backend: convex/fitTokens.ts. Money never moves here; staff credit a
// reference code after the parent pays on a hosted checkout or at the desk.

const WEBHOOK_URL = 'https://dependable-spoonbill-535.convex.site/fittoken-purchase';

const ageOf = (ts: number): string => {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

interface PackForm {
  key: string;
  name: string;
  tokens: string;
  priceLabel: string;
  paymentUrl: string;
  active: boolean;
  isNew: boolean;
}

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg text-sm text-white outline-none';
const inputStyle: React.CSSProperties = {
  background: 'var(--pz-bg)',
  border: '1.5px solid rgba(255,255,255,0.12)',
};

const TokenCenter: React.FC<{ students: Student[]; adminName: string; onRefresh: () => void }> = ({
  students,
  adminName,
  onRefresh,
}) => {
  const coach = adminName || 'Coach';
  const [pending, setPending] = useState<PendingPurchaseRow[]>([]);
  const [packs, setPacks] = useState<FitTokenPack[]>([]);
  const [balances, setBalances] = useState<TokenBalanceRow[]>(() =>
    students.map((s) => ({
      studentId: s.id,
      fullName: s.fullName,
      gamerTag: s.gamerTag ?? null,
      fitTokens: s.fitTokens ?? 0,
    }))
  );
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [packForm, setPackForm] = useState<PackForm | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = fitTokensClient.subscribePendingPurchases(setPending);
    return unsub;
  }, []);

  const loadPacks = async () => {
    try {
      setPacks(await fitTokensClient.allPacks());
    } catch (err) {
      console.warn('Failed to load FitToken packs:', err);
    }
  };
  const loadBalances = async () => {
    try {
      setBalances(await fitTokensClient.balances());
    } catch (err) {
      console.warn('Failed to load FitToken balances:', err);
    }
  };
  useEffect(() => {
    loadPacks();
    loadBalances();
  }, []);

  // ── Pending queue actions ───────────────────────────────────────────────

  const handleCredit = async (row: PendingPurchaseRow) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await fitTokensClient.adminCredit(row.id, coach);
      await loadBalances();
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to credit that purchase');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelRow = async (row: PendingPurchaseRow) => {
    if (busyId) return;
    if (!window.confirm(`Cancel ${row.reference} (${row.packName} for ${row.studentName})? The code will stop working.`)) return;
    setBusyId(row.id);
    try {
      await fitTokensClient.adminCancel(row.id, coach);
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel that purchase');
    } finally {
      setBusyId(null);
    }
  };

  // ── Packs editor ────────────────────────────────────────────────────────

  const openEdit = (p: FitTokenPack) =>
    setPackForm({
      key: p.key,
      name: p.name,
      tokens: String(p.tokens),
      priceLabel: p.priceLabel,
      paymentUrl: p.paymentUrl ?? '',
      active: p.active,
      isNew: false,
    });

  const openNew = () =>
    setPackForm({ key: '', name: '', tokens: '50', priceLabel: '', paymentUrl: '', active: true, isNew: true });

  const savePack = async () => {
    if (!packForm) return;
    const tokens = parseInt(packForm.tokens, 10);
    if (!packForm.key.trim()) {
      alert('Pack key is required (short slug like "starter")');
      return;
    }
    if (!Number.isFinite(tokens) || tokens <= 0) {
      alert('Tokens must be a positive number');
      return;
    }
    setPackBusy(true);
    try {
      await fitTokensClient.upsertPack({
        key: packForm.key,
        name: packForm.name.trim() || packForm.key,
        tokens,
        priceLabel: packForm.priceLabel,
        paymentUrl: packForm.paymentUrl.trim(),
        active: packForm.active,
      });
      setPackForm(null);
      await loadPacks();
    } catch (err: any) {
      alert(err?.message || 'Failed to save the pack');
    } finally {
      setPackBusy(false);
    }
  };

  const deletePack = async (p: FitTokenPack) => {
    if (!window.confirm(`Remove the ${p.name} pack? Parents will no longer see it.`)) return;
    try {
      await fitTokensClient.removePack(p.key);
      await loadPacks();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove the pack');
    }
  };

  // ── Balances quick adjust ───────────────────────────────────────────────

  const quickAdjust = async (row: TokenBalanceRow, sign: 1 | -1) => {
    const amtStr = window.prompt(
      `${sign > 0 ? 'Add' : 'Remove'} how many FitTokens for ${row.fullName}?`,
      '10'
    );
    if (!amtStr) return;
    const amt = Math.abs(parseInt(amtStr, 10));
    if (!amt) return;
    const reason = window.prompt(
      'Reason (shows in the ledger):',
      sign > 0 ? 'Front desk purchase' : 'Correction'
    );
    if (reason === null) return;
    try {
      await fitTokensClient.adjust(row.studentId, sign * amt, reason, coach);
      await loadBalances();
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Adjustment failed');
    }
  };

  const filteredBalances = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return balances;
    return balances.filter(
      (b) =>
        b.fullName.toLowerCase().includes(needle) ||
        (b.gamerTag ?? '').toLowerCase().includes(needle)
    );
  }, [balances, search]);

  // ── Webhook cheat sheet ─────────────────────────────────────────────────

  const cheatSheet = [
    `POST ${WEBHOOK_URL}`,
    'Header: x-fittoken-secret: <FITTOKEN_WEBHOOK_SECRET>',
    'Body: { "reference": "FT-XXXXXX" }',
    '  or: { "email": "parent@example.com", "packKey": "starter" }',
  ].join('\n');

  const copyCheatSheet = async () => {
    try {
      await navigator.clipboard.writeText(cheatSheet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the webhook cheat sheet:', cheatSheet);
    }
  };

  return (
    <div className="pz-scope space-y-6">
      {/* ── Pending purchases queue ─────────────────────────────────────── */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
            <Ic.Coin size={24} className="text-[#CBFE1C]" /> FitTokens Queue
          </h2>
          {pending.length > 0 && (
            <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </div>
        <p className="text-xs text-[#ABABAB] mb-4">
          Parents pay on the hosted checkout or at the front desk, then you credit their code here.
          The webhook credits paid checkouts automatically.
        </p>

        {pending.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <Ic.CheckCircle size={36} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">No pending purchases</div>
            <div className="text-xs">New reference codes show up here in real time</div>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((row) => (
              <div key={row.id} className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-black text-sm" style={{ color: 'var(--pz-volt)' }}>{row.reference}</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[9px] font-black uppercase">
                        {row.packName} · {row.tokens} tokens
                      </span>
                      {row.priceLabel && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-black uppercase">
                          {row.priceLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white/80">
                      for {row.studentName}
                    </div>
                    <div className="text-[10px] text-[#ABABAB] mt-0.5">
                      {row.parentName} · {row.parentEmail} · {ageOf(row.createdAt)}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleCredit(row)}
                      disabled={busyId === row.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.Check size={14} /> Credit
                    </button>
                    <button
                      onClick={() => handleCancelRow(row)}
                      disabled={busyId === row.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ic.XMark size={14} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Webhook cheat sheet for the GHL / Stripe automation */}
        <div className="mt-5 p-3 rounded-xl border border-white/10" style={{ background: 'var(--pz-bg)' }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="pz-eyebrow">Payment Webhook</div>
            <button
              onClick={copyCheatSheet}
              className="touch-btn focus-ring min-h-[36px] px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5"
            >
              <Ic.ClipboardCheck size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            className="text-[11px] leading-relaxed m-0 overflow-x-auto"
            style={{ color: 'var(--pz-volt)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          >
            {cheatSheet}
          </pre>
          <p className="text-[10px] text-[#ABABAB] mt-2 mb-0">
            Point the GHL automation (or Stripe webhook relay) here after a successful checkout.
            The reference code rides the payment link as client_reference_id.
          </p>
        </div>
      </section>

      {/* ── Packs editor ────────────────────────────────────────────────── */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
            <Ic.Store size={24} className="text-[#CBFE1C]" /> Packs
          </h2>
          <button
            onClick={openNew}
            className="touch-btn focus-ring min-h-[44px] px-4 rounded-xl bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5"
          >
            <Ic.Plus size={14} /> Add Pack
          </button>
        </div>
        <p className="text-xs text-[#ABABAB] mb-4">
          What parents see on the Get FitTokens sheet. Payment URL is a hosted Stripe Payment Link
          or GHL checkout link; leave it empty for front-desk-only packs.
        </p>

        <div className="space-y-2">
          {packs.map((p) => (
            <div key={p.key} className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-white">{p.name}</span>
                    <span className="text-[10px] text-[#ABABAB] font-bold">({p.key})</span>
                    {!p.active && (
                      <span className="px-2 py-0.5 rounded bg-white/10 text-[#ABABAB] text-[9px] font-black uppercase">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/80 font-bold mt-0.5 inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--pz-volt)' }}>
                      <Ic.Coin size={12} /> {p.tokens}
                    </span>
                    <span>· {p.priceLabel}</span>
                    <span className="text-[10px] text-[#ABABAB]">
                      · {p.paymentUrl ? 'Hosted checkout linked' : 'Front desk only'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="touch-btn focus-ring min-h-[44px] px-3 rounded-xl bg-white/5 border border-white/15 text-white text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5"
                  >
                    <Ic.Edit size={13} /> Edit
                  </button>
                  <button
                    onClick={() => deletePack(p)}
                    className="touch-btn focus-ring min-h-[44px] px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5"
                  >
                    <Ic.Trash size={13} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {packs.length === 0 && (
            <div className="text-center py-8 text-[#ABABAB] text-sm">
              No packs yet. Add one, or run the seed to load the defaults.
            </div>
          )}
        </div>

        {packForm && (
          <div className="mt-4 p-4 rounded-xl border border-[#CBFE1C]/30" style={{ background: 'var(--pz-bg)' }}>
            <div className="pz-eyebrow mb-3">{packForm.isNew ? 'New Pack' : `Edit ${packForm.key}`}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wide text-[#ABABAB] mb-1">Key</label>
                <input
                  className={inputCls}
                  style={inputStyle}
                  value={packForm.key}
                  disabled={!packForm.isNew}
                  onChange={(e) => setPackForm({ ...packForm, key: e.target.value })}
                  placeholder="starter"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wide text-[#ABABAB] mb-1">Name</label>
                <input
                  className={inputCls}
                  style={inputStyle}
                  value={packForm.name}
                  onChange={(e) => setPackForm({ ...packForm, name: e.target.value })}
                  placeholder="Starter Pack"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wide text-[#ABABAB] mb-1">Tokens</label>
                <input
                  className={inputCls}
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={packForm.tokens}
                  onChange={(e) => setPackForm({ ...packForm, tokens: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wide text-[#ABABAB] mb-1">Price Label</label>
                <input
                  className={inputCls}
                  style={inputStyle}
                  value={packForm.priceLabel}
                  onChange={(e) => setPackForm({ ...packForm, priceLabel: e.target.value })}
                  placeholder="$4.99"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-wide text-[#ABABAB] mb-1">
                  Payment URL (hosted Stripe/GHL checkout link, optional)
                </label>
                <input
                  className={inputCls}
                  style={inputStyle}
                  value={packForm.paymentUrl}
                  onChange={(e) => setPackForm({ ...packForm, paymentUrl: e.target.value })}
                  placeholder="https://buy.stripe.com/..."
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                onClick={() => setPackForm({ ...packForm, active: !packForm.active })}
                className={`touch-btn focus-ring min-h-[44px] px-4 rounded-xl text-[10px] font-black uppercase tracking-wide border ${
                  packForm.active
                    ? 'bg-[#CBFE1C]/15 border-[#CBFE1C]/40 text-[#CBFE1C]'
                    : 'bg-white/5 border-white/15 text-[#ABABAB]'
                }`}
              >
                {packForm.active ? 'Active' : 'Inactive'}
              </button>
              <div className="flex-grow" />
              <button
                onClick={() => setPackForm(null)}
                className="touch-btn focus-ring min-h-[44px] px-4 rounded-xl bg-white/5 border border-white/15 text-white text-[10px] font-black uppercase tracking-wide"
              >
                Cancel
              </button>
              <button
                onClick={savePack}
                disabled={packBusy}
                className="touch-btn focus-ring min-h-[44px] px-5 rounded-xl bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black uppercase tracking-wide disabled:opacity-50"
              >
                {packBusy ? 'Saving' : 'Save Pack'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Balances ────────────────────────────────────────────────────── */}
      <section className="pz-card p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5 mb-1">
          <Ic.Users size={24} className="text-[#CBFE1C]" /> Balances
        </h2>
        <p className="text-xs text-[#ABABAB] mb-4">
          Every athlete's FitTokens balance. Use plus and minus for front-desk grants and
          corrections; every change lands in the ledger with your name.
        </p>
        <input
          className={`${inputCls} mb-3`}
          style={inputStyle}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or gamer tag"
          aria-label="Search athletes"
        />
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {filteredBalances.map((row) => (
            <div
              key={row.studentId}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/10"
              style={{ background: 'var(--pz-panel-2)' }}
            >
              <div className="flex-grow min-w-0">
                <div className="text-sm font-bold text-white truncate">{row.fullName}</div>
                {row.gamerTag && (
                  <div className="text-[10px] text-[#ABABAB] font-bold truncate">{row.gamerTag}</div>
                )}
              </div>
              <div
                className="inline-flex items-center gap-1 text-sm font-black flex-shrink-0"
                style={{ color: 'var(--pz-volt)' }}
              >
                <Ic.Coin size={14} /> {row.fitTokens.toLocaleString()}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => quickAdjust(row, -1)}
                  aria-label={`Remove FitTokens from ${row.fullName}`}
                  className="touch-btn focus-ring w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-black inline-flex items-center justify-center"
                >
                  -
                </button>
                <button
                  onClick={() => quickAdjust(row, 1)}
                  aria-label={`Add FitTokens to ${row.fullName}`}
                  className="touch-btn focus-ring w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black inline-flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {filteredBalances.length === 0 && (
            <div className="text-center py-8 text-[#ABABAB] text-sm">No athletes match that search</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TokenCenter;
