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
      else if (['admin', 'founder', 'gen_dir', 'manager'].includes(r)) navigate('/desktop');
      else navigate('/select');
    } catch (err) {
      const msg = err.response?.data?.error || '';
      // Translate known backend errors
      if (msg.includes('заблокирован') || err.response?.status === 403) {
        setError(t('accountBlocked'));
      } else if (msg.includes('не найден') || msg.includes('topilmadi')) {
        setError(uz ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден');
      } else if (msg.includes('пароль') || msg.includes('Parol')) {
        setError(uz ? 'Parol noto\'g\'ri' : 'Неверный пароль');
      } else {
        setError(msg || t('error'));
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
      background: 'linear-gradient(160deg, #1e1b4b 0%, #3730a3 50%, #4338ca 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif", padding: '20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
      <div style={{ position: 'absolute', bottom: '-150px', left: '-80px', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: '#fff', borderRadius: '24px', padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '72px', height: '72px', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #4338ca, #6366f1, #f97316)',
              borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(67,56,202,.4)',
            }}>
              <Icon name="store" size={34} color="#fff" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e1b4b' }}>ERP System</div>
            <div style={{ fontSize: '13px', color: '#9EA3BF', marginTop: '4px' }}>
              {uz ? 'Biznes boshqaruv tizimi' : 'Система управления бизнесом'}
            </div>
          </div>

          {/* Language toggle */}
          <div style={{ display: 'flex', background: '#F4F5FA', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
            {[{ key: 'uz', label: "O'zbek" }, { key: 'ru', label: 'Русский' }].map(l => (
              <button key={l.key} onClick={() => changeLang(l.key)} style={{
                flex: 1, padding: '9px', border: 'none', cursor: 'pointer', borderRadius: '9px',
                fontWeight: 800, fontSize: '13px',
                background: lang === l.key ? '#fff' : 'transparent',
                color: lang === l.key ? '#4338ca' : '#9EA3BF',
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
                  onFocus={e => e.target.style.borderColor = '#4338ca'}
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
                  onFocus={e => e.target.style.borderColor = '#4338ca'}
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
              background: loading ? '#9EA3BF' : 'linear-gradient(135deg, #4338ca, #6366f1)',
              border: 'none', borderRadius: '12px', color: '#fff',
              fontWeight: 900, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Nunito', sans-serif",
              boxShadow: loading ? 'none' : '0 6px 20px rgba(67,56,202,.35)',
              transition: 'all .2s', letterSpacing: '0.3px',
            }}>
              {loading
                ? (uz ? 'Yuklanmoqda...' : 'Загрузка...')
                : (uz ? 'Kirish →' : 'Войти →')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
