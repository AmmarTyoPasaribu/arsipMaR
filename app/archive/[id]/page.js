'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getUserFromToken } from '../../../lib/auth';
import { useFeedback } from '../../components/Feedback';
import Icon from '../../components/Icon';

function formatTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSep(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hari ini';
  if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function renderTextWithLinks(text) {
  // split() with a capture group puts the URL matches at odd indexes
  const parts = text.split(/(https?:\/\/[^\s]+)/);
  return parts.map((part, i) => (i % 2 === 1
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    : part));
}

export default function ArchiveChatPage() {
  const [user, setUser] = useState(null);
  const [archive, setArchive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  // Only auto-scroll after the first load and after sending, not after edits/deletes
  const scrollMode = useRef('initial');
  const router = useRouter();
  const params = useParams();
  const archiveId = params.id;
  const { notify, notifyError, confirm, ui } = useFeedback();

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) { router.replace('/'); return; }
    setUser(decoded);
  }, []);

  useEffect(() => {
    if (user && archiveId) { fetchArchive(); fetchMessages(); }
  }, [user, archiveId]);

  useEffect(() => {
    // wait for the first non-empty load, otherwise the initial scroll is spent on the empty list
    if (!scrollMode.current || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: scrollMode.current === 'initial' ? 'auto' : 'smooth' });
    scrollMode.current = null;
  }, [messages]);

  // Auto-grow the composer up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [newMessage]);

  useEffect(() => {
    function onScroll() {
      const dist = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setShowScrollBtn(dist > 300);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function fetchArchive() {
    const { data } = await supabase
      .from('archives').select('*').eq('id', archiveId).eq('user_id', user.id).maybeSingle();
    if (!data) { router.replace('/dashboard'); return; }
    setArchive(data);
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages').select('*').eq('archive_id', archiveId).eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) notifyError('Gagal memuat pesan');
    setMessages(data || []);
    setLoaded(true);
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({ archive_id: archiveId, user_id: user.id, content });
    setSending(false);
    if (error) { notifyError('Gagal mengirim pesan'); return; }
    setNewMessage('');
    scrollMode.current = 'smooth';
    fetchMessages();
    textareaRef.current?.focus();
  }

  // Enter sends, Shift+Enter inserts a newline (skipped while an IME is composing)
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function saveTitle(e) {
    e?.preventDefault();
    const title = titleInput.trim();
    setRenaming(false);
    if (!title || title === archive.title) return;
    const { error } = await supabase.from('archives').update({ title }).eq('id', archiveId).eq('user_id', user.id);
    if (error) { notifyError('Gagal mengganti nama'); return; }
    setArchive(a => ({ ...a, title }));
    notify('Nama arsip diperbarui');
  }

  function startEdit(msg) {
    setEditingId(msg.id);
    setEditText(msg.content);
  }

  async function saveEdit(msgId) {
    const content = editText.trim();
    if (!content) return;
    setEditingId(null);
    const { error } = await supabase.from('messages').update({ content }).eq('id', msgId).eq('user_id', user.id);
    if (error) { notifyError('Gagal menyimpan pesan'); return; }
    setMessages(list => list.map(m => (m.id === msgId ? { ...m, content } : m)));
    notify('Pesan diperbarui');
  }

  function copyMessage(text) {
    navigator.clipboard.writeText(text).then(() => notify('Pesan disalin')).catch(() => notifyError('Gagal menyalin'));
  }

  function requestDeleteMessage(msgId) {
    confirm({
      title: 'Hapus pesan?',
      desc: 'Pesan ini akan dihapus permanen.',
      onConfirm: async () => {
        const { error } = await supabase.from('messages').delete().eq('id', msgId).eq('user_id', user.id);
        if (error) { notifyError('Gagal menghapus pesan'); return; }
        setMessages(list => list.filter(m => m.id !== msgId));
        notify('Pesan dihapus');
      },
    });
  }

  function exportChat(format) {
    if (!archive || messages.length === 0) return;

    let content, type;
    const safeTitle = archive.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'arsip';

    if (format === 'json') {
      content = JSON.stringify({
        archive: archive.title,
        exported_at: new Date().toISOString(),
        messages: messages.map(m => ({ content: m.content, timestamp: m.created_at })),
      }, null, 2);
      type = 'application/json';
    } else {
      const lines = [`=== ${archive.title} ===`, `Exported: ${new Date().toLocaleString('id-ID')}`, `Total: ${messages.length} pesan`, ''];
      let lastDate = '';
      messages.forEach(m => {
        const date = new Date(m.created_at);
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        if (dateStr !== lastDate) { lines.push(`--- ${dateStr} ---`); lastDate = dateStr; }
        lines.push(`[${formatTime(m.created_at)}] ${m.content}`);
      });
      content = lines.join('\n');
      type = 'text/plain';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${safeTitle}.${format}`; a.click();
    URL.revokeObjectURL(url);
    notify(`Diekspor sebagai .${format}`);
  }

  function showDateSep(i) {
    if (i === 0) return true;
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(messages[i].created_at).toDateString();
  }

  if (!user) return <div className="loading-screen"><div className="spinner large" /></div>;

  return (
    <div className="chat-page">
      {ui}

      <header className="chat-header">
        <div className="chat-header-inner">
          <button onClick={() => router.push('/dashboard')} className="icon-btn" aria-label="Kembali" title="Kembali">
            <Icon name="back" size={18} strokeWidth={2.5} />
          </button>

          <div className="chat-title-wrap">
            {renaming ? (
              <form onSubmit={saveTitle} className="rename-form">
                <input className="input input-sm" value={titleInput} autoFocus aria-label="Nama arsip"
                  onChange={(e) => setTitleInput(e.target.value)} onBlur={saveTitle}
                  onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(false); }} />
              </form>
            ) : (
              <button className="chat-title" disabled={!archive} title="Ganti nama arsip"
                onClick={() => { setTitleInput(archive.title); setRenaming(true); }}>
                <span className="chat-title-text">{archive?.title || 'Memuat…'}</span>
                <Icon name="edit" size={13} className="chat-title-icon" />
              </button>
            )}
            <span className="chat-subtitle">{messages.length} pesan</span>
          </div>

          {messages.length > 0 && (
            <div className="chat-header-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => exportChat('txt')} title="Ekspor sebagai .txt">
                <Icon name="download" size={14} /> .txt
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportChat('json')} title="Ekspor sebagai .json">
                <Icon name="download" size={14} /> .json
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="chat-main">
        {!loaded ? (
          <div className="loading-block"><span className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <Icon name="chat" size={44} strokeWidth={1.5} />
            <p className="empty-title">Belum ada pesan</p>
            <p className="empty-desc">Tulis catatan pertamamu di kolom bawah.</p>
          </div>
        ) : (
          <div className="note-list">
            {messages.map((msg, i) => (
              <div key={msg.id}>
                {showDateSep(i) && <div className="date-sep"><span>{formatDateSep(msg.created_at)}</span></div>}
                <article className={`note ${editingId === msg.id ? 'note-editing' : ''}`}>
                  {editingId === msg.id ? (
                    <div className="note-edit">
                      <textarea className="input textarea" value={editText} autoFocus rows={Math.min(8, editText.split('\n').length + 1)}
                        onChange={(e) => setEditText(e.target.value)} aria-label="Ubah pesan"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit(msg.id);
                        }} />
                      <div className="note-edit-actions">
                        <span className="hint">Ctrl+Enter untuk simpan · Esc batal</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(msg.id)} disabled={!editText.trim()}>Simpan</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="note-text">{renderTextWithLinks(msg.content)}</p>
                      <div className="note-footer">
                        <time className="note-time" dateTime={msg.created_at}>{formatTime(msg.created_at)}</time>
                        <div className="note-actions">
                          <button className="icon-btn icon-btn-sm" onClick={() => copyMessage(msg.content)} aria-label="Salin" title="Salin">
                            <Icon name="copy" size={13} />
                          </button>
                          <button className="icon-btn icon-btn-sm" onClick={() => startEdit(msg)} aria-label="Ubah" title="Ubah">
                            <Icon name="edit" size={13} />
                          </button>
                          <button className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => requestDeleteMessage(msg.id)}
                            aria-label="Hapus" title="Hapus">
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              </div>
            ))}
            <div ref={messagesEndRef} className="scroll-anchor" />
          </div>
        )}
      </main>

      {showScrollBtn && (
        <button className="scroll-bottom" onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Ke pesan terbaru">
          <Icon name="down" size={18} strokeWidth={2.5} />
        </button>
      )}

      <form onSubmit={sendMessage} className="composer">
        <div className="composer-inner">
          <textarea
            ref={textareaRef}
            placeholder="Tulis pesan…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="composer-input"
            rows={1}
            aria-label="Tulis pesan"
          />
          <button type="submit" className="composer-send" disabled={sending || !newMessage.trim()} aria-label="Kirim">
            {sending ? <span className="spinner small" /> : <Icon name="send" size={17} strokeWidth={2.2} />}
          </button>
        </div>
        <p className="composer-hint">Enter untuk kirim · Shift+Enter baris baru</p>
      </form>
    </div>
  );
}
