// «Управление» → «Стандарты работ» (ТЗ «Декор, обновление 2», раздел 3): библиотека пошаговых чек-листов
// (вход, стол, стена из ткани, тент…). Создаёт и меняет — «менять стандарты работ» (учредитель — всегда);
// стандарт создаётся пустым, шаги пишет учредитель: текст, фото-образец, «нужно фото». Остальные смотрят.
// Изменение стандарта не меняет уже выбранные в заказах чек-листы — шаги копируются в заказ при выборе.
import React, { useRef, useState } from 'react';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT } from '../i18n.js';
import { useDecor, useLoad, useActions, Card, Chip, Sheet, Loading } from '../kit.jsx';
import { Thumb, compressImage } from '../evidence.jsx';

export function StandardsTab() {
  const { t } = useT();
  const { can } = useDecor();
  const manage = can('edit_standards');
  const [archive, setArchive] = useState(false);
  const [list, err, reload] = useLoad(() => api.get('/standards', { params: { all: 1 } }).then(r => r.data), []);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  if (!list) return <Card><Loading err={err} retry={reload} /></Card>;
  const shown = list.filter(s => s.active !== archive);
  const cur = open ? list.find(s => s.id === open) : null;
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('stdTitle')}</h3>
        <div className="dd-row" style={{ gap: 8 }}>
          {(archive || list.some(s => !s.active)) && <button type="button" className="dd-btn ghost sm" onClick={() => setArchive(v => !v)}>{archive ? t('designsActive') : t('designsArchive')}</button>}
          {manage && !archive && <button type="button" className="dd-btn sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> {t('stdNew')}</button>}
        </div>
      </div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('stdNote')}</p>
      {!shown.length ? <div className="dd-empty">{archive ? t('designsNoArchive') : t(manage ? 'stdNoneOwner' : 'stdNone')}</div> : (
        <div className="dd-lines" style={{ marginTop: 10 }}>
          {shown.map(s => (
            <button key={s.id} type="button" className="dd-line dd-line-btn" onClick={() => setOpen(s.id)}>
              <div className="dd-line-head"><b>{s.name}</b>
                {s.steps.length ? <Chip tone="blue">{t('stdSteps', { n: s.steps.length })}</Chip> : <Chip tone="warn">{t('stdEmpty')}</Chip>}</div>
              {s.photo_steps > 0 && <div className="dd-sub">{t('stdPhotoSteps', { n: s.photo_steps })}</div>}
              {s.steps.length > 0 && <div className="dd-sub dd-design-lines">{s.steps.map(x => `${x.position}. ${x.text}`).join(' · ')}</div>}
            </button>
          ))}
        </div>
      )}
      {creating && <NewStandard onClose={() => setCreating(false)} onCreated={s => { setCreating(false); reload(); setOpen(s.id); }} />}
      {cur && <StandardSheet key={cur.id} std={cur} manage={manage} onClose={() => setOpen(null)} onSaved={reload} />}
    </Card>
  );
}

function NewStandard({ onClose, onCreated }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [name, setName] = useState('');
  const create = async () => {
    try { const r = await actions.run(`std:${name}`, cfg => api.post('/standards', { name: name.trim() }, cfg)); if (r) { toast(t('stdCreated', { name: r.data.name })); onCreated(r.data); } }
    catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  return (
    <Sheet title={t('stdNew')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !name.trim()} onClick={create}><Icon name="check" size={18} /> {t('tkCreate')}</button></>}>
      <div className="dd-field"><label htmlFor="std_name">{t('stdName')}</label>
        <input id="std_name" className="dd-inp" maxLength={160} autoFocus value={name} placeholder={t('stdNamePh')} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && create()} /></div>
      <p className="dd-note">{t('stdNewNote')}</p>
    </Sheet>
  );
}

