'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { parseInventory, detectPlatform, normalizeUrl } from '../../lib/parseInventory';
import Icon from '../components/Icon';
import { SearchInput } from './ArchivesTab';

const SERVICE_LABELS = { supabase: 'Supabase', cloudinary: 'Cloudinary', render: 'Render' };
const IMPORT_PLACEHOLDER = '*Website*\nnama.vercel.app\n\n*Supabase*\nemail@gmail.com\nNamaProyek\n\n*Cloudinary*\nemail@gmail.com (catatan\n\n*Render*\nemail@gmail.com (Proyek)';

// "mar.interview.vercel.app" -> "mar.interview"
function siteName(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.(vercel\.app|onrender\.com)$/, '');
}

export default function ProjectsTab({ user, notify, notifyError, confirm }) {
  const [websites, setWebsites] = useState([]);
  const [services, setServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [missingTables, setMissingTables] = useState(false);
  const [search, setSearch] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSvcType, setNewSvcType] = useState('supabase');
  const [newSvcEmail, setNewSvcEmail] = useState('');
  const [newSvcNote, setNewSvcNote] = useState('');
  const [projectInputs, setProjectInputs] = useState({});
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [w, s, p] = await Promise.all([
      supabase.from('websites').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('services').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('service_projects').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);
    setLoaded(true);
    // Tables not created yet (migration_inventory.sql not run)
    if (w.error || s.error || p.error) { setMissingTables(true); return; }
    setMissingTables(false);
    setWebsites(w.data || []); setServices(s.data || []); setProjects(p.data || []);
  }

  async function addWebsite(e) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const url = normalizeUrl(newUrl);
    if (websites.some(w => w.url.toLowerCase() === url.toLowerCase())) { notifyError('Website sudah ada'); return; }
    const { error } = await supabase.from('websites').insert({
      user_id: user.id, url, name: siteName(url), platform: detectPlatform(url),
    });
    if (error) { notifyError('Gagal menambah website'); return; }
    setNewUrl(''); loadAll(); notify('Website ditambahkan');
  }

  function deleteWebsite(w) {
    confirm({
      title: 'Hapus website?',
      desc: `${siteName(w.url)} akan dihapus dari daftar.`,
      onConfirm: async () => {
        const { error } = await supabase.from('websites').delete().eq('id', w.id).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus'); return; }
        loadAll(); notify('Website dihapus');
      },
    });
  }

  async function addService(e) {
    e.preventDefault();
    const email = newSvcEmail.trim().toLowerCase();
    if (!email) return;
    if (services.some(s => s.type === newSvcType && s.account_email === email)) { notifyError('Akun sudah ada'); return; }
    const { error } = await supabase.from('services').insert({
      user_id: user.id, type: newSvcType, account_email: email, note: newSvcNote.trim(),
    });
    if (error) { notifyError('Gagal menambah akun'); return; }
    setNewSvcEmail(''); setNewSvcNote(''); loadAll(); notify('Akun ditambahkan');
  }

  function deleteService(s) {
    confirm({
      title: 'Hapus akun?',
      desc: `${s.account_email} (${SERVICE_LABELS[s.type]}) beserta daftar proyeknya akan dihapus.`,
      onConfirm: async () => {
        const { error } = await supabase.from('services').delete().eq('id', s.id).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus'); return; }
        loadAll(); notify('Akun dihapus');
      },
    });
  }

  async function addProject(serviceId) {
    const name = (projectInputs[serviceId] || '').trim();
    if (!name) return;
    const { error } = await supabase.from('service_projects').insert({ user_id: user.id, service_id: serviceId, name });
    if (error) { notifyError('Gagal menambah proyek'); return; }
    setProjectInputs(p => ({ ...p, [serviceId]: '' })); loadAll();
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('service_projects').delete().eq('id', id).eq('user_id', user.id);
    if (error) notifyError('Gagal menghapus proyek');
    loadAll();
  }

  async function runImport() {
    const parsed = parseInventory(importText);
    if (parsed.websites.length === 0 && parsed.services.length === 0) {
      notifyError('Tidak ada data yang dikenali'); return;
    }
    setBusy(true);
    let addedSites = 0, addedAccounts = 0, addedProjects = 0;

    const knownUrls = new Set(websites.map(w => w.url.toLowerCase()));
    const newSites = parsed.websites.filter(w => !knownUrls.has(w.url.toLowerCase()) && knownUrls.add(w.url.toLowerCase()));
    if (newSites.length) {
      const { error } = await supabase.from('websites').insert(newSites.map(w => ({ ...w, user_id: user.id })));
      if (!error) addedSites = newSites.length;
    }

    const knownServices = [...services];
    for (const svc of parsed.services) {
      let existing = knownServices.find(s => s.type === svc.type && s.account_email === svc.account_email);
      if (!existing) {
        const { data, error } = await supabase.from('services')
          .insert({ user_id: user.id, type: svc.type, account_email: svc.account_email, note: svc.note })
          .select().single();
        if (error) continue;
        existing = data; knownServices.push(data); addedAccounts++;
      }
      const have = new Set(projects.filter(p => p.service_id === existing.id).map(p => p.name.toLowerCase()));
      const fresh = svc.projects.filter(n => !have.has(n.toLowerCase()) && have.add(n.toLowerCase()));
      if (fresh.length) {
        const { error } = await supabase.from('service_projects')
          .insert(fresh.map(name => ({ user_id: user.id, service_id: existing.id, name })));
        if (!error) addedProjects += fresh.length;
      }
    }

    setBusy(false); setImportText(''); setShowImport(false); loadAll();
    notify(`Diimpor: ${addedSites} website, ${addedAccounts} akun, ${addedProjects} proyek`);
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => notify('Disalin')).catch(() => notifyError('Gagal menyalin'));
  }

  if (loaded && missingTables) {
    return (
      <section className="page">
        <div className="alert alert-warn">
          <Icon name="alert" size={16} />
          <span>Tabel inventaris belum dibuat. Jalankan <b>migration_inventory.sql</b> di Supabase SQL Editor, lalu muat ulang halaman.</span>
        </div>
      </section>
    );
  }

  const q = search.trim().toLowerCase();
  const projectsOf = (serviceId) => projects.filter(p => p.service_id === serviceId);
  const shownSites = q ? websites.filter(w => w.url.toLowerCase().includes(q)) : websites;
  const shownServices = q
    ? services.filter(s => s.account_email.includes(q) || s.note?.toLowerCase().includes(q)
        || projectsOf(s.id).some(p => p.name.toLowerCase().includes(q)))
    : services;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Proyek</h1>
          <p className="page-subtitle">
            {loaded ? `${websites.length} website · ${services.length} akun layanan · ${projects.length} proyek` : 'Memuat…'}
          </p>
        </div>
        <button className={`btn ${showImport ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setShowImport(v => !v)}>
          <Icon name={showImport ? 'x' : 'upload'} size={15} />
          {showImport ? 'Tutup impor' : 'Impor dari teks'}
        </button>
      </div>

      {showImport && (
        <div className="panel import-panel">
          <p className="panel-hint">
            Tempel catatan dengan judul <code>*Website*</code>, <code>*Supabase*</code>, <code>*Cloudinary*</code>, atau <code>*Render*</code>.
            Data yang sudah ada akan dilewati.
          </p>
          <textarea className="input textarea mono" rows={9} value={importText}
            onChange={(e) => setImportText(e.target.value)} placeholder={IMPORT_PLACEHOLDER} aria-label="Teks untuk diimpor" />
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={runImport} disabled={busy || !importText.trim()}>
              {busy ? <span className="spinner small" /> : 'Impor'}
            </button>
          </div>
        </div>
      )}

      {(websites.length > 0 || services.length > 0) && (
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari website, email akun, atau proyek…" />
        </div>
      )}

      {!loaded ? (
        <div className="loading-block"><span className="spinner" /></div>
      ) : (
        <>
          {/* Websites */}
          <div className="section-head">
            <h2 className="section-title">Website <span className="count-badge">{websites.length}</span></h2>
            <form onSubmit={addWebsite} className="inline-form">
              <input type="text" className="input" placeholder="mis. margames.vercel.app" value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)} aria-label="URL website baru" />
              <button type="submit" className="btn btn-primary" disabled={!newUrl.trim()}>
                <Icon name="plus" size={16} /> Tambah
              </button>
            </form>
          </div>

          {shownSites.length === 0 ? (
            <p className="muted-note">{q ? 'Tidak ada website yang cocok.' : 'Belum ada website.'}</p>
          ) : (
            <div className="grid-3">
              {shownSites.map(w => (
                <div key={w.id} className="site-card">
                  <div className="site-avatar">{siteName(w.url).charAt(0).toUpperCase()}</div>
                  <div className="site-body">
                    <div className="site-name">{siteName(w.url)}</div>
                    <a href={w.url} target="_blank" rel="noopener noreferrer" className="site-url" title={w.url}>
                      {w.url.replace(/^https?:\/\//, '')}
                    </a>
                    <span className="badge">{w.platform}</span>
                  </div>
                  <div className="site-actions">
                    <a href={w.url} target="_blank" rel="noopener noreferrer" className="btn btn-soft btn-sm" title={w.url}>
                      Buka <Icon name="external" size={13} />
                    </a>
                    <button className="icon-btn icon-btn-danger reveal-on-hover" onClick={() => deleteWebsite(w)}
                      aria-label={`Hapus ${siteName(w.url)}`} title="Hapus">
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Services */}
          <div className="section-head">
            <h2 className="section-title">Layanan <span className="count-badge">{services.length}</span></h2>
            <form onSubmit={addService} className="inline-form inline-form-wrap">
              <select className="select" value={newSvcType} onChange={(e) => setNewSvcType(e.target.value)} aria-label="Jenis layanan">
                {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="email" className="input" placeholder="Email akun" value={newSvcEmail}
                onChange={(e) => setNewSvcEmail(e.target.value)} aria-label="Email akun" />
              <input type="text" className="input" placeholder="Catatan (opsional)" value={newSvcNote}
                onChange={(e) => setNewSvcNote(e.target.value)} aria-label="Catatan" />
              <button type="submit" className="btn btn-primary" disabled={!newSvcEmail.trim()}>
                <Icon name="plus" size={16} /> Tambah
              </button>
            </form>
          </div>

          {shownServices.length === 0 && (
            <p className="muted-note">{q ? 'Tidak ada akun yang cocok.' : 'Belum ada akun layanan.'}</p>
          )}

          {Object.keys(SERVICE_LABELS).map(type => {
            const list = shownServices.filter(s => s.type === type);
            if (list.length === 0) return null;
            return (
              <div key={type} className={`svc-group svc-${type}`}>
                <h3 className="svc-group-title"><span className="dot" />{SERVICE_LABELS[type]} <span className="count-badge">{list.length}</span></h3>
                <div className="grid-3">
                  {list.map(s => (
                    <div key={s.id} className="account-card">
                      <div className="account-head">
                        <button className="email-address" onClick={() => copy(s.account_email)} title="Klik untuk menyalin">
                          {s.account_email}
                        </button>
                        <button className="icon-btn icon-btn-danger reveal-on-hover" onClick={() => deleteService(s)}
                          aria-label={`Hapus akun ${s.account_email}`} title="Hapus akun">
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                      {s.note && <div className="account-note">{s.note}</div>}
                      <div className="project-chips">
                        {projectsOf(s.id).map(p => (
                          <span key={p.id} className="project-chip">
                            {p.name}
                            <button className="project-chip-remove" onClick={() => deleteProject(p.id)} aria-label={`Hapus proyek ${p.name}`}>
                              <Icon name="x" size={10} strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input type="text" className="input input-sm input-ghost" placeholder="+ Tambah proyek (Enter)"
                        value={projectInputs[s.id] || ''} aria-label="Tambah proyek"
                        onChange={(e) => setProjectInputs(p => ({ ...p, [s.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProject(s.id); } }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
