import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { Icon } from '../icons.jsx';

export default function InterfaceSelect() {
  const { user, logout } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const navigate = useNavigate();
  const uz = lang === 'uz';

  const roleLabel = {
    admin: uz ? 'Administrator' : 'Администратор',
    founder: uz ? 'Ta\'sischi' : 'Учредитель',
    director: uz ? 'Direktor' : 'Директор',
    manager: uz ? 'Menejer' : 'Менеджер',
    cashier: uz ? 'Kassir' : 'Кассир',
    warehouse: uz ? 'Omborchi' : 'Складовщик',
    seller: uz ? 'Sotuvchi' : 'Продавец',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5FA', fontFamily: "'Nunito', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {/* flexWrap: на 360px логотип с названием компании плюс языки, имя
          пользователя и «Выйти» в одну строку не влезали — шапка уносила
          экран вбок на 113px. */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E4F0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 auto' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #1E40AF, #2563EB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="store" size={20} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontWeight: 900, fontSize: user?.company_name ? '14px' : '16px', color: '#0B1640' }}>
              {user?.company_name || 'Wave ERP'}
            </span>
            {user?.branch_name && (
              <span style={{ fontSize: '11px', color: '#9EA3BF', fontWeight: 600 }}>{user.branch_name}</span>
            )}
          </div>
        </div>
        {/* Правая группа тоже должна переноситься: на 360px языки, имя с ролью
            и «Выйти» в одну строку не встают, и кнопка выхода уезжала за край. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
          <div style={{ display: 'flex', background: '#F4F5FA', borderRadius: '8px', padding: '3px', flex: '0 0 auto' }}>
            {[{ key: 'uz', label: "UZ" }, { key: 'ru', label: 'RU' }].map(l => (
              <button key={l.key} onClick={() => changeLang(l.key)} style={{
                padding: '5px 12px', border: 'none', cursor: 'pointer', borderRadius: '6px',
                fontWeight: 800, fontSize: '12px',
                background: lang === l.key ? '#fff' : 'transparent',
                color: lang === l.key ? '#1E40AF' : '#9EA3BF',
                boxShadow: lang === l.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                fontFamily: "'Nunito', sans-serif",
              }}>{l.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#F4F5FA', borderRadius: '20px', minWidth: 0, flex: '0 1 auto' }}>
            <Icon name="user" size={14} color="#6B6F8A" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A1B2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</span>
            <span style={{ fontSize: '11px', background: 'rgba(30,64,175,.1)', color: '#1E40AF', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{roleLabel[user?.role]}</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: '1.5px solid #E2E4F0', color: '#6B6F8A',
            padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
          }}>
            <Icon name="logout" size={15} color="#6B6F8A" />
            {uz ? 'Chiqish' : 'Выйти'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0B1640', margin: '0 0 8px', textAlign: 'center' }}>
          {uz ? 'Interfeys tanlang' : 'Выберите интерфейс'}
        </h1>
        <p style={{ fontSize: '14px', color: '#9EA3BF', margin: '0 0 40px', textAlign: 'center' }}>
          {uz ? 'Ish rejimini belgilang' : 'Выберите режим работы'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', maxWidth: '680px', width: '100%' }}>
          {/* Computer */}
          <button onClick={() => navigate('/desktop')} style={{
            flex: '1 1 280px', maxWidth: '300px',
            background: '#fff', border: '2px solid #E2E4F0', borderRadius: '20px',
            padding: '36px 28px', cursor: 'pointer', textAlign: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,.06)',
            transition: 'all .2s', fontFamily: "'Nunito', sans-serif",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(30,64,175,.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E4F0'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(30,64,175,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Icon name="desktop" size={38} color="#1E40AF" />
            </div>
            <div style={{ fontWeight: 900, fontSize: '20px', color: '#0B1640', marginBottom: '8px' }}>
              {uz ? 'Kompyuter' : 'Компьютер'}
            </div>
            <div style={{ fontSize: '13px', color: '#9EA3BF', marginBottom: '18px', lineHeight: 1.5 }}>
              {uz ? 'Ombor va kassa boshqaruvi' : 'Управление складом и кассой'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'rgba(30,64,175,.08)', borderRadius: '20px' }}>
              <Icon name="desktop" size={13} color="#1E40AF" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1E40AF', letterSpacing: '0.5px' }}>
                {uz ? 'KOMPYUTER' : 'КОМПЬЮТЕР'}
              </span>
            </div>
          </button>

          {/* Phone */}
          <button onClick={() => navigate('/mobile')} style={{
            flex: '1 1 280px', maxWidth: '300px',
            background: '#fff', border: '2px solid #1E40AF', borderRadius: '20px',
            padding: '36px 28px', cursor: 'pointer', textAlign: 'center',
            boxShadow: '0 8px 32px rgba(30,64,175,.15)',
            transition: 'all .2s', fontFamily: "'Nunito', sans-serif",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(30,64,175,.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(30,64,175,.15)'; }}
          >
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Icon name="mobile" size={38} color="#16a34a" />
            </div>
            <div style={{ fontWeight: 900, fontSize: '20px', color: '#0B1640', marginBottom: '8px' }}>
              {uz ? 'Telefon' : 'Телефон'}
            </div>
            <div style={{ fontSize: '13px', color: '#9EA3BF', marginBottom: '18px', lineHeight: 1.5 }}>
              {uz ? 'Tovar skaneri va kirim-chiqim' : 'Сканер товаров и приход-расход'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'rgba(34,197,94,.1)', borderRadius: '20px' }}>
              <Icon name="mobile" size={13} color="#16a34a" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', letterSpacing: '0.5px' }}>
                {uz ? 'TELEFON' : 'ТЕЛЕФОН'}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
