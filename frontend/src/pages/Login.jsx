import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { Icon } from '../icons.jsx';
import { useTranslation } from '../useTranslation.js';
import api from '../api.js';

export default function Login() {
  const { login } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const uz = lang === 'uz';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.user, data.token);
      const r = data.user.role;
      if (r === 'seller') navigate('/sell');
      else if (r === 'admin') navigate('/admin');
      else if (['founder', 'gen_dir', 'manager'].includes(r)) navigate('/desktop');
      else navigate('/select');
    } catch (err) {
      const st = err.response?.status;
      const msg = err.response?.data?.error || '';
      // Локализуем по статус-коду (надёжнее, чем по тексту), узбекский/русский.
      if (st === 429) {
        setError(uz ? "Juda koʻp urinish. 1 daqiqadan soʻng qayta urinib koʻring." : 'Слишком много попыток. Попробуйте через 1 мин.');
      } else if (st === 403) {
        setError(t('accountBlocked'));
      } else if (st === 401) {
        setError(uz ? "Login yoki parol notoʻgʻri" : 'Неверный логин или пароль');
      } else {
        setError(uz ? 'Xatolik yuz berdi. Qayta urinib koʻring.' : (msg || 'Ошибка. Попробуйте ещё раз.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 12px 12px 38px', border: '1.5px solid #E2E4F0',
    borderRadius: '10px', fontSize: '14px', fontFamily: "'Nunito', sans-serif",
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
  };
  const labelStyle = {
    fontSize: '11px', fontWeight: 800, color: '#6B6F8A',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '7px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0B1640 0%, #16307A 50%, #1E40AF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif", padding: '20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
      <div style={{ position: 'absolute', bottom: '-150px', left: '-80px', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: '#fff', borderRadius: '24px', padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

          {/* Logo — Wave (волна + зелёная линия + ERP SYSTEM) */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '78px', height: '78px', margin: '0 auto 12px',
              background: '#fff', border: '1px solid #E3EAF3',
              borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '46px', boxShadow: '0 10px 26px rgba(30,58,138,.16)',
            }}>🌊</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0F1B33', lineHeight: 1, letterSpacing: '-1px' }}>Wave</div>
            <svg width="120" height="12" viewBox="0 0 120 12" fill="none" style={{ display: 'block', margin: '7px auto 0' }}>
              <path d="M3 7 Q 18 1, 33 6 T 63 6 T 93 6 T 117 6" stroke="#2ECC71" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', letterSpacing: '3px', marginTop: '9px' }}>ERP SYSTEM</div>
          </div>

          {/* Language toggle */}
          <div style={{ display: 'flex', background: '#F4F5FA', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
            {[{ key: 'uz', label: "O'zbek" }, { key: 'ru', label: 'Русский' }].map(l => (
              <button key={l.key} onClick={() => changeLang(l.key)} style={{
                flex: 1, padding: '9px', border: 'none', cursor: 'pointer', borderRadius: '9px',
                fontWeight: 800, fontSize: '13px',
                background: lang === l.key ? '#fff' : 'transparent',
                color: lang === l.key ? '#2563EB' : '#9EA3BF',
                boxShadow: lang === l.key ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                transition: 'all .2s', fontFamily: "'Nunito', sans-serif",
              }}>{l.label}</button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Blocked / error message */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                color: '#dc2626', padding: '12px 14px', borderRadius: '10px',
                marginBottom: '16px', fontSize: '13px', fontWeight: 700,
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Login */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>
                {uz ? 'Login' : 'Логин'}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Icon name="user" size={16} color="#9EA3BF" />
                </div>
                <input
                  style={inputStyle}
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder={uz ? 'Foydalanuvchi nomi' : 'Имя пользователя'}
                  autoFocus required
                  onFocus={e => e.target.style.borderColor = '#2563EB'}
                  onBlur={e => e.target.style.borderColor = '#E2E4F0'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>
                {uz ? 'Parol' : 'Пароль'}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Icon name="lock" size={16} color="#9EA3BF" />
                </div>
                <input
                  style={{ ...inputStyle, paddingRight: '42px' }}
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={uz ? 'Parolni kiriting' : 'Введите пароль'}
                  required
                  onFocus={e => e.target.style.borderColor = '#2563EB'}
                  onBlur={e => e.target.style.borderColor = '#E2E4F0'}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                }}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={17} color="#9EA3BF" />
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9EA3BF' : 'linear-gradient(135deg, #1E40AF, #2563EB)',
              border: 'none', borderRadius: '12px', color: '#fff',
              fontWeight: 900, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Nunito', sans-serif",
              boxShadow: loading ? 'none' : '0 6px 20px rgba(30,64,175,.35)',
              transition: 'all .2s', letterSpacing: '0.3px',
            }}>
              {loading
                ? (uz ? 'Yuklanmoqda...' : 'Загрузка...')
                : (uz ? 'Kirish →' : 'Войти →')}
            </button>
          </form>
        </div>

        {/* WoW · World Wide — фирменный знак (мелким, снизу) */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <svg width="118" height="30" viewBox="0 0 100 30" fill="none" style={{ display: 'inline-block' }}>
            <circle cx="14" cy="15" r="11" stroke="#fff" strokeWidth="2" />
            <circle cx="14" cy="4.6" r="3" fill="#2ECC71" />
            <text x="14" y="19.6" textAnchor="middle" fontFamily="'Nunito', sans-serif" fontSize="11" fontWeight="900" fill="#fff">W</text>
            <text x="31" y="20" fontFamily="'Nunito', sans-serif" fontSize="15" fontWeight="900" fill="#fff" letterSpacing="-0.3">WoW</text>
            <path d="M65 22 L77 5" stroke="#2ECC71" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M77 5 L71.5 6.8 M77 5 L78.7 10.6" stroke="#2ECC71" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '3.5px', color: 'rgba(255,255,255,.55)', marginTop: '1px' }}>WORLD WIDE</div>
        </div>
      </div>
    </div>
  );
}
