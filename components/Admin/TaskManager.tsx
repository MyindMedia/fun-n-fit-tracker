import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { SpecialTask, TaskSubmission } from '../../types';

interface PendingRow {
  submission: TaskSubmission;
  taskTitle: string;
  points: number;
  studentName: string;
  parentName: string;
}

interface TaskForm {
  id?: string;
  title: string;
  description: string;
  points: number;
  requiresProof: boolean;
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  points: 25,
  requiresProof: false,
};

interface TaskManagerProps {
  adminName: string;
}

const TaskManager: React.FC<TaskManagerProps> = ({ adminName }) => {
  const coach = adminName || 'Coach';

  // ── Pending approval queue (live) ───────────────────────────────────────
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = gameCenter.subscribePendingSubmissions(setPending);
    return unsub;
  }, []);

  const handleReview = async (submissionId: string, approve: boolean) => {
    if (reviewingId) return;
    if (!approve && !window.confirm('Reject this submission? The athlete will not receive points.')) return;
    setReviewingId(submissionId);
    try {
      await gameCenter.reviewSubmission(submissionId, approve, coach);
    } catch (err: any) {
      alert(err?.message || 'Review failed');
    } finally {
      setReviewingId(null);
    }
  };

  // ── Task CRUD ───────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    try {
      const rows = await gameCenter.adminListTasks();
      setTasks(rows);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const updateField = <K extends keyof TaskForm>(field: K, value: TaskForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.title.trim() || !form.description.trim()) {
      alert('Please fill in a title and description');
      return;
    }
    const points = Math.max(1, Math.round(Number(form.points) || 25));
    setSaving(true);
    try {
      if (form.id) {
        await gameCenter.updateTask(form.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          points,
          requiresProof: form.requiresProof,
        });
      } else {
        await gameCenter.createTask({
          title: form.title.trim(),
          description: form.description.trim(),
          points,
          requiresProof: form.requiresProof,
        });
      }
      await loadTasks();
      setForm(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: SpecialTask) => {
    if (busyId) return;
    setBusyId(t.id);
    try {
      await gameCenter.updateTask(t.id, { isActive: !t.isActive });
      await loadTasks();
    } catch (err: any) {
      alert(err?.message || 'Failed to update task');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (t: SpecialTask) => {
    if (!window.confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    setBusyId(t.id);
    try {
      await gameCenter.removeTask(t.id);
      await loadTasks();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete task');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pz-scope space-y-4">
      {/* Pending approval queue */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight">
            ⏳ Pending Approvals
          </h2>
          {pending.length > 0 && (
            <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] font-black rounded-full px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm font-medium">Queue is clear</div>
            <div className="text-xs">Parent task submissions land here for review</div>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(({ submission, taskTitle, points, studentName, parentName }) => (
              <div key={submission.id} className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)', borderColor: 'rgba(245, 158, 11, 0.35)' }}>
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-sm text-white">{studentName}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase">
                        +{points} pts
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white/90">⭐ {taskTitle}</div>
                    <div className="text-[10px] text-[#ABABAB] mt-0.5">
                      Submitted by {parentName} · {new Date(submission.createdAt).toLocaleDateString()}{' '}
                      {new Date(submission.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    {submission.note && (
                      <div className="text-xs text-[#ABABAB] rounded-lg border border-white/10 px-3 py-2 mt-2" style={{ background: 'var(--pz-bg)' }}>
                        “{submission.note}”
                      </div>
                    )}
                    {submission.photoUrl && (
                      <a
                        href={submission.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2"
                      >
                        <img
                          src={submission.photoUrl}
                          alt="Submission proof"
                          className="w-24 h-24 object-cover rounded-xl border-2 border-white/10"
                        />
                      </a>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => handleReview(submission.id, true)}
                      disabled={reviewingId === submission.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleReview(submission.id, false)}
                      disabled={reviewingId === submission.id}
                      className="touch-btn focus-ring flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Task catalog */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight">
            ⭐ Special Tasks
          </h2>
          <button
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="touch-btn focus-ring pz-btn px-4 py-2 text-xs"
          >
            + New Task
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-[#ABABAB]">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-[#ABABAB]">
            <div className="text-4xl mb-2">⭐</div>
            <div className="text-sm font-medium">No special tasks yet</div>
            <div className="text-xs">Create off-site challenges kids can complete for points</div>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`pz-card-sm p-4 transition-all ${
                  t.isActive ? '' : 'opacity-60'
                }`}
                style={{ background: 'var(--pz-panel-2)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-sm text-white">{t.title}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase">
                        +{t.points} pts
                      </span>
                      {t.requiresProof && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[9px] font-black uppercase">
                          📸 Proof Required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#ABABAB]">{t.description}</div>
                  </div>
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={busyId === t.id}
                    className={`touch-btn focus-ring px-3 py-1 rounded-lg text-[9px] font-black uppercase flex-shrink-0 disabled:opacity-50 ${
                      t.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-[#ABABAB]'
                    }`}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      setForm({
                        id: t.id,
                        title: t.title,
                        description: t.description,
                        points: t.points,
                        requiresProof: t.requiresProof,
                      })
                    }
                    className="touch-btn focus-ring pz-btn-ghost px-3 py-2 text-[10px]"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={busyId === t.id}
                    className="touch-btn focus-ring px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wide border border-red-500/30 active:bg-red-500/20 disabled:opacity-50"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create / edit modal */}
      {form && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setForm(null)}
            aria-hidden="true"
          />
          <div className="relative pz-card w-full sm:max-w-md drop-shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <button
                onClick={() => setForm(null)}
                className="touch-btn text-[#ABABAB] font-bold text-sm px-2 py-1"
              >
                Cancel
              </button>
              <h3 className="text-sm text-white uppercase tracking-wide">
                {form.id ? 'Edit Task' : 'New Task'}
              </h3>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.description.trim()}
                className="touch-btn text-[#CBFE1C] font-black text-sm px-2 py-1 disabled:opacity-30"
              >
                {saving ? '…' : 'Save'}
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Read a book for 30 minutes"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Description *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What does the athlete need to do?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => updateField('points', Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white outline-none focus:border-[#CBFE1C]"
                />
              </div>

              <div className="pz-card-sm flex items-center justify-between p-4" style={{ background: 'var(--pz-panel-2)' }}>
                <div>
                  <div className="font-black text-sm text-white">Require Proof</div>
                  <div className="text-[10px] text-[#ABABAB]">Parents must attach a note or photo</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('requiresProof', !form.requiresProof)}
                  className={`w-14 h-8 rounded-full transition-all flex-shrink-0 ${
                    form.requiresProof ? 'bg-emerald-500' : 'bg-white/15'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      form.requiresProof ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;
