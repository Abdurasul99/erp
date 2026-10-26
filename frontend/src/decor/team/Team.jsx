// Команда: сотрудники и уровни (и их входы — учредитель), ставки за большой / малый заказ, начисления и «Выплатить»,
// история выплат. Начисление создаётся при одобрении «Приёмки» с полным комплектом фото и видео и ЗАМОРАЖИВАЕТ ставку:
// смена ставок прошлые начисления не меняет. Выплата уменьшает кассу; повтор не выплачивает дважды (ключ повтора).
// Суммы команды видят только те, у кого «выплачивать» или «видеть себестоимость»; остальные — только свои начисления.
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fts } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, Sheet, Loading, Empty, numIn } from '../kit.jsx';

const LEVELS = ['pm', 'trainee', 'cashier', 'storekeeper'];

export default function Team() {
  const { t } = useT();
  const { me, can } = useDecor();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const sums = can('pay_team') || can('see_finance');
  const seeRates = sums || can('edit_settings');
  const [emps, empErr, reloadEmps] = useLoad(() => api.get('/employees').then(r => r.data), []);
  const [pay, , reloadPay] = useLoad(() => (sums ? api.get('/payroll').then(r => r.data) : Promise.resolve(null)), [sums]);
  const [my, , reloadMy] = useLoad(() => (!sums && me.employee ? api.get('/payroll/my').then(r => r.data).catch(() => null) : Promise.resolve(null)), [sums]);
  const tabs = [['people', t('tmTabPeople')], ...(seeRates ? [['rates', t('tmTabRates')]] : []),
    ...(sums ? [['pay', t('tmTabPay'), pay?.due_total_usd > 0 ? fm(pay.due_total_usd) : null, 'warn']] : []), ...(my ? [['my', t('tmTabMy')]] : [])];
  const tab = tabs.some(x => x[0] === params.get('tab')) ? params.get('tab') : (sums ? 'pay' : tabs[0][0]);
  if (!emps) return <><Hero id="team" /><Loading err={empErr} retry={reloadEmps} /></>;
  const active = emps.filter(e => e.is_active);
  const stats = [[active.length, t('tmStatPeople')]];
  if (pay) stats.push([fm(pay.due_total_usd), t('tmStatDue')], [fm(pay.paid_total_usd), t('tmStatPaid')]);
  else if (my) stats.push([fm(my.due_usd || 0), t('tmStatMyDue')]);
  return (
    <>
      <Hero id="team" stats={stats} acts={can('see_finance') || can('confirm_money') ? [{ label: t('t_finance'), onClick: () => nav('/decor/finance?tab=cash') }] : []} />
      <Tabs value={tab} onChange={k => setParams({ tab: k }, { replace: true })} items={tabs} />
      {tab === 'people' && <PeopleTab emps={emps} reload={reloadEmps} />}
      {tab === 'rates' && <RatesTab />}
      {tab === 'pay' && pay && <PayTab pay={pay} reload={() => { reloadPay(); reloadMy(); }} />}
      {tab === 'my' && my && <MyTab my={my} />}
    </>
  );
}

