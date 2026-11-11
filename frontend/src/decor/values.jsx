// «Кадрият» — ценности компании (D27; ТЗ «Декор, обновление 2», раздел 4).
// ValuesBar — шесть кнопок на самом верху Главной у всех должностей и на странице входа: нажатие — окно с названием
// и текстом на языке экрана (ЎЗ — узбекский текст кириллицей). Текста ещё нет — «Текст скоро будет».
// При каждом нажатии список перечитывается: учредитель поменял текст — у сотрудника он сразу новый.
// ValuesEditor — Настройки → Кадрият (полномочие «менять Кадрият»): шесть строк, названия и тексты RU/UZ, порядок кнопок.
import React, { useEffect, useState } from 'react';
import api from './api.js';
import Icon from './icons.jsx';
import { useT } from './i18n.js';
import { toCyrillic } from './cyrillic.js';
import { useDecor, useActions, Card, Sheet, Loading } from './kit.jsx';

export function valueText(v, lang) {
  const uz = lang !== 'ru';
  const title = (uz ? v.title_uz : v.title_ru) || v.title_ru || v.title_uz;
  const text = (uz ? v.text_uz : v.text_ru) || '';
  return lang === 'uzc' ? { title: toCyrillic(title), text: toCyrillic(text) } : { title, text };
}

export function ValuesBar({ values, refresh }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(null);         // position открытой ценности
  if (!values?.length) return null;
  const cur = open ? values.find(v => v.position === open) : null;
  const shown = cur ? valueText(cur, lang) : null;
  return (
    <section className="dd-values" aria-label={t('valuesTitle')}>
      <div className="dd-eyebrow">{t('valuesTitle')}</div>
      <div className="dd-values-grid">
        {values.map(v => (
          <button key={v.position} type="button" className="dd-value" onClick={() => { setOpen(v.position); refresh?.(); }}>
            {valueText(v, lang).title}
          </button>
        ))}
      </div>
      {cur && (
        <Sheet title={shown.title} onClose={() => setOpen(null)}>
          {shown.text ? <p className="dd-value-text">{shown.text}</p> : <div className="dd-empty">{t('valueSoon')}</div>}
        </Sheet>
      )}
    </section>
  );
}

// Ценности компании для Главной (по токену)
export function useValues() {
  const [vals, setVals] = useState(null);
  const load = () => api.get('/values').then(r => setVals(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  return [vals, load];
}

// ---------- Настройки → Кадрият ----------
export function ValuesEditor() {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [f, setF] = useState(null);
  const [orig, setOrig] = useState(null);
  const load = () => api.get('/values').then(r => { setF(r.data.map(v => ({ ...v }))); setOrig(JSON.stringify(r.data)); }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!f) return <Loading />;
  const set = (i, p) => { setF(f.map((v, k) => (k === i ? { ...v, ...p } : v))); actions.reset('values'); };
  const move = (i, d) => { const n = [...f]; [n[i], n[i + d]] = [n[i + d], n[i]]; setF(n); actions.reset('values'); };
  const changed = JSON.stringify(f.map(({ updated_at, ...v }, i) => ({ ...v, position: i + 1 }))) !== JSON.stringify(JSON.parse(orig).map(({ updated_at, ...v }) => v));
  const bad = f.some(v => !v.title_uz.trim() || !v.title_ru.trim());
  const save = async () => {
    try {
      const r = await actions.run('values', cfg => api.put('/values', { values: f.map(({ title_uz, title_ru, text_uz, text_ru }) => ({ title_uz, title_ru, text_uz, text_ru })) }, cfg));
      if (r) { toast(t('valuesSaved')); setF(r.data.map(v => ({ ...v }))); setOrig(JSON.stringify(r.data)); }
    } catch (e) { toast(e?.response?.data?.error || t('noAnswer'), 'bad'); }
  };
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('valuesTitle')}</h3>
        <button type="button" className="dd-btn" disabled={!!actions.busy || !changed || bad} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button></div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('valuesNote')}</p>
      <div className="dd-lines" style={{ marginTop: 12, gridTemplateColumns: 'none' }}>
        {f.map((v, i) => (
          <div key={`${v.position}-${i}`} className="dd-line dd-value-edit">
            <div className="dd-line-head"><b>{i + 1}. {v.title_ru || '—'}</b>
              <div className="dd-row" style={{ gap: 6 }}>
                <button type="button" className="dd-btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp')}>↑</button>
                <button type="button" className="dd-btn ghost sm" disabled={i === f.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown')}>↓</button>
              </div>
            </div>
            <div className="dd-grid dd-g2" style={{ gap: 10 }}>
              <div className="dd-field"><label htmlFor={`vt_ru_${i}`}>{t('valueTitleRu')}</label>
                <input id={`vt_ru_${i}`} className="dd-inp" maxLength={120} value={v.title_ru} onChange={e => set(i, { title_ru: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor={`vt_uz_${i}`}>{t('valueTitleUz')}</label>
                <input id={`vt_uz_${i}`} className="dd-inp" maxLength={120} value={v.title_uz} onChange={e => set(i, { title_uz: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor={`vx_ru_${i}`}>{t('valueTextRu')}</label>
                <textarea id={`vx_ru_${i}`} className="dd-inp dd-textarea" rows={5} maxLength={5000} value={v.text_ru} onChange={e => set(i, { text_ru: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor={`vx_uz_${i}`}>{t('valueTextUz')}</label>
                <textarea id={`vx_uz_${i}`} className="dd-inp dd-textarea" rows={5} maxLength={5000} value={v.text_uz} onChange={e => set(i, { text_uz: e.target.value })} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="dd-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="dd-btn lg" disabled={!!actions.busy || !changed || bad} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>
      </div>
    </Card>
  );
}
