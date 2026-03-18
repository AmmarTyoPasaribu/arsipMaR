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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const router = useRouter();
  const params = useParams();
  const archiveId = params.id;

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
    if (user && archiveId) {
      fetchArchive();
      fetchMessages();
    }
  }, [user, archiveId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchArchive() {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      .eq('id', archiveId)
      .eq('user_id', user.id)
      .single();
    if (error || !data) {
      router.push('/dashboard');
      return;
    }
    setArchive(data);
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('archive_id', archiveId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      archive_id: archiveId,
      user_id: user.id,
      content: newMessage.trim(),
    });

    if (!error) {
      setNewMessage('');
      fetchMessages();
      inputRef.current?.focus();
    }
    setSending(false);
  }

  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id);
    fetchMessages();
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateSeparator(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hari Ini';
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function shouldShowDateSeparator(index) {
    if (index === 0) return true;
    const prevDate = new Date(messages[index - 1].created_at).toDateString();
    const currDate = new Date(messages[index].created_at).toDateString();
    return prevDate !== currDate;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner large"></div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Chat Header */}
      <header className="chat-header">
        <button onClick={() => router.push('/dashboard')} className="btn-back" id="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="chat-header-info">
          <h2>{archive?.title || 'Loading...'}</h2>
          <span className="message-count">{messages.length} pesan</span>
        </div>
      </header>

      {/* Messages Area */}
      <div className="messages-area" id="messages-area">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p>Belum ada pesan. Mulai menulis!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id}>
              {shouldShowDateSeparator(index) && (
                <div className="date-separator">
                  <span>{formatDateSeparator(msg.created_at)}</span>
                </div>
              )}
              <div className="message-bubble" id={`msg-${msg.id}`}>
                <div className="message-content">
                  <p>{msg.content}</p>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                    <button
                      className="btn-delete-msg"
                      onClick={() => deleteMessage(msg.id)}
                      title="Hapus pesan"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div ref={index === messages.length - 1 ? messagesEndRef : null} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={sendMessage} className="chat-input-bar" id="chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          placeholder="Ketik pesan..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="chat-input"
          id="chat-input"
          autoFocus
        />
        <button type="submit" className="btn-send" disabled={sending || !newMessage.trim()} id="send-btn">
          {sending ? (
            <span className="spinner small"></span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
