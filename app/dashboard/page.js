'use client';

import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) {
      router.push('/');
      return;
    }
    setUser(decoded);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchArchives();
      fetchEmails();
      fetchTags();
    }
  }, [user]);

  async function fetchArchives() {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setArchives(data || []);
  }

  async function fetchEmails() {
    const { data, error } = await supabase
      .from('emails')
      .select('*, tags(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setEmails(data || []);
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });
    if (!error) setTags(data || []);
  }

  async function createArchive(e) {
    e.preventDefault();
    if (!newArchiveTitle.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('archives').insert({
      title: newArchiveTitle.trim(),
      user_id: user.id,
    });
    if (!error) {
      setNewArchiveTitle('');
      fetchArchives();
    }
    setCreating(false);
  }

  async function deleteArchive(id) {
    if (!confirm('Hapus arsip ini beserta semua pesannya?')) return;
    await supabase.from('messages').delete().eq('archive_id', id);
    await supabase.from('archives').delete().eq('id', id);
    fetchArchives();
  }

  async function addEmail(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('emails').insert({
      email: newEmail.trim(),
      user_id: user.id,
    });
    if (!error) {
      setNewEmail('');
      fetchEmails();
    }
    setCreating(false);
  }

  async function deleteEmail(id) {
    if (!confirm('Hapus email ini?')) return;
    await supabase.from('emails').delete().eq('id', id);
    fetchEmails();
  }

  async function createTag(e) {
    e.preventDefault();
    if (!newTag.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('tags').insert({
      name: newTag.trim(),
      user_id: user.id,
    });
    if (!error) {
      setNewTag('');
      fetchTags();
    }
    setCreating(false);
  }

  async function deleteTag(id) {
    if (!confirm('Hapus tag ini? Email di tag ini akan menjadi tanpa tag.')) return;
    await supabase.from('tags').delete().eq('id', id);
    fetchTags();
    fetchEmails();
  }

  async function assignTag(emailId, tagId) {
    await supabase.from('emails').update({ tag_id: tagId || null }).eq('id', emailId);
    setAssigningEmail(null);
    fetchEmails();
  }

  function handleLogout() {
    removeToken();
    router.push('/');
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredEmails = selectedTagFilter === 'all'
    ? emails
    : selectedTagFilter === 'untagged'
      ? emails.filter(e => !e.tag_id)
      : emails.filter(e => e.tag_id === selectedTagFilter);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner large"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="app-title">ArsipMaR</h1>
          <span className="user-email">{user?.email}</span>
        </div>
        <button onClick={handleLogout} className="btn-logout" id="logout-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Keluar
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'arsip' ? 'active' : ''}`}
          onClick={() => setActiveTab('arsip')}
          id="tab-arsip"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Arsip Chat
        </button>
        <button
          className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
          id="tab-email"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email
        </button>
      </div>

      {/* Content */}
      <main className="dashboard-content">
        {/* ===== ARSIP TAB ===== */}
        {activeTab === 'arsip' && (
          <div className="section-content">
            <form onSubmit={createArchive} className="create-form">
              <input
                type="text"
                placeholder="Judul arsip baru..."
                value={newArchiveTitle}
                onChange={(e) => setNewArchiveTitle(e.target.value)}
                className="create-input"
                id="archive-input"
              />
              <button type="submit" className="btn-create" disabled={creating} id="create-archive-btn">
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>

            <div className="card-list">
              {archives.length === 0 ? (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p>Belum ada arsip. Buat arsip pertamamu!</p>
                </div>
              ) : (
                archives.map((archive) => (
                  <div
                    key={archive.id}
                    className="card archive-card"
                    onClick={() => router.push(`/archive/${archive.id}`)}
                    id={`archive-${archive.id}`}
                  >
                    <div className="card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>
                    </div>
                    <div className="card-content">
                      <h3>{archive.title}</h3>
                      <span className="card-date">{formatDate(archive.created_at)}</span>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteArchive(archive.id);
                      }}
                      title="Hapus arsip"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===== EMAIL TAB ===== */}
        {activeTab === 'email' && (
          <div className="section-content">
            {/* Add Email */}
            <form onSubmit={addEmail} className="create-form">
              <input
                type="email"
                placeholder="Tambahkan email..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="create-input"
                id="email-input"
              />
              <button type="submit" className="btn-create" disabled={creating} id="add-email-btn">
                {creating ? <span className="spinner small"></span> : '+'}
              </button>
            </form>

            {/* Tag Management */}
            <div className="tag-section">
              <form onSubmit={createTag} className="tag-form">
                <input
                  type="text"
                  placeholder="Buat tag baru..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="tag-input"
                  id="tag-input"
                />
                <button type="submit" className="btn-tag-add" disabled={creating} id="add-tag-btn">
                  + Tag
                </button>
              </form>

              {/* Tag Filter Pills */}
              {tags.length > 0 && (
                <div className="tag-filters">
                  <button
                    className={`tag-pill ${selectedTagFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('all')}
                  >
                    Semua ({emails.length})
                  </button>
                  <button
                    className={`tag-pill ${selectedTagFilter === 'untagged' ? 'active' : ''}`}
                    onClick={() => setSelectedTagFilter('untagged')}
                  >
                    Tanpa Tag ({emails.filter(e => !e.tag_id).length})
                  </button>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      className={`tag-pill ${selectedTagFilter === tag.id ? 'active' : ''}`}
                      onClick={() => setSelectedTagFilter(tag.id)}
                    >
                      {tag.name} ({emails.filter(e => e.tag_id === tag.id).length})
                      <span
                        className="tag-delete"
                        onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                        title="Hapus tag"
                      >×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email List */}
            <div className="card-list">
              {filteredEmails.length === 0 ? (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p>Belum ada email. Tambahkan email pertamamu!</p>
                </div>
              ) : (
                filteredEmails.map((item, index) => {
                  const globalIndex = emails.findIndex(e => e.id === item.id) + 1;
                  return (
                    <div key={item.id} className="card email-card" id={`email-${item.id}`}>
                      {/* Email Number */}
                      <div className="email-number">#{globalIndex}</div>

                      <div className="card-icon email-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                      </div>

                      <div className="card-content">
                        <h3>{item.email}</h3>
                        <div className="email-meta">
                          {item.tags ? (
                            <span className="email-tag-badge">{item.tags.name}</span>
                          ) : (
                            <span className="email-tag-badge untagged">Tanpa Tag</span>
                          )}
                          <span className="card-date">{formatDate(item.created_at)}</span>
                        </div>
                      </div>

                      <div className="card-actions">
                        {/* Assign Tag Button */}
                        <div className="tag-assign-wrapper">
                          <button
                            className="btn-tag-assign"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningEmail(assigningEmail === item.id ? null : item.id);
                            }}
                            title="Ubah tag"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                              <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                          </button>
                          {assigningEmail === item.id && (
                            <div className="tag-dropdown">
                              <button
                                className="tag-option"
                                onClick={() => assignTag(item.id, null)}
                              >
                                — Tanpa Tag
                              </button>
                              {tags.map(tag => (
                                <button
                                  key={tag.id}
                                  className={`tag-option ${item.tag_id === tag.id ? 'selected' : ''}`}
                                  onClick={() => assignTag(item.id, tag.id)}
                                >
                                  {tag.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <a
                          href={`mailto:${item.email}?body=halo`}
                          className="btn-mailto"
                          onClick={(e) => e.stopPropagation()}
                          title="Kirim email"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </a>

                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEmail(item.id);
                          }}
                          title="Hapus email"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
