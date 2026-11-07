'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Icon from '../components/Icon';
import { SearchInput } from './ArchivesTab';

const FIELDS = {
  recovery_email: { label: 'Email pemulihan', placeholder: 'email@pemulihan.com', type: 'email', saved: 'Email pemulihan disimpan' },
  payment: { label: 'Payment', placeholder: 'Isi info payment', type: 'text', saved: 'Payment disimpan' },
};

export default function InfoTab({ user, emails, loaded, refreshEmails, notify, notifyError }) {
  const [search, setSearch] = useState('');
  // { id, field } of the cell being edited
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');

  function startEdit(item, field) {
    setEditing({ id: item.id, field });
    setValue(item[field] || '');
  }

  async function save() {
    const { id, field } = editing;
    setEditing(null);
    const { error } = await supabase.from('emails').update({ [field]: value.trim() }).eq('id', id).eq('user_id', user.id);
    if (error) { notifyError('Gagal menyimpan'); return; }
    refreshEmails(); notify(FIELDS[field].saved);
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => notify('Disalin')).catch(() => notifyError('Gagal menyalin'));
  }

  // Info has its own view: search only, always in number order (independent of the Email tab filters)
  const q = search.trim().toLowerCase();
  const list = q ? emails.filter(x => x.email.toLowerCase().includes(q)) : emails;
  const complete = emails.filter(x => x.recovery_email?.trim() && x.payment?.trim()).length;

  function renderCell(item, field) {
    const cfg = FIELDS[field];
    if (editing?.id === item.id && editing.field === field) {
      return (
        <form className="inline-edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input type={cfg.type} className="input input-sm" value={value} autoFocus placeholder={cfg.placeholder}
            onChange={(e) => setValue(e.target.value)} aria-label={cfg.label}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }} />
          <button type="submit" className="btn btn-primary btn-sm" aria-label="Simpan"><Icon name="check" size={14} strokeWidth={2.5} /></button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} aria-label="Batal">
            <Icon name="x" size={14} strokeWidth={2.5} />
          </button>
        </form>
      );
    }
    const current = item[field]?.trim();
    return (
      <button className={`editable ${current ? '' : 'editable-empty'}`} onClick={() => startEdit(item, field)}
        title={`Ubah ${cfg.label.toLowerCase()}`}>
        <span className="editable-text">{current || `Tambah ${cfg.label.toLowerCase()}`}</span>
        <Icon name={current ? 'edit' : 'plus'} size={13} className="editable-icon" />
      </button>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Info Akun</h1>
          <p className="page-subtitle">
            {loaded ? `${complete} dari ${emails.length} email sudah lengkap` : 'Memuat…'}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari email…" />
      </div>

      {!loaded ? (
        <div className="loading-block"><span className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <Icon name="info" size={40} strokeWidth={1.5} />
          <p className="empty-title">{emails.length === 0 ? 'Belum ada email' : 'Tidak ada email yang cocok'}</p>
          {emails.length === 0 && <p className="empty-desc">Tambahkan email di tab Email terlebih dahulu.</p>}
        </div>
      ) : (
        <div className="data-table info-table">
          <div className="dt-head">
            <span className="center">#</span>
            <span>Email</span>
            <span>Email pemulihan</span>
            <span>Payment</span>
          </div>
          {list.map((item, index) => (
            <div key={item.id} className="dt-row">
              <div className="cell-num"><span className="num-plain">{item.sort_order || index + 1}</span></div>
              <div className="cell-email">
                <button className="email-address" onClick={() => copy(item.email)} title="Klik untuk menyalin">{item.email}</button>
              </div>
              <div className="cell-field" data-label="Email pemulihan">{renderCell(item, 'recovery_email')}</div>
              <div className="cell-field" data-label="Payment">{renderCell(item, 'payment')}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
