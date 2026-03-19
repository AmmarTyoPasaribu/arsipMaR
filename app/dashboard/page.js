'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getUserFromToken, removeToken } from '../../lib/auth';
import { useRouter } from 'next/navigation';

const TAG_COLORS = ['#f97316','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#6366f1','#84cc16','#e879f9','#38bdf8'];

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('arsip');
  const [archives, setArchives] = useState([]);
  const [emails, setEmails] = useState([]);
  const [tags, setTags] = useState([]);
  const [newArchiveTitle, setNewArchiveTitle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTag, setNewTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');
  const [assigningEmail, setAssigningEmail] = useState(null);
  const [editingDrive, setEditingDrive] = useState(null);
  const [driveInput, setDriveInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  // Sort editing
  const [editingSortId, setEditingSortId] = useState(null);
  const [sortInput, setSortInput] = useState('');
  // Info tab
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentInput, setPaymentInput] = useState('');
  const [editingRecovery, setEditingRecovery] = useState(null);
  const [recoveryInput, setRecoveryInput] = useState('');
  const router = useRouter();

  function showConfirm(title, desc, onConfirm, isLogout) {
    setToast({ title, desc, onConfirm, isLogout: !!isLogout });
  }
  function dismissConfirm() { setToast(null); }
  function handleConfirm() { if (toast?.onConfirm) toast.onConfirm(); setToast(null); }
  function showSuccess(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); }

  useEffect(() => {
    const saved = localStorage.getItem('arsipmar-theme');
    if (saved === 'light') { setDarkMode(false); document.documentElement.setAttribute('data-theme', 'light'); }
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('arsipmar-theme', next ? 'dark' : 'light');
  }

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) { router.push('/'); return; }
    setUser(decoded); setLoading(false);
  }, []);

  useEffect(() => { if (user) { fetchArchives(); fetchEmails(); fetchTags(); } }, [user]);

  async function fetchArchives() {
    const { data } = await supabase.from('archives').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setArchives(data || []);
  }
  async function fetchEmails() {
    const { data } = await supabase.from('emails').select('*, tags(id, name)').eq('user_id', user.id).order('sort_order', { ascending: true });
    setEmails(data || []);
  }
  async function fetchTags() {
    const { data } = await supabase.from('tags').select('*').eq('user_id', user.id).order('name', { ascending: true });
    setTags(data || []);
  }

  async function createArchive(e) {
    e.preventDefault(); if (!newArchiveTitle.trim()) return;
    setCreating(true);
    await supabase.from('archives').insert({ title: newArchiveTitle.trim(), user_id: user.id });
    setNewArchiveTitle(''); fetchArchives(); setCreating(false);
    showSuccess('Arsip berhasil dibuat');
  }

  function requestDeleteArchive(e, id) {
    e.stopPropagation();
    showConfirm('Hapus Arsip?', 'Arsip beserta semua pesannya akan dihapus permanen.', async () => {
      await supabase.from('messages').delete().eq('archive_id', id);
      await supabase.from('archives').delete().eq('id', id);
      fetchArchives(); showSuccess('Arsip berhasil dihapus');
    });
  }

  async function addEmail(e) {
    e.preventDefault(); if (!newEmail.trim()) return;
    setCreating(true);
    const maxOrder = emails.length > 0 ? Math.max(...emails.map(e => e.sort_order || 0)) : 0;
    await supabase.from('emails').insert({ email: newEmail.trim(), user_id: user.id, sort_order: maxOrder + 1 });
    setNewEmail(''); fetchEmails(); setCreating(false);
    showSuccess('Email berhasil ditambahkan');
  }

  function requestDeleteEmail(e, id) {
    e.stopPropagation();
    showConfirm('Hapus Email?', 'Email ini akan dihapus permanen dari daftar.', async () => {
      await supabase.from('emails').delete().eq('id', id);
      fetchEmails(); showSuccess('Email berhasil dihapus');
    });
  }

  async function createTag(e) {
    e.preventDefault(); if (!newTag.trim()) return;
    setCreating(true);
    await supabase.from('tags').insert({ name: newTag.trim(), user_id: user.id });
    setNewTag(''); fetchTags(); setCreating(false);
  }

  function requestDeleteTag(e, id) {
    e.stopPropagation();
    showConfirm('Hapus Tag?', 'Tag ini akan dihapus dan email terkait akan kehilangan tag.', async () => {
      await supabase.from('tags').delete().eq('id', id);
      fetchTags(); fetchEmails(); showSuccess('Tag berhasil dihapus');
    });
  }

  async function assignTag(emailId, tagId) {
    await supabase.from('emails').update({ tag_id: tagId || null }).eq('id', emailId);
    setAssigningEmail(null); fetchEmails();
  }

  async function updateDriveUsage(emailId) {
    const parsed = parseFloat(driveInput.replace(',', '.'));
    const value = isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, 15));
    await supabase.from('emails').update({ drive_usage: value }).eq('id', emailId);
    setEditingDrive(null); setDriveInput(''); fetchEmails();
    showSuccess('Drive usage diperbarui');
  }

  // Sort by number: swap if duplicate
  async function saveSortOrder(emailId, currentOrder) {
    const newOrder = parseInt(sortInput);
    if (isNaN(newOrder) || newOrder < 1 || newOrder === currentOrder) {
      setEditingSortId(null); setSortInput(''); return;
    }
    // Find email that currently has this sort_order
    const existing = emails.find(e => e.sort_order === newOrder && e.id !== emailId);
    if (existing) {
      // Swap: give the existing one the current order
      await supabase.from('emails').update({ sort_order: currentOrder }).eq('id', existing.id);
    }
    await supabase.from('emails').update({ sort_order: newOrder }).eq('id', emailId);
    setEditingSortId(null); setSortInput('');
    fetchEmails();
  }

  // Info tab: update payment
  async function savePayment(emailId) {
    await supabase.from('emails').update({ payment: paymentInput.trim() }).eq('id', emailId);
    setEditingPayment(null); setPaymentInput(''); fetchEmails();
    showSuccess('Payment diperbarui');
  }

  // Info tab: update recovery email
  async function saveRecovery(emailId) {
    await supabase.from('emails').update({ recovery_email: recoveryInput.trim() }).eq('id', emailId);
    setEditingRecovery(null); setRecoveryInput(''); fetchEmails();
    showSuccess('Email pemulihan diperbarui');
  }

  function copyEmail(emailText) {
    navigator.clipboard.writeText(emailText).then(() => {
      setCopiedId(emailText); showSuccess('Email berhasil disalin!');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function requestLogout() {
    showConfirm('Keluar dari Akun?', 'Kamu akan keluar dari ArsipMaR.', () => { removeToken(); router.push('/'); }, true);
  }

  function getTagColor(tagId) {
    const idx = tags.findIndex(t => t.id === tagId);
    return TAG_COLORS[idx % TAG_COLORS.length] || TAG_COLORS[0];
  }

  function formatDate(d) { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function formatGB(v) { return (!v) ? '0' : v.toFixed(1).replace('.', ','); }
  function getDrivePercent(v) { return (!v) ? 0 : Math.min((v / 15) * 100, 100); }
  function getDriveColor(p) { if (p >= 90) return '#ef4444'; if (p >= 70) return '#f59e0b'; if (p >= 50) return '#eab308'; return '#22c55e'; }

  const filteredArchives = searchQuery.trim()
    ? archives.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())) : archives;

  const filteredEmails = (() => {
    let list = selectedTagFilter === 'all' ? emails
      : selectedTagFilter === 'untagged' ? emails.filter(e => !e.tag_id)
      : emails.filter(e => e.tag_id === selectedTagFilter);
    if (searchQuery.trim() && (activeTab === 'email' || activeTab === 'info'))
      list = list.filter(e => e.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  })();

  if (loading) return <div className="loading-screen"><div className="spinner large"></div></div>;

  return (
    <div className="dashboard">
      {/* Confirm Modal */}
      {toast && (
        <div className="modal-overlay" onClick={dismissConfirm}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              {toast.isLogout ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              )}
            </div>
            <div className="modal-title">{toast.title}</div>
            <div className="modal-desc">{toast.desc}</div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={dismissConfirm}>Batal</button>
              <button className={`modal-btn-confirm ${toast.isLogout ? 'logout-btn' : ''}`} onClick={handleConfirm}>
                {toast.isLogout ? 'Ya, Keluar' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="toast-success">
          <span className="toast-success-icon">✓</span>
          {successMsg}
        </div>
      )}

      {/* Top Nav */}
      <header className="dashboard-header">
        <div className="header-left">
          <img src="/logo.svg" alt="ArsipMaR" width="34" height="34" style={{ borderRadius: 6 }}/>
          <h1 className="app-title">ArsipMaR</h1>
          <span className="user-email">{user?.email}</span>
        </div>
        <div className="header-right">
          <button onClick={toggleTheme} className="btn-theme" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
          <button onClick={requestLogout} className="btn-logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Keluar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'arsip' ? 'active' : ''}`}
          onClick={() => { setActiveTab('arsip'); setSearchQuery(''); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Arsip Chat
        </button>
        <button className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => { setActiveTab('email'); setSearchQuery(''); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email
        </button>
        <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => { setActiveTab('info'); setSearchQuery(''); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Info
        </button>
      </div>

      <main className="dashboard-content">
        {/* ARSIP */}
        {activeTab === 'arsip' && (
          <div className="section-content">
            <form onSubmit={createArchive} className="create-form">
              <input type="text" placeholder="Judul arsip baru..." value={newArchiveTitle}
                onChange={(e) => setNewArchiveTitle(e.target.value)} className="create-input"/>
              <button type="submit" className="btn-create" disabled={creating}>
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Cari arsip..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="search-input"/>
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>
            <div className="card-grid">
              {filteredArchives.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p>{searchQuery ? 'Tidak ditemukan' : 'Belum ada arsip'}</p>
                </div>
              ) : filteredArchives.map(a => (
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
                  <button className="btn-delete" onClick={(e) => requestDeleteArchive(e, a.id)}>
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

        {/* EMAIL */}
        {activeTab === 'email' && (
          <div className="section-content">
            <form onSubmit={addEmail} className="create-form">
              <input type="email" placeholder="Tambahkan email..." value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} className="create-input"/>
              <button type="submit" className="btn-create" disabled={creating}>
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Cari email..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="search-input"/>
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>

            <div className="tag-section">
              <form onSubmit={createTag} className="tag-form">
                <input type="text" placeholder="Buat tag baru..." value={newTag}
                  onChange={(e) => setNewTag(e.target.value)} className="tag-input"/>
                <button type="submit" className="btn-tag-add" disabled={creating}>+ Tag</button>
              </form>
              {tags.length > 0 && (
                <div className="tag-filters">
                  <button className={`tag-pill ${selectedTagFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('all')}>Semua ({emails.length})</button>
                  <button className={`tag-pill ${selectedTagFilter === 'untagged' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('untagged')}>Tanpa Tag ({emails.filter(e => !e.tag_id).length})</button>
                  {tags.map((t, i) => (
                    <button key={t.id} className={`tag-pill ${selectedTagFilter === t.id ? 'active' : ''}`}
                      onClick={() => setSelectedTagFilter(t.id)}
                      style={selectedTagFilter === t.id ? { background: TAG_COLORS[i % TAG_COLORS.length], borderColor: TAG_COLORS[i % TAG_COLORS.length] } : {}}>
                      <span className="tag-dot" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}></span>
                      {t.name} ({emails.filter(e => e.tag_id === t.id).length})
                      <span className="tag-delete" onClick={(e) => requestDeleteTag(e, t.id)}>×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email Table */}
            <div className="email-table">
              <div className="email-table-header">
                <span className="th-center">#</span>
                <span>Email</span>
                <span className="th-center">Cadangkan</span>
                <span className="th-center">Pay</span>
                <span className="th-center">Tag</span>
                <span className="th-center">Drive</span>
                <span className="th-center">Action</span>
              </div>
              {filteredEmails.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p>{searchQuery ? 'Tidak ditemukan' : 'Belum ada email'}</p>
                </div>
              ) : filteredEmails.map((item, index) => {
                const dp = getDrivePercent(item.drive_usage);
                const dc = getDriveColor(dp);
                const tc = item.tags ? getTagColor(item.tag_id) : null;
                const hasRecovery = !!(item.recovery_email && item.recovery_email.trim());
                const hasPay = !!(item.payment && item.payment.trim());
                return (
                  <div key={item.id} className="email-row">
                    <div className="sort-num-cell">
                      {editingSortId === item.id ? (
                        <input type="number" className="sort-input" value={sortInput} min="1" autoFocus
                          onChange={(e) => setSortInput(e.target.value)}
                          onBlur={() => saveSortOrder(item.id, item.sort_order)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveSortOrder(item.id, item.sort_order); if (e.key === 'Escape') { setEditingSortId(null); setSortInput(''); } }}/>
                      ) : (
                        <span className="sort-num" onClick={() => { setEditingSortId(item.id); setSortInput(String(item.sort_order || index + 1)); }}
                          title="Klik untuk ubah urutan">
                          {item.sort_order || index + 1}
                        </span>
                      )}
                    </div>
                    <div className="email-info">
                      <span className="email-address" onClick={() => copyEmail(item.email)} title="Klik untuk copy">
                        {item.email}
                        {copiedId === item.email && <span className="copied-badge">✓</span>}
                      </span>
                      <div className="email-date">{formatDate(item.created_at)}</div>
                    </div>
                    <div className="status-cell">
                      <span className={`status-badge ${hasRecovery ? 'yes' : 'no'}`}>
                        {hasRecovery ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="status-cell">
                      <span className={`status-badge ${hasPay ? 'yes' : 'no'}`}>
                        {hasPay ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="email-tag-cell">
                      {item.tags ? (
                        <span className="email-tag-badge" style={{ background: `${tc}18`, color: tc }}>
                          <span className="tag-dot" style={{ background: tc }}></span>
                          {item.tags.name}
                        </span>
                      ) : (
                        <span className="email-tag-badge untagged">—</span>
                      )}
                    </div>
                    <div className="drive-cell">
                      <div className="drive-bar-mini">
                        <div className="drive-bar-mini-fill" style={{ width: `${dp}%`, backgroundColor: dc }}/>
                      </div>
                      <div className="drive-labels">
                        <span className="drive-label" style={{ color: dc }}>{formatGB(item.drive_usage)} / 15 GB</span>
                        <span className="drive-percent" style={{ color: dc }}>{dp.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="email-actions">
                      {/* Tag */}
                      <div className="action-wrapper">
                        <button className={`action-btn ${assigningEmail === item.id ? 'tag-active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setAssigningEmail(assigningEmail === item.id ? null : item.id); setEditingDrive(null); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                            <line x1="7" y1="7" x2="7.01" y2="7"/>
                          </svg>
                        </button>
                        {assigningEmail === item.id && (
                          <div className="dropdown">
                            <button className="dropdown-item" onClick={() => assignTag(item.id, null)}>— Tanpa Tag</button>
                            {tags.map((t, i) => (
                              <button key={t.id} className={`dropdown-item ${item.tag_id === t.id ? 'selected' : ''}`}
                                onClick={() => assignTag(item.id, t.id)}>
                                <span className="tag-dot" style={{ background: TAG_COLORS[i % TAG_COLORS.length], display: 'inline-block', marginRight: 6 }}></span>
                                {t.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Drive */}
                      <div className="action-wrapper">
                        <button className={`action-btn ${editingDrive === item.id ? 'drive-active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setEditingDrive(editingDrive === item.id ? null : item.id);
                            setDriveInput(item.drive_usage ? formatGB(item.drive_usage) : ''); setAssigningEmail(null); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                        {editingDrive === item.id && (
                          <div className="drive-edit-popup">
                            <input type="text" className="drive-input" placeholder="GB" value={driveInput}
                              onChange={(e) => setDriveInput(e.target.value)} autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') updateDriveUsage(item.id); if (e.key === 'Escape') { setEditingDrive(null); setDriveInput(''); } }}/>
                            <button className="drive-save" onClick={() => updateDriveUsage(item.id)}>✓</button>
                          </div>
                        )}
                      </div>
                      {/* Send */}
                      <a href={`mailto:${item.email}`} className="action-btn" onClick={(e) => e.stopPropagation()} title="Kirim">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </a>
                      {/* Delete */}
                      <button className="action-btn delete-btn" onClick={(e) => requestDeleteEmail(e, item.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

        {/* INFO */}
        {activeTab === 'info' && (
          <div className="section-content">
            <div className="search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Cari email..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="search-input"/>
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>

            <div className="email-table">
              <div className="info-table-header">
                <span className="th-center">#</span>
                <span>Email</span>
                <span className="th-center">Email Pemulihan</span>
                <span className="th-center">Payment</span>
              </div>
              {filteredEmails.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>Belum ada email</p>
                </div>
              ) : filteredEmails.map((item, index) => (
                <div key={item.id} className="info-row">
                  <span className="email-num">{item.sort_order || index + 1}</span>
                  <div className="email-info">
                    <span className="email-address" onClick={() => copyEmail(item.email)} title="Klik untuk copy">
                      {item.email}
                      {copiedId === item.email && <span className="copied-badge">✓</span>}
                    </span>
                  </div>
                  <div className="info-input-cell">
                    {editingRecovery === item.id ? (
                      <div className="info-edit-row">
                        <input type="email" className="info-input" value={recoveryInput}
                          onChange={(e) => setRecoveryInput(e.target.value)} autoFocus placeholder="Email pemulihan..."
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRecovery(item.id); if (e.key === 'Escape') setEditingRecovery(null); }}/>
                        <button className="drive-save" onClick={() => saveRecovery(item.id)}>✓</button>
                        <button className="info-cancel" onClick={() => setEditingRecovery(null)}>✗</button>
                      </div>
                    ) : (
                      <span className="info-value" onClick={() => { setEditingRecovery(item.id); setRecoveryInput(item.recovery_email || ''); setEditingPayment(null); }}>
                        {item.recovery_email && item.recovery_email.trim() ? item.recovery_email : <span className="info-empty">— Kosong</span>}
                      </span>
                    )}
                  </div>
                  <div className="info-input-cell">
                    {editingPayment === item.id ? (
                      <div className="info-edit-row">
                        <input type="text" className="info-input" value={paymentInput}
                          onChange={(e) => setPaymentInput(e.target.value)} autoFocus placeholder="Isi payment..."
                          onKeyDown={(e) => { if (e.key === 'Enter') savePayment(item.id); if (e.key === 'Escape') setEditingPayment(null); }}/>
                        <button className="drive-save" onClick={() => savePayment(item.id)}>✓</button>
                        <button className="info-cancel" onClick={() => setEditingPayment(null)}>✗</button>
                      </div>
                    ) : (
                      <span className="info-value" onClick={() => { setEditingPayment(item.id); setPaymentInput(item.payment || ''); setEditingRecovery(null); }}>
                        {item.payment && item.payment.trim() ? item.payment : <span className="info-empty">— Kosong</span>}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
