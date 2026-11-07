'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import Icon from '../components/Icon';

function formatDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ArchivesTab({ user, notify, notifyError, confirm }) {
  const [archives, setArchives] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchArchives(); }, []);

  async function fetchArchives() {
    const { data, error } = await supabase.from('archives').select('*, messages(count)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) notifyError('Gagal memuat arsip');
    setArchives(data || []);
    setLoaded(true);
  }

  async function createArchive(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    const { error } = await supabase.from('archives').insert({ title, user_id: user.id });
    setCreating(false);
    if (error) { notifyError('Gagal membuat arsip'); return; }
    setNewTitle(''); fetchArchives();
    notify('Arsip dibuat');
  }

  function requestDelete(a) {
    confirm({
      title: 'Hapus arsip?',
      desc: `"${a.title}" beserta semua pesannya akan dihapus permanen.`,
      onConfirm: async () => {
        // messages are removed by ON DELETE CASCADE
        const { error } = await supabase.from('archives').delete().eq('id', a.id).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus arsip'); return; }
        fetchArchives(); notify('Arsip dihapus');
      },
    });
  }

  const q = search.trim().toLowerCase();
  const filtered = q ? archives.filter(a => a.title.toLowerCase().includes(q)) : archives;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Arsip Chat</h1>
          <p className="page-subtitle">{loaded ? `${archives.length} arsip` : 'Memuat…'}</p>
        </div>
        <form onSubmit={createArchive} className="inline-form">
          <input type="text" className="input" placeholder="Judul arsip baru" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)} aria-label="Judul arsip baru" />
          <button type="submit" className="btn btn-primary" disabled={creating || !newTitle.trim()}>
            {creating ? <span className="spinner small" /> : <><Icon name="plus" size={16} /> Buat</>}
          </button>
        </form>
      </div>

      {archives.length > 0 && (
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari arsip…" />
        </div>
      )}

      {!loaded ? (
        <div className="loading-block"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="chat" size={40} strokeWidth={1.5} />
          <p className="empty-title">{q ? 'Tidak ada arsip yang cocok' : 'Belum ada arsip'}</p>
          {!q && <p className="empty-desc">Buat arsip pertama lewat kolom di atas.</p>}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map(a => {
            const count = a.messages?.[0]?.count ?? 0;
            return (
              <div key={a.id} className="archive-card">
                <div className="archive-icon"><Icon name="chat" size={18} /></div>
                <div className="archive-body">
                  <Link href={`/archive/${a.id}`} className="archive-title stretched-link">{a.title}</Link>
                  <span className="archive-meta">{count} pesan · {formatDate(a.created_at)}</span>
                </div>
                <button className="icon-btn icon-btn-danger reveal-on-hover" onClick={() => requestDelete(a)}
                  aria-label={`Hapus ${a.title}`} title="Hapus">
                  <Icon name="trash" size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Icon name="search" size={15} className="search-icon" />
      <input type="search" className="search-input" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Hapus pencarian">
          <Icon name="x" size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
