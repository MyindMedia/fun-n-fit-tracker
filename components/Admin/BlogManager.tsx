
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BlogPost } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Ic } from '../icons';

const BlogManager: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getAllBlogPosts();
      setPosts(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingPost({
      title: '',
      content: '',
      excerpt: '',
      targetAudience: 'ALL',
      priority: 'NORMAL',
      isPublished: false
    });
    setShowForm(true);
  };

  const openEditForm = (post: BlogPost) => {
    setEditingPost({ ...post });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  const handleSave = async () => {
    if (!editingPost || !editingPost.title || !editingPost.content) {
      alert('Please fill in title and content');
      return;
    }

    setLoading(true);
    try {
      if (editingPost.id) {
        await supabaseService.updateBlogPost(editingPost.id, {
          title: editingPost.title,
          content: editingPost.content,
          excerpt: editingPost.excerpt,
          targetAudience: editingPost.targetAudience,
          priority: editingPost.priority,
          isPublished: editingPost.isPublished
        });
      } else {
        await supabaseService.createBlogPost({
          title: editingPost.title,
          content: editingPost.content,
          excerpt: editingPost.excerpt,
          targetAudience: editingPost.targetAudience,
          priority: editingPost.priority,
          isPublished: editingPost.isPublished
        });
      }
      await loadPosts();
      closeForm();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save post');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPost?.id) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;

    setLoading(true);
    try {
      await supabaseService.deleteBlogPost(editingPost.id);
      await loadPosts();
      closeForm();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (post: BlogPost) => {
    setLoading(true);
    try {
      await supabaseService.updateBlogPost(post.id, { isPublished: !post.isPublished });
      await loadPosts();
    } catch (err) {
      console.error('Toggle publish failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/15 text-red-400';
      case 'LOW': return 'bg-white/5 text-[#ABABAB]';
      default: return 'bg-sky-500/15 text-sky-400';
    }
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case 'STUDENTS': return 'Students';
      case 'PARENTS': return 'Parents';
      case 'COACHES': return 'Coaches';
      case 'ADMINS': return 'Admins';
      default: return 'Everyone';
    }
  };

  // Update individual fields without recreating the object reference
  const updateField = (field: keyof BlogPost, value: any) => {
    setEditingPost(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <section className="pz-scope pz-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight">
          Blog & Alerts
        </h2>
        <button
          onClick={openCreateForm}
          className="touch-btn pz-btn px-4 py-2 text-xs"
        >
          + New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-2xl pz-display text-white">{posts.length}</div>
          <div className="text-[9px] font-bold text-[#ABABAB] uppercase">Total</div>
        </div>
        <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
          <div className="text-2xl pz-display text-emerald-400">{posts.filter(p => p.isPublished).length}</div>
          <div className="text-[9px] font-bold text-emerald-400/80 uppercase">Published</div>
        </div>
        <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
          <div className="text-2xl pz-display text-red-400">{posts.filter(p => p.priority === 'HIGH' && p.isPublished).length}</div>
          <div className="text-[9px] font-bold text-red-400/80 uppercase">Alerts</div>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-2">
        {loading && posts.length === 0 ? (
          <div className="text-center py-12 text-[#ABABAB]">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-[#ABABAB]">
            <Ic.Note size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">No posts yet</div>
            <div className="text-xs">Create your first post above</div>
          </div>
        ) : (
          posts.map(post => (
            <div
              key={post.id}
              onClick={() => openEditForm(post)}
              className="touch-btn pz-card-sm p-4 cursor-pointer transition-all hover:border-[#CBFE1C]"
              style={{ background: 'var(--pz-panel-2)' }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getPriorityColor(post.priority)}`}>
                      {post.priority === 'HIGH' ? 'Alert' : post.priority}
                    </span>
                    <span className="text-[9px] font-bold text-[#ABABAB]">
                      {getAudienceLabel(post.targetAudience)}
                    </span>
                  </div>
                  <div className="font-black text-sm text-white truncate">{post.title}</div>
                  {post.excerpt && (
                    <div className="text-xs text-[#ABABAB] truncate mt-1">{post.excerpt}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePublish(post); }}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                      post.isPublished
                        ? 'bg-[#CBFE1C]/15 text-[#CBFE1C]'
                        : 'bg-white/10 text-[#ABABAB]'
                    }`}
                  >
                    {post.isPublished ? 'Live' : 'Draft'}
                  </button>
                  {post.publishedAt && (
                    <span className="text-[9px] text-[#ABABAB]">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal: portal to <body> so the parent pz-card's notch clip-path
          can't clip it (it was hiding the Save + audience controls), and lift
          it above the tab bar. */}
      {showForm && editingPost && createPortal(
        <div className="pz-scope mobile-modal animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative flex flex-col w-full h-full animate-slide-up overflow-hidden" style={{ background: 'var(--pz-bg)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0" style={{ background: 'var(--pz-panel)' }}>
              <button onClick={closeForm} className="touch-btn text-[#ABABAB] font-bold text-sm px-2 py-1">
                Cancel
              </button>
              <h2 className="text-sm text-white uppercase tracking-wide">
                {editingPost.id ? 'Edit Post' : 'New Post'}
              </h2>
              <button
                onClick={handleSave}
                disabled={loading || !editingPost.title || !editingPost.content}
                className="touch-btn text-[#CBFE1C] font-black text-sm px-2 py-1 disabled:opacity-30"
              >
                {loading ? '...' : 'Save'}
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-grow overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {/* Title */}
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={editingPost.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Enter post title..."
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Excerpt (Preview Text)
                </label>
                <input
                  type="text"
                  value={editingPost.excerpt || ''}
                  onChange={(e) => updateField('excerpt', e.target.value)}
                  placeholder="Short preview text..."
                  maxLength={200}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Content *
                </label>
                <textarea
                  value={editingPost.content || ''}
                  onChange={(e) => updateField('content', e.target.value)}
                  placeholder="Write your post content..."
                  rows={8}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C] resize-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['ALL', 'STUDENTS', 'PARENTS'].map(aud => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => updateField('targetAudience', aud)}
                      className={`touch-btn p-3 rounded-xl border-2 text-xs font-black uppercase transition-all ${
                        editingPost.targetAudience === aud
                          ? 'border-[#CBFE1C] bg-[#CBFE1C]/10 text-[#CBFE1C]'
                          : 'border-white/10 bg-[#171C27] text-[#ABABAB]'
                      }`}
                    >
                      {getAudienceLabel(aud)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-2 block">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['LOW', 'NORMAL', 'HIGH'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateField('priority', p)}
                      className={`touch-btn p-3 rounded-xl border-2 text-xs font-black uppercase transition-all ${
                        editingPost.priority === p
                          ? p === 'HIGH' ? 'border-red-500 bg-red-500/10 text-red-400'
                          : p === 'LOW' ? 'border-white/40 bg-white/5 text-white'
                          : 'border-[#CBFE1C] bg-[#CBFE1C]/10 text-[#CBFE1C]'
                          : 'border-white/10 bg-[#171C27] text-[#ABABAB]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#ABABAB] mt-1">HIGH priority posts appear as alerts</p>
              </div>

              {/* Publish Toggle */}
              <div className="pz-card-sm flex items-center justify-between p-4" style={{ background: 'var(--pz-panel-2)' }}>
                <div>
                  <div className="font-black text-sm text-white">Publish</div>
                  <div className="text-[10px] text-[#ABABAB]">Make visible to target audience</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('isPublished', !editingPost.isPublished)}
                  className={`w-14 h-8 rounded-full transition-all ${editingPost.isPublished ? 'bg-emerald-500' : 'bg-white/15'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${editingPost.isPublished ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Delete Button (only for existing posts) */}
              {editingPost.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="touch-btn w-full py-4 rounded-xl bg-red-500/10 text-red-400 font-black text-xs uppercase tracking-widest border border-red-500/30 active:bg-red-500/20"
                >
                  Delete Post
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default BlogManager;
