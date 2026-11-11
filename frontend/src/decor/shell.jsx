// Оболочка «Декора» как в Wave: вход, верхняя панель (поиск Ctrl K), нижний плавающий док, «Инструменты». Главная — home/Home.jsx.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { TOKEN_KEY, USER_KEY, COMPANY_KEY, store, errText } from './api.js';
import { ValuesBar } from './values.jsx';
import Icon from './icons.jsx';
import { useT, fday, fm, LANGS } from './i18n.js';
import { SECTIONS, useDecor, Tile, Hero, Sheet, StatusChip } from './kit.jsx';

const LABEL = id => `s_${id === 'decor' ? 'decor' : id}`;
const visible = (s, me) => s !== '|' && (!s.feature || me.features.includes(s.feature))
  && (!s.perm || me.permissions.includes(s.perm)) && !(me.panel_off || []).includes(s.id);
// Текущий раздел по адресу /decor/<path>
export function useSection() {
  const loc = useLocation();
  const seg = loc.pathname.replace(/^\/decor\/?/, '').split('/')[0] || '';
  return SECTIONS.find(s => s !== '|' && s.path === seg)?.id || 'home';
}

// RU · UZ (латиница) · ЎЗ (кириллица)
const LANG_LABELS = { ru: 'RU', uz: 'UZ', uzc: 'ЎЗ' };
function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="dd-lang" role="group" aria-label="Язык · Til · Тил">
      {LANGS.map(l => (
        <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_LABELS[l]}</button>
      ))}
    </div>
  );
}

export function TopBar({ hints }) {
  const { t } = useT();
  const { me, logout } = useDecor();
  const nav = useNavigate();
  const cur = useSection();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  useEffect(() => {   // Ctrl K / ⌘K — поиск заказа
    const k = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const name = me.user.first_name || me.user.username;
  const initials = name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <>
      <header className="dd-top">
        <button type="button" className="dd-brand" onClick={() => nav('/decor')}>
          <div className="dd-logo">D</div>
          <div style={{ minWidth: 0 }}><b>{me.user.company_name}</b><small>{t('erp')} · {t(`r_${me.user.role}`)}</small></div>
        </button>
        <div className="dd-crumb">{t(LABEL(cur))}</div>
        <div className="dd-spacer" />
        <button type="button" className="dd-pill" onClick={() => setSearch(true)}><Icon name="search" size={16} /> {t('search')} <span className="dd-chip gray">Ctrl K</span></button>
        <button type="button" className="dd-icon-btn dd-search-ic" onClick={() => setSearch(true)} aria-label={t('search')} title={t('search')}><Icon name="search" size={18} /></button>
        <LangToggle />
        {me.features.includes('decor-ai') && (
          <button type="button" className="dd-icon-btn ai" onClick={() => nav('/decor/ai')} aria-label={t('ai')} title={t('ai')}><Icon name="spark" size={18} /></button>
        )}
        <button type="button" className="dd-icon-btn" onClick={() => nav('/decor/ai')} aria-label={t('notifications')} title={t('notifications')}>
          <Icon name="bell" size={18} />{hints > 0 && <span className="dd-badge">{hints}</span>}
        </button>
        <button type="button" className="dd-user" onClick={() => setMenu(v => !v)} aria-haspopup="menu">
          <div className="dd-avatar">{initials}</div>
          <div className="dd-user-text"><b>{name}</b><small>{me.user.branch_name || me.user.company_name}</small></div>
        </button>
        {menu && (
          <div className="dd-menu" role="menu" onMouseLeave={() => setMenu(false)}>
            <button type="button" role="menuitem" onClick={logout}><Icon name="logout" size={18} /> {t('logout')}</button>
          </div>
        )}
      </header>
      {/* окно — вне шапки: у шапки backdrop-filter, и fixed внутри неё центрировалось бы по шапке */}
      {search && <SearchSheet onClose={() => setSearch(false)} />}
    </>
  );
}

// Поиск заказа по номеру, клиенту, телефону, адресу → карточка заказа (/decor/orders?open=<id>)
function SearchSheet({ onClose }) {
  const { t, lang } = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const s = q.trim();
    if (!s) { setRes(null); setErr(''); return undefined; }
    let alive = true;
    const tm = setTimeout(() => api.get('/orders', { params: { q: s } })
      .then(r => { if (alive) { setRes(r.data.slice(0, 20)); setErr(''); } })
      .catch(e => { if (alive) setErr(errText(e, t('error'))); }), 250);
    return () => { alive = false; clearTimeout(tm); };
  }, [q, t]);
  const go = id => { onClose(); nav(`/decor/orders?open=${id}`); };
  return (
    <Sheet title={t('searchTitle')} onClose={onClose}>
      <input className="dd-inp" autoFocus value={q} placeholder={t('searchPh')} aria-label={t('searchPh')} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && res?.length) go(res[0].id); }} />
      {err ? <div className="dd-err" style={{ marginTop: 10 }}>{err}</div>
        : !res ? <div className="dd-note" style={{ marginTop: 10 }}>{t('searchHint')}</div>
          : !res.length ? <div className="dd-empty">{t('searchEmpty')}</div>
            : (
              <div className="dd-lines" style={{ marginTop: 10 }}>
                {res.map(o => (
                  <button key={o.id} type="button" className="dd-line dd-line-btn" onClick={() => go(o.id)}>
                    <div className="dd-line-head"><b>{o.no} · {o.client}</b><StatusChip status={o.status} /></div>
                    <div className="dd-nums"><span>{fday(o.event_date, lang)}</span>{o.phone && <span>{o.phone}</span>}{o.price_usd > 0 && <span><b>{fm(o.price_usd)}</b></span>}</div>
                  </button>
                ))}
              </div>
            )}
    </Sheet>
  );
}

