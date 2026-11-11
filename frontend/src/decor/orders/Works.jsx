// Карточка заказа → «Работы» (ТЗ «Декор, обновление 2», раздел 3): виды работ заказа и их чек-листы.
// Работу выбирают из стандартов (команда заказа, «оформлять заказы», учредитель) — шаги копируются в заказ.
// Бригада (сотрудник из команды заказа со своим входом) отмечает шаги на телефоне — крупные карточки, строго по порядку;
// шаг «нужно фото» без фото не отметить. Прогресс «7 из 12», кто и когда отметил шаг.
// Снять отметку — только с последнего отмеченного шага: тот, кто отметил, или учредитель.
import React, { useRef, useState } from 'react';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fts } from '../i18n.js';
import { useDecor, useLoad, useActions, Card, Chip, Loading, ItemPick } from '../kit.jsx';
import { Thumb, compressImage } from '../evidence.jsx';

const time = ts => { try { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };

export default function WorksTab({ o, onChanged }) {
  const { t, lang } = useT();
  const { toast } = useDecor();
  const [w, err, reload, setW] = useLoad(() => api.get(`/orders/${o.id}/works`).then(r => r.data), [o.id]);
  const [stds] = useLoad(() => api.get('/standards').then(r => r.data).catch(() => []), []);
  const actions = useActions();
  const busy = !!actions.busy;
  const [pick, setPick] = useState('');
  const [photos, setPhotos] = useState({});       // stepId → [{ file, url }]
  const fileRef = useRef(null);
  const forStep = useRef(null);
  if (!w) return <Card><Loading err={err} retry={reload} /></Card>;

  const act = async (aid, request, msg) => {
    try {
      const r = await actions.run(aid, request);
      if (r) { setW(r.data); if (msg) toast(msg); onChanged?.(); }
      return r;
    } catch (e) { toast(errText(e, t('error')), 'bad'); reload(); return null; }
  };
  const chosen = new Set(w.works.map(x => x.standard_id));
  const options = (stds || []).filter(s => !chosen.has(s.id)).map(s => ({ id: s.id, name: s.name, note: s.steps.length ? t('stdSteps', { n: s.steps.length }) : t('stdEmpty'), tone: s.steps.length ? '' : 'warn' }));
  const addWork = () => act(`work:add:${pick}`, cfg => api.post(`/orders/${o.id}/works`, { standard_id: Number(pick) }, cfg), t('wkAdded')).then(r => r && setPick(''));
  const removeWork = x => act(`work:del:${x.id}`, cfg => api.delete(`/orders/${o.id}/works/${x.id}`, cfg), t('wkRemoved', { name: x.name }));
  const takePhoto = stepId => { forStep.current = stepId; fileRef.current?.click(); };
  const onFile = async e => {
    const list = [...(e.target.files || [])].filter(f => /^image\//.test(f.type)); e.target.value = '';
    const id = forStep.current;
    if (!list.length || !id) return;
    const out = [];
    for (const f of list) { const c = await compressImage(f); out.push({ file: c, url: URL.createObjectURL(c) }); }
    setPhotos(p => ({ ...p, [id]: [...(p[id] || []), ...out].slice(0, 5) }));
    actions.reset(`step:${id}`);
  };
  const mark = async s => {
    const files = photos[s.id] || [];
    let body = {};
    if (files.length) { body = new FormData(); files.forEach(f => body.append('files', f.file, f.file.name || 'step.jpg')); }
    const r = await act(`step:${s.id}`, cfg => api.post(`/orders/${o.id}/steps/${s.id}/done`, body, cfg), t('wkStepDone', { n: s.position }));
    if (r) { files.forEach(f => URL.revokeObjectURL(f.url)); setPhotos(p => { const n = { ...p }; delete n[s.id]; return n; }); }
  };
  const undo = s => act(`undo:${s.id}`, cfg => api.post(`/orders/${o.id}/steps/${s.id}/undo`, {}, cfg), t('wkStepUndone', { n: s.position }));

  return <>
    <Card>
      <div className="dd-row dd-between"><h3>{t('wkTitle')}</h3>
        {w.total > 0 && <Chip tone={w.done === w.total ? 'ok' : 'blue'}>{t('wkProgress', { done: w.done, total: w.total })}</Chip>}</div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t(w.can_mark ? 'wkNoteMark' : 'wkNote')}</p>
      {w.can_choose && o.status !== 'closed' && (
        <div className="dd-row" style={{ gap: 8, marginTop: 10 }}>
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <ItemPick id="wk_pick" items={options} value={pick} placeholder={t('wkPick')} onChange={v => setPick(v === '' ? '' : String(v))} />
          </div>
          <button type="button" className="dd-btn" disabled={busy || !pick} onClick={addWork}><Icon name="plus" size={16} /> {t('wkAdd')}</button>
        </div>
      )}
      {!w.works.length && <div className="dd-empty">{t(stds?.length ? 'wkNone' : 'wkNoStandards')}</div>}
    </Card>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    {w.works.map(x => {
      const lastDone = [...x.steps].reverse().find(s => s.done);
      return (
        <Card key={x.id}>
          <div className="dd-row dd-between"><h3>{x.name}</h3>
            <div className="dd-row" style={{ gap: 6 }}>
              <Chip tone={x.done === x.total ? 'ok' : 'blue'}>{t('wkProgress', { done: x.done, total: x.total })}</Chip>
              {w.can_choose && x.done === 0 && o.status !== 'closed' && <button type="button" className="dd-btn ghost sm" disabled={busy} onClick={() => removeWork(x)} aria-label={t('remove')}><Icon name="x" size={14} /></button>}
            </div>
          </div>
          <div className="dd-progress" aria-hidden="true"><span style={{ width: `${x.total ? (x.done / x.total) * 100 : 0}%` }} /></div>
          <div className="dd-stepcards">
            {x.steps.map(s => {
              const next = x.next_step === s.id;
              const files = photos[s.id] || [];
              const canUndo = s.done && lastDone?.id === s.id && (w.is_owner || s.done_by?.id === w.me);
              return (
                <div key={s.id} className={`dd-stepcard ${s.done ? 'done' : next ? 'next' : 'locked'}`}>
                  <div className="dd-stepcard-head">
                    <span className="dd-stepno">{s.done ? <Icon name="check" size={18} /> : s.position}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="dd-steptext">{s.text}</div>
                      {s.photo_required && !s.done && <Chip tone="warn"><Icon name="camera" size={12} /> {t('stdNeedPhoto')}</Chip>}
                      {s.done && <div className="dd-sub">{t('wkDoneBy', { name: s.done_by?.name || '—', date: fts(s.done_at, lang), time: time(s.done_at) })}</div>}
                    </div>
                  </div>
                  {(s.sample_photo || s.files.length > 0) && (
                    <div className="dd-thumbs">
                      {s.sample_photo && !s.done && <div className="dd-thumb"><Thumb f={{ id: s.sample_photo, kind: 'image', original_name: t('stdSample') }} /><span className="dd-thumb-size">{t('stdSample')}</span></div>}
                      {s.files.map(f => <div key={f.id} className="dd-thumb"><Thumb f={f} /></div>)}
                    </div>
                  )}
                  {next && w.can_mark && o.status !== 'closed' && <>
                    {files.length > 0 && (
                      <div className="dd-thumbs">
                        {files.map((f, k) => (
                          <div key={f.url} className="dd-thumb"><img src={f.url} alt="" />
                            <button type="button" className="dd-thumb-x" aria-label={t('evRemove')}
                              onClick={() => { URL.revokeObjectURL(f.url); setPhotos(p => ({ ...p, [s.id]: files.filter((_, j) => j !== k) })); actions.reset(`step:${s.id}`); }}><Icon name="x" size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="dd-row" style={{ gap: 8 }}>
                      <button type="button" className="dd-btn ghost lg" disabled={busy} onClick={() => takePhoto(s.id)}><Icon name="camera" size={18} /> {t('wkPhoto')}</button>
                      <button type="button" className="dd-btn lg" disabled={busy || (s.photo_required && !files.length)} onClick={() => mark(s)}><Icon name="check" size={18} /> {t('wkMark')}</button>
                    </div>
                    {s.photo_required && !files.length && <div className="dd-note">{t('wkNeedPhoto')}</div>}
                  </>}
                  {!s.done && !next && <div className="dd-note">{t('wkLocked', { n: x.steps.find(y => y.id === x.next_step)?.position || 1 })}</div>}
                  {canUndo && o.status !== 'closed' && <button type="button" className="dd-btn ghost sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => undo(s)}><Icon name="undo" size={14} /> {t('wkUndo')}</button>}
                </div>
              );
            })}
          </div>
        </Card>
      );
    })}
  </>;
}