// ---------- Сотрудники: уровни, телефоны, входы ----------
function PeopleTab({ emps, reload }) {
  const { t } = useT();
  const { me, can } = useDecor();
  const [sheet, setSheet] = useState(null);
  const owner = me.is_owner;
  return <>
    <Card>
      <div className="dd-row dd-between"><h3>{t('tmPeopleTitle')}</h3>
        {can('edit_settings') && <button type="button" className="dd-btn" onClick={() => setSheet({ kind: 'emp', e: null })}><Icon name="plus" size={16} /> {t('tmAdd')}</button>}</div>
      <div className="dd-lines" style={{ marginTop: 10 }}>
        {emps.map(e => (
          <div key={e.id} className={`dd-line ${e.is_active ? '' : 'done'}`}>
            <div className="dd-line-head"><b>{e.name}</b><span className="dd-row" style={{ gap: 6 }}><Chip tone="blue">{t(`l_${e.level}`)}</Chip>{!e.is_active && <Chip tone="gray">{t('tmInactive')}</Chip>}</span></div>
            <div className="dd-line-head">
              <div className="dd-nums">
                {e.phone && <span>{e.phone}</span>}
                <span>{e.has_login ? <>{t('tmLogin')} <b>{e.username || '✓'}</b>{e.is_blocked ? ` · ${t('tmBlocked')}` : ''}</> : t('tmNoLogin')}</span>
              </div>
              <div className="dd-line-acts">
                {can('edit_settings') && <button type="button" className="dd-btn ghost sm" onClick={() => setSheet({ kind: 'emp', e })}>{t('tmEdit')}</button>}
                {owner && <button type="button" className="dd-btn ghost sm" onClick={() => setSheet({ kind: 'login', e })}>{e.has_login ? t('tmLoginManage') : t('tmLoginCreate')}</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('tmPeopleNote')}</p>
    </Card>
    {sheet?.kind === 'emp' && <EmpSheet e={sheet.e} onClose={() => setSheet(null)} onDone={reload} />}
    {sheet?.kind === 'login' && <LoginSheet e={sheet.e} onClose={() => setSheet(null)} onDone={reload} />}
  </>;
}

function EmpSheet({ e, onClose, onDone }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const aid = `emp:${e?.id || 'new'}`;
  const [f, setF] = useState({ name: e?.name || '', phone: e?.phone || '', level: e?.level || 'pm', is_active: e ? e.is_active : true });
  const set = p => { setF({ ...f, ...p }); actions.reset(aid); };
  const save = async () => {
    try {
      const r = await actions.run(aid, cfg => (e ? api.put(`/employees/${e.id}`, f, cfg) : api.post('/employees', f, cfg)));
      if (r) { toast(t('saved')); onDone(); onClose(); }
    } catch (x) { toast(x?.response ? errText(x, t('error')) : t('noAnswer'), 'bad'); }
  };
  return (
    <Sheet title={e ? e.name : t('tmAdd')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !f.name.trim()} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>
    </>}>
      <div className="dd-field"><label htmlFor="em_n">{t('tmName')}</label><input id="em_n" className="dd-inp" value={f.name} onChange={x => set({ name: x.target.value })} /></div>
      <div className="dd-form">
        <div className="dd-field"><label htmlFor="em_p">{t('phone')}</label><input id="em_p" className="dd-inp" inputMode="tel" value={f.phone} placeholder="+998" onChange={x => set({ phone: x.target.value })} /></div>
        <div className="dd-field"><label htmlFor="em_l">{t('tmLevel')}</label>
          <select id="em_l" className="dd-inp" value={f.level} onChange={x => set({ level: x.target.value })}>{LEVELS.map(l => <option key={l} value={l}>{t(`l_${l}`)}</option>)}</select></div>
      </div>
      {e && <label className="dd-row" style={{ gap: 8 }}><input type="checkbox" checked={f.is_active} onChange={x => set({ is_active: x.target.checked })} /> {t('tmActive')}</label>}
      {e?.has_login && f.level !== e.level && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('tmLevelRelogin')}</div>}
    </Sheet>
  );
}

// Вход сотрудника (учредитель): создать логин и пароль; заблокировать / разблокировать; новый пароль
function LoginSheet({ e, onClose, onDone }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [f, setF] = useState({ username: '', password: '' });
  const set = p => { setF({ ...f, ...p }); actions.reset('login'); actions.reset('pwd'); };
  const run = async (aid, fn, msg) => {
    try { const r = await actions.run(aid, fn); if (r) { toast(msg); onDone(); onClose(); } } catch (x) { toast(x?.response ? errText(x, t('error')) : t('noAnswer'), 'bad'); }
  };
  return (
    <Sheet title={`${t('tmLoginTitle')} · ${e.name}`} onClose={onClose} footer={<button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>}>
      {!e.has_login ? <>
        <p className="dd-note">{t('tmLoginNote', { role: t(`r_${{ pm: 'pm', trainee: 'pm', cashier: 'cashier', storekeeper: 'warehouse' }[e.level]}`) })}</p>
        <div className="dd-field"><label htmlFor="lg_u">{t('username')}</label><input id="lg_u" className="dd-inp" autoComplete="off" value={f.username} onChange={x => set({ username: x.target.value })} /></div>
        <div className="dd-field"><label htmlFor="lg_p">{t('password')}</label><input id="lg_p" className="dd-inp" type="password" autoComplete="new-password" value={f.password} onChange={x => set({ password: x.target.value })} /></div>
        <button type="button" className="dd-btn lg wide" disabled={!!actions.busy || !f.username.trim() || f.password.length < 4}
          onClick={() => run('login', cfg => api.post(`/employees/${e.id}/login`, f, cfg), t('tmLoginCreated'))}>{t('tmLoginCreate')}</button>
      </> : <>
        <div className="dd-check"><span>{t('username')}</span><b>{e.username}</b></div>
        <button type="button" className={`dd-btn lg wide ${e.is_blocked ? 'ok' : 'bad'}`} disabled={!!actions.busy}
          onClick={() => run('block', cfg => api.put(`/employees/${e.id}/login`, { is_blocked: !e.is_blocked }, cfg), e.is_blocked ? t('tmUnblocked') : t('tmBlockedOk'))}>
          {e.is_blocked ? t('tmUnblock') : t('tmBlock')}</button>
        <div className="dd-field"><label htmlFor="lg_np">{t('tmNewPassword')}</label><input id="lg_np" className="dd-inp" type="password" autoComplete="new-password" value={f.password} onChange={x => set({ password: x.target.value })} /></div>
        <button type="button" className="dd-btn ghost lg wide" disabled={!!actions.busy || f.password.length < 4}
          onClick={() => run('pwd', cfg => api.put(`/employees/${e.id}/login`, { password: f.password }, cfg), t('tmPasswordSet'))}>{t('tmSetPassword')}</button>
      </>}
    </Sheet>
  );
}

// ---------- Ставки за заказ: уровень × большой / малый ----------
function RatesTab() {
  const { t } = useT();
  const { can, toast } = useDecor();
  const [rates, err, reload] = useLoad(() => api.get('/rates').then(r => r.data), []);
  const [edit, setEdit] = useState({});
  const actions = useActions();
  if (!rates) return <Loading err={err} retry={reload} />;
  const val = (l, k) => rates.find(r => r.level === l && r.order_type === k)?.amount_usd ?? 0;
  const key = (l, k) => `${l}:${k}`;
  const save = async (l, k) => {
    const v = Number(edit[key(l, k)]);
    try {
      const r = await actions.run(`rate:${key(l, k)}:${v}`, cfg => api.put('/rates', { level: l, order_type: k, amount_usd: v }, cfg));
      if (r) { toast(t('tmRateSaved', { level: t(`l_${l}`), sum: fm(v) })); setEdit(e => { const n = { ...e }; delete n[key(l, k)]; return n; }); reload(); }
    } catch (x) { toast(x?.response ? errText(x, t('error')) : t('noAnswer'), 'bad'); }
  };
  const cell = (l, k) => (can('edit_settings') ? (
    <div className="dd-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <input className="dd-inp num" style={{ width: 90 }} inputMode="decimal" aria-label={`${t(`l_${l}`)} · ${t(k)}`} value={edit[key(l, k)] ?? String(val(l, k))}
        onChange={e => setEdit({ ...edit, [key(l, k)]: numIn(e.target.value) })} />
      {edit[key(l, k)] !== undefined && Number(edit[key(l, k)]) !== val(l, k) && edit[key(l, k)] !== ''
        && <button type="button" className="dd-btn sm" disabled={!!actions.busy} onClick={() => save(l, k)}><Icon name="check" size={14} /></button>}
    </div>) : <b className="num">{fm(val(l, k))}</b>);
  return (
    <Card>
      <h3>{t('tmRatesTitle')}</h3>
      <div className="dd-tw" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>{t('tmLevel')}</th><th>{t('big')}</th><th>{t('small')}</th></tr></thead>
          <tbody>{LEVELS.map(l => <tr key={l}><td><b>{t(`l_${l}`)}</b></td><td>{cell(l, 'big')}</td><td>{cell(l, 'small')}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('tmRatesNote')}</p>
    </Card>
  );
}

// ---------- Начисления и выплаты ----------
function PayTab({ pay, reload }) {
  const { t, lang } = useT();
  const { can, toast } = useDecor();
  const actions = useActions();
  const [confirm, setConfirm] = useState(null);
  const payOut = async p => {
    try {
      const r = await actions.run(`pay:${p.employee.id}:${p.due_usd}`, cfg => api.post('/payroll/pay', { employee_id: p.employee.id }, cfg));
      if (r) { toast(t('tmPaidOk', { name: p.employee.name, sum: fm(r.data.amount_usd) })); setConfirm(null); reload(); }
    } catch (x) { toast(x?.response ? errText(x, t('error')) : t('noAnswer'), 'bad'); }
  };
  return <>
    <Card>
      <h3>{t('tmPeopleDue')}</h3>
      <div className="dd-lines" style={{ marginTop: 10 }}>
        {pay.people.map(p => (
          <div key={p.employee.id} className="dd-line">
            <div className="dd-line-head"><b>{p.employee.name} <span className="dd-note">· {t(`l_${p.employee.level}`)}</span></b>
              {p.due_usd > 0 ? <Chip tone="warn">{t('tmDue')} {fm(p.due_usd)}</Chip> : <Chip tone="ok">{t('tmNothingDue')}</Chip>}</div>
            <div className="dd-line-head">
              <div className="dd-nums"><span>{t('tmOrders')} <b>{p.orders}</b></span><span>{t('tmPaid')} <b>{fm(p.paid_usd)}</b></span></div>
              {can('pay_team') && p.due_usd > 0 && <button type="button" className="dd-btn ok sm" disabled={!!actions.busy} onClick={() => setConfirm(p)}>{t('tmPay', { sum: fm(p.due_usd) })}</button>}
            </div>
          </div>
        ))}
      </div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('tmPayNote')}</p>
    </Card>
    <Card>
      <h3>{t('tmAccruals')}</h3>
      {!pay.accruals.length ? <div className="dd-empty">{t('tmNoAccruals')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {pay.accruals.map(a => (
            <div key={a.id} className="dd-line">
              <div className="dd-line-head"><b>{a.no} · {a.employee?.name}</b><b className="num">{fm(a.amount_usd)}</b></div>
              <div className="dd-nums"><span>{t(`l_${a.level}`)} · {t(a.order_type === 'big' ? 'bigShort' : 'smallShort')}</span><span>{fts(a.created_at, lang)}</span>
                <Chip tone={a.status === 'paid' ? 'ok' : 'warn'}>{t(a.status === 'paid' ? 'tmStPaid' : 'tmStDue')}</Chip></div>
            </div>
          ))}
        </div>
      )}
    </Card>
    <Card>
      <h3>{t('tmPayouts')}</h3>
      {!pay.payouts.length ? <div className="dd-empty">{t('tmNoPayouts')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {pay.payouts.map((x, i) => (
            <div key={i} className="dd-line">
              <div className="dd-line-head"><b>{x.employee?.name}</b><b className="num" style={{ color: 'var(--bad)' }}>−{fm(x.amount_usd)}</b></div>
              <div className="dd-nums"><span>{fts(x.paid_at, lang)}</span><span>{t('tmForOrders', { list: x.orders.join(', ') })}</span>{x.paid_by && <span>{t('tmPaidBy', { name: x.paid_by })}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
    {confirm && (
      <Sheet title={t('tmPayTitle', { name: confirm.employee.name })} onClose={() => setConfirm(null)} footer={<>
        <button type="button" className="dd-btn ghost lg" onClick={() => setConfirm(null)}>{t('cancel')}</button>
        <button type="button" className="dd-btn ok lg" disabled={!!actions.busy} onClick={() => payOut(confirm)}><Icon name="check" size={18} /> {t('tmPay', { sum: fm(confirm.due_usd) })}</button>
      </>}>
        <p>{t('tmPayConfirm', { name: confirm.employee.name, sum: fm(confirm.due_usd), cash: fm(pay.cash_box_usd) })}</p>
        <div className="dd-lines">{pay.accruals.filter(a => a.employee?.id === confirm.employee.id && a.status === 'due').map(a => (
          <div key={a.id} className="dd-line"><div className="dd-line-head"><span>{a.no}</span><b className="num">{fm(a.amount_usd)}</b></div></div>))}</div>
      </Sheet>
    )}
  </>;
}

// ---------- Мои начисления (без доступа к суммам команды) ----------
function MyTab({ my }) {
  const { t, lang } = useT();
  return <>
    <Card>
      <h3>{t('tmMyTitle')}</h3>
      <div className="dd-kpis" style={{ marginTop: 10 }}>
        <div><span>{t('tmDue')}</span><b className="num">{fm(my.due_usd || 0)}</b></div>
        <div><span>{t('tmPaid')}</span><b className="num">{fm(my.paid_usd || 0)}</b></div>
        <div><span>{t('tmOrders')}</span><b className="num">{my.orders || 0}</b></div>
      </div>
    </Card>
    <Card>
      <h3>{t('tmAccruals')}</h3>
      {!my.accruals?.length ? <Empty>{t('tmNoAccruals')}</Empty> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {my.accruals.map(a => (
            <div key={a.id} className="dd-line">
              <div className="dd-line-head"><b>{a.no}</b><b className="num">{fm(a.amount_usd)}</b></div>
              <div className="dd-nums"><span>{fts(a.created_at, lang)}</span><Chip tone={a.status === 'paid' ? 'ok' : 'warn'}>{t(a.status === 'paid' ? 'tmStPaid' : 'tmStDue')}</Chip></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  </>;
}
