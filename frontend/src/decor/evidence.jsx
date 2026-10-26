// Доказательства (фото/видео) — обязательны (D24): требования компании по этапам, сжатие фото на телефоне перед
// отправкой, выбор фото/видео с подсказкой «нужно ещё 2 фото и видео», статус по этапам заказа, миниатюры файлов.
// Сжатие — один раз при выборе: повтор после обрыва связи отправит те же файлы с тем же ключом (сервер узнает повтор).
import React, { useEffect, useRef, useState } from 'react';
import api, { errText } from './api.js';
import Icon from './icons.jsx';
import { useT } from './i18n.js';
import { Chip, Sheet } from './kit.jsx';

export const EV_STAGES = ['issue', 'install', 'acceptance', 'dismantle', 'final', 'handover'];
const DEFAULT_RULE = { min_photos: 1, need_video: false, shortage_note: false };

// ---------- Требования компании: один запрос на всё приложение, обновляются после сохранения в Настройках ----------
let cache = null; let pending = null;
const subs = new Set();
export function loadRules(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending || force) {
    pending = api.get('/evidence/rules').then(r => { cache = r.data; pending = null; subs.forEach(f => f(cache)); return cache; })
      .catch(e => { pending = null; throw e; });
  }
  return pending;
}
export function setRulesCache(data) { cache = data; subs.forEach(f => f(cache)); }
export function useEvidenceRules() {
  const [r, setR] = useState(cache);
  useEffect(() => { subs.add(setR); if (!cache) loadRules().catch(() => {}); return () => { subs.delete(setR); }; }, []);
  return r;
}
export const ruleOf = (rules, stage) => rules?.rules?.find(r => r.stage === stage) || DEFAULT_RULE;