export function Dock() {
  const { t } = useT();
  const { me } = useDecor();
  const nav = useNavigate();
  const cur = useSection();
  const list = SECTIONS.filter((s, i, a) => (s === '|' ? a[i - 1] !== '|' : visible(s, me)));
  return (
    <div className="dd-dockwrap">
      <nav className="dd-dock" aria-label={t('departments')}>
        {list.map((s, k) => (s === '|' ? <span key={`sep${k}`} className="dd-dsep" /> : (
          <button key={s.id} type="button" className={`dd-dk ${cur === s.id ? 'on' : ''}`} onClick={() => nav(`/decor/${s.path}`)} aria-current={cur === s.id ? 'page' : undefined}>
            <Tile g={s.g} i={s.i} size={52} icon={24} /><span>{t(LABEL(s.id))}</span>
          </button>
        )))}
      </nav>
    </div>
  );
}

export function Tools() {
  const { t } = useT();
  const { me } = useDecor();
  const nav = useNavigate();
  return (
    <>
      <Hero id="tools" />
      <div className="dd-grid dd-g3">
        {SECTIONS.filter(s => s !== '|' && s.id !== 'home' && s.id !== 'tools' && visible(s, me)).map(s => (
          <button key={s.id} type="button" className="dd-card dd-tool" onClick={() => nav(`/decor/${s.path}`)}>
            <Tile g={s.g} i={s.i} />
            <div><h3>{t(`t_${s.id}`)}</h3><div className="dd-sub">{t(`d_${s.id}`)}</div></div>
          </button>
        ))}
      </div>
    </>
  );
}

export function Login() {
  const { t } = useT();
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // «Кадрият» на странице входа (ТЗ обновление 2): ценности компании, из которой уже входили на этом устройстве
  const [values, setValues] = useState(null);
  const loadValues = () => api.get('/public/values', { params: { company: store.get(COMPANY_KEY) || undefined } }).then(r => setValues(r.data.values)).catch(() => {});
  useEffect(() => { loadValues(); }, []);
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const { data } = await api.post('/auth/login', f);
      store.set(TOKEN_KEY, data.token); store.set(USER_KEY, JSON.stringify(data.user)); store.set(COMPANY_KEY, String(data.user.company_id));
      window.location.href = '/decor';
    } catch (ex) { setErr(errText(ex, t('error'))); setBusy(false); }
  };
  return (
    <div className="dd dd-login">
      <div className="dd-login-col">
      <form className="dd-card" onSubmit={submit}>
        <div className="dd-row dd-between"><div className="dd-logo">D</div><LangToggle /></div>
        <div><h2 style={{ fontSize: 22, fontWeight: 900 }}>{t('loginTitle')}</h2><div className="dd-sub">Wave · {t('sphereName')}</div></div>
        <div className="dd-field"><label htmlFor="dl_u">{t('username')}</label>
          <input id="dl_u" className="dd-inp" autoComplete="username" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></div>
        <div className="dd-field"><label htmlFor="dl_p">{t('password')}</label>
          <input id="dl_p" className="dd-inp" type="password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
        {err && <div className="dd-err">{err}</div>}
        <button type="submit" className="dd-btn lg" disabled={busy || !f.username || !f.password}>{t('enter')}</button>
      </form>
      <ValuesBar values={values} refresh={loadValues} />
      </div>
    </div>
  );
}

export const logoutNow = () => { store.del(TOKEN_KEY); store.del(USER_KEY); window.location.href = '/decor/login'; };
