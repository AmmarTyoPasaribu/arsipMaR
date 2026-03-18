'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { getUserFromToken } from '../../../lib/auth';
import { useRouter, useParams } from 'next/navigation';

export default function ArchiveChatPage() {
  const [user, setUser] = useState(null);
  const [archive, setArchive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const router = useRouter();
  const params = useParams();
  const archiveId = params.id;

  function showToastConfirm(message, onConfirm) { setToast({ type: 'confirm', message, onConfirm }); }
  function showToastInfo(message) {
    setToast({ type: 'info', message });
    setTimeout(() => setToast(null), 2000);
  }
  function dismissToast() { setToast(null); }
  function handleToastConfirm() { if (toast?.onConfirm) toast.onConfirm(); setToast(null); }

  useEffect(() => {
    const decoded = getUserFromToken();
    if (!decoded) { router.push('/'); return; }
    setUser(decoded);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && archiveId) { fetchArchive(); fetchMessages(); }
  }, [user, archiveId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [newMessage]);

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    function handleScroll() {
      const distFromBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    }
    area.addEventListener('scroll', handleScroll);
    return () => area.removeEventListener('scroll', handleScroll);
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchArchive() {
    const { data } = await supabase
      .from('archives').select('*').eq('id', archiveId).eq('user_id', user.id).single();
    if (!data) { router.push('/dashboard'); return; }
    setArchive(data);
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages').select('*').eq('archive_id', archiveId).eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      archive_id: archiveId, user_id: user.id, content: newMessage.trim(),
    });
    if (!error) { setNewMessage(''); fetchMessages(); }
    setSending(false);
  }

  function requestDeleteMessage(msgId) {
    showToastConfirm('Hapus pesan ini?', async () => {
      await supabase.from('messages').delete().eq('id', msgId);
      fetchMessages();
    });
  }

  // Export chat
  function exportChat(format) {
    if (!archive || messages.length === 0) return;

    let content, filename, type;

    if (format === 'json') {
      content = JSON.stringify({
        archive: archive.title,
        exported_at: new Date().toISOString(),
        messages: messages.map(m => ({
          content: m.content,
          timestamp: m.created_at,
        })),
      }, null, 2);
      filename = `${archive.title}.json`;
      type = 'application/json';
    } else {
      const lines = [`=== ${archive.title} ===`, `Exported: ${new Date().toLocaleString('id-ID')}`, `Total: ${messages.length} pesan`, ''];
      let lastDate = '';
      messages.forEach(m => {
        const date = new Date(m.created_at);
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        if (dateStr !== lastDate) { lines.push(`--- ${dateStr} ---`); lastDate = dateStr; }
        const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        lines.push(`[${time}] ${m.content}`);
      });
      content = lines.join('\n');
      filename = `${archive.title}.txt`;
      type = 'text/plain';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToastInfo(`Exported sebagai ${format.toUpperCase()}`);
  }

  function formatTime(d) {
    return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateSep(d) {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Hari Ini';
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function showDateSep(i) {
    if (i === 0) return true;
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(messages[i].created_at).toDateString();
  }

  function renderTextWithLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: '#93c5fd', textDecoration: 'underline', wordBreak: 'break-all' }}
            onClick={(e) => e.stopPropagation()}>
            {part}
          </a>
        );
      }
      return part;
    });
  }

  if (loading) return <div className="loading-screen"><div className="spinner large"></div></div>;

  return (
    <div className="chat-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          {toast.type === 'confirm' ? (
            <div className="toast-confirm">
              <span className="toast-text">{toast.message}</span>
              <div className="toast-actions">
                <button className="toast-btn-yes" onClick={handleToastConfirm}>Hapus</button>
                <button className="toast-btn-no" onClick={dismissToast}>Batal</button>
              </div>
            </div>
          ) : (
            <div className="toast">
              <span className="toast-text">{toast.message}</span>
            </div>
          )}
        </div>
      )}

      <header className="chat-header">
        <button onClick={() => router.push('/dashboard')} className="btn-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="chat-header-info">
          <h2>{archive?.title || '...'}</h2>
          <span className="message-count">{messages.length} pesan</span>
        </div>
        {/* Export Buttons */}
        {messages.length > 0 && (
          <div className="export-btns">
            <button className="btn-export" onClick={() => exportChat('txt')} title="Export .txt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              .txt
            </button>
            <button className="btn-export" onClick={() => exportChat('json')} title="Export .json">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              .json
            </button>
          </div>
        )}
      </header>

      <div className="messages-area" ref={messagesAreaRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p>Belum ada pesan. Mulai menulis!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id}>
              {showDateSep(i) && <div className="date-separator"><span>{formatDateSep(msg.created_at)}</span></div>}
              <div className="message-bubble">
                <div className="message-content">
                  <p>{renderTextWithLinks(msg.content)}</p>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                    <button className="btn-delete-msg" onClick={() => requestDeleteMessage(msg.id)} title="Hapus">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {i === messages.length - 1 && <div ref={messagesEndRef} />}
            </div>
          ))
        )}
      </div>

      {/* Scroll to Bottom */}
      {showScrollBtn && (
        <button className="btn-scroll-bottom" onClick={scrollToBottom}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      <form onSubmit={sendMessage} className="chat-input-bar">
        <textarea
          ref={textareaRef}
          placeholder="Ketik pesan..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="chat-textarea"
          rows={1}
        />
        <button type="submit" className="btn-send" disabled={sending || !newMessage.trim()}>
          {sending ? (
            <span className="spinner small"></span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
