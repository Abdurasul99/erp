// Настройки: «Доказательства» (требования к фото/видео по этапам, лимиты файлов, место под файлы — учредитель),
// «Полномочия» (должность × действие; меняет учредитель, у учредителя и ген. директора — всё), «Нормы расчёта» (курс,
// дней на объекте, транспорт, расходники, постоянные расходы, заказов в месяц — «менять настройки»; закрытые заказы не
// меняются — у них снимок), «Панель» (какие разделы видны в нижнем меню — учредитель). Каждое сохранение — с ключом повтора.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm2 } from '../i18n.js';
import { SECTIONS, useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, Stepper, Loading, NoAccess, numIn } from '../kit.jsx';
import { EV_STAGES, useEvidenceRules, setRulesCache, needText, evidenceError, mb } from '../evidence.jsx';

export default function Settings() {
  const { t } = useT();
  const { me, can } = useDecor();
  const [params, setParams] = useSearchParams();
  const owner = me.is_owner;
  const edit = owner || can('edit_settings');
  const tabs = [['evidence', t('stTabEvidence')], ...(edit ? [['perms', t('stTabPerms')]] : []), ...(edit || can('see_finance') ? [['norms', t('stTabNorms')]] : []), ['panel', t('stTabPanel')]];
  const tab = tabs.some(x => x[0] === params.get('tab')) ? params.get('tab') : 'evidence';
  return (
    <>
      <Hero id="settings" />
      <Tabs value={tab} onChange={k => setParams({ tab: k }, { replace: true })} items={tabs} />
      {tab === 'evidence' && <EvidenceTab />}
      {tab === 'perms' && <PermsTab />}
      {tab === 'norms' && <NormsTab />}
      {tab === 'panel' && <PanelTab />}
    </>
  );
}

// Общая обёртка сохранения: ключ повтора, сообщение, понятная ошибка
function useSave() {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const save = async (aid, fn, msg) => {
    try { const r = await actions.run(aid, fn); if (r && msg) toast(msg); return r; } catch (e) { toast(e?.response ? evidenceError(t, e) : t('noAnswer'), 'bad'); return null; }
  };
  return { save, actions, busy: !!actions.busy };
}

