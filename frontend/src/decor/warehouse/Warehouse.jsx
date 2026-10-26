// Склад: декор и износ, заявки на сборку (выдача), на объектах (довыдача, остаток, финал по вещи, поздний возврат,
// «принять всё»), «не вернулось с объекта», «недостача под вопросом». Удобно с телефона: строки — карточками,
// действия — через окно с крупным счётчиком и подтверждением. Суммы видит только тот, кому их отдаёт сервер.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm2, fday, fdd } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, StatusChip, Stepper, Sheet, Loading, Empty, NoAccess } from '../kit.jsx';
import { EvidencePicker, evForm, evidenceError, useEvidenceReady, dropFiles } from '../evidence.jsx';
import { StockTab } from './Stock.jsx';

// Шапка заказа в карточках склада
export function OrderHead({ o, right }) {
  const { t, lang } = useT();
  return (
    <div className="dd-order-head">
      <div style={{ minWidth: 0 }}>
        <h3>{o.no} · {o.client}</h3>
        <div className="dd-sub">{fday(o.event_date, lang)} · {t('period', { from: fdd(o.period.from), to: fdd(o.period.to) }).toLowerCase()}{o.team?.length ? ` · ${o.team.map(p => p.name).join(' + ')}` : ''}</div>
        <div className="dd-row" style={{ marginTop: 8, gap: 6 }}>
          <StatusChip status={o.status} />
          {o.not_returned && <Chip tone="bad">{t('notReturnedChip')}</Chip>}
          {o.shortage_pending && <Chip tone="warn">{t('tabShortage')}</Chip>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default function Warehouse() {
  const { t, lang } = useT();
  const { can, toast, refreshHints } = useDecor();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [wh, err, reload] = useLoad(() => api.get('/warehouse').then(r => r.data), []);
  const [items, itemsErr, reloadItems] = useLoad(() => api.get('/items').then(r => r.data), []);
  const [qty, setQty] = useState({});          // количества в заявках: 'orderId:itemId' → шт
  const [sheet, setSheet] = useState(null);     // окно действия
  const actions = useActions();                 // ключ повтора на каждое действие, кнопки заблокированы до ответа
  const busy = !!actions.busy;
  const canMove = can('handle_decor');

  // Вкладка: из адреса, иначе — где есть работа
  // На вкладке «Недостача под вопросом» — только незакрытые заказы; списанное в закрытых показывается ниже, без счётчика
  const counts = wh ? { requests: wh.requests.length, onsite: wh.on_site.length, notback: wh.not_returned.length, shortage: wh.shortage_pending.length } : {};
  const tab = params.get('tab') || (wh ? (counts.notback ? 'notback' : counts.requests ? 'requests' : counts.onsite ? 'onsite' : 'stock') : 'stock');
  const focus = Number(params.get('order')) || null;
  const setTab = (k, order) => setParams(order ? { tab: k, order } : { tab: k }, { replace: true });
  useEffect(() => {   // подсветить и показать заказ, на который перешли
    if (!focus || !wh) return;
    const el = document.getElementById(`dd-o-${tab}-${focus}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus, tab, wh]);

  if (err?.response?.status === 403) return <><Hero id="decor" /><NoAccess err={err} /></>;
  if (!wh) return <><Hero id="decor" /><Loading err={err} retry={reload} /></>;

  // id действия — что делаем и с чем: повтор того же действия (нет ответа) идёт с тем же ключом
  const done = async (id, fn, msg) => {
    try {
      const r = await actions.run(id, fn);
      if (!r) return;
      toast(typeof msg === 'function' ? msg(r.data) : msg); setSheet(null); reload(); reloadItems(); refreshHints();
    } catch (e) { toast(evidenceError(t, e), 'bad'); }
  };
  const getQty = (o, l) => qty[`${o.id}:${l.item_id}`] ?? l.qty;
  const setLineQty = (o, l, v) => { setQty({ ...qty, [`${o.id}:${l.item_id}`]: v }); actions.reset(`issue:${o.id}`); };
  // Выдача и финальный возврат — с фото (требования этапов, D24); при недостаче на финале — комментарий или ещё фото
  const issueLines = o => o.lines.map(l => ({ item_id: l.item_id, qty: Number(getQty(o, l)) || 0 }));
  const issue = (o, files, comment) => done(`issue:${o.id}`, cfg => api.post(`/orders/${o.id}/issue`, evForm({ lines: issueLines(o), comment }, files), cfg),
    t('issued', { no: o.no }));
  const moveId = (orderId, itemId, type) => `move:${orderId}:${itemId}:${type}`;
  const move = (orderId, f, type, n, closed, files, comment) => done(moveId(orderId, f.item_id, type),
    cfg => api.post(`/orders/${orderId}/moves`, type === 'final' ? evForm({ type, item_id: f.item_id, qty: n, comment }, files) : { type, item_id: f.item_id, qty: n }, cfg),
    t(type === 'extra' ? 'mvExtra' : type === 'left' ? 'mvLeft' : type === 'final' ? 'mvFinal' : closed ? 'mvLateClosed' : 'mvLate', { item: f.item, qty: n }));
  const finalAll = (o, lines, files, comment) => done(`finalAll:${o.id}`, cfg => api.post(`/orders/${o.id}/final-all`, evForm({ lines, comment }, files), cfg), d => {
    const short = (d?.accepted || []).filter(a => a.short > 0);
    const names = new Map(o.flows.map(f => [f.item_id, f.item]));
    return t('finalAllDone', { n: d?.accepted?.length || 0 }) + (short.length ? t('finalAllShort', { list: short.map(a => `${names.get(a.item_id)} ${a.short}`).join(', ') }) : '');
  });

  const stats = [[items ? items.length : '·', t('whStatItems')], [counts.requests, t('whStatRequests')], [counts.onsite, t('whStatSites')]];
  if (counts.notback) stats.push([counts.notback, t('whStatNotBack')]);
  return (
    <>
      <Hero id="decor" stats={stats} acts={[
        ...(can('create_order') ? [{ label: t('whGoCalc'), onClick: () => nav('/decor/calc') }] : []),
        { label: t('whGoBooking'), onClick: () => nav('/decor/booking') },
      ]} />
      <Tabs value={tab} onChange={k => setTab(k)} items={[
        ['notback', t('tabNotBack'), counts.notback || null, 'bad'],
        ['shortage', t('tabShortage'), counts.shortage || null, 'warn'],
        ['requests', t('tabRequests'), counts.requests || null],
        ['onsite', t('tabOnSite'), counts.onsite || null],
        ['stock', t('tabStock')],
      ]} />

      {tab === 'stock' && (items ? <StockTab items={items} reload={reloadItems} /> : <Loading err={itemsErr} retry={reloadItems} />)}

      {tab === 'requests' && (!wh.requests.length ? <Empty>{t('noRequests')}</Empty> : wh.requests.map(o => (
        <Card key={o.id} id={`dd-o-requests-${o.id}`} className={focus === o.id ? 'dd-anchor-hl' : ''}>
          <OrderHead o={{ ...o }} />
          <div className="dd-lines">
            {o.lines.map(l => (
              <div key={l.item_id} className="dd-line">
                <div className="dd-line-head"><b>{l.item}</b>
                  {l.free < l.qty ? <Chip tone="bad">{t('shortN', { n: l.qty - l.free })}</Chip> : null}</div>
                <div className="dd-line-head">
                  <div className="dd-nums"><span>{t('byDesign')} <b>{l.qty}</b></span><span>{t('freeShort')} <b style={{ color: l.free < l.qty ? 'var(--bad)' : undefined }}>{l.free}</b></span></div>
                  <Stepper value={getQty(o, l)} onChange={v => setLineQty(o, l, v)} label={t('issueQty')} />
                </div>
              </div>
            ))}
          </div>
          <div className="dd-stack" style={{ marginTop: 14 }}>
            <button type="button" className="dd-btn ok lg wide" disabled={!canMove || busy} onClick={() => setSheet({ kind: 'issue', o })}><Icon name="camera" size={18} /> {t('issueBtn')}</button>
            <span className="dd-note">{canMove ? t('issueNote') : t('noIssueRight')}</span>
          </div>
        </Card>
      )))}

      {tab === 'onsite' && (!wh.on_site.length ? <Empty>{t('noOnSite')}</Empty> : wh.on_site.map(o => {
        const waiting = o.flows.filter(f => !f.final_done && f.onSite > 0);
        return (
          <Card key={o.id} id={`dd-o-onsite-${o.id}`} className={focus === o.id ? 'dd-anchor-hl' : ''}>
            <OrderHead o={o} right={waiting.length ? <Chip tone="warn">{t('waitingN', { n: waiting.length })}</Chip> : <Chip tone="ok">{t('finalDone')}</Chip>} />
            <div className="dd-lines">
              {o.flows.map(f => (
                <div key={f.item_id} className={`dd-line ${f.final_done || f.onSite <= 0 ? 'done' : ''}`}>
                  <div className="dd-line-head"><b>{f.item}</b>
                    {f.final_done ? (f.onSite > 0 ? <Chip tone="warn">{t('tabShortage')}: {f.onSite}</Chip> : <Chip tone="ok">{t('finalDone')}</Chip>)
                      : f.onSite > 0 ? <Chip tone="blue">{t('onSiteShort')} {f.onSite}</Chip> : <Chip tone="gray">{t('nothingOnSite')}</Chip>}
                  </div>
                  <div className="dd-nums">
                    <span>{t('byDesign')} <b>{f.design || '·'}</b></span><span>{t('issuedShort')} <b>{f.issued}</b></span>
                    <span>{t('leftShort')} <b>{f.left || '·'}</b></span><span>{t('finalShort')} <b>{f.final_done ? f.fin : '·'}</b></span>
                    {f.late > 0 && <span>{t('lateShort')} <b>{f.late}</b></span>}
                  </div>
                  <div className="dd-line-acts">
                    {!f.final_done && <>
                      <button type="button" className="dd-btn ghost sm" disabled={!canMove} onClick={() => setSheet({ kind: 'move', type: 'extra', o, f, n: 1 })}>{t('btnExtra')}</button>
                      <button type="button" className="dd-btn ghost sm" disabled={!canMove || f.onSite <= 0} onClick={() => setSheet({ kind: 'move', type: 'left', o, f, n: f.onSite })}>{t('btnLeft')}</button>
                      <button type="button" className="dd-btn sm" disabled={!canMove || f.onSite <= 0} onClick={() => setSheet({ kind: 'move', type: 'final', o, f, n: f.onSite })}>{t('btnFinal')}</button>
                    </>}
                    {f.final_done && f.onSite > 0 && (
                      <button type="button" className="dd-btn warn sm" disabled={!canMove} onClick={() => setSheet({ kind: 'move', type: 'late_return', o, f, n: f.onSite })}><Icon name="undo" size={16} /> {t('btnLate')}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {waiting.length > 0 && (
              <div className="dd-stack" style={{ marginTop: 14 }}>
                <button type="button" className="dd-btn ok lg wide" disabled={!canMove || busy}
                  onClick={() => setSheet({ kind: 'finalAll', o, lines: Object.fromEntries(waiting.map(f => [f.item_id, f.onSite])) })}>
                  <Icon name="check" size={18} /> {t('btnFinalAll')}</button>
                <span className="dd-note">{t('finalAllNote')}</span>
              </div>
            )}
          </Card>
        );
      }))}

      {tab === 'notback' && (
        <>
          <Card className="alert"><h3 style={{ color: 'var(--bad)' }}>{t('nbTitle')}</h3><p className="dd-sub" style={{ marginTop: 4 }}>{t('nbNote')}</p></Card>
          {!wh.not_returned.length ? <Empty>{t('nbEmpty')}</Empty> : wh.not_returned.map(x => (
            <Card key={x.order_id} className="alert">
              <div className="dd-order-head">
                <div><h3>{t('nbOrder', { no: x.no, client: x.client })}</h3><div className="dd-sub">{t('nbLate', { date: fday(x.period_to, lang), n: x.days_late })}</div></div>
                <Chip tone="bad">{t('notReturnedChip')}</Chip>
              </div>
              <div className="dd-lines">
                {x.items.map(i => <div key={i.item_id} className="dd-line"><div className="dd-line-head"><b>{i.item}</b><Chip tone="bad">{t('onSiteShort')} {i.qty}</Chip></div></div>)}
              </div>
              <button type="button" className="dd-btn lg wide" style={{ marginTop: 14 }} onClick={() => setTab('onsite', x.order_id)}>{t('nbAccept')} →</button>
            </Card>
          ))}
        </>
      )}

      {tab === 'shortage' && (
        <>
          <Card className="attn"><h3 style={{ color: 'var(--warn)' }}>{t('spTitle')}</h3><p className="dd-sub" style={{ marginTop: 4 }}>{t('spNote')}</p></Card>
          {!wh.shortage_pending.length ? <Empty>{t('spEmpty')}</Empty> : wh.shortage_pending.map(x => (
            <ShortageCard key={x.order_id} x={x} canMove={canMove} onLate={(i) => setSheet({ kind: 'move', type: 'late_return', o: { id: x.order_id, no: x.no }, f: { item_id: i.item_id, item: i.item, onSite: i.qty }, n: i.qty })} />
          ))}
          {wh.shortage_fixed.length > 0 && <>
            <Card><h3>{t('sfTitle')}</h3><p className="dd-sub" style={{ marginTop: 4 }}>{t('sfNote')}</p></Card>
            {wh.shortage_fixed.map(x => (
              <ShortageCard key={x.order_id} x={x} fixed canMove={canMove} onLate={(i) => setSheet({ kind: 'move', type: 'late_return', closed: true, o: { id: x.order_id, no: x.no }, f: { item_id: i.item_id, item: i.item, onSite: i.qty }, n: i.qty })} />
            ))}
          </>}
        </>
      )}

      {sheet?.kind === 'issue' && <IssueSheet o={sheet.o} lines={issueLines(sheet.o)} busy={busy} onClose={() => setSheet(null)} onEdit={() => actions.reset(`issue:${sheet.o.id}`)}
        onGo={(files, comment) => issue(sheet.o, files, comment)} />}
      {sheet?.kind === 'move' && <MoveSheet s={sheet} busy={busy} onClose={() => setSheet(null)} onEdit={() => actions.reset(moveId(sheet.o.id, sheet.f.item_id, sheet.type))}
        onGo={(n, files, comment) => move(sheet.o.id, sheet.f, sheet.type, n, sheet.closed, files, comment)} />}
      {sheet?.kind === 'finalAll' && <FinalAllSheet s={sheet} busy={busy} onClose={() => setSheet(null)} onEdit={() => actions.reset(`finalAll:${sheet.o.id}`)}
        onGo={(lines, files, comment) => finalAll(sheet.o, Object.entries(lines).map(([item_id, q]) => ({ item_id: Number(item_id), qty: Number(q) || 0 })), files, comment)} />}
    </>
  );
}

function ShortageCard({ x, fixed, canMove, onLate }) {
  const { t, lang } = useT();
  return (
    <Card className={fixed ? '' : 'attn'}>
      <div className="dd-order-head">
        <div><h3>{x.no} · {x.client}</h3><div className="dd-sub">{fday(x.event_date, lang)}{x.amount_usd !== undefined ? ` · ${fixed ? t('sfAmount', { sum: fm2(x.amount_usd) }) : t('spAmount', { sum: fm2(x.amount_usd) })}` : ''}</div></div>
        {fixed ? <StatusChip status="closed" /> : <Chip tone="warn">{t('tabShortage')}</Chip>}
      </div>
      <div className="dd-lines">
        {x.items.map(i => (
          <div key={i.item_id} className="dd-line">
            <div className="dd-line-head"><b>{i.item}</b><Chip tone={fixed ? 'gray' : 'warn'}>{i.qty} {t('pcs')}</Chip></div>
            <div className="dd-line-head">
              <div className="dd-nums">{i.since && <span>{t('spSince', { date: fday(i.since, lang) })}</span>}{i.amount_usd !== undefined && <span><b>{fm2(i.amount_usd)}</b></span>}</div>
              <button type="button" className="dd-btn warn sm" disabled={!canMove} onClick={() => onLate(i)}><Icon name="undo" size={16} /> {t('btnLate')}</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Окно одного движения: крупный счётчик, для финала — сколько станет недостачей под вопросом
// onEdit — данные действия изменились: следующее нажатие — новое действие с новым ключом
function MoveSheet({ s, busy, onClose, onGo, onEdit }) {
  const { t } = useT();
  const [n, setNraw] = useState(s.n);
  const [files, setFilesRaw] = useState([]);
  const [comment, setCommentRaw] = useState('');
  const setN = v => { setNraw(v); onEdit?.(); };
  const setFiles = v => { setFilesRaw(v); onEdit?.(); };
  const setComment = v => { setCommentRaw(v); onEdit?.(); };
  const isFinal = s.type === 'final';
  const shortNow = isFinal ? s.f.onSite - (Number(n) || 0) : 0;
  const ready = useEvidenceReady('final', files, { shortage: shortNow > 0, comment });
  const close = () => { dropFiles(files); onClose(); };
  const title = { extra: t('btnExtra'), left: t('btnLeft'), final: t('confirmFinalTitle'), late_return: t('btnLate') }[s.type];
  const max = s.type === 'extra' ? undefined : s.f.onSite;
  const min = s.type === 'final' ? 0 : 1;
  const short = s.type === 'final' ? s.f.onSite - (Number(n) || 0) : 0;
  return (
    <Sheet title={`${title} · ${s.o.no}`} onClose={close} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={close}>{t('cancel')}</button>
      <button type="button" className={`dd-btn lg ${s.type === 'final' ? 'ok' : s.type === 'late_return' ? 'warn' : ''}`} disabled={busy || n === '' || Number(n) < min || (max !== undefined && Number(n) > max) || (isFinal && !ready)} onClick={() => onGo(Number(n), files, comment)}>
        <Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      <div className="dd-line-head"><b style={{ fontSize: 17 }}>{s.f.item}</b>{s.f.onSite !== undefined && <Chip tone="blue">{s.type === 'late_return' ? t('tabShortage') : t('onSiteShort')} {s.f.onSite}</Chip>}</div>
      <div className="dd-row" style={{ justifyContent: 'center', margin: '8px 0' }}><Stepper value={n} onChange={setN} min={min} max={max} label={title} /></div>
      {s.type === 'final' && <div className="dd-note">{t('confirmFinal', { item: s.f.item, qty: Number(n) || 0, onSite: s.f.onSite })}</div>}
      {short > 0 && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('confirmFinalShort', { n: short })}</div>}
      {isFinal && <>
        <EvidencePicker stage="final" files={files} onChange={setFiles} shortage={short > 0} comment={comment} compact />
        {short > 0 && <div className="dd-field"><label htmlFor="mv_cm">{t('shortageComment')}</label>
          <input id="mv_cm" className="dd-inp" value={comment} placeholder={t('shortageCommentPh')} onChange={e => setComment(e.target.value)} /></div>}
      </>}
      {s.closed && <div className="dd-note">{t('sfNote')}</div>}
    </Sheet>
  );
}

// «Принять всё как финальный возврат»: по каждой вещи без финала — сколько вернули
function FinalAllSheet({ s, busy, onClose, onGo, onEdit }) {
  const { t } = useT();
  const [lines, setLinesRaw] = useState(s.lines);
  const [files, setFilesRaw] = useState([]);
  const [comment, setCommentRaw] = useState('');
  const setLines = v => { setLinesRaw(v); onEdit?.(); };
  const setFiles = v => { setFilesRaw(v); onEdit?.(); };
  const setComment = v => { setCommentRaw(v); onEdit?.(); };
  const flows = useMemo(() => new Map(s.o.flows.map(f => [f.item_id, f])), [s.o.flows]);
  const short = Object.entries(lines).reduce((a, [id, q]) => a + Math.max(0, flows.get(Number(id)).onSite - (Number(q) || 0)), 0);
  const ready = useEvidenceReady('final', files, { shortage: short > 0, comment });
  const close = () => { dropFiles(files); onClose(); };
  return (
    <Sheet title={t('confirmFinalAllTitle')} onClose={close} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={close}>{t('cancel')}</button>
      <button type="button" className="dd-btn ok lg" disabled={busy || !ready} onClick={() => onGo(lines, files, comment)}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      <div className="dd-note">{t('confirmFinalAll', { no: s.o.no, n: Object.keys(lines).length })} {t('finalAllNote')}</div>
      {Object.entries(lines).map(([id, q]) => {
        const f = flows.get(Number(id));
        return (
          <div key={id} className="dd-line">
            <div className="dd-line-head"><b>{f.item}</b><Chip tone="blue">{t('onSiteShort')} {f.onSite}</Chip></div>
            <div className="dd-line-head">
              <span className="dd-note">{f.onSite - (Number(q) || 0) > 0 ? <span style={{ color: 'var(--warn)', fontWeight: 800 }}>{t('shortN', { n: f.onSite - (Number(q) || 0) })}</span> : '✓'}</span>
              <Stepper value={q} onChange={v => setLines({ ...lines, [id]: v })} min={0} max={f.onSite} label={f.item} />
            </div>
          </div>
        );
      })}
      {short > 0 && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('confirmFinalShort', { n: short })}</div>}
      <EvidencePicker stage="final" files={files} onChange={setFiles} shortage={short > 0} comment={comment} compact />
      {short > 0 && <div className="dd-field"><label htmlFor="fa_cm">{t('shortageComment')}</label>
        <input id="fa_cm" className="dd-inp" value={comment} placeholder={t('shortageCommentPh')} onChange={e => setComment(e.target.value)} /></div>}
    </Sheet>
  );
}

// Выдача по заявке: что уезжает и фото погрузки (требование этапа «выдача со склада»)
function IssueSheet({ o, lines, busy, onClose, onGo, onEdit }) {
  const { t } = useT();
  const [files, setFilesRaw] = useState([]);
  const [comment, setCommentRaw] = useState('');
  const setFiles = v => { setFilesRaw(v); onEdit?.(); };
  const setComment = v => { setCommentRaw(v); onEdit?.(); };
  const ready = useEvidenceReady('issue', files);
  const names = new Map(o.lines.map(l => [l.item_id, l.item]));
  const total = lines.filter(l => l.qty > 0);
  const close = () => { dropFiles(files); onClose(); };
  return (
    <Sheet title={`${t('issueBtn')} · ${o.no}`} onClose={close} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={close}>{t('cancel')}</button>
      <button type="button" className="dd-btn ok lg" disabled={busy || !ready || !total.length} onClick={() => onGo(files, comment)}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      <div className="dd-nums">{total.map(l => <span key={l.item_id}>{names.get(l.item_id)} <b>{l.qty}</b></span>)}</div>
      <EvidencePicker stage="issue" files={files} onChange={setFiles} compact />
      <div className="dd-field"><label htmlFor="is_cm">{t('commentLabel')}</label>
        <input id="is_cm" className="dd-inp" value={comment} placeholder={t('issueCommentPh')} onChange={e => setComment(e.target.value)} /></div>
    </Sheet>
  );
}
