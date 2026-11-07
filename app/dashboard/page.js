'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { getUserFromToken, removeToken } from '../../lib/auth';
import { useFeedback } from '../components/Feedback';
import { useTheme } from '../components/useTheme';
import Icon from '../components/Icon';
import ArchivesTab from './ArchivesTab';
import EmailsTab from './EmailsTab';
import InfoTab from './InfoTab';
import ProjectsTab from './ProjectsTab';

const TABS = [
  { id: 'arsip', label: 'Arsip', icon: 'chat' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'info', label: 'Info', icon: 'info' },
  { id: 'proyek', label: 'Proyek', icon: 'grid' },
];
const TAB_KEY = 'arsipmar-tab';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('arsip');
  // emails + tags are shared by the Email and Info tabs
  const [emails, setEmails] = useState([]);
  const [tags, setTags] = useState([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);
  const router = useRouter();
  const feedback = useFeedback();
  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) { router.replace('/'); return; }
    setUser(decoded);
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (TABS.some(t => t.id === saved)) setActiveTab(saved);
    } catch {}
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('emails').select('*, tags(id, name)')
      .eq('user_id', user.id).order('sort_order', { ascending: true });
    if (error) feedback.notifyError('Gagal memuat email');
    setEmails(data || []);
    setEmailsLoaded(true);
  }, [user]);

  const fetchTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('tags').select('*').eq('user_id', user.id).order('name', { ascending: true });
    setTags(data || []);
  }, [user]);

  useEffect(() => { if (user) { fetchEmails(); fetchTags(); } }, [user]);

  function selectTab(id) {
    setActiveTab(id);
    try { localStorage.setItem(TAB_KEY, id); } catch {}
    window.scrollTo({ top: 0 });
  }

  function requestLogout() {
    feedback.confirm({
      title: 'Keluar dari akun?',
      desc: 'Kamu perlu login lagi untuk membuka ArsipMaR.',
      confirmLabel: 'Ya, Keluar',
      tone: 'accent',
      icon: 'logout',
      onConfirm: () => { removeToken(); router.replace('/'); },
    });
  }

  if (!user) return <div className="loading-screen"><div className="spinner large" /></div>;

  const shared = { user, notify: feedback.notify, notifyError: feedback.notifyError, confirm: feedback.confirm };

  return (
    <div className="app-shell">
      {feedback.ui}

      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <img src="/logo.svg" alt="" width="32" height="32" />
            <span className="brand-name">ArsipMaR</span>
          </div>

          <nav className="top-nav" aria-label="Menu utama">
            {TABS.map(t => (
              <button key={t.id} className={`top-nav-btn ${activeTab === t.id ? 'active' : ''}`}
                aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => selectTab(t.id)}>
                <Icon name={t.icon} size={15} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <span className="user-email" title={user.email}>{user.email}</span>
            <button onClick={toggleTheme} className="icon-btn" aria-label={dark ? 'Mode terang' : 'Mode gelap'}
              title={dark ? 'Mode terang' : 'Mode gelap'}>
              <Icon name={dark ? 'sun' : 'moon'} size={16} />
            </button>
            <button onClick={requestLogout} className="icon-btn" aria-label="Keluar" title="Keluar">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'arsip' && <ArchivesTab {...shared} />}
        {activeTab === 'email' && (
          <EmailsTab {...shared} emails={emails} tags={tags} loaded={emailsLoaded}
            refreshEmails={fetchEmails} refreshTags={fetchTags} />
        )}
        {activeTab === 'info' && (
          <InfoTab {...shared} emails={emails} loaded={emailsLoaded} refreshEmails={fetchEmails} />
        )}
        {activeTab === 'proyek' && <ProjectsTab {...shared} />}
      </main>

      <nav className="bottom-nav" aria-label="Menu utama">
        {TABS.map(t => (
          <button key={t.id} className={`bottom-nav-btn ${activeTab === t.id ? 'active' : ''}`}
            aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => selectTab(t.id)}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
