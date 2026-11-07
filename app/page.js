'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setToken, getUserFromToken } from '../lib/auth';
import Icon from './components/Icon';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Already logged in -> straight to the dashboard
  useEffect(() => {
    if (getUserFromToken()) router.replace('/dashboard');
  }, []);

  function switchMode(signUp) {
    setIsSignUp(signUp);
    setError('');
  }

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan');
        return;
      }

      setToken(data.token);
      router.push('/dashboard');
    } catch (err) {
      setError('Gagal menghubungi server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.svg" alt="" width="52" height="52" className="login-logo" />
          <h1>ArsipMaR</h1>
          <p className="login-subtitle">Arsip catatan, email, dan proyek pribadimu</p>
        </div>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={!isSignUp}
            className={`segmented-btn ${!isSignUp ? 'active' : ''}`} onClick={() => switchMode(false)}>
            Masuk
          </button>
          <button type="button" role="tab" aria-selected={isSignUp}
            className={`segmented-btn ${isSignUp ? 'active' : ''}`} onClick={() => switchMode(true)}>
            Daftar
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <Icon name="alert" size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="login-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="nama@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder={isSignUp ? 'Minimal 6 karakter' : 'Masukkan password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button type="button" className="input-action" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner small" /> : isSignUp ? 'Buat Akun' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
