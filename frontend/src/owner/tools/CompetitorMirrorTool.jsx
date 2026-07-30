import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum, fmtMoney } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// 6 KPI-осей зеркала. higherBetter=false → меньше лучше (средняя цена дешевле = выгоднее).
const AXES = [
  { key: 'sku',       label: 'Ассортимент (SKU)',  icon: '📦', higherBetter: true  },
  { key: 'avg_price', label: 'Средняя цена',       icon: '💵', higherBetter: false },
  { key: 'rating',    label: 'Рейтинг отзывов',    icon: '⭐', higherBetter: true  },
  { key: 'service',   label: 'Качество сервиса',   icon: '🛎️', higherBetter: true  },
  { key: 'locations', label: 'Кол-во точек',       icon: '📍', higherBetter: true  },
  { key: 'online',    label: 'Онлайн-присутствие', icon: '🌐', higherBetter: true  },
];

// ── Числовой ввод ────────────────────────────────────────────────────────────
// Стейт полей формы — СТРОКИ: в onChange только чистка символов, диапазон и
// приведение к числу — на onBlur / при сохранении. type="number" тут нельзя:
// на промежуточно-невалидном вводе («1 500 000», «4,5») браузер отдаёт
// e.target.value === '' и контролируемое поле само себя очищает.
const cleanDec = (s) => String(s ?? '').replace(/[^\d.,\s]/g, ''); // цифры, разделитель, пробелы-разряды
const cleanInt = (s) => String(s ?? '').replace(/[^\d]/g, '');     // только цифры (целые счётчики)
const normNum = (s) => normalizeDecimal(s);
const toNum = (s, dflt = 0) => { const n = parseFloat(normNum(s)); return Number.isFinite(n) ? n : dflt; };
const toInt = (s, dflt = 0) => { const n = parseInt(normNum(s), 10); return Number.isFinite(n) ? n : dflt; };
const clampNum = (n, min, max) => Math.min(max, Math.max(min, n));
// onBlur: пустое остаётся пустым (поле можно очистить целиком), мусор гасим,
// выход за диапазон зажимаем. Валидный ввод отдаём как набрали (уже без пробелов).
const tidyNum = (s, min = null, max = null) => {
  const t = normNum(s).replace(/^0+(?=\d)/, ''); // «020» → «20»
  if (t === '') return '';
  let n = parseFloat(t);
  if (!Number.isFinite(n)) return '';
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return (n === parseFloat(t) && /^\d+(\.\d+)?$/.test(t)) ? t : String(n);
};

// Нормализация значения оси в 0–100 относительно «макс» по паре (своя vs конкурент).
// Для метрик где меньше = лучше инвертируем шкалу.
function normalize(value, maxVal, higherBetter) {
  const v = parseFloat(value) || 0;
  const m = parseFloat(maxVal) || 0;
  if (m <= 0) return 0;
  const raw = Math.min(100, Math.round((v / m) * 100));
  return higherBetter ? raw : (100 - raw);
}

