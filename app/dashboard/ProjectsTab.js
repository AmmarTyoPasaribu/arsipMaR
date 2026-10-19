'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { parseInventory, detectPlatform, normalizeUrl } from '../../lib/parseInventory';

const SERVICE_LABELS = { supabase: 'Supabase', cloudinary: 'Cloudinary', render: 'Render' };
const SERVICE_ICONS = { supabase: '⚡', cloudinary: '☁', render: '▲' };

// "mar.interview.vercel.app" -> "mar.interview"
function siteName(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.(vercel\.app|onrender\.com)$/, '');
}

export default function ProjectsTab({ user, showSuccess, showConfirm }) {
  const [websites, setWebsites] = useState([]);
  const [services, setServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [missingTables, setMissingTables] = useState(false);
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
    // Tables not created yet (migration_inventory.sql not run)
    if (w.error || s.error || p.error) { setMissingTables(true); return; }
    setMissingTables(false);
    setWebsites(w.data || []); setServices(s.data || []); setProjects(p.data || []);
  }

  async function addWebsite(e) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const url = normalizeUrl(newUrl);
    if (websites.some(w => w.url.toLowerCase() === url.toLowerCase())) { showSuccess('Website sudah ada'); return; }
    const { error } = await supabase.from('websites').insert({
      user_id: user.id, url, name: url.replace(/^https?:\/\//, '').split('.')[0], platform: detectPlatform(url),
    });
    if (error) { showSuccess('Gagal menambah website'); return; }
    setNewUrl(''); loadAll(); showSuccess('Website ditambahkan');
  }

  function deleteWebsite(id) {
    showConfirm('Hapus Website?', 'Website ini akan dihapus dari daftar.', async () => {
      const { error } = await supabase.from('websites').delete().eq('id', id).eq('user_id', user.id);
      loadAll(); showSuccess(error ? 'Gagal menghapus' : 'Website dihapus');
    });
  }

  async function addService(e) {
    e.preventDefault();
    const email = newSvcEmail.trim().toLowerCase();
    if (!email) return;
    if (services.some(s => s.type === newSvcType && s.account_email === email)) { showSuccess('Akun sudah ada'); return; }
    const { error } = await supabase.from('services').insert({
      user_id: user.id, type: newSvcType, account_email: email, note: newSvcNote.trim(),
    });
    if (error) { showSuccess('Gagal menambah akun'); return; }
    setNewSvcEmail(''); setNewSvcNote(''); loadAll(); showSuccess('Akun ditambahkan');
  }

  function deleteService(id) {
    showConfirm('Hapus Akun?', 'Akun beserta daftar proyeknya akan dihapus.', async () => {
      const { error } = await supabase.from('services').delete().eq('id', id).eq('user_id', user.id);
      loadAll(); showSuccess(error ? 'Gagal menghapus' : 'Akun dihapus');
    });
  }

  async function addProject(serviceId) {
    const name = (projectInputs[serviceId] || '').trim();
    if (!name) return;
    const { error } = await supabase.from('service_projects').insert({ user_id: user.id, service_id: serviceId, name });
    if (error) { showSuccess('Gagal menambah proyek'); return; }
    setProjectInputs(p => ({ ...p, [serviceId]: '' })); loadAll();
  }

  async function deleteProject(id) {
    await supabase.from('service_projects').delete().eq('id', id).eq('user_id', user.id);
    loadAll();
  }

  async function runImport() {
    const parsed = parseInventory(importText);
    if (parsed.websites.length === 0 && parsed.services.length === 0) {
      showSuccess('Tidak ada data yang dikenali'); return;
    }
    setBusy(true);
    let addedSites = 0, addedAccounts = 0, addedProjects = 0;

    const knownUrls = new Set(websites.map(w => w.url.toLowerCase()));
    const newSites = parsed.websites.filter(w => !knownUrls.has(w.url.toLowerCase()) && knownUrls.add(w.url.toLowerCase()));
    if (newSites.length) {
      const { error } = await supabase.from('websites').insert(newSites.map(w => ({ ...w, user_id: user.id })));
      if (!error) addedSites = newSites.length;
    }

    for (const svc of parsed.services) {
      let existing = services.find(s => s.type === svc.type && s.account_email === svc.account_email);
      if (!existing) {
        const { data, error } = await supabase.from('services')
          .insert({ user_id: user.id, type: svc.type, account_email: svc.account_email, note: svc.note })
          .select().single();
        if (error) continue;
        existing = data; services.push(data); addedAccounts++;
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
    showSuccess(`Impor: ${addedSites} website, ${addedAccounts} akun, ${addedProjects} proyek`);
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => showSuccess('Disalin!')).catch(() => showSuccess('Gagal menyalin'));
  }

  if (missingTables) {
    return (
      <div className="section-content">
        <div className="warn-banner">
          Tabel inventaris belum dibuat. Jalankan <b>migration_inventory.sql</b> di Supabase SQL Editor, lalu muat ulang halaman.
        </div>
      </div>
    );
  }

  return (
    <div className="section-content">
      <div className="inv-toolbar">
        <div className="inv-stats">
          <span className="inv-stat inv-stat-site"><b>{websites.length}</b> website</span>
          <span className="inv-stat inv-stat-acc"><b>{services.length}</b> akun</span>
          <span className="inv-stat inv-stat-proj"><b>{projects.length}</b> proyek</span>
        </div>
        <button className="tag-pill" onClick={() => setShowImport(v => !v)}>
          {showImport ? 'Tutup impor' : 'Impor dari teks'}
        </button>
      </div>

      {showImport && (
        <div className="import-box">
          <textarea className="import-textarea" rows={10} value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'*Website*\nnama.vercel.app\n\n*Supabase*\nemail@gmail.com\nNamaProyek\n\n*Cloudinary*\nemail@gmail.com (catatan\n\n*Render*\nemail@gmail.com (Proyek)'} />
          <button className="btn-primary" onClick={runImport} disabled={busy || !importText.trim()}>
            {busy ? <span className="spinner"></span> : 'Impor'}
          </button>
        </div>
      )}

      {/* Websites */}
      <h3 className="inv-heading"><span className="inv-dot inv-dot-site"></span>Website <span className="inv-count">{websites.length}</span></h3>
      <form onSubmit={addWebsite} className="create-form">
        <input type="text" placeholder="URL website, mis. margames.vercel.app" value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)} className="create-input" />
        <button type="submit" className="btn-create">+</button>
      </form>
      <div className="inv-grid">
        {websites.length === 0 ? (
          <div className="empty-state"><p>Belum ada website</p></div>
        ) : websites.map(w => (
          <div key={w.id} className={`site-card site-${w.platform}`}>
            <div className="site-avatar">{siteName(w.url).charAt(0).toUpperCase()}</div>
            <div className="site-body">
              <div className="site-name">{siteName(w.url)}</div>
              <a href={w.url} target="_blank" rel="noopener noreferrer" className="site-url" title={w.url}>
                {w.url.replace(/^https?:\/\//, '')}
              </a>
              <span className={`platform-badge platform-${w.platform}`}>{w.platform}</span>
            </div>
            <div className="site-actions">
              <a href={w.url} target="_blank" rel="noopener noreferrer" className="site-open" title={w.url}>Buka ↗</a>
              <button className="site-del" onClick={() => deleteWebsite(w.id)} title="Hapus">×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Services */}
      <h3 className="inv-heading"><span className="inv-dot inv-dot-svc"></span>Layanan <span className="inv-count">{services.length}</span></h3>
      <form onSubmit={addService} className="create-form inv-service-form">
        <select className="sort-select" value={newSvcType} onChange={(e) => setNewSvcType(e.target.value)}>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="email" placeholder="Email akun..." value={newSvcEmail}
          onChange={(e) => setNewSvcEmail(e.target.value)} className="create-input" />
        <input type="text" placeholder="Catatan (opsional)" value={newSvcNote}
          onChange={(e) => setNewSvcNote(e.target.value)} className="create-input" />
        <button type="submit" className="btn-create">+</button>
      </form>

      {Object.keys(SERVICE_LABELS).map(type => {
        const list = services.filter(s => s.type === type);
        if (list.length === 0) return null;
        return (
          <div key={type} className="inv-group">
            <div className={`inv-group-title svc-${type}`}><span className="svc-icon">{SERVICE_ICONS[type]}</span>{SERVICE_LABELS[type]}<span className="inv-count">{list.length}</span></div>
            <div className="inv-grid">
              {list.map(s => (
                <div key={s.id} className={`inv-account svc-${type}`}>
                  <div className="inv-account-head">
                    <span className="email-address" onClick={() => copy(s.account_email)} title="Klik untuk copy">{s.account_email}</span>
                    <button className="btn-delete" onClick={() => deleteService(s.id)} title="Hapus akun">×</button>
                  </div>
                  {s.note && <div className="email-date">{s.note}</div>}
                  <div className="inv-projects">
                    {projects.filter(p => p.service_id === s.id).map(p => (
                      <span key={p.id} className="inv-project">
                        {p.name}
                        <span className="tag-delete" onClick={() => deleteProject(p.id)}>×</span>
                      </span>
                    ))}
                  </div>
                  <div className="inv-add-project">
                    <input type="text" className="tag-input" placeholder="+ proyek" value={projectInputs[s.id] || ''}
                      onChange={(e) => setProjectInputs(p => ({ ...p, [s.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProject(s.id); } }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
