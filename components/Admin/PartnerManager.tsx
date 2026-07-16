import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { gameCenter } from '../../services/gameCenter';
import { PartnerBusiness } from '../../types';

const visitLink = (qrSecret: string) =>
  `${window.location.origin}${window.location.pathname}#/parent-dashboard?visit=${qrSecret}`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface PartnerForm {
  id?: string;
  name: string;
  description: string;
  category: string;
  address: string;
  pointsReward: number;
}

const EMPTY_FORM: PartnerForm = {
  name: '',
  description: '',
  category: '',
  address: '',
  pointsReward: 25,
};

const PartnerManager: React.FC = () => {
  const [partners, setPartners] = useState<PartnerBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const rows = await gameCenter.adminListPartners();
      setPartners(rows);
    } catch (err: any) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = <K extends keyof PartnerForm>(field: K, value: PartnerForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      alert('Please enter a business name');
      return;
    }
    const points = Math.max(1, Math.round(Number(form.pointsReward) || 25));
    setSaving(true);
    try {
      if (form.id) {
        await gameCenter.updatePartner(form.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          address: form.address.trim() || undefined,
          pointsReward: points,
        });
      } else {
        await gameCenter.createPartner({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          address: form.address.trim() || undefined,
          pointsReward: points,
        });
      }
      await load();
      setForm(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: PartnerBusiness) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      await gameCenter.updatePartner(p.id, { isActive: !p.isActive });
      await load();
    } catch (err: any) {
      alert(err?.message || 'Failed to update partner');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: PartnerBusiness) => {
    if (!window.confirm(`Delete "${p.name}"? Its QR code will stop working. This cannot be undone.`)) return;
    setBusyId(p.id);
    try {
      await gameCenter.removePartner(p.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete partner');
    } finally {
      setBusyId(null);
    }
  };

  const handleRotate = async (p: PartnerBusiness) => {
    if (!window.confirm(`Rotate the QR code for "${p.name}"? Printed QR codes will stop working and must be replaced.`)) return;
    setBusyId(p.id);
    try {
      await gameCenter.rotatePartnerSecret(p.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Failed to rotate QR secret');
    } finally {
      setBusyId(null);
    }
  };

  const handlePrint = async (p: PartnerBusiness) => {
    if (!p.qrSecret) {
      alert('No QR secret available for this partner yet.');
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(visitLink(p.qrSecret), {
        width: 640,
        margin: 2,
        color: { dark: '#0f172a', light: '#FFFFFF' },
      });
      const win = window.open('', '_blank');
      if (!win) {
        alert('Pop-up blocked — please allow pop-ups to print the QR code.');
        return;
      }
      win.document.write(`
        <title>${escapeHtml(p.name)} — Fun 'N Fit QR</title>
        <style>
          body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 48px 24px; color: #0f172a; }
          h1 { font-size: 34px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
          .points { font-size: 18px; font-weight: 700; color: #059669; margin: 0 0 28px; }
          img { width: 340px; height: 340px; border: 6px solid #0f172a; border-radius: 24px; padding: 12px; }
          .hint { font-size: 16px; font-weight: 600; margin-top: 28px; max-width: 420px; margin-left: auto; margin-right: auto; }
          .print-btn { margin-top: 32px; padding: 14px 32px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; background: #2563eb; color: white; border: none; border-radius: 12px; cursor: pointer; }
          @media print { .print-btn { display: none; } }
        </style>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="points">Earn ${p.pointsReward} points per visit</p>
        <img src="${dataUrl}" alt="QR code" />
        <p class="hint">Scan with your Fun 'N Fit parent portal to earn ${p.pointsReward} points!</p>
        <button class="print-btn" onclick="window.print()">🖨️ Print</button>
      `);
      win.document.close();
    } catch (err: any) {
      alert(err?.message || 'Failed to generate QR code');
    }
  };

  return (
    <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
          🏪 Partners
        </h2>
        <button
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="touch-btn focus-ring px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-black uppercase active:bg-blue-600"
        >
          + New Partner
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-slate-900">{partners.length}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Partners</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-emerald-600">{partners.filter((p) => p.isActive).length}</div>
          <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Active</div>
        </div>
      </div>

      {/* Partner list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">🏪</div>
            <div className="text-sm font-medium">No partner businesses yet</div>
            <div className="text-xs">Add a local business so families can earn points around town</div>
          </div>
        ) : (
          partners.map((p) => (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition-all ${
                p.isActive ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-sm text-slate-900 truncate">{p.name}</span>
                    {p.category && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-600 text-[9px] font-black uppercase">
                        {p.category}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase">
                      +{p.pointsReward} pts
                    </span>
                  </div>
                  {p.description && <div className="text-xs text-slate-500 mb-0.5">{p.description}</div>}
                  {p.address && <div className="text-[10px] text-slate-400">📍 {p.address}</div>}
                </div>
                <button
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p.id}
                  className={`touch-btn focus-ring px-3 py-1 rounded-lg text-[9px] font-black uppercase flex-shrink-0 disabled:opacity-50 ${
                    p.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {p.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => handlePrint(p)}
                  className="touch-btn focus-ring px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide active:bg-slate-700"
                >
                  🖨️ Print QR
                </button>
                <button
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      description: p.description || '',
                      category: p.category || '',
                      address: p.address || '',
                      pointsReward: p.pointsReward,
                    })
                  }
                  className="touch-btn focus-ring px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wide active:bg-slate-200"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleRotate(p)}
                  disabled={busyId === p.id}
                  className="touch-btn focus-ring px-3 py-2 rounded-xl bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wide border border-amber-100 active:bg-amber-100 disabled:opacity-50"
                >
                  🔁 Rotate QR
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={busyId === p.id}
                  className="touch-btn focus-ring px-3 py-2 rounded-xl bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-wide border border-red-100 active:bg-red-100 disabled:opacity-50"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <button
                onClick={() => setForm(null)}
                className="touch-btn text-slate-500 font-bold text-sm px-2 py-1"
              >
                Cancel
              </button>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                {form.id ? 'Edit Partner' : 'New Partner'}
              </h3>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="touch-btn text-brand-blue font-black text-sm px-2 py-1 disabled:opacity-30"
              >
                {saving ? '…' : 'Save'}
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Tony's Pizza"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What families should know…"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Category
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  placeholder="e.g. Food, Books, Sports"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main St"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Points Per Visit
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.pointsReward}
                  onChange={(e) => updateField('pointsReward', Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Each athlete can earn this once per business per day
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PartnerManager;