// SVG radar-чарт: своя компания vs конкурент по 6 осям (0–100).
function Radar({ mine, theirs }) {
  const { tt } = useTt();
  const size = 260, cx = size / 2, cy = size / 2, R = 92;
  const n = AXES.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, val) => {
    const r = (val / 100) * R;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const poly = (vals) => vals.map((v, i) => point(i, v).join(',')).join(' ');
  const grid = [25, 50, 75, 100];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto' }}>
      {/* сетка-кольца */}
      {grid.map((g) => (
        <polygon key={g}
          points={AXES.map((_, i) => point(i, g).join(',')).join(' ')}
          fill="none" stroke="#E3EAF3" strokeWidth="1" />
      ))}
      {/* оси */}
      {AXES.map((ax, i) => {
        const [x, y] = point(i, 100);
        return <line key={ax.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#E3EAF3" strokeWidth="1" />;
      })}
      {/* конкурент */}
      <polygon points={poly(theirs)} fill="rgba(217,119,6,0.18)" stroke="#D97706" strokeWidth="2" />
      {/* своя компания */}
      <polygon points={poly(mine)} fill="rgba(29,78,216,0.20)" stroke="#1D4ED8" strokeWidth="2.5" />
      {/* подписи осей */}
      {AXES.map((ax, i) => {
        const [x, y] = point(i, 122);
        return (
          <text key={ax.key} x={x} y={y} fontSize="9.5" fontWeight="700" fill="#5A6B85"
            textAnchor={Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end'}
            dominantBaseline="middle">{ax.icon}</text>
        );
      })}
    </svg>
  );
}

export default function CompetitorMirrorTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selId, setSelId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', sku: '', avg_price: '', rating: '', service: '', locations: '', online: '', source: '' });

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/competitors', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, reloadKey]);

  const mine = data?.mine || null;
  const competitors = data?.competitors || [];

  // Выбранный конкурент (по умолчанию первый).
  const selected = useMemo(() => {
    if (!competitors.length) return null;
    return competitors.find(c => c.id === selId) || competitors[0];
  }, [competitors, selId]);

  // Нормализованные значения по парам для radar + бар-сравнения + win/lose.
  const compare = useMemo(() => {
    if (!mine || !selected) return [];
    return AXES.map(ax => {
      const mv = parseFloat(mine[ax.key]) || 0;
      const tv = parseFloat(selected[ax.key]) || 0;
      const maxVal = Math.max(mv, tv, 1);
      const mineNorm = normalize(mv, maxVal, ax.higherBetter);
      const theirNorm = normalize(tv, maxVal, ax.higherBetter);
      // Победа по «эффективности» оси: выше нормализованный балл = лучше.
      let verdict = 'tie';
      if (mineNorm > theirNorm + 2) verdict = 'win';
      else if (theirNorm > mineNorm + 2) verdict = 'lose';
      return { ...ax, mv, tv, mineNorm, theirNorm, verdict };
    });
  }, [mine, selected]);

  const wins = compare.filter(c => c.verdict === 'win');
  const loses = compare.filter(c => c.verdict === 'lose');
  const ties = compare.filter(c => c.verdict === 'tie');

  function openNew() {
    setForm({ id: null, name: '', sku: '', avg_price: '', rating: '', service: '', locations: '', online: '', source: '' });
    setEditOpen(true);
  }
  function openEdit(c) {
    setForm({
      id: c.id, name: c.name || '',
      sku: String(c.sku ?? ''), avg_price: String(c.avg_price ?? ''),
      rating: String(c.rating ?? ''), service: String(c.service ?? ''),
      locations: String(c.locations ?? ''), online: String(c.online ?? ''),
      source: c.source || '',
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast(tt('Укажите название конкурента'), 'error'); return; }
    setSaving(true);
    try {
      const body = {
        id: form.id || undefined,
        name: form.name.trim(),
        // Явное приведение к числу с дефолтом: пустое поле даёт 0, не NaN.
        sku: toInt(form.sku),
        avg_price: toNum(form.avg_price),
        rating: clampNum(toNum(form.rating), 0, 5),
        service: clampNum(toInt(form.service), 0, 100),
        locations: toInt(form.locations),
        online: clampNum(toInt(form.online), 0, 100),
        source: form.source.trim() || null,
      };
      if (branchId) body.branch_id = branchId;
      const r = await api.post('/marketing/competitors', body);
      toast(tt('Конкурент сохранён'), 'success');
      setEditOpen(false);
      if (r.data?.id) setSelId(r.data.id);
      setReloadKey(k => k + 1);
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const fmtAxisVal = (ax, v) => {
    if (ax.key === 'avg_price') return fmtMoney(v);
    if (ax.key === 'rating') return (parseFloat(v) || 0).toFixed(1);
    if (ax.key === 'service' || ax.key === 'online') return `${fmtNum(v)}%`;
    return fmtNum(v);
  };

  return (
    <>
      <PageHeader
        title={tt('🪞 Зеркало конкурентов')}
        sub={tt('Сравнение с конкурентами по 6 KPI · radar · сильные и слабые стороны')}
        actions={<button className="btn btn-sm" onClick={openNew}>{tt('+ Конкурент')}</button>}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : competitors.length === 0 ? (
        <EmptyState
          icon="🪞"
          title={tt('Нет конкурентов')}
          description={tt('Добавьте конкурента и введите его метрики вручную — система сравнит их с вашими (SKU, средняя цена и точки берутся автоматически).')}
          action={<button className="btn" onClick={openNew}>{tt('+ Добавить конкурента')}</button>}
        />
      ) : (
        <>
          {/* Свои авто-метрики */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Наш ассортимент (SKU)')} value={fmtNum(mine?.sku)} sub={tt('авто из системы')} color="#1D4ED8" />
            <Tile icon="💵" label={tt('Наша средняя цена')} value={fmtMoney(mine?.avg_price)} sub={tt('авто из системы')} color="#0EA5E9" />
            <Tile icon="📍" label={tt('Наши точки')} value={fmtNum(mine?.locations)} sub={tt('авто из системы')} color="#16A34A" />
            <Tile icon="🪞" label={tt('Конкурентов')} value={fmtNum(competitors.length)} sub={tt('в сравнении')} color="#D97706" />
          </div>

          {/* Выбор конкурента */}
          <Card icon="🎯" title={tt('Конкурент для сравнения')} style={{ marginBottom: 16 }}
            actions={selected && <button className="btn btn-sm btn-ghost" onClick={() => openEdit(selected)}>{tt('✏️ Изменить метрики')}</button>}>
            <Pills
              value={selected?.id}
              onChange={setSelId}
              options={competitors.map(c => ({ value: c.id, label: c.name }))}
            />
            {selected?.source && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
                {tt('Источник')}: {selected.source}
              </div>
            )}
          </Card>

          {/* Итог win/lose/tie */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="✅" label={tt('Мы сильнее')} value={fmtNum(wins.length)} sub={tt('из 6 KPI')} color="#16A34A" />
            <Tile icon="⚠️" label={tt('Мы слабее')} value={fmtNum(loses.length)} sub={tt('из 6 KPI')} color="#DC2626" />
            <Tile icon="≈" label={tt('Паритет')} value={fmtNum(ties.length)} sub={tt('из 6 KPI')} color="#D97706" />
          </div>

          {/* Radar + легенда */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="🕸️" title={tt('Radar — мы vs конкурент')}>
              <Radar mine={compare.map(c => c.mineNorm)} theirs={compare.map(c => c.theirNorm)} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 8, fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#1D4ED8' }} /> {tt('Мы')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#D97706' }} /> {selected?.name}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
                {tt('Все оси нормализованы в 0–100. Для средней цены меньше = лучше (шкала инвертирована).')}
              </div>
            </Card>

            {/* Бар-сравнение по осям */}
            <Card icon="📊" title={tt('Сравнение по KPI')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {compare.map(c => (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      <span>{c.icon} {tt(c.label)}</span>
                      <span>
                        {c.verdict === 'win' && <Badge tone="green">{tt('✓ мы')}</Badge>}
                        {c.verdict === 'lose' && <Badge tone="red">{tt('↓ они')}</Badge>}
                        {c.verdict === 'tie' && <Badge tone="yellow">{tt('≈')}</Badge>}
                      </span>
                    </div>
                    {/* две полоски: мы / они */}
                    {[['#1D4ED8', tt('Мы'), c.mineNorm, c.mv], ['#D97706', selected?.name, c.theirNorm, c.tv]].map(([col, lbl, norm, raw], i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ width: 56, fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lbl}</span>
                        <div style={{ flex: 1, background: 'var(--bg2, #F1F5F9)', borderRadius: 6, height: 16, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: Math.max(3, norm) + '%', height: '100%', background: col, borderRadius: 6, transition: 'width .3s ease' }} />
                        </div>
                        <span className="mono" style={{ width: 78, textAlign: 'right', fontSize: 11, fontWeight: 700 }}>{fmtAxisVal(c, raw)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Карточки сильных/слабых сторон */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="💪" title={tt('Наши сильные стороны')}>
              {wins.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: 8 }}>{tt('Преимуществ над этим конкурентом не выявлено')}</div>
              ) : (
                <div className="list">
                  {wins.map(c => (
                    <div key={c.key} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge tone="green">+</Badge>
                      <span style={{ fontSize: 13, flex: 1 }}>{c.icon} {tt(c.label)}</span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtAxisVal(c, c.mv)} {tt('vs')} {fmtAxisVal(c, c.tv)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card icon="⚠️" title={tt('Где мы проигрываем')}>
              {loses.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: 8 }}>{tt('Слабых сторон против этого конкурента нет 🎉')}</div>
              ) : (
                <div className="list">
                  {loses.map(c => (
                    <div key={c.key} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge tone="red">−</Badge>
                      <span style={{ fontSize: 13, flex: 1 }}>{c.icon} {tt(c.label)}</span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtAxisVal(c, c.mv)} {tt('vs')} {fmtAxisVal(c, c.tv)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Таблица всех конкурентов */}
          <Card icon="📋" title={tt('Все конкуренты')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Конкурент')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('SKU')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Ср. цена')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Рейтинг')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сервис')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Точки')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Онлайн')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'rgba(29,78,216,.06)' }}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{tt('🏠 Наша компания')}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(mine?.sku)}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(mine?.avg_price)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{(parseFloat(mine?.rating) || 0).toFixed(1)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(mine?.service)}%</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(mine?.locations)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(mine?.online)}%</td>
                    <td></td>
                  </tr>
                  {competitors.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer', opacity: selected?.id === c.id ? 1 : 0.85 }}
                      onClick={() => setSelId(c.id)}>
                      <td style={{ fontWeight: 700 }}>{c.name}{selected?.id === c.id && <Badge tone="blue">{tt('выбран')}</Badge>}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.sku)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(c.avg_price)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{(parseFloat(c.rating) || 0).toFixed(1)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.service)}%</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.locations)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.online)}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{tt('✏️')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              {tt('Наши метрики SKU (число товаров), средняя цена (avg price_sell) и точки (число филиалов) берутся автоматически из системы. Рейтинг, сервис и онлайн вводятся вручную. Метрики конкурентов — ручной ввод.')}
            </div>
          </Card>
        </>
      )}

      {/* Модалка ручного ввода метрик конкурента */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        icon="🪞"
        title={form.id ? tt('Метрики конкурента') : tt('Новый конкурент')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>{tt('Отмена')}</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? tt('Сохранение…') : tt('Сохранить')}</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('Название конкурента')}</div>
            <input className="input" style={{ width: '100%' }} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={tt('Напр.: Конкурент А')} />
          </label>
          <div className="grid-2" style={{ gap: 12 }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('📦 Ассортимент (SKU)')}</div>
              <input className="input" type="text" inputMode="numeric" style={{ width: '100%' }} value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: cleanInt(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, sku: tidyNum(e.target.value, 0) }))} placeholder="0" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('💵 Средняя цена')}</div>
              <input className="input" type="text" inputMode="decimal" style={{ width: '100%' }} value={form.avg_price}
                onChange={e => setForm(f => ({ ...f, avg_price: cleanDec(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, avg_price: tidyNum(e.target.value, 0) }))} placeholder="0" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('⭐ Рейтинг (0–5)')}</div>
              <input className="input" type="text" inputMode="decimal" style={{ width: '100%' }} value={form.rating}
                onChange={e => setForm(f => ({ ...f, rating: cleanDec(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, rating: tidyNum(e.target.value, 0, 5) }))} placeholder="0.0" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('🛎️ Сервис (0–100)')}</div>
              <input className="input" type="text" inputMode="numeric" style={{ width: '100%' }} value={form.service}
                onChange={e => setForm(f => ({ ...f, service: cleanInt(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, service: tidyNum(e.target.value, 0, 100) }))} placeholder="0" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('📍 Кол-во точек')}</div>
              <input className="input" type="text" inputMode="numeric" style={{ width: '100%' }} value={form.locations}
                onChange={e => setForm(f => ({ ...f, locations: cleanInt(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, locations: tidyNum(e.target.value, 0) }))} placeholder="0" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('🌐 Онлайн (0–100)')}</div>
              <input className="input" type="text" inputMode="numeric" style={{ width: '100%' }} value={form.online}
                onChange={e => setForm(f => ({ ...f, online: cleanInt(e.target.value) }))}
                onBlur={e => setForm(f => ({ ...f, online: tidyNum(e.target.value, 0, 100) }))} placeholder="0" />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('Источник данных (необязательно)')}</div>
            <input className="input" style={{ width: '100%' }} value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder={tt('сайт, отзывы, разведка…')} />
          </label>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>
            {tt('Сервис и онлайн — субъективная оценка в процентах (0–100). Рейтинг — по 5-балльной шкале.')}
          </div>
        </div>
      </Modal>
    </>
  );
}
