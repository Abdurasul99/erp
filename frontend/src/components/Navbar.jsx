import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { Icon } from '../icons.jsx';
import { useTranslation } from '../useTranslation.js';
import api from '../api.js';
import NotificationsBell from './NotificationsBell.jsx';

// Верхняя панель staff-оболочки (/desktop: кассир, складовщик).
// Светлое стекло Wave Bento-канона — тёмный индиго-градиент убран.
// Логика (смена пароля, язык, выход, мобильное меню) не менялась.
// onOpenTasks — куда вести по клику на уведомление (оболочка сама переключает
// раздел; свой роут у «Задач» на /desktop отсутствует).
export default function Navbar({ onOpenTasks }) {
  const { user, logout } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ cur: '', next: '', show: false });
  const [pwdMsg, setPwdMsg] = useState(null);
  const uz = lang === 'uz';

  // Клик по строке уведомления ведёт в раздел «Задачи» оболочки. Без обработчика
  // строка просто гасится как прочитанная — колокольчик это допускает.
  const bellTarget = onOpenTasks ? () => { setMenuOpen(false); onOpenTasks(); } : undefined;

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

  const roleLabel = { admin: uz ? 'Admin' : 'Администратор', founder: uz ? 'Ta\'sischi' : 'Учредитель', director: uz ? 'Direktor' : 'Директор', manager: uz ? 'Menejer' : 'Менеджер', cashier: uz ? 'Kassir' : 'Кассир', warehouse: uz ? 'Omborchi' : 'Складовщик', seller: uz ? 'Sotuvchi' : 'Продавец' };
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  const ghostBtn = {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#fff', border: '1px solid rgba(20,20,40,.1)',
    color: '#55555E', padding: '7px 13px', borderRadius: '9px', cursor: 'pointer',
    fontWeight: 650, fontSize: '12px', fontFamily: "'Inter', 'Nunito', sans-serif",
    transition: 'all .18s',
  };

  return (
    <nav style={{
      background: 'rgba(250,250,252,.82)',
      backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      borderBottom: '1px solid rgba(20,20,40,.07)',
      padding: '0 20px', display: 'flex', alignItems: 'center', height: '58px',
      position: 'sticky', top: 0, zIndex: 100,
      fontFamily: "'Inter', 'Nunito', sans-serif",
    }}>
      {/* Logo / company brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '20px', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/select')}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -6px rgba(10,132,255,.6)' }}>
          <Icon name="store" size={18} color="#fff" />
        </div>
        <div className="hide-mobile" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ color: '#141419', fontWeight: 800, fontSize: user?.company_name ? '14px' : '16px', letterSpacing: '-0.01em', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.company_name || 'Wave ERP'}
          </span>
          {user?.branch_name && (
            <span style={{ color: '#8E8E96', fontSize: '11px', fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.branch_name}
            </span>
          )}
        </div>
      </div>

      {/* Mobile switch */}
      <button onClick={() => navigate('/select')} style={{ ...ghostBtn, marginRight: 'auto', flexShrink: 0 }}>
        <Icon name="mobile" size={13} color="#8E8E96" />
        <span className="hide-mobile">{uz ? 'Telefon' : 'Телефон'}</span>
      </button>

      {/* Desktop right side */}
      <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <NotificationsBell variant="staff" onOpenTask={bellTarget} />
        {/* Lang */}
        <div style={{ display: 'flex', gap: '3px', background: '#ECEDF1', borderRadius: '9px', padding: '3px' }}>
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{ padding: '4px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '11px', background: lang === l ? '#fff' : 'transparent', color: lang === l ? '#0071E3' : '#8E8E96', fontFamily: 'inherit', boxShadow: lang === l ? '0 1px 4px rgba(20,20,40,.12)' : 'none' }}>{l.toUpperCase()}</button>
          ))}
        </div>
        {/* User — clickable: opens change password */}
        <button onClick={() => setPwdOpen(true)} title={t('myPassword')}
          style={{ ...ghostBtn, borderRadius: '20px', color: '#141419', fontWeight: 700, fontSize: '13px' }}>
          <Icon name="user" size={14} color="#8E8E96" />
          <span>{fullName}</span>
          <span style={{ background: 'rgba(10,132,255,.1)', color: '#0071E3', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.3px' }}>{roleLabel[user?.role]}</span>
        </button>
        {/* Logout */}
        <button onClick={() => { logout(); navigate('/login'); }} style={ghostBtn}>
          <Icon name="logout" size={14} color="#8E8E96" />
          {uz ? 'Chiqish' : 'Выйти'}
        </button>
      </div>

      {/* Mobile hamburger */}
      <div className="hide-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '3px', background: '#ECEDF1', borderRadius: '8px', padding: '3px' }}>
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '10px', background: lang === l ? '#fff' : 'transparent', color: lang === l ? '#0071E3' : '#8E8E96', fontFamily: 'inherit' }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={() => setMenuOpen(v => !v)} style={{ background: '#fff', border: '1px solid rgba(20,20,40,.1)', color: '#141419', width: '36px', height: '36px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
        {/* Второй экземпляр колокольчика — правый блок целиком скрыт на узких
            экранах, а уведомления нужны и там. Стоит последним намеренно: попап
            прижат к правому краю кнопки (.nbell-pop { right: 0 }), и из любой
            другой позиции он на телефоне уехал бы за левую границу экрана.
            Счётчик общий (контекст инбокса) — лишнего поллинга не возникает.
            zIndex поднят выше выпадающего меню (200): иначе открытое меню
            накрывало бы попап. Обёртка размером с саму кнопку — кликов у
            соседей не перехватывает. */}
        <div style={{ display: 'inline-flex', position: 'relative', zIndex: 300 }}>
          <NotificationsBell variant="staff" onOpenTask={bellTarget} />
        </div>
      </div>

      {/* Change my password modal */}
      {pwdOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,40,.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setPwdOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '18px', padding: '24px', maxWidth: '380px', width: '100%', boxShadow: '0 28px 80px -20px rgba(20,20,40,.4)', fontFamily: "'Inter', 'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#141419' }}>🔑 {t('myPassword')}</div>
              <button onClick={() => setPwdOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#8E8E96' }}>×</button>
            </div>
            <div style={{ fontSize: '13px', color: '#8E8E96', marginBottom: '14px' }}>@{user?.username}</div>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8E8E96', marginBottom: '14px', cursor: 'pointer' }}>
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
        <div className="hide-desktop" style={{ position: 'absolute', top: '58px', right: 0, left: 0, background: '#fff', padding: '12px 20px', boxShadow: '0 18px 44px -12px rgba(20,20,40,.25)', borderBottom: '1px solid rgba(20,20,40,.07)', zIndex: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(20,20,40,.07)', marginBottom: '10px' }}>
            <Icon name="user" size={16} color="#8E8E96" />
            <div>
              <div style={{ color: '#141419', fontWeight: 700, fontSize: '14px' }}>{fullName}</div>
              <div style={{ color: '#8E8E96', fontSize: '11px' }}>{roleLabel[user?.role]}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); setMenuOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: '#F4F4F6', border: 'none', color: '#141419', padding: '10px 14px', borderRadius: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
            <Icon name="logout" size={14} color="#8E8E96" />
            {uz ? 'Chiqish' : 'Выйти'}
          </button>
        </div>
      )}
    </nav>
  );
}
