// src/pages/AuthPage.jsx
// The Login / Register page.
// A single page that toggles between two forms — no separate route needed.
// All text comes from i18next so switching languages works instantly.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import client from '../api/client';
import useStore from '../store/useStore';
import './AuthPage.css';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useStore((s) => s.setUser);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(''); // clear error on typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password };

      const res = await client.post(endpoint, payload);
      setUser(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'EMAIL_TAKEN')       setError(t('errors.emailTaken'));
      else if (code === 'INVALID_CREDENTIALS') setError(t('errors.invalidCreds'));
      else setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const switchLang = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div className="auth-page">
      {/* Floating background orbs from index.css */}
      <div className="bg-orbs" />

      {/* Language toggle */}
      <div className="lang-toggle">
        <button className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`} onClick={() => switchLang('en')}>EN</button>
        <button className={`lang-btn ${i18n.language === 'es' ? 'active' : ''}`} onClick={() => switchLang('es')}>ES</button>
      </div>

      <div className="auth-card glass-panel glass-panel--gold relative z-10">
        {/* Crystal diamond logo */}
        <div className="auth-logo">
          <div className="auth-crystal" />
          <span className="auth-logo-title">{t('app.name')}</span>
          <span className="auth-logo-sub">{t('app.tagline')}</span>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Username field — only shown on register */}
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label">{t('auth.username')}</label>
              <input
                className="input"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="HeroicWarrior"
                required
                minLength={3}
                maxLength={50}
                autoComplete="username"
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">{t('auth.email')}</label>
            <input
              className="input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="hero@realm.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('auth.password')}</label>
            <input
              className="input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading
              ? t('auth.loading')
              : mode === 'login' ? t('auth.login') : t('auth.register')
            }
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? t('auth.register') : t('auth.login')}
          </button>
        </div>
      </div>
    </div>
  );
}
