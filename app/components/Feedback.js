'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icon';

function ConfirmModal({ title, desc, confirmLabel = 'Ya, Hapus', tone = 'danger', icon = 'trash', onConfirm, onClose }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}>
        <div className={`modal-icon modal-icon-${tone}`}><Icon name={icon} size={22} /></div>
        <div className="modal-title" id="modal-title">{title}</div>
        {desc && <div className="modal-desc">{desc}</div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button ref={confirmRef} className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast + confirm dialog shared by every page. Render `ui` once near the page root.
export function useFeedback() {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, type, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const notifyError = useCallback((message) => notify(message, 'error'), [notify]);

  // confirm({ title, desc, confirmLabel?, tone?, icon?, onConfirm })
  const confirm = useCallback((opts) => setDialog(opts), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const ui = (
    <>
      {dialog && <ConfirmModal {...dialog} onClose={closeDialog} />}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.key} className={`toast toast-${toast.type}`}>
            <span className="toast-icon"><Icon name={toast.type === 'error' ? 'alert' : 'check'} size={13} strokeWidth={2.5} /></span>
            {toast.message}
          </div>
        )}
      </div>
    </>
  );

  return { notify, notifyError, confirm, ui };
}
