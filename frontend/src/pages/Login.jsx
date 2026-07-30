import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { Icon } from '../icons.jsx';
import { Icon as OIcon } from '../owner/icons.jsx';
import { useTranslation } from '../useTranslation.js';
import api from '../api.js';

// Страница входа «Живая волна»: сплит-экран в светлом Wave Bento-каноне.
// Слева — бренд-панель с «жидким» логотипом (плитка наполняется живой волной —
// буквальное воплощение имени Wave), справа — панель входа. Вся логика формы
// (submit, локализация ошибок, RU/UZ, глазок пароля, роутинг ролей) не менялась.

// «Жидкий» логотип: вода с двумя дрейфующими синусоидами поднимается внутри
// стеклянной плитки, затем прорисовывается белый глиф волны. Чистый SVG+CSS.
function LiquidLogo({ size = 104 }) {
  return (
    <svg className="lq" width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="lqClip"><rect x="4" y="4" width="88" height="88" rx="24" /></clipPath>
        <linearGradient id="lqWater" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0A84FF" /><stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
        <linearGradient id="lqWater2" x1="96" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#32ADE6" /><stop offset="1" stopColor="#0A84FF" />
        </linearGradient>
      </defs>
      {/* стеклянная плитка */}
      <rect x="4" y="4" width="88" height="88" rx="24" fill="#F0F4FB" />
      <g clipPath="url(#lqClip)">
        {/* вода: группа поднимается, волны внутри дрейфуют навстречу друг другу */}
        <g className="lq-rise">
          <path className="lq-w lq-w2" fill="url(#lqWater2)" opacity="0.55"
            d="M0 14 Q 12 4, 24 14 T 48 14 T 72 14 T 96 14 T 120 14 T 144 14 T 168 14 T 192 14 V 200 H 0 Z" />
          <path className="lq-w lq-w1" fill="url(#lqWater)"
            d="M0 18 Q 12 8, 24 18 T 48 18 T 72 18 T 96 18 T 120 18 T 144 18 T 168 18 T 192 18 V 200 H 0 Z" />
        </g>
      </g>
      {/* грань плитки */}
      <rect x="4" y="4" width="88" height="88" rx="24" stroke="rgba(20,20,40,.08)" strokeWidth="1.5" />
      {/* белый глиф волны — прорисовывается, когда вода поднялась */}
      <path className="lq-glyph" pathLength="100"
        d="M22 55 c 8-16, 14-16, 19 0 s 11 16, 19 0 s 10-14, 14-6"
        stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const { login } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // ?reason=session — сессию завершил вход с другого устройства (одиночная сессия).
  const [error, setError] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('reason') === 'session') {
        return (localStorage.getItem('lang') === 'uz')
          ? 'Boshqa qurilmadan kirildi — bu qurilmadagi seans yakunlandi.'
          : 'Выполнен вход с другого устройства — сессия на этом устройстве завершена.';
      }
    } catch { /* noop */ }
    return '';
  });
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
      else if (['founder', 'director', 'manager'].includes(r)) navigate('/desktop');
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

  const FEATURES = uz ? [
    { icon: 'layout',   text: "115+ asbob — savdo, ombor, moliya, jamoa" },
    { icon: 'sparkles', text: 'AI-tahlilchi savollaringizga raqamlar bilan javob beradi' },
    { icon: 'activity', text: 'Biznes salomatligi indeksi va jonli nazorat' },
  ] : [
    { icon: 'layout',   text: '115+ инструментов — продажи, склад, финансы, команда' },
    { icon: 'sparkles', text: 'AI-аналитик отвечает на вопросы вашими цифрами' },
    { icon: 'activity', text: 'Индекс здоровья бизнеса и живой контроль' },
  ];

  return (
    <div className="lg-page">
     {/* Единая центрированная карточка из двух половин: бренд слева, вход справа —
         форма рядом с лого, а не растянута по краям экрана. */}
     <div className="lg-duo">
      {/* ── Левая бренд-панель ── */}
      <div className="lg-brand">
        <div className="lg-brand-inner">
          <LiquidLogo />
          <div className="lg-word">
            Wave
            <svg width="112" height="12" viewBox="0 0 120 12" fill="none" className="lg-underline">
              <path pathLength="100" d="M3 7 Q 18 1, 33 6 T 63 6 T 93 6 T 117 6" stroke="#2ECC71" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="lg-tag">{uz ? 'Biznesingizning jonli boshqaruvchisi' : 'Живой управленец вашего бизнеса'}</div>

          <div className="lg-feats">
            {FEATURES.map((f, i) => (
              <div className="lg-feat" key={f.icon} style={{ animationDelay: (1.15 + i * 0.14) + 's' }}>
                <span className="lg-feat-ico"><OIcon name={f.icon} size={15} /></span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* WoW · World Wide — фирменный знак разработчика */}
          <div className="lg-wow">
            <svg width="96" height="26" viewBox="0 0 100 30" fill="none">
              <circle cx="14" cy="15" r="11" stroke="#14284B" strokeWidth="2" />
              <circle cx="14" cy="4.6" r="3" fill="#2ECC71" />
              <text x="14" y="19.6" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="900" fill="#14284B">W</text>
              <text x="31" y="20" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="900" fill="#14284B" letterSpacing="-0.3">WoW</text>
              <path d="M65 22 L77 5" stroke="#2ECC71" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M77 5 L71.5 6.8 M77 5 L78.7 10.6" stroke="#2ECC71" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>WORLD WIDE</span>
          </div>
        </div>
      </div>

      {/* ── Правая панель входа ── */}
      <div className="lg-side">
        <div className="lg-card">
          <div className="lg-hello">{uz ? 'Xush kelibsiz!' : 'С возвращением!'}</div>
          <div className="lg-hello-sub">{uz ? 'Hisobingizga kiring' : 'Войдите в свой аккаунт'}</div>

          {/* Язык */}
          <div className="lg-langs">
            {[{ key: 'uz', label: "O'zbek" }, { key: 'ru', label: 'Русский' }].map(l => (
              <button key={l.key} type="button" onClick={() => changeLang(l.key)}
                className={'lg-lang' + (lang === l.key ? ' on' : '')}>{l.label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="lg-error">
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <label className="lg-label">{uz ? 'Login' : 'Логин'}</label>
            <div className="lg-inputwrap">
              <span className="lg-input-ico"><Icon name="user" size={16} color="currentColor" /></span>
              <input
                className="lg-input"
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder={uz ? 'Foydalanuvchi nomi' : 'Имя пользователя'}
                autoFocus required autoComplete="username"
              />
            </div>

            <label className="lg-label" style={{ marginTop: 16 }}>{uz ? 'Parol' : 'Пароль'}</label>
            <div className="lg-inputwrap">
              <span className="lg-input-ico"><Icon name="lock" size={16} color="currentColor" /></span>
              <input
                className="lg-input" style={{ paddingRight: 42 }}
                type={showPass ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={uz ? 'Parolni kiriting' : 'Введите пароль'}
                required autoComplete="current-password"
              />
              <button type="button" className="lg-eye" onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? (uz ? 'Parolni yashirish' : 'Скрыть пароль') : (uz ? "Parolni ko'rsatish" : 'Показать пароль')}>
                <Icon name={showPass ? 'eyeOff' : 'eye'} size={17} color="currentColor" />
              </button>
            </div>

            <button type="submit" disabled={loading} className="lg-cta">
              {loading
                ? (uz ? 'Yuklanmoqda…' : 'Загрузка…')
                : (uz ? 'Kirish →' : 'Войти →')}
            </button>
          </form>

          <div className="lg-note">{uz ? "Kirish ma'lumotlarini administratoringizdan oling" : 'Данные для входа выдаёт ваш администратор'}</div>
        </div>
      </div>
     </div>

      <style>{`
        .lg-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 28px;
          font-family: 'Inter', 'Nunito', -apple-system, sans-serif;
          background:
            radial-gradient(900px 540px at 78% -10%, rgba(10,132,255,.09), transparent 60%),
            radial-gradient(760px 520px at -8% 108%, rgba(46,204,113,.07), transparent 56%),
            #F4F4F6;
          color: #141419;
        }
        /* Карточка-дуэт: бренд + вход как две половины одного целого, по центру экрана */
        .lg-duo {
          display: flex; width: 100%; max-width: 1000px; min-height: 620px;
          background: #fff;
          border: 1px solid rgba(20,20,40,.07);
          border-radius: 28px; overflow: hidden;
          box-shadow: 0 44px 110px -32px rgba(20,20,40,.28);
          animation: lgUp .55s cubic-bezier(.22,1,.36,1) both;
        }
        /* ── Бренд-панель (левая половина карточки) ── */
        .lg-brand {
          flex: 1.12; display: flex; align-items: center; justify-content: center;
          padding: 48px 44px;
          background:
            radial-gradient(420px 300px at 82% 0%, rgba(10,132,255,.10), transparent 60%),
            radial-gradient(380px 300px at 0% 100%, rgba(46,204,113,.08), transparent 60%),
            #F7F9FD;
          border-right: 1px solid rgba(20,20,40,.06);
        }
        .lg-brand-inner { max-width: 360px; }
        .lg-word {
          font-size: 52px; font-weight: 850; letter-spacing: -0.04em; line-height: 1;
          margin-top: 22px; animation: lgUp .6s cubic-bezier(.22,1,.36,1) .55s both;
        }
        .lg-underline { display: block; margin-top: 8px; }
        .lg-underline path {
          stroke-dasharray: 100; stroke-dashoffset: 100;
          animation: lgDraw .9s cubic-bezier(.45,0,.2,1) .85s forwards;
        }
        .lg-tag {
          font-size: 15.5px; font-weight: 550; color: #55555E; margin-top: 14px;
          animation: lgUp .6s cubic-bezier(.22,1,.36,1) .75s both;
        }
        .lg-feats { margin-top: 34px; display: flex; flex-direction: column; gap: 13px; }
        .lg-feat {
          display: flex; align-items: center; gap: 11px;
          font-size: 13.5px; font-weight: 550; color: #3d3d46;
          animation: lgUp .55s cubic-bezier(.22,1,.36,1) both;
        }
        .lg-feat-ico {
          width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: linear-gradient(135deg, #0A84FF, #5E5CE6);
          box-shadow: 0 6px 14px -6px rgba(10,132,255,.55);
        }
        .lg-wow {
          margin-top: 44px; opacity: .8;
          animation: lgUp .6s ease 1.6s both;
        }
        .lg-wow span { display: block; font-size: 8px; font-weight: 800; letter-spacing: 3.5px; color: #8E8E96; margin-top: 2px; }

        /* ── «Жидкий» логотип ── */
        .lq { filter: drop-shadow(0 18px 34px rgba(10,132,255,.28)); }
        .lq-rise { transform: translateY(96px); animation: lqRise 1.5s cubic-bezier(.3,.7,.3,1) .15s forwards; }
        .lq-w { animation-duration: 3.2s; animation-iteration-count: infinite; animation-timing-function: linear; }
        .lq-w1 { animation-name: lqDriftL; }
        .lq-w2 { animation-name: lqDriftR; animation-duration: 4.5s; }
        .lq-glyph {
          stroke-dasharray: 100; stroke-dashoffset: 100;
          animation: lgDraw .8s cubic-bezier(.45,0,.2,1) 1.35s forwards;
          filter: drop-shadow(0 2px 5px rgba(10, 60, 160, .35));
        }
        @keyframes lqRise { to { transform: translateY(28px); } }
        @keyframes lqDriftL { from { translate: 0 0; } to { translate: -96px 0; } }
        @keyframes lqDriftR { from { translate: -96px 0; } to { translate: 0 0; } }
        @keyframes lgDraw { to { stroke-dashoffset: 0; } }
        @keyframes lgUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

        /* ── Панель входа (правая половина карточки) ── */
        .lg-side {
          flex: 1; min-width: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff;
          padding: 48px 40px;
        }
        .lg-card { width: 100%; max-width: 340px; animation: lgUp .6s cubic-bezier(.22,1,.36,1) .3s both; }
        .lg-hello { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
        .lg-hello-sub { font-size: 13.5px; color: #8E8E96; margin-top: 4px; }
        .lg-langs {
          display: flex; gap: 2px; background: #ECEDF1; border-radius: 11px; padding: 3px;
          margin: 20px 0 22px;
        }
        .lg-lang {
          flex: 1; padding: 8px; border: none; cursor: pointer; border-radius: 9px;
          font-weight: 700; font-size: 13px; font-family: inherit;
          background: transparent; color: #8E8E96; transition: all .18s;
        }
        .lg-lang.on { background: #fff; color: #0071E3; box-shadow: 0 2px 8px rgba(20,20,40,.1); }
        .lg-error {
          background: rgba(229,72,77,.07); border: 1px solid rgba(229,72,77,.2);
          color: #d62d33; padding: 11px 13px; border-radius: 11px;
          margin-bottom: 16px; font-size: 13px; font-weight: 600;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .lg-label {
          display: block; font-size: 10.5px; font-weight: 800; color: #8E8E96;
          text-transform: uppercase; letter-spacing: .07em; margin-bottom: 7px;
        }
        .lg-inputwrap { position: relative; color: #A5A5AD; }
        .lg-input-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); display: flex; }
        .lg-input {
          width: 100%; box-sizing: border-box;
          padding: 12.5px 12px 12.5px 40px;
          border: 1.5px solid rgba(20,20,40,.12); border-radius: 12px;
          font-size: 14px; font-family: inherit; color: #141419;
          outline: none; background: #fff;
          transition: border-color .2s, box-shadow .2s;
        }
        .lg-input:focus { border-color: #0A84FF; box-shadow: 0 0 0 4px rgba(10,132,255,.12); }
        .lg-inputwrap:focus-within { color: #0A84FF; }
        .lg-eye {
          position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 3px; display: flex;
          color: #A5A5AD;
        }
        .lg-eye:hover { color: #55555E; }
        .lg-cta {
          width: 100%; margin-top: 26px; padding: 14px;
          background: linear-gradient(135deg, #0A84FF, #5E5CE6);
          border: none; border-radius: 13px; color: #fff; cursor: pointer;
          font-weight: 800; font-size: 15px; font-family: inherit; letter-spacing: .01em;
          box-shadow: 0 10px 26px -8px rgba(10,132,255,.55);
          transition: transform .18s, box-shadow .18s, opacity .18s;
        }
        .lg-cta:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 14px 32px -8px rgba(10,132,255,.65); }
        .lg-cta:active:not(:disabled) { transform: translateY(0); }
        .lg-cta:disabled { opacity: .55; cursor: not-allowed; }
        .lg-note { font-size: 11px; color: #A5A5AD; text-align: center; margin-top: 18px; }

        /* ── Мобильный: дуэт складывается в столбик ── */
        @media (max-width: 880px) {
          .lg-page { padding: 0; align-items: stretch; }
          .lg-duo {
            flex-direction: column; max-width: none; min-height: 100vh;
            background: transparent; border: none; border-radius: 0; box-shadow: none;
          }
          .lg-brand { flex: none; padding: 42px 24px 14px; background: transparent; border-right: none; }
          .lg-brand-inner { text-align: center; }
          .lg-word { font-size: 40px; margin-top: 14px; }
          .lg-underline { margin: 8px auto 0; }
          .lg-feats { display: none; }
          .lg-wow { display: none; }
          .lg-side { flex: 1; align-items: flex-start; background: transparent; padding: 10px 22px 40px; }
          .lg-card {
            background: #fff; border: 1px solid rgba(20,20,40,.07); border-radius: 22px;
            padding: 26px 22px; max-width: 400px; margin: 0 auto;
            box-shadow: 0 22px 60px -18px rgba(20,20,40,.18);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-page * { animation-duration: .01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
