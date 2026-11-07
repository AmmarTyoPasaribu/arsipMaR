'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Icon from '../components/Icon';
import { SearchInput } from './ArchivesTab';

// Candy pastels used as solid fills under dark ink text (Brutal Permen)
const TAG_COLORS = ['#d7c4ff', '#ffb8d9', '#a8f0ff', '#ffe08a', '#b8f5a0', '#ffc6a8', '#c4d4ff', '#f5c4ff', '#a8ffe0', '#ffd0d0'];
const DRIVE_MAX_GB = 15;
// GB thresholds: 12+ red, 11 to <12 orange, below that green
const DRIVE_RED_GB = 12, DRIVE_ORANGE_GB = 11;

// Color derived from the tag id, so it doesn't shift when another tag is deleted
export function tagColor(tagId) {
  let h = 0;
  for (const ch of String(tagId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function driveLevel(gb) { return gb >= DRIVE_RED_GB ? 'full' : gb >= DRIVE_ORANGE_GB ? 'warn' : 'ok'; }
export function formatGB(v) { return (v || 0).toFixed(1).replace('.', ','); }
function formatDate(d) { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function EmailsTab({ user, emails, tags, loaded, refreshEmails, refreshTags, notify, notifyError, confirm }) {
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('order');
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  // which inline popover is open: { type: 'tag' | 'drive', id }
  const [popover, setPopover] = useState(null);
  const [driveInput, setDriveInput] = useState('');
  const [editingSortId, setEditingSortId] = useState(null);
  const [sortInput, setSortInput] = useState('');
  const savingSort = useRef(false);

  // Close popovers on outside click / Escape (popover elements stop propagation)
  useEffect(() => {
    if (!popover) return;
    const close = () => setPopover(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [popover]);

  async function addEmail(e) {
    e.preventDefault();
    const value = newEmail.trim().toLowerCase();
    if (!value) return;
    if (emails.some(x => x.email.toLowerCase() === value)) { notifyError('Email sudah ada di daftar'); return; }
    setCreating(true);
    const maxOrder = emails.length > 0 ? Math.max(...emails.map(x => x.sort_order || 0)) : 0;
    const { error } = await supabase.from('emails').insert({ email: value, user_id: user.id, sort_order: maxOrder + 1 });
    setCreating(false);
    if (error) { notifyError('Gagal menambahkan email'); return; }
    setNewEmail(''); refreshEmails();
    notify('Email ditambahkan');
  }

  function requestDeleteEmail(item) {
    confirm({
      title: 'Hapus email?',
      desc: `${item.email} akan dihapus permanen dari daftar.`,
      onConfirm: async () => {
        const { error } = await supabase.from('emails').delete().eq('id', item.id).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus email'); return; }
        refreshEmails(); notify('Email dihapus');
      },
    });
  }

  async function createTag(e) {
    e.preventDefault();
    const name = newTag.trim();
    if (!name) { setAddingTag(false); return; }
    if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) { notifyError('Tag sudah ada'); return; }
    const { error } = await supabase.from('tags').insert({ name, user_id: user.id });
    if (error) { notifyError('Gagal membuat tag'); return; }
    setNewTag(''); setAddingTag(false); refreshTags();
    notify('Tag dibuat');
  }

  function requestDeleteTag(e, tag) {
    e.stopPropagation();
    confirm({
      title: `Hapus tag "${tag.name}"?`,
      desc: 'Email yang memakai tag ini akan menjadi tanpa tag.',
      onConfirm: async () => {
        const { error } = await supabase.from('tags').delete().eq('id', tag.id).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus tag'); return; }
        if (tagFilter === tag.id) setTagFilter('all');
        refreshTags(); refreshEmails(); notify('Tag dihapus');
      },
    });
  }

  async function assignTag(emailId, tagId) {
    setPopover(null);
    const { error } = await supabase.from('emails').update({ tag_id: tagId || null }).eq('id', emailId);
    if (error) notifyError('Gagal mengubah tag');
    refreshEmails();
  }

  function openDrive(item) {
    setDriveInput(item.drive_usage ? formatGB(item.drive_usage) : '');
    setPopover({ type: 'drive', id: item.id });
  }

  async function saveDrive(emailId) {
    const parsed = parseFloat(driveInput.replace(',', '.'));
    const value = isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, DRIVE_MAX_GB));
    setPopover(null);
    const { error } = await supabase.from('emails').update({ drive_usage: value }).eq('id', emailId);
    if (error) { notifyError('Gagal menyimpan drive'); return; }
    refreshEmails(); notify('Drive diperbarui');
  }

  // Changing a number swaps places with the email that currently has it
  async function saveSortOrder(emailId, currentOrder) {
    // Enter and the resulting blur both call this; ignore the second call
    if (savingSort.current) return;
    const newOrder = parseInt(sortInput, 10);
    if (isNaN(newOrder) || newOrder < 1 || newOrder === currentOrder) {
      setEditingSortId(null); setSortInput(''); return;
    }
    savingSort.current = true;
    const existing = emails.find(x => x.sort_order === newOrder && x.id !== emailId);
    if (existing) await supabase.from('emails').update({ sort_order: currentOrder }).eq('id', existing.id);
    await supabase.from('emails').update({ sort_order: newOrder }).eq('id', emailId);
    setEditingSortId(null); setSortInput('');
    await refreshEmails();
    savingSort.current = false;
  }

  function copyEmail(text) {
    navigator.clipboard.writeText(text).then(() => notify('Email disalin')).catch(() => notifyError('Gagal menyalin'));
  }

  const totalGB = emails.reduce((s, x) => s + (x.drive_usage || 0), 0);
  const fullCount = emails.filter(x => (x.drive_usage || 0) >= DRIVE_RED_GB).length;
  const noRecoveryCount = emails.filter(x => !x.recovery_email?.trim()).length;
  const noPayCount = emails.filter(x => !x.payment?.trim()).length;

  const q = search.trim().toLowerCase();
  let list = tagFilter === 'all' ? emails
    : tagFilter === 'untagged' ? emails.filter(x => !x.tag_id)
    : emails.filter(x => x.tag_id === tagFilter);
  if (q) list = list.filter(x => x.email.toLowerCase().includes(q));
  if (statusFilter === 'norecovery') list = list.filter(x => !x.recovery_email?.trim());
  else if (statusFilter === 'nopay') list = list.filter(x => !x.payment?.trim());
  else if (statusFilter === 'full') list = list.filter(x => (x.drive_usage || 0) >= DRIVE_RED_GB);
  if (sortBy === 'drive') list = [...list].sort((a, b) => (b.drive_usage || 0) - (a.drive_usage || 0));
  else if (sortBy === 'az') list = [...list].sort((a, b) => a.email.localeCompare(b.email));
  else if (sortBy === 'new') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const toggleStatus = (key) => setStatusFilter(s => (s === key ? 'all' : key));
  const filtersActive = q || tagFilter !== 'all' || statusFilter !== 'all';

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Email</h1>
          <p className="page-subtitle">{loaded ? `${emails.length} email tersimpan` : 'Memuat…'}</p>
        </div>
        <form onSubmit={addEmail} className="inline-form">
          <input type="email" className="input" placeholder="Tambah email" value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)} aria-label="Tambah email" />
          <button type="submit" className="btn btn-primary" disabled={creating || !newEmail.trim()}>
            {creating ? <span className="spinner small" /> : <><Icon name="plus" size={16} /> Tambah</>}
          </button>
        </form>
      </div>

      {emails.length > 0 && (
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Drive terpakai</span>
            <span className="stat-value">{formatGB(totalGB)} <small>/ {emails.length * DRIVE_MAX_GB} GB</small></span>
          </div>
          <button className={`stat stat-btn ${fullCount > 0 ? 'stat-danger' : ''} ${statusFilter === 'full' ? 'active' : ''}`}
            onClick={() => toggleStatus('full')} aria-pressed={statusFilter === 'full'}>
            <span className="stat-label">Drive ≥ {DRIVE_RED_GB} GB</span>
            <span className="stat-value">{fullCount}</span>
          </button>
          <button className={`stat stat-btn ${statusFilter === 'norecovery' ? 'active' : ''}`}
            onClick={() => toggleStatus('norecovery')} aria-pressed={statusFilter === 'norecovery'}>
            <span className="stat-label">Belum dicadangkan</span>
            <span className="stat-value">{noRecoveryCount}</span>
          </button>
          <button className={`stat stat-btn ${statusFilter === 'nopay' ? 'active' : ''}`}
            onClick={() => toggleStatus('nopay')} aria-pressed={statusFilter === 'nopay'}>
            <span className="stat-label">Belum ada pay</span>
            <span className="stat-value">{noPayCount}</span>
          </button>
        </div>
      )}

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari email…" />
        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Urutkan">
          <option value="order">Urut: nomor</option>
          <option value="drive">Urut: drive terpenuh</option>
          <option value="az">Urut: A–Z</option>
          <option value="new">Urut: terbaru</option>
        </select>
      </div>

      <div className="chip-row">
        <button className={`chip ${tagFilter === 'all' ? 'active' : ''}`} onClick={() => setTagFilter('all')}>
          Semua <span className="chip-count">{emails.length}</span>
        </button>
        <button className={`chip ${tagFilter === 'untagged' ? 'active' : ''}`} onClick={() => setTagFilter('untagged')}>
          Tanpa tag <span className="chip-count">{emails.filter(x => !x.tag_id).length}</span>
        </button>
        {tags.map(t => (
          <span key={t.id} className={`chip chip-tag ${tagFilter === t.id ? 'active' : ''}`} style={{ '--tag': tagColor(t.id) }}>
            <button className="chip-main" onClick={() => setTagFilter(t.id)}>
              <span className="dot" />
              {t.name} <span className="chip-count">{emails.filter(x => x.tag_id === t.id).length}</span>
            </button>
            <button className="chip-remove" onClick={(e) => requestDeleteTag(e, t)} aria-label={`Hapus tag ${t.name}`}>
              <Icon name="x" size={11} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {addingTag ? (
          <form onSubmit={createTag} className="chip-form">
            <input autoFocus className="chip-input" placeholder="Nama tag" value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onBlur={() => { if (!newTag.trim()) setAddingTag(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setNewTag(''); setAddingTag(false); } }} />
          </form>
        ) : (
          <button className="chip chip-ghost" onClick={() => setAddingTag(true)}>
            <Icon name="plus" size={12} strokeWidth={2.5} /> Tag
          </button>
        )}
      </div>

      {filtersActive && (
        <div className="filter-note">
          Menampilkan {list.length} dari {emails.length} email
          <button className="link-btn" onClick={() => { setSearch(''); setTagFilter('all'); setStatusFilter('all'); }}>
            Reset filter
          </button>
        </div>
      )}

      {!loaded ? (
        <div className="loading-block"><span className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <Icon name="mail" size={40} strokeWidth={1.5} />
          <p className="empty-title">{emails.length === 0 ? 'Belum ada email' : 'Tidak ada email yang cocok'}</p>
          {emails.length === 0 && <p className="empty-desc">Tambahkan email lewat kolom di atas.</p>}
        </div>
      ) : (
        <div className="data-table email-table">
          <div className="dt-head">
            <span className="center">#</span>
            <span>Email</span>
            <span className="center">Cadangkan</span>
            <span className="center">Pay</span>
            <span>Tag</span>
            <span>Drive</span>
            <span className="sr-only">Aksi</span>
          </div>
          {list.map((item, index) => {
            const gb = item.drive_usage || 0;
            const level = driveLevel(gb);
            const hasRecovery = !!item.recovery_email?.trim();
            const hasPay = !!item.payment?.trim();
            const tagOpen = popover?.type === 'tag' && popover.id === item.id;
            const driveOpen = popover?.type === 'drive' && popover.id === item.id;
            return (
              <div key={item.id} className={`dt-row ${tagOpen || driveOpen ? 'has-popover' : ''}`}>
                <div className="cell-num">
                  {editingSortId === item.id ? (
                    <input type="number" className="num-input" value={sortInput} min="1" autoFocus
                      onChange={(e) => setSortInput(e.target.value)}
                      onBlur={() => saveSortOrder(item.id, item.sort_order)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveSortOrder(item.id, item.sort_order);
                        if (e.key === 'Escape') { setEditingSortId(null); setSortInput(''); }
                      }} />
                  ) : (
                    <button className="num-badge" title="Ubah urutan"
                      onClick={() => { setEditingSortId(item.id); setSortInput(String(item.sort_order || index + 1)); }}>
                      {item.sort_order || index + 1}
                    </button>
                  )}
                </div>

                <div className="cell-email">
                  <button className="email-address" onClick={() => copyEmail(item.email)} title="Klik untuk menyalin">
                    {item.email}
                  </button>
                  <span className="cell-sub">{formatDate(item.created_at)}</span>
                </div>

                <div className="cell-status" data-label="Cadangkan">
                  <span className={`status ${hasRecovery ? 'status-yes' : 'status-no'}`}
                    title={hasRecovery ? item.recovery_email : 'Belum ada email pemulihan'}>
                    <Icon name={hasRecovery ? 'check' : 'x'} size={13} strokeWidth={2.5} />
                  </span>
                </div>

                <div className="cell-status" data-label="Pay">
                  <span className={`status ${hasPay ? 'status-yes' : 'status-no'}`}
                    title={hasPay ? item.payment : 'Belum ada payment'}>
                    <Icon name={hasPay ? 'check' : 'x'} size={13} strokeWidth={2.5} />
                  </span>
                </div>

                <div className="cell-tag popover-anchor" data-label="Tag" onClick={(e) => e.stopPropagation()}>
                  <button className="cell-trigger" onClick={() => setPopover(tagOpen ? null : { type: 'tag', id: item.id })}
                    aria-expanded={tagOpen} title="Ubah tag">
                    {item.tags ? (
                      <span className="tag-badge" style={{ '--tag': tagColor(item.tag_id) }}>
                        <span className="dot" />{item.tags.name}
                      </span>
                    ) : (
                      <span className="tag-badge tag-empty"><Icon name="plus" size={11} strokeWidth={2.5} /> Tag</span>
                    )}
                  </button>
                  {tagOpen && (
                    <div className="popover menu">
                      <button className={`menu-item ${!item.tag_id ? 'selected' : ''}`} onClick={() => assignTag(item.id, null)}>
                        Tanpa tag
                      </button>
                      {tags.map(t => (
                        <button key={t.id} className={`menu-item ${item.tag_id === t.id ? 'selected' : ''}`}
                          onClick={() => assignTag(item.id, t.id)}>
                          <span className="dot" style={{ background: tagColor(t.id) }} />{t.name}
                        </button>
                      ))}
                      {tags.length === 0 && <div className="menu-hint">Buat tag lewat tombol “+ Tag”.</div>}
                    </div>
                  )}
                </div>

                <div className="cell-drive popover-anchor" data-label="Drive" onClick={(e) => e.stopPropagation()}>
                  <button className={`drive drive-${level}`} onClick={() => (driveOpen ? setPopover(null) : openDrive(item))}
                    aria-expanded={driveOpen} title="Ubah pemakaian drive">
                    <span className="drive-bar"><span className="drive-fill" style={{ width: `${Math.min((gb / DRIVE_MAX_GB) * 100, 100)}%` }} /></span>
                    <span className="drive-text">{formatGB(gb)} / {DRIVE_MAX_GB} GB</span>
                  </button>
                  {driveOpen && (
                    <form className="popover drive-popover" onSubmit={(e) => { e.preventDefault(); saveDrive(item.id); }}>
                      <input type="text" inputMode="decimal" className="input input-sm" placeholder="GB" value={driveInput}
                        onChange={(e) => setDriveInput(e.target.value)} autoFocus aria-label="Pemakaian drive (GB)" />
                      <button type="submit" className="btn btn-primary btn-sm" aria-label="Simpan">
                        <Icon name="check" size={14} strokeWidth={2.5} />
                      </button>
                    </form>
                  )}
                </div>

                <div className="cell-actions">
                  <a href={`mailto:${item.email}`} className="icon-btn" title="Kirim email" aria-label={`Kirim email ke ${item.email}`}>
                    <Icon name="send" size={15} />
                  </a>
                  <button className="icon-btn icon-btn-danger" onClick={() => requestDeleteEmail(item)}
                    title="Hapus" aria-label={`Hapus ${item.email}`}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
