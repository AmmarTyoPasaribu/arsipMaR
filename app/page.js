'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '../lib/auth';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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
          <div className="login-logo">
            <img src="/logo.svg" alt="ArsipMaR" width="56" height="56" />
          </div>
          <h1>ArsipMaR</h1>
          <p className="login-subtitle">Personal Archive & Chat</p>
        </div>

        {/* Tab Toggle Login/Sign Up */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); setError(''); }}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        <h2 className="auth-title">{isSignUp ? 'Buat Akun Baru' : 'Masuk ke Akunmu'}</h2>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleAuth} className="login-form">
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={isSignUp ? 'Minimal 6 karakter' : 'Masukkan password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : isSignUp ? (
              'Buat Akun'
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        <div className="login-switch">
          <p>
            {isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'}
            <button
              type="button"
              className="btn-link"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            >
              {isSignUp ? 'Login' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
