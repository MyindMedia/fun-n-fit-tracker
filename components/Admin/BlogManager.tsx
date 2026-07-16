
import React, { useState, useEffect } from 'react';
import { BlogPost } from '../../types';
import { supabaseService } from '../../services/supabaseService';

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
      case 'HIGH': return 'bg-red-100 text-red-600';
      case 'LOW': return 'bg-slate-100 text-slate-500';
      default: return 'bg-blue-100 text-blue-600';
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
    <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
          Blog & Alerts
        </h2>
        <button
          onClick={openCreateForm}
          className="touch-btn px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-black uppercase active:bg-blue-600"
        >
          + New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-slate-900">{posts.length}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Total</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-emerald-600">{posts.filter(p => p.isPublished).length}</div>
          <div className="text-[9px] font-bold text-emerald-500 uppercase">Published</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-red-600">{posts.filter(p => p.priority === 'HIGH' && p.isPublished).length}</div>
          <div className="text-[9px] font-bold text-red-500 uppercase">Alerts</div>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-2">
        {loading && posts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm font-medium">No posts yet</div>
            <div className="text-xs">Create your first post above</div>
          </div>
        ) : (
          posts.map(post => (
            <div
              key={post.id}
              onClick={() => openEditForm(post)}
              className="touch-btn p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer active:bg-slate-100 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getPriorityColor(post.priority)}`}>
                      {post.priority === 'HIGH' ? 'Alert' : post.priority}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      {getAudienceLabel(post.targetAudience)}
                    </span>
                  </div>
                  <div className="font-black text-sm text-slate-900 truncate">{post.title}</div>
                  {post.excerpt && (
                    <div className="text-xs text-slate-500 truncate mt-1">{post.excerpt}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePublish(post); }}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                      post.isPublished
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {post.isPublished ? 'Live' : 'Draft'}
                  </button>
                  {post.publishedAt && (
                    <span className="text-[9px] text-slate-400">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Modal - Rendered inline to prevent re-mounting */}
      {showForm && editingPost && (
        <div className="mobile-modal animate-fade-in" style={{ zIndex: 'var(--z-modal, 200)' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative flex flex-col bg-slate-50 w-full h-full animate-slide-up overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
              <button onClick={closeForm} className="touch-btn text-slate-500 font-bold text-sm px-2 py-1">
                Cancel
              </button>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                {editingPost.id ? 'Edit Post' : 'New Post'}
              </h2>
              <button
                onClick={handleSave}
                disabled={loading || !editingPost.title || !editingPost.content}
                className="touch-btn text-brand-blue font-black text-sm px-2 py-1 disabled:opacity-30"
              >
                {loading ? '...' : 'Save'}
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-grow overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {/* Title */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={editingPost.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Enter post title..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Excerpt (Preview Text)
                </label>
                <input
                  type="text"
                  value={editingPost.excerpt || ''}
                  onChange={(e) => updateField('excerpt', e.target.value)}
                  placeholder="Short preview text..."
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Content *
                </label>
                <textarea
                  value={editingPost.content || ''}
                  onChange={(e) => updateField('content', e.target.value)}
                  placeholder="Write your post content..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue resize-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
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
                          ? 'border-brand-blue bg-blue-50 text-brand-blue'
                          : 'border-slate-100 bg-white text-slate-500'
                      }`}
                    >
                      {getAudienceLabel(aud)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
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
                          ? p === 'HIGH' ? 'border-red-500 bg-red-50 text-red-600'
                          : p === 'LOW' ? 'border-slate-400 bg-slate-50 text-slate-500'
                          : 'border-brand-blue bg-blue-50 text-brand-blue'
                          : 'border-slate-100 bg-white text-slate-500'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">HIGH priority posts appear as alerts</p>
              </div>

              {/* Publish Toggle */}
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100">
                <div>
                  <div className="font-black text-sm text-slate-900">Publish</div>
                  <div className="text-[10px] text-slate-500">Make visible to target audience</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('isPublished', !editingPost.isPublished)}
                  className={`w-14 h-8 rounded-full transition-all ${editingPost.isPublished ? 'bg-emerald-500' : 'bg-slate-300'}`}
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
                  className="touch-btn w-full py-4 rounded-xl bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest border border-red-100 active:bg-red-100"
                >
                  Delete Post
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BlogManager;