// ---------- Чего не хватает (то же правило, что на сервере: formulas.evidenceGap) ----------
const kindOf = f => f.kind || ((f.type || f.mime || '').startsWith('video') ? 'video' : (f.type || f.mime || '').startsWith('image') ? 'image' : null);
export function gapOf(rule, files, { shortage = false, comment = '' } = {}) {
  const photos = files.filter(f => kindOf(f) === 'image').length;
  const videos = files.filter(f => kindOf(f) === 'video').length;
  const noteNeeded = Boolean(rule.shortage_note && shortage && !String(comment || '').trim());
  const needPhotos = rule.min_photos + (noteNeeded ? 1 : 0);
  const missPhotos = Math.max(0, needPhotos - photos);
  const missVideo = Boolean(rule.need_video) && videos === 0;
  return { ok: missPhotos === 0 && !missVideo, missing: { photos: missPhotos, video: missVideo, note: noteNeeded && missPhotos > 0 },
    need: { photos: needPhotos, video: Boolean(rule.need_video) }, have: { photos, videos } };
}
// «нужно ещё 2 фото и видео» / «нужно ещё 1 фото или комментарий о недостаче»
export function missingText(t, missing) {
  const parts = [];
  if (missing.photos > 0) parts.push(t('evPhotosN', { n: missing.photos }));
  if (missing.video) parts.push(t('evVideo'));
  return t('evNeedMore', { list: parts.join(t('evAnd')) }) + (missing.note ? t('evOrNote') : '');
}
// «нужно: 3 фото + видео»
export function needText(t, rule) {
  const parts = [];
  if (rule.min_photos > 0) parts.push(t('evPhotosN', { n: rule.min_photos }));
  if (rule.need_video) parts.push(t('evVideo'));
  return t('evNeed', { list: parts.join(' + ') });
}
// Ответ сервера → понятный текст на языке экрана (не хватает фото, файл больше лимита, остальное — как есть)
export function evidenceError(t, e) {
  const d = e?.response?.data;
  if (!e?.response) return t('noAnswer');
  if (d?.code === 'evidence' && d.missing) return `${t('evRejected')}: ${missingText(t, d.missing)}`;
  if (d?.code === 'file_too_big' && d.limit_mb) return t('fileTooBig', { kind: t(d.kind === 'video' ? 'evVideoCap' : 'evPhotoCap'), name: d.name, size: String(d.size_mb).replace('.', ','), limit: d.limit_mb });
  return errText(e, t('error'));
}
export const mb = bytes => (bytes / 1048576).toFixed(1).replace('.', ',');
// Размер файла: до 1 МБ — в КБ, дальше — в МБ
export const sizeText = (t, bytes) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} ${t('kbShort')}` : `${mb(bytes)} ${t('mbShort')}`);

// ---------- Сжатие фото: длинная сторона до 1920 px, JPEG 80%; если не вышло меньше — исходный файл ----------
const MAX_SIDE = 1920;
async function decode(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch { /* ниже — через <img> */ } }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
export async function compressImage(file) {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return file;
  try {
    const img = await decode(file);
    const w = img.width; const h = img.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    if (scale === 1 && file.size < 600 * 1024) return file;          // и так маленькое
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${(file.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch { return file; }
}

// Форма для отправки: поля (списки — JSON) + выбранные файлы
export function evForm(fields, files) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  for (const f of files) fd.append('files', f.file, f.file.name);
  return fd;
}
// Файлы больше лимитов компании (показываются красным, кнопка отправки недоступна)
export const tooBig = (rules, f) => f.size > (kindOf(f) === 'video' ? (rules?.video_max_mb ?? 100) : (rules?.photo_max_mb ?? 10)) * 1048576;

// ---------- Выбор фото и видео: «Снять фото», «Видео», «Из галереи»; требование этапа и что уже есть ----------
// files — [{ file, kind, url, size, original }]; onChange(files) — родитель сбрасывает ключ действия (новые данные)
export function EvidencePicker({ stage, files, onChange, shortage = false, comment = '', compact = false }) {
  const { t } = useT();
  const rules = useEvidenceRules();
  const rule = ruleOf(rules, stage);
  const gap = gapOf(rule, files, { shortage, comment });
  const [working, setWorking] = useState(false);
  const inputs = { photo: useRef(null), video: useRef(null), gallery: useRef(null) };
  const add = async list => {
    setWorking(true);
    const out = [];
    for (const f of list) {
      if (!/^(image|video)\//.test(f.type)) continue;
      const c = f.type.startsWith('image/') ? await compressImage(f) : f;
      out.push({ file: c, kind: c.type.startsWith('video/') ? 'video' : 'image', url: URL.createObjectURL(c), size: c.size, original: f.size, name: c.name });
    }
    setWorking(false);
    onChange([...files, ...out].slice(0, 10));
  };
  const remove = i => { URL.revokeObjectURL(files[i].url); onChange(files.filter((_, k) => k !== i)); };
  const pick = (ref) => ref.current?.click();
  const onInput = e => { const l = [...(e.target.files || [])]; e.target.value = ''; if (l.length) add(l); };
  const big = files.filter(f => tooBig(rules, f));
  return (
    <div className="dd-evpick">
      <div className="dd-row dd-between" style={{ gap: 8 }}>
        <span className="dd-label">{t('evTitle')} · {needText(t, rule)}{rule.shortage_note && shortage ? ` ${t('evShortageRule')}` : ''}</span>
        {gap.ok && !big.length ? <Chip tone="ok">✓ {t('evComplete')}</Chip> : <Chip tone="warn">{missingText(t, gap.missing)}</Chip>}
      </div>
      <div className="dd-row" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="dd-btn ghost" onClick={() => pick(inputs.photo)} disabled={working || files.length >= 10}><Icon name="camera" size={18} /> {t('evShoot')}</button>
        {(rule.need_video || !compact) && <button type="button" className="dd-btn ghost" onClick={() => pick(inputs.video)} disabled={working || files.length >= 10}>▶ {t('evShootVideo')}</button>}
        <button type="button" className="dd-btn ghost" onClick={() => pick(inputs.gallery)} disabled={working || files.length >= 10}><Icon name="grid" size={18} /> {t('evGallery')}</button>
        <input ref={inputs.photo} type="file" accept="image/*" capture="environment" hidden onChange={onInput} />
        <input ref={inputs.video} type="file" accept="video/*" capture="environment" hidden onChange={onInput} />
        <input ref={inputs.gallery} type="file" accept="image/*,video/*" multiple hidden onChange={onInput} />
      </div>
      {working && <div className="dd-note" style={{ marginTop: 6 }}>{t('evCompressing')}</div>}
      {files.length > 0 && (
        <div className="dd-thumbs" style={{ marginTop: 10 }}>
          {files.map((f, i) => (
            <div key={f.url} className={`dd-thumb ${tooBig(rules, f) ? 'big' : ''}`}>
              {f.kind === 'image' ? <img src={f.url} alt="" /> : <div className="dd-vid">▶</div>}
              <span className="dd-thumb-size">{sizeText(t, f.size)}{f.original > f.size ? ` · ${t('evCompressed')}` : ''}</span>
              <button type="button" className="dd-thumb-x" onClick={() => remove(i)} aria-label={t('evRemove')}><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {big.length > 0 && <div className="dd-warnline bad" style={{ marginTop: 8 }}><Icon name="alert" size={16} /> {t('evTooBigLocal', { photo: rules?.photo_max_mb ?? 10, video: rules?.video_max_mb ?? 100 })}</div>}
    </div>
  );
}
// Можно отправлять: комплект полный и нет файлов больше лимита
export function useEvidenceReady(stage, files, opts) {
  const rules = useEvidenceRules();
  const gap = gapOf(ruleOf(rules, stage), files, opts);
  return gap.ok && !files.some(f => tooBig(rules, f));
}
// Освободить ссылки на превью при закрытии окна
export const dropFiles = files => files.forEach(f => f.url && URL.revokeObjectURL(f.url));

// ---------- Миниатюра файла с сервера (по токену компании, через blob) ----------
export function Thumb({ f }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null; let alive = true;
    api.get(`/files/${f.id}`, { responseType: 'blob' }).then(r => { u = URL.createObjectURL(r.data); if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [f.id]);
  if (f.kind === 'image') return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={f.original_name || ''} /></a> : <div className="dd-vid" style={{ background: 'var(--surface2)' }} />;
  return <a className="dd-vid" href={url || '#'} target="_blank" rel="noreferrer">▶ {f.original_name || 'video'}</a>;
}

// ---------- Доказательства по этапам заказа: есть / не хватает / ждёт одобрения ----------
const STATE_TONE = { ok: 'ok', missing: 'bad', pending: 'blue', na: 'gray' };
export function EvidenceStatus({ list, onAdd }) {
  const { t } = useT();
  return (
    <div className="dd-evlist">
      {list.map(e => (
        <div key={e.stage} className={`dd-check ${e.state === 'na' ? 'na' : ''}`}>
          <span>{t(`ev_${e.stage}`)}{!e.blocking && e.applicable ? <span className="dd-note"> · {t('evInfoOnly')}</span> : null}</span>
          <span className="dd-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            {e.stage === 'handover' && e.applicable && <span className="dd-note">{t('evReceipts', { done: e.done, total: e.total })}</span>}
            {e.state === 'missing' && e.missing && e.stage !== 'handover' && <span className="dd-note">{e.unlinked > 0 && e.missing.photos === 0 && !e.missing.video ? t('evNoOwn') : missingText(t, e.missing)}</span>}
            <Chip tone={STATE_TONE[e.state]}>{t(`evs_${e.state}`)}</Chip>
            {e.state === 'missing' && onAdd && ['issue', 'final'].includes(e.stage) && <button type="button" className="dd-btn ghost sm" onClick={() => onAdd(e.stage)}>{t('evAdd')}</button>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Окно действия с фото: «Сдал кассиру», «Добавить фото чека», «Добавить доказательства» ----------
// send(files, comment) → промис запроса (через useActions); aid — id действия: правка файлов или комментария = новый ключ
export function EvidenceSheet({ title, note, stage, shortage = false, commentPh, busy, actions, aid, send, onClose }) {
  const { t } = useT();
  const [files, setFilesRaw] = useState([]);
  const [comment, setCommentRaw] = useState('');
  const setFiles = v => { setFilesRaw(v); actions.reset(aid); };
  const setComment = v => { setCommentRaw(v); actions.reset(aid); };
  const ready = useEvidenceReady(stage, files, { shortage, comment });
  const close = () => { dropFiles(files); onClose(); };
  const go = async () => { const r = await send(files, comment); if (r) close(); };
  return (
    <Sheet title={title} onClose={close} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={close}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={busy || !ready} onClick={go}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      {note && <p className="dd-note">{note}</p>}
      <EvidencePicker stage={stage} files={files} onChange={setFiles} shortage={shortage} comment={comment} compact />
      <div className="dd-field"><label htmlFor={`evs_${aid}`}>{shortage ? t('shortageComment') : t('commentLabel')}</label>
        <input id={`evs_${aid}`} className="dd-inp" value={comment} placeholder={commentPh || t('commentPh')} onChange={e => setComment(e.target.value)} /></div>
    </Sheet>
  );
}
