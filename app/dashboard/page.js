'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getUserFromToken, removeToken } from '../../lib/auth';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('arsip');
  const [archives, setArchives] = useState([]);
  const [emails, setEmails] = useState([]);
  const [tags, setTags] = useState([]);
  const [newArchiveTitle, setNewArchiveTitle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTag, setNewTag] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');
  const [assigningEmail, setAssigningEmail] = useState(null);
  const [editingDrive, setEditingDrive] = useState(null);
  const [driveInput, setDriveInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const router = useRouter();

  // Toast system
  function showToastConfirm(message, onConfirm) {
    setToast({ message, onConfirm });
  }

  function dismissToast() { setToast(null); }

  function handleToastConfirm() {
    if (toast?.onConfirm) toast.onConfirm();
    setToast(null);
  }

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) { router.push('/'); return; }
    setUser(decoded);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) { fetchArchives(); fetchEmails(); fetchTags(); }
  }, [user]);

  async function fetchArchives() {
    const { data } = await supabase.from('archives').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    setArchives(data || []);
  }

  async function fetchEmails() {
    const { data } = await supabase.from('emails').select('*, tags(id, name)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    setEmails(data || []);
  }

  async function fetchTags() {
    const { data } = await supabase.from('tags').select('*')
      .eq('user_id', user.id).order('name', { ascending: true });
    setTags(data || []);
  }

  async function createArchive(e) {
    e.preventDefault();
    if (!newArchiveTitle.trim()) return;
    setCreating(true);
    await supabase.from('archives').insert({ title: newArchiveTitle.trim(), user_id: user.id });
    setNewArchiveTitle('');
    fetchArchives();
    setCreating(false);
  }

  function requestDeleteArchive(e, id) {
    e.stopPropagation();
    showToastConfirm('Hapus arsip ini?', async () => {
      await supabase.from('messages').delete().eq('archive_id', id);
      await supabase.from('archives').delete().eq('id', id);
      fetchArchives();
    });
  }

  async function addEmail(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setCreating(true);
    await supabase.from('emails').insert({ email: newEmail.trim(), user_id: user.id });
    setNewEmail('');
    fetchEmails();
    setCreating(false);
  }

  function requestDeleteEmail(e, id) {
    e.stopPropagation();
    showToastConfirm('Hapus email ini?', async () => {
      await supabase.from('emails').delete().eq('id', id);
      fetchEmails();
    });
  }

  async function createTag(e) {
    e.preventDefault();
    if (!newTag.trim()) return;
    setCreating(true);
    await supabase.from('tags').insert({ name: newTag.trim(), user_id: user.id });
    setNewTag('');
    fetchTags();
    setCreating(false);
  }

  function requestDeleteTag(e, id) {
    e.stopPropagation();
    showToastConfirm('Hapus tag ini?', async () => {
      await supabase.from('tags').delete().eq('id', id);
      fetchTags(); fetchEmails();
    });
  }

  async function assignTag(emailId, tagId) {
    await supabase.from('emails').update({ tag_id: tagId || null }).eq('id', emailId);
    setAssigningEmail(null);
    fetchEmails();
  }

  async function updateDriveUsage(emailId) {
    const parsed = parseFloat(driveInput.replace(',', '.'));
    const value = isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, 15));
    await supabase.from('emails').update({ drive_usage: value }).eq('id', emailId);
    setEditingDrive(null); setDriveInput('');
    fetchEmails();
  }

  function handleLogout() { removeToken(); router.push('/'); }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatGB(v) { return (!v) ? '0' : v.toFixed(1).replace('.', ','); }
  function getDrivePercent(v) { return (!v) ? 0 : Math.min((v / 15) * 100, 100); }
  function getDriveColor(p) {
    if (p >= 90) return '#ef4444';
    if (p >= 70) return '#f59e0b';
    if (p >= 50) return '#eab308';
    return '#22c55e';
  }

  const filteredEmails = selectedTagFilter === 'all'
    ? emails
    : selectedTagFilter === 'untagged'
      ? emails.filter(e => !e.tag_id)
      : emails.filter(e => e.tag_id === selectedTagFilter);

  if (loading) return <div className="loading-screen"><div className="spinner large"></div></div>;

  return (
    <div className="dashboard">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className="toast-confirm">
            <span className="toast-text">{toast.message}</span>
            <div className="toast-actions">
              <button className="toast-btn-yes" onClick={handleToastConfirm}>Hapus</button>
              <button className="toast-btn-no" onClick={dismissToast}>Batal</button>
            </div>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="app-title">ArsipMaR</h1>
          <span className="user-email">{user?.email}</span>
        </div>
        <button onClick={handleLogout} className="btn-logout" id="logout-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Keluar
        </button>
      </header>

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'arsip' ? 'active' : ''}`}
          onClick={() => setActiveTab('arsip')} id="tab-arsip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Arsip Chat
        </button>
        <button className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')} id="tab-email">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email
        </button>
      </div>

      <main className="dashboard-content">
        {activeTab === 'arsip' && (
          <div className="section-content">
            <form onSubmit={createArchive} className="create-form">
              <input type="text" placeholder="Judul arsip baru..." value={newArchiveTitle}
                onChange={(e) => setNewArchiveTitle(e.target.value)} className="create-input" id="archive-input"/>
              <button type="submit" className="btn-create" disabled={creating}>
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>
            <div className="card-list">
              {archives.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p>Belum ada arsip</p>
                </div>
              ) : archives.map(a => (
                <div key={a.id} className="card" onClick={() => router.push(`/archive/${a.id}`)}>
                  <div className="card-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                  </div>
                  <div className="card-content">
                    <h3>{a.title}</h3>
                    <span className="card-date">{formatDate(a.created_at)}</span>
                  </div>
                  <button className="btn-delete" onClick={(e) => requestDeleteArchive(e, a.id)} title="Hapus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="section-content">
            <form onSubmit={addEmail} className="create-form">
              <input type="email" placeholder="Tambahkan email..." value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} className="create-input" id="email-input"/>
              <button type="submit" className="btn-create" disabled={creating}>
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>

            <div className="tag-section">
              <form onSubmit={createTag} className="tag-form">
                <input type="text" placeholder="Buat tag baru..." value={newTag}
                  onChange={(e) => setNewTag(e.target.value)} className="tag-input" id="tag-input"/>
                <button type="submit" className="btn-tag-add" disabled={creating}>+ Tag</button>
              </form>
              {tags.length > 0 && (
                <div className="tag-filters">
                  <button className={`tag-pill ${selectedTagFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('all')}>Semua ({emails.length})</button>
                  <button className={`tag-pill ${selectedTagFilter === 'untagged' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('untagged')}>Tanpa Tag ({emails.filter(e => !e.tag_id).length})</button>
                  {tags.map(t => (
                    <button key={t.id} className={`tag-pill ${selectedTagFilter === t.id ? 'active' : ''}`}
                      onClick={() => setSelectedTagFilter(t.id)}>
                      {t.name} ({emails.filter(e => e.tag_id === t.id).length})
                      <span className="tag-delete" onClick={(e) => requestDeleteTag(e, t.id)}>×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card-list">
              {filteredEmails.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p>Belum ada email</p>
                </div>
              ) : filteredEmails.map((item, index) => {
                const dp = getDrivePercent(item.drive_usage);
                const dc = getDriveColor(dp);
                return (
                  <div key={item.id} className="card email-card">
                    <div className="email-number">#{index + 1}</div>
                    <div className="card-content">
                      <h3>{item.email}</h3>
                      <div className="email-meta">
                        {item.tags ? (
                          <span className="email-tag-badge">{item.tags.name}</span>
                        ) : (
                          <span className="email-tag-badge untagged">—</span>
                        )}
                        <span className="card-date">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="drive-usage">
                        <div className="drive-bar-container">
                          <div className="drive-bar-fill" style={{ width: `${dp}%`, backgroundColor: dc }}/>
                        </div>
                        <div className="drive-info">
                          <span className="drive-text" style={{ color: dc }}>{formatGB(item.drive_usage)} / 15 GB</span>
                          <span className="drive-percent" style={{ color: dc }}>{dp.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="card-actions">
                      <div className="tag-assign-wrapper">
                        <button className="btn-tag-assign" onClick={(e) => {
                          e.stopPropagation();
                          setAssigningEmail(assigningEmail === item.id ? null : item.id);
                          setEditingDrive(null);
                        }} title="Tag">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                            <line x1="7" y1="7" x2="7.01" y2="7"/>
                          </svg>
                        </button>
                        {assigningEmail === item.id && (
                          <div className="tag-dropdown">
                            <button className="tag-option" onClick={() => assignTag(item.id, null)}>— Tanpa Tag</button>
                            {tags.map(t => (
                              <button key={t.id} className={`tag-option ${item.tag_id === t.id ? 'selected' : ''}`}
                                onClick={() => assignTag(item.id, t.id)}>{t.name}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="drive-update-wrapper">
                        <button className="btn-drive-update" onClick={(e) => {
                          e.stopPropagation();
                          setEditingDrive(editingDrive === item.id ? null : item.id);
                          setDriveInput(item.drive_usage ? formatGB(item.drive_usage) : '');
                          setAssigningEmail(null);
                        }} title="Update Drive">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                        {editingDrive === item.id && (
                          <div className="drive-edit-inline">
                            <input type="text" className="drive-input" placeholder="GB" value={driveInput}
                              onChange={(e) => setDriveInput(e.target.value)} autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateDriveUsage(item.id);
                                if (e.key === 'Escape') { setEditingDrive(null); setDriveInput(''); }
                              }}/>
                            <button className="btn-drive-save" onClick={() => updateDriveUsage(item.id)}>✓</button>
                          </div>
                        )}
                      </div>

                      <a href={`mailto:${item.email}?body=halo`} className="btn-mailto"
                        onClick={(e) => e.stopPropagation()} title="Kirim">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </a>

                      <button className="btn-delete" onClick={(e) => requestDeleteEmail(e, item.id)} title="Hapus">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
