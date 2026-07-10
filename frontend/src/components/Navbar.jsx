import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { Icon } from '../icons.jsx';
import { useTranslation } from '../useTranslation.js';
import api from '../api.js';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ cur: '', next: '', show: false });
  const [pwdMsg, setPwdMsg] = useState(null);
  const uz = lang === 'uz';

  const changeMyPassword = async () => {
    setPwdMsg(null);
    if (!pwd.next || pwd.next.length < 4) { setPwdMsg({ type: 'error', text: t('minPassword') }); return; }
    try {
      await api.post('/auth/change-password', { current_password: pwd.cur, new_password: pwd.next });
      setPwdMsg({ type: 'success', text: t('passwordChanged') });
      setPwd({ cur: '', next: '', show: false });
      setTimeout(() => { setPwdOpen(false); setPwdMsg(null); }, 1500);
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.response?.data?.error || t('error') });
    }
  };

  const roleLabel = { admin: uz ? 'Admin' : 'Администратор', founder: uz ? 'Ta\'sischi' : 'Учредитель', gen_dir: uz ? 'Tarmoq direktori' : 'Директор сети', manager: uz ? 'Menejer' : 'Менеджер', cashier: uz ? 'Kassir' : 'Кассир', warehouse: uz ? 'Omborchi' : 'Складовщик', seller: uz ? 'Sotuvchi' : 'Продавец' };
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  return (
    <nav style={{ background: 'linear-gradient(135deg, #1e1b4b, #3730a3)', padding: '0 20px', display: 'flex', alignItems: 'center', height: '58px', boxShadow: '0 2px 16px rgba(30,27,75,.3)', position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Logo / company brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '20px', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/select')}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(255,255,255,.3), rgba(255,255,255,.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="store" size={18} color="#fff" />
        </div>
        <div className="hide-mobile" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: user?.company_name ? '14px' : '16px', letterSpacing: '0.2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.company_name || 'Wave ERP'}
          </span>
          {user?.branch_name && (
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '11px', fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.branch_name}
            </span>
          )}
        </div>
      </div>

      {/* Mobile switch */}
      <button onClick={() => navigate('/select')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,.1)', border: 'none', color: 'rgba(255,255,255,.8)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif", marginRight: 'auto', flexShrink: 0 }}>
        <Icon name="mobile" size={13} color="rgba(255,255,255,.8)" />
        <span className="hide-mobile">{uz ? 'Telefon' : 'Телефон'}</span>
      </button>

      {/* Desktop right side */}
      <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Lang */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,.1)', borderRadius: '8px', padding: '3px' }}>
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '11px', background: lang === l ? 'rgba(255,255,255,.9)' : 'transparent', color: lang === l ? '#4338ca' : 'rgba(255,255,255,.7)', fontFamily: "'Nunito', sans-serif" }}>{l.toUpperCase()}</button>
          ))}
        </div>
        {/* User — clickable: opens change password */}
        <button onClick={() => setPwdOpen(true)} title={t('myPassword')}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,.1)', padding: '6px 12px', borderRadius: '20px', color: '#fff', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
          <Icon name="user" size={14} color="rgba(255,255,255,.8)" />
          <span>{fullName}</span>
          <span style={{ background: 'rgba(255,255,255,.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.3px' }}>{roleLabel[user?.role]}</span>
        </button>
        {/* Logout */}
        <button onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,.1)', border: 'none', color: 'rgba(255,255,255,.8)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif", transition: 'background .2s' }}>
          <Icon name="logout" size={14} color="rgba(255,255,255,.8)" />
          {uz ? 'Chiqish' : 'Выйти'}
        </button>
      </div>

      {/* Mobile hamburger */}
      <div className="hide-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,.1)', borderRadius: '8px', padding: '3px' }}>
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '10px', background: lang === l ? 'rgba(255,255,255,.9)' : 'transparent', color: lang === l ? '#4338ca' : 'rgba(255,255,255,.7)', fontFamily: "'Nunito', sans-serif" }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Change my password modal */}
      {pwdOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setPwdOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#1A1B2E' }}>🔑 {t('myPassword')}</div>
              <button onClick={() => setPwdOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ fontSize: '13px', color: '#6B6F8A', marginBottom: '14px' }}>@{user?.username}</div>
            {pwdMsg && <div className={`alert alert-${pwdMsg.type}`} style={{ marginBottom: '12px' }}>{pwdMsg.text}</div>}
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{t('currentPassword')}</label>
              <input className="input" type={pwd.show ? 'text' : 'password'} value={pwd.cur}
                onChange={e => setPwd({ ...pwd, cur: e.target.value })} autoFocus />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('newPassword')}</label>
              <input className="input" type={pwd.show ? 'text' : 'password'} value={pwd.next}
                onChange={e => setPwd({ ...pwd, next: e.target.value })} placeholder={t('minPassword')} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B6F8A', marginBottom: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={pwd.show} onChange={e => setPwd({ ...pwd, show: e.target.checked })} />
              {uz ? 'Parolni ko\'rsatish' : 'Показать пароли'}
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={changeMyPassword} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setPwdOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="hide-desktop" style={{ position: 'absolute', top: '58px', right: 0, left: 0, background: '#1e1b4b', padding: '12px 20px', boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.1)', marginBottom: '10px' }}>
            <Icon name="user" size={16} color="rgba(255,255,255,.6)" />
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{fullName}</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px' }}>{roleLabel[user?.role]}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); setMenuOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.08)', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
            <Icon name="logout" size={14} color="rgba(255,255,255,.7)" />
            {uz ? 'Chiqish' : 'Выйти'}
          </button>
        </div>
      )}
    </nav>
  );
}
