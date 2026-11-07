'use client';

import { useState, useEffect } from 'react';

// The initial theme is applied by the inline script in app/layout.js; this keeps React in sync with it
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('arsipmar-theme', next ? 'dark' : 'light'); } catch {}
  }

  return { dark, toggleTheme };
}