let seq = 0;
function StandardSheet({ std, manage, onClose, onSaved }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const busy = !!actions.busy;
  const edit = manage && std.active;
  const [name, setName] = useState(std.name);
  const [steps, setSteps] = useState(() => std.steps.map(s => ({ key: ++seq, text: s.text, photo_required: s.photo_required, sample_photo: s.sample_photo })));
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef(null);
  const target = useRef(null);
  const set = (key, p) => { setSteps(steps.map(s => (s.key === key ? { ...s, ...p } : s))); actions.reset('std'); };
  const move = (i, d) => { const n = [...steps]; [n[i], n[i + d]] = [n[i + d], n[i]]; setSteps(n); actions.reset('std'); };
  const clean = steps.map(s => ({ text: s.text.trim(), photo_required: s.photo_required, sample_photo: s.sample_photo || null }));
  const orig = JSON.stringify(std.steps.map(s => ({ text: s.text, photo_required: s.photo_required, sample_photo: s.sample_photo || null })));
  const changed = name.trim() !== std.name || JSON.stringify(clean) !== orig;
  const bad = !name.trim() || clean.some(s => !s.text);
  const run = async (aid, request, msg) => {
    try { const r = await actions.run(aid, request); if (r) { toast(msg); onSaved(); } return r; } catch (e) { toast(errText(e, t('error')), 'bad'); return null; }
  };
  const save = () => run('std', cfg => api.put(`/standards/${std.id}`, { name: name.trim(), steps: clean }, cfg), t('stdSaved', { name: name.trim() }));
  const setActive = async on => { const r = await run(`std:active:${on}`, cfg => api.put(`/standards/${std.id}`, { active: on }, cfg), t(on ? 'designRestored' : 'designArchived', { name: std.name })); if (r) onClose(); };
  const pickSample = key => { target.current = key; fileRef.current?.click(); };
  const upload = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    const key = target.current;
    if (!file || !/^image\//.test(file.type)) return;
    setUploading(key);
    try {
      const c = await compressImage(file);
      const fd = new FormData(); fd.append('files', c, c.name || 'sample.jpg');
      const r = await actions.run(`sample:${key}:${file.name}:${file.size}`, cfg => api.post(`/standards/${std.id}/sample`, fd, cfg));
      if (r) set(key, { sample_photo: r.data.file_id });
    } catch (ex) { toast(errText(ex, t('error')), 'bad'); } finally { setUploading(null); }
  };
  const footer = <>
    <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
    {manage && <button type="button" className="dd-btn ghost lg" disabled={busy} onClick={() => setActive(!std.active)}>{t(std.active ? 'designArchive' : 'designRestore')}</button>}
    {edit && <button type="button" className="dd-btn lg" disabled={busy || bad || !changed} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>}
  </>;
  return (
    <Sheet title={std.name} onClose={onClose} footer={footer}>
      {edit && <div className="dd-field"><label htmlFor="std_n">{t('stdName')}</label>
        <input id="std_n" className="dd-inp" maxLength={160} value={name} onChange={e => { setName(e.target.value); actions.reset('std'); }} /></div>}
      <p className="dd-note">{t('stdCopyNote')}</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
      {!steps.length && <div className="dd-empty">{t(edit ? 'stdNoStepsOwner' : 'stdNoSteps')}</div>}
      <div className="dd-lines" style={{ gridTemplateColumns: 'none' }}>
        {steps.map((s, i) => (
          <div key={s.key} className="dd-line">
            <div className="dd-line-head"><b>{t('stdStepN', { n: i + 1 })}</b>
              {edit ? (
                <div className="dd-row" style={{ gap: 6 }}>
                  <button type="button" className="dd-btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp')}>↑</button>
                  <button type="button" className="dd-btn ghost sm" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown')}>↓</button>
                  <button type="button" className="dd-btn ghost sm" onClick={() => { setSteps(steps.filter(x => x.key !== s.key)); actions.reset('std'); }} aria-label={t('remove')}><Icon name="x" size={14} /></button>
                </div>
              ) : s.photo_required && <Chip tone="warn">{t('stdNeedPhoto')}</Chip>}
            </div>
            {edit ? <>
              <textarea className="dd-inp dd-textarea" rows={2} maxLength={2000} value={s.text} placeholder={t('stdStepPh')} aria-label={t('stdStepN', { n: i + 1 })}
                onChange={e => set(s.key, { text: e.target.value })} />
              <div className="dd-row" style={{ gap: 8 }}>
                <button type="button" className={`dd-toggle ${s.photo_required ? 'on' : ''}`} aria-pressed={s.photo_required} onClick={() => set(s.key, { photo_required: !s.photo_required })}>
                  <Icon name="camera" size={14} /> {t('stdNeedPhoto')}</button>
                <button type="button" className="dd-btn ghost sm" disabled={busy || uploading === s.key} onClick={() => pickSample(s.key)}>
                  {uploading === s.key ? t('evCompressing') : t(s.sample_photo ? 'stdSampleChange' : 'stdSampleAdd')}</button>
                {s.sample_photo && <button type="button" className="dd-btn ghost sm" onClick={() => set(s.key, { sample_photo: null })}>{t('stdSampleRemove')}</button>}
              </div>
            </> : <div style={{ whiteSpace: 'pre-line' }}>{s.text}</div>}
            {s.sample_photo && <div className="dd-thumbs"><div className="dd-thumb"><Thumb f={{ id: s.sample_photo, kind: 'image', original_name: t('stdSample') }} /></div></div>}
          </div>
        ))}
      </div>
      {edit && <button type="button" className="dd-btn ghost" style={{ alignSelf: 'flex-start' }}
        onClick={() => { setSteps([...steps, { key: ++seq, text: '', photo_required: false, sample_photo: null }]); actions.reset('std'); }}>
        <Icon name="plus" size={16} /> {t('stdAddStep')}</button>}
    </Sheet>
  );
}
