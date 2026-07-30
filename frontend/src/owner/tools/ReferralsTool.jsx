import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const STATUS_META = {
  pending:   { badge: 'yellow', label: 'Ожидает' },
  activated: { badge: 'green',  label: 'Активирован' },
  rejected:  { badge: 'red',    label: 'Отклонён' },
};

const PERIODS = [
  { value: '30',  label: '30 дней' },
  { value: '90',  label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: '0',   label: 'Всё время' },
];

const TABS = [
  { value: 'overview', label: 'Обзор' },
  { value: 'top',      label: 'Топ рефереров' },
  { value: 'list',     label: 'Все рефералы' },
  { value: 'actions',  label: 'Действия' },
  { value: 'rules',    label: 'Условия' },
];

const inputStyle = { maxWidth: 220, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)' };

// ID клиента — это идентификатор, а не количество. Держим его СТРОКОЙ и чистим
// в onChange всё кроме цифр: вставка «№ 1024» из буфера даёт «1024», а не пустоту.
// type="number" здесь был вреден: спиннеры + колёсико мыши при прокрутке страницы
// молча меняло ID (можно было привязать реферала к чужому клиенту).
// 9 цифр — предел INTEGER в БД, дальше сервер отдал бы 500.
const digitsOnly = (v) => String(v ?? '').replace(/[^\d]/g, '').slice(0, 9);
// Нормализация на blur (не в onChange — иначе не стереть первую цифру):
// «0012» → «12», «0» / «000» → пусто (нулевого клиента не существует).
const normId = (v) => {
  if (v === '') return '';
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

export default function ReferralsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('90');
  const [busy, setBusy] = useState(null);     // id реферала в активации / 'gen' / 'use'
  const [msg, setMsg] = useState(null);       // тост { tone, text }
  const [codeCustId, setCodeCustId] = useState('');
  const [genCode, setGenCode] = useState(null);
  const [useCode, setUseCode] = useState('');
  const [useRefId, setUseRefId] = useState('');

  const load = () => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/crm/referrals/top', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId, period]);

  const flash = (tone, text) => { setMsg({ tone, text }); setTimeout(() => setMsg(null), 4000); };

  // Активация ожидающего реферала → начисление бонуса рефереру (use → activate → bonus).
  const activate = (id) => {
    setBusy(id);
    api.post(`/crm/referrals/${id}/activate`)
      .then(() => { flash('green', tt('✓ Реферал активирован, бонус начислен')); load(); })
      .catch(e => flash(e.response?.status === 409 ? 'yellow' : 'red', e.response?.data?.error || e.message))
      .finally(() => setBusy(null));
  };

  // Генерация промокода FRIEND-<id> для клиента-реферера.
  const generateCode = () => {
    const cid = parseInt(codeCustId, 10);
    // Пустое / нечитаемое поле не уходит на сервер как NaN — просим ввести ID.
    if (!Number.isFinite(cid) || cid <= 0) return flash('red', tt('Укажите ID клиента-реферера'));
    setBusy('gen'); setGenCode(null);
    api.post('/crm/referrals/code', { customer_id: cid })
      .then(r => { setGenCode(r.data.code?.code); flash('green', tt('Промокод готов')); })
      .catch(e => flash('red', e.response?.data?.error || e.message))
      .finally(() => setBusy(null));
  };

  // Регистрация приглашения: привязать промокод к новому клиенту (создаёт pending-реферал).
  const registerUse = () => {
    const rid = parseInt(useRefId, 10);
    if (!useCode.trim() || !Number.isFinite(rid) || rid <= 0) return flash('red', tt('Укажите промокод и ID нового клиента'));
    setBusy('use');
    api.post('/crm/referrals/use', { code: useCode.trim(), referred_id: rid })
      .then(() => { flash('green', tt('✓ Приглашение зарегистрировано — ожидает первой покупки')); setUseCode(''); setUseRefId(''); load(); })
      .catch(e => flash(e.response?.status === 409 ? 'yellow' : 'red', e.response?.data?.error || e.message))
      .finally(() => setBusy(null));
  };

  const summary = data?.summary || {};
  const settings = data?.settings || {};
  const top = data?.top || [];
  const referrals = data?.referrals || [];

  const roiText = summary.roi != null ? `${summary.roi}x` : '—';
  const roiTone = summary.roi == null ? 'gray' : summary.roi >= 3 ? 'green' : summary.roi >= 1 ? 'yellow' : 'red';

  return (
    <>
      <PageHeader
        title={tt('🤝 Реферальная программа')}
        sub={tt('Приведи друга · бонус рефереру · скидка другу · ROI')}
        actions={<Badge tone={roiTone}>{tt('ROI')} {roiText}</Badge>}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} label={tt('Раздел')} />
        <div style={{ marginLeft: 'auto' }}>
          <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} label={tt('Период')} />
        </div>
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}
      {msg && <div style={{ marginBottom: 12 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <div className="grid-4" style={{ marginBottom: 16 }}>
                <Tile icon="🧑‍🤝‍🧑" label={tt('Активные рефереры')} value={fmtNum(summary.active_referrers)} sub={tt('приводят друзей')} color="#1D4ED8" />
                <Tile icon="🆕" label={tt('Новые рефералы')} value={fmtNum(summary.new_referred)} sub={tt('приглашённых клиентов')} color="#1D4ED8" />
                <Tile icon="💰" label={tt('Выручка рефералов')} value={fmtMoneyFull(summary.referral_revenue)} sub={tt('покупки приглашённых')} color="#16A34A" />
                <Tile icon="🎁" label={tt('Выплачено бонусов')} value={fmtMoneyFull(summary.bonuses_paid)} sub={tt('начислено рефереров')} color="#D97706" />
              </div>

              <Card icon="📈" title={tt('Окупаемость программы (ROI)')} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--primary)' }} className="mono">{roiText}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {tt('Выручка рефералов')} {fmtMoneyFull(summary.referral_revenue)} {tt('÷ бонусы')} {fmtMoneyFull(summary.bonuses_paid)}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                  {tt('Сколько сум выручки приносит 1 сум, потраченный на бонусы рефереров.')}
                </div>
              </Card>

              <Card icon="🏆" title={tt('Топ рефереров')}>
                {top.length === 0 ? (
                  <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                    {tt('Пока никто не приводил друзей')}
                  </div>
                ) : (
                  <div className="list">
                    {top.slice(0, 5).map((x, i) => (
                      <div key={x.referrer_id} className="list-item">
                        <div style={{ width: 30, textAlign: 'center', fontWeight: 900, color: 'var(--text3)' }} className="mono">{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="list-item-title">{x.name || tt('Без имени')}</div>
                          <div className="list-item-sub">{x.phone || ''}</div>
                        </div>
                        <Badge tone="green">{x.activated} / {x.invited}</Badge>
                        <div style={{ minWidth: 110, textAlign: 'right', fontWeight: 800 }} className="mono">{fmtMoneyFull(x.bonus_earned)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === 'top' && (
            <Card icon="🏆" title={`${tt('Топ рефереров')} (${top.length})`}>
              {top.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>{tt('Нет данных')}</div>
              ) : (
                <div className="list">
                  {top.map((x, i) => (
                    <div key={x.referrer_id} className="list-item" style={{ alignItems: 'center' }}>
                      <div style={{ width: 30, textAlign: 'center', fontWeight: 900, color: 'var(--text3)' }} className="mono">{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="list-item-title">{x.name || tt('Без имени')}</div>
                        <div className="list-item-sub">{x.phone || ''}</div>
                      </div>
                      <Badge tone="blue">{tt('Приглашено')} {x.invited}</Badge>
                      <Badge tone="green">{tt('Активировано')} {x.activated}</Badge>
                      <div style={{ minWidth: 120, textAlign: 'right' }}>
                        <div style={{ fontWeight: 800 }} className="mono">{fmtMoneyFull(x.revenue)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('бонус')} {fmtMoneyFull(x.bonus_earned)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'list' && (
            <Card icon="📋" title={`${tt('Все рефералы за период')} (${referrals.length})`}>
              {referrals.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>{tt('Нет рефералов за выбранный период')}</div>
              ) : (
                <div className="list">
                  {referrals.map(r => {
                    const st = STATUS_META[r.status] || { badge: 'gray', label: r.status };
                    return (
                      <div key={r.id} className="list-item" style={{ alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="list-item-title">
                            {r.referrer_name || tt('Реферер')} <span style={{ color: 'var(--text3)' }}>→</span> {r.referred_name || tt('Друг')}
                          </div>
                          <div className="list-item-sub">
                            {r.promo_code} · {tt('скидка')} {r.discount_pct != null ? `${r.discount_pct}%` : '—'}
                            {r.referred_revenue ? ` · ${tt('выручка')} ${fmtMoneyFull(r.referred_revenue)}` : ''}
                          </div>
                        </div>
                        {r.bonus_amount ? <div style={{ minWidth: 100, textAlign: 'right', fontWeight: 800 }} className="mono">{fmtMoneyFull(r.bonus_amount)}</div> : null}
                        {r.status === 'pending' && (
                          <button className="btn btn-sm" disabled={busy === r.id}
                            title={tt('Активировать и начислить бонус рефереру')}
                            onClick={() => activate(r.id)}>
                            {busy === r.id ? tt('...') : tt('Активировать')}
                          </button>
                        )}
                        <Badge tone={st.badge}>{tt(st.label)}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === 'actions' && (
            <>
              <Card icon="🎟️" title={tt('Сгенерировать промокод')} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                  {tt('Создаёт код вида FRIEND-<ID> для клиента-реферера. Укажите ID клиента (из карточки клиента).')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" inputMode="numeric" placeholder={tt('ID клиента-реферера')} style={inputStyle}
                    value={codeCustId}
                    onChange={e => setCodeCustId(digitsOnly(e.target.value))}
                    onBlur={() => setCodeCustId(v => normId(v))} />
                  <button className="btn" disabled={busy === 'gen'} onClick={generateCode}>
                    {busy === 'gen' ? tt('...') : tt('Создать код')}
                  </button>
                  {genCode && <Badge tone="green">{genCode}</Badge>}
                </div>
              </Card>
              <Card icon="🔗" title={tt('Зарегистрировать приглашение')}>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                  {tt('Привязывает промокод к новому клиенту (другу). После первой покупки от порога активируйте реферал во вкладке «Все рефералы».')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input placeholder={tt('Промокод (FRIEND-…)')} style={inputStyle}
                    value={useCode} onChange={e => setUseCode(e.target.value)} />
                  <input type="text" inputMode="numeric" placeholder={tt('ID нового клиента')} style={inputStyle}
                    value={useRefId}
                    onChange={e => setUseRefId(digitsOnly(e.target.value))}
                    onBlur={() => setUseRefId(v => normId(v))} />
                  <button className="btn" disabled={busy === 'use'} onClick={registerUse}>
                    {busy === 'use' ? tt('...') : tt('Зарегистрировать')}
                  </button>
                </div>
              </Card>
            </>
          )}

          {tab === 'rules' && (
            <Card icon="⚙️" title={tt('Условия программы')}>
              <div className="grid-2">
                <Tile icon="🛒" label={tt('Мин. первая покупка')} value={fmtMoneyFull(settings.min_purchase_uzs)} sub={tt('для активации бонуса')} color="#1D4ED8" />
                <Tile icon="🎁" label={tt('Бонус рефереру')} value={fmtMoneyFull(settings.bonus_to_referrer)} sub={tt('за каждого друга')} color="#D97706" />
                <Tile icon="🏷️" label={tt('Скидка другу')} value={`${settings.discount_pct ?? '—'}%`} sub={tt('на первую покупку')} color="#16A34A" />
                <Tile icon="⏳" label={tt('Срок действия бонуса')} value={`${settings.validity_days ?? '—'} ${tt('дн.')}`} sub={tt('до сгорания')} color="#1D4ED8" />
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                {tt('Клиент получает промокод вида')} <b>FRIEND-&lt;id&gt;</b>. {tt('Друг приходит по коду и получает скидку на первую покупку. После первой покупки от порога реферер получает бонус на баланс.')}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}