// ---------- Доказательства и файлы ----------
function EvidenceTab() {
  const { t } = useT();
  const { me, can } = useDecor();
  const rules = useEvidenceRules();
  const owner = me.is_owner;
  const [usage, , reloadUsage] = useLoad(() => (owner || can('edit_settings') ? api.get('/files/usage').then(r => r.data) : Promise.resolve(null)), [owner]);
  const { save, actions, busy } = useSave();
  const [f, setF] = useState(null);
  useEffect(() => { if (rules && !f) setF({ rules: rules.rules.map(r => ({ ...r })), photo: String(rules.photo_max_mb), video: String(rules.video_max_mb) }); }, [rules, f]);
  if (!rules || !f) return <Loading />;
  const setRule = (stage, p) => { setF({ ...f, rules: f.rules.map(r => (r.stage === stage ? { ...r, ...p } : r)) }); actions.reset('evRules'); };
  const setLim = p => { setF({ ...f, ...p }); actions.reset('evRules'); };
  const changed = JSON.stringify(f.rules) !== JSON.stringify(rules.rules) || Number(f.photo) !== rules.photo_max_mb || Number(f.video) !== rules.video_max_mb;
  const bad = f.rules.some(r => r.min_photos === 0 && !r.need_video) || !(Number(f.photo) >= 1 && Number(f.photo) <= 50) || !(Number(f.video) >= 1 && Number(f.video) <= 500);
  const go = async () => {
    const r = await save('evRules', cfg => api.put('/evidence/rules', { rules: f.rules, photo_max_mb: Number(f.photo), video_max_mb: Number(f.video) }, cfg), t('stEvSaved'));
    if (r) { setRulesCache(r.data); setF(null); }
  };
  const ro = !owner;
  return <>
    <Card>
      <div className="dd-row dd-between"><h3>{t('stEvTitle')}</h3>{ro ? <Chip tone="gray">{t('stOwnerOnly')}</Chip> : null}</div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('stEvNote')}</p>
      <div className="dd-lines" style={{ marginTop: 12 }}>
        {EV_STAGES.map(stage => {
          const r = f.rules.find(x => x.stage === stage);
          return (
            <div key={stage} className="dd-line">
              <div className="dd-line-head"><b>{t(`ev_${stage}`)}</b><Chip tone={r.min_photos === 0 && !r.need_video ? 'bad' : 'blue'}>{needText(t, r)}</Chip></div>
              <div className="dd-line-head">
                <div className="dd-row" style={{ gap: 10 }}>
                  <span className="dd-label">{t('stPhotos')}</span>
                  {ro ? <b>{r.min_photos}</b> : <Stepper value={r.min_photos} min={0} max={9} onChange={v => setRule(stage, { min_photos: Number(v) || 0 })} label={`${t(`ev_${stage}`)} · ${t('stPhotos')}`} />}
                </div>
                <label className="dd-row" style={{ gap: 8 }}><input type="checkbox" disabled={ro} checked={r.need_video} onChange={e => setRule(stage, { need_video: e.target.checked })} /> {t('stVideo')}</label>
              </div>
              {stage === 'final' && <label className="dd-row" style={{ gap: 8 }}><input type="checkbox" disabled={ro} checked={r.shortage_note} onChange={e => setRule(stage, { shortage_note: e.target.checked })} /> {t('stShortageNote')}</label>}
              {r.min_photos === 0 && !r.need_video && <div className="dd-warnline bad"><Icon name="alert" size={16} /> {t('stNeedOne')}</div>}
            </div>
          );
        })}
      </div>
    </Card>
    <Card>
      <h3>{t('stFilesTitle')}</h3>
      <div className="dd-form" style={{ marginTop: 10 }}>
        <div className="dd-field"><label htmlFor="st_ph">{t('stPhotoMax')}</label><input id="st_ph" className="dd-inp num" inputMode="numeric" disabled={ro} value={f.photo} onChange={e => setLim({ photo: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="dd-field"><label htmlFor="st_vd">{t('stVideoMax')}</label><input id="st_vd" className="dd-inp num" inputMode="numeric" disabled={ro} value={f.video} onChange={e => setLim({ video: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('stFilesNote')}</p>
      {usage && (
        <div style={{ marginTop: 12 }}>
          <div className="dd-eyebrow">{t('stUsage')}</div>
          <div className="dd-sum-line"><span>{t('stUsagePhotos', { n: usage.photos.files })}</span><b className="num">{mb(usage.photos.bytes)} {t('mbShort')}</b></div>
          <div className="dd-sum-line"><span>{t('stUsageVideos', { n: usage.videos.files })}</span><b className="num">{mb(usage.videos.bytes)} {t('mbShort')}</b></div>
          <div className="dd-sum-line strong"><span>{t('stUsageTotal')}</span><b className="num">{mb(usage.total_bytes)} {t('mbShort')}</b></div>
          <button type="button" className="dd-btn ghost sm" style={{ marginTop: 6 }} onClick={reloadUsage}>{t('stRefresh')}</button>
        </div>
      )}
    </Card>
    {!ro && <div className="dd-savebar"><button type="button" className="dd-btn lg" disabled={!changed || bad || busy} onClick={go}><Icon name="check" size={18} /> {t('saveBtn')}</button></div>}
  </>;
}

// ---------- Полномочия: должность × действие ----------
function PermsTab() {
  const { t } = useT();
  const { me, reloadMe } = useDecor();
  const [p, err, reload] = useLoad(() => api.get('/permissions').then(r => r.data), []);
  const { save, busy } = useSave();
  if (err?.response?.status === 403) return <NoAccess err={err} />;
  if (!p) return <Loading err={err} retry={reload} />;
  const toggle = async (position, action, allowed) => {
    const r = await save(`perm:${position}:${action}:${allowed}`, cfg => api.put('/permissions', { position, action, allowed }, cfg),
      t('stPermSaved', { pos: t(`r_${position}`), act: t(`pa_${action}`), state: t(allowed ? 'stOn' : 'stOff') }));
    if (r) { reload(); reloadMe(); }
  };
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('stPermsTitle')}</h3>{!me.is_owner && <Chip tone="gray">{t('stOwnerOnly')}</Chip>}</div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('stPermsNote')}</p>
      <div className="dd-tw" style={{ marginTop: 10 }}>
        <table className="dd-perms">
          <thead><tr><th>{t('stAction')}</th>{p.positions.map(pos => <th key={pos} style={{ textAlign: 'center' }}>{t(`r_${pos}`)}</th>)}</tr></thead>
          <tbody>{p.actions.map(a => (
            <tr key={a}><td>{t(`pa_${a}`)}</td>
              {p.positions.map(pos => {
                const on = p.matrix[pos][a];
                return <td key={pos} style={{ textAlign: 'center' }}>
                  <button type="button" role="switch" aria-checked={on} aria-label={`${t(`r_${pos}`)} · ${t(`pa_${a}`)}`} className={`dd-switch ${on ? 'on' : ''}`}
                    disabled={!me.is_owner || busy} onClick={() => toggle(pos, a, !on)}><span /></button>
                </td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Нормы расчёта ----------
const NORMS = [
  ['rate_uzs', 'stRate', 'uzs'], ['days_on_site', 'stDays', 'int'], ['transport_usd', 'stTransport', 'usd'], ['consumables_uzs', 'stConsumables', 'uzs'],
  ['target_usd', 'stTarget', 'usd'], ['repair_uzs', 'stRepair', 'uzs'], ['other_fixed_usd', 'stOtherFixed', 'usd'], ['expected_orders', 'stExpected', 'int'],
];
function NormsTab() {
  const { t } = useT();
  const { me, can, reloadMe } = useDecor();
  const [s, err, reload] = useLoad(() => api.get('/settings').then(r => r.data), []);
  const { save, actions, busy } = useSave();
  const [f, setF] = useState(null);
  useEffect(() => { if (s && !f) setF(Object.fromEntries(NORMS.map(([k]) => [k, String(s[k] ?? '')]))); }, [s, f]);
  if (!s || !f) return <Loading err={err} retry={reload} />;
  const ro = !(me.is_owner || can('edit_settings'));
  const set = p => { setF({ ...f, ...p }); actions.reset('norms'); };
  const diff = Object.fromEntries(NORMS.filter(([k]) => f[k] !== '' && Number(f[k]) !== s[k]).map(([k]) => [k, Number(f[k])]));
  const go = async () => {
    const r = await save('norms', cfg => api.put('/settings', diff, cfg), t('stNormsSaved'));
    if (r) { setF(null); reload(); reloadMe(); }
  };
  return <>
    <Card>
      <h3>{t('stNormsTitle')}</h3>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('stNormsNote')}</p>
      <div className="dd-form" style={{ marginTop: 12 }}>
        {NORMS.map(([k, label, kind]) => (
          <div key={k} className="dd-field"><label htmlFor={`n_${k}`}>{t(label)}</label>
            <input id={`n_${k}`} className="dd-inp num" inputMode={kind === 'int' ? 'numeric' : 'decimal'} disabled={ro} value={f[k]}
              onChange={e => set({ [k]: kind === 'int' ? e.target.value.replace(/\D/g, '') : numIn(e.target.value) })} /></div>
        ))}
      </div>
      {s.fixed_monthly_usd !== undefined && (
        <div style={{ marginTop: 12 }}>
          <div className="dd-sum-line"><span>{t('stFixedMonthly')}</span><b className="num">{fm2(s.fixed_monthly_usd)}</b></div>
          <div className="dd-sum-line strong"><span>{t('stFixedShare')}</span><b className="num">{fm2(s.fixed_share_usd)}</b></div>
        </div>
      )}
    </Card>
    {!ro && <div className="dd-savebar"><button type="button" className="dd-btn lg" disabled={!Object.keys(diff).length || busy} onClick={go}><Icon name="check" size={18} /> {t('saveBtn')}</button></div>}
  </>;
}

// ---------- Панель: какие разделы видны в нижнем меню у всех ----------
const PANEL = ['tools', 'orders', 'calc', 'booking', 'decor', 'finance', 'team', 'reports', 'ai'];
function PanelTab() {
  const { t } = useT();
  const { me, reloadMe } = useDecor();
  const { save, busy } = useSave();
  const off = me.panel_off || [];
  const toggle = async id => {
    const next = off.includes(id) ? off.filter(x => x !== id) : [...off, id];
    const r = await save(`panel:${next.sort().join(',')}`, cfg => api.put('/settings/panel', { panel_off: next }, cfg), t('stPanelSaved'));
    if (r) reloadMe();
  };
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('stPanelTitle')}</h3>{!me.is_owner && <Chip tone="gray">{t('stOwnerOnly')}</Chip>}</div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('stPanelNote')}</p>
      <div className="dd-lines" style={{ marginTop: 10 }}>
        {PANEL.map(id => {
          const s = SECTIONS.find(x => x !== '|' && x.id === id);
          const featOff = s.feature && !me.features.includes(s.feature);
          const on = !off.includes(id);
          return (
            <div key={id} className="dd-line">
              <div className="dd-line-head"><b>{t(`s_${id}`)}</b>
                {featOff ? <Chip tone="gray">{t('stFeatureOff')}</Chip> : (
                  <button type="button" role="switch" aria-checked={on} aria-label={t(`s_${id}`)} className={`dd-switch ${on ? 'on' : ''}`} disabled={!me.is_owner || busy} onClick={() => toggle(id)}><span /></button>
                )}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
