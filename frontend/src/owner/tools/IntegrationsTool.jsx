import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';

// Честные статусы: «Активна» — реально подключено (DeepSeek по env, Telegram по БД).
// Telegram — self-serve (подключает сам владелец). Остальное требует договора/кабинета.
const CATALOG = [
  { key: 'deepseek',      ic: '🤖', n: 'AI-консультант (Wave AI)', d: 'Чат · анализ финансов · рекомендации', need: 'server' },
  { key: 'telegram',      ic: '📱', n: 'Telegram Bot',              d: 'Уведомления и отчёты в Telegram',       need: 'self' },
  { key: 'eskiz_sms',     ic: '🔔', n: 'SMS UZ (Eskiz.uz)',         d: 'SMS-уведомления клиентам',              need: 'account' },
  { key: 'click',         ic: '💳', n: 'Click',                     d: 'Онлайн-оплата',                         need: 'merchant' },
  { key: 'payme',         ic: '💠', n: 'Payme',                     d: 'Онлайн-оплата',                         need: 'merchant' },
  { key: 'uzum',          ic: '🟣', n: 'Uzum',                      d: 'Оплата · маркетплейс',                  need: 'merchant' },
  { key: 'marketplaces',  ic: '🛒', n: 'OZON / Wildberries',        d: 'Синхронизация остатков и заказов',      need: 'seller' },
  { key: 'bank_client',   ic: '🏦', n: 'Банк-клиент',               d: 'Авто-разнесение выписки',               need: 'bank' },
  { key: 'accounting_1c', ic: '📦', n: '1С Бухгалтерия',            d: 'Выгрузка бухгалтеру',                   need: 'file' },
];

const NEED_NOTE = {
  account:  'Нужен аккаунт Eskiz.uz. Подключим по запросу — напишите нам.',
  merchant: 'Нужен мерчант-договор с провайдером (даёт ключи). Есть договор — напишите нам, подключим.',
  seller:   'Нужен кабинет продавца на маркетплейсе и API-ключ. Есть — напишите нам.',
  bank:     'Нужен доступ к интернет-банку компании. Подключим по запросу.',
  file:     'Выгрузка в формате 1С. Подключим по запросу.',
};

export default function IntegrationsTool() {
  const { tt } = useTt();
  const [data, setData] = useState(null);
  const [integ, setInteg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = async () => {
    try {
      const [ov, ig] = await Promise.all([api.get('/settings/overview'), api.get('/integrations')]);
      setData(ov.data); setInteg(ig.data); setError(null);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const statuses = integ?.integrations || {};
  const deepseekOn = !!(integ?.env?.deepseek ?? data?.integrations?.deepseek);
  const isConnected = (key) => key === 'deepseek' ? deepseekOn : statuses[key]?.status === 'connected';
  const activeCount = CATALOG.filter(it => isConnected(it.key)).length;

  return (
    <>
      <PageHeader title={tt('🔌 Интеграции')} sub={tt('Подключение и синхронизация внешних сервисов')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile icon="🔌" label={tt('Активных')} value={fmtNum(activeCount)} sub={`${tt('из')} ${CATALOG.length} ${tt('в каталоге')}`} color="#16A34A" />
            <Tile icon="🤖" label={tt('AI-запросов')} value={fmtNum(data.ai_requests_30d)} sub={tt('за 30 дней')} color="#1D4ED8" />
            <Tile icon="🧮" label={tt('AI-токенов')} value={fmtNum(data.ai_tokens_30d)} sub={tt('за 30 дней')} color="#0EA5E9" />
          </div>

          <div className="grid-3">
            {CATALOG.map(it => (
              it.key === 'telegram'
                ? <TelegramCard key="telegram" status={statuses.telegram} onReload={reload} />
                : <ServiceCard key={it.key} it={it} active={isConnected(it.key)} />
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            {tt('ℹ️ Telegram подключается вами самостоятельно за пару минут. Платёжные и маркетплейс-интеграции требуют договора/кабинета у провайдера — напишите нам, подключим.')}
          </div>
        </>
      )}
    </>
  );
}

function CardHead({ ic, name, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 24 }} aria-hidden="true">{ic}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{name}</div></div>
      {badge}
    </div>
  );
}

function ServiceCard({ it, active }) {
  const { tt } = useTt();
  return (
    <Card style={{ padding: 18 }}>
      <CardHead ic={it.ic} name={tt(it.n)} badge={<Badge tone={active ? 'green' : 'gray'}>{active ? tt('Активна') : tt('Не подключена')}</Badge>} />
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>{tt(it.d)}</div>
      {active ? (
        <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{tt('✓ Работает на сервере')}</div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tt(NEED_NOTE[it.need] || 'Подключается по запросу — напишите нам.')}</div>
      )}
    </Card>
  );
}

function TelegramCard({ status, onReload }) {
  const { tt } = useTt();
  const connected = status?.status === 'connected';
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [chats, setChats] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const detect = async () => {
    if (!token.trim()) { setMsg({ t: 'err', m: tt('Сначала вставьте токен бота') }); return; }
    setBusy('detect'); setMsg(null);
    try {
      const r = await api.post('/integrations/telegram/detect', { bot_token: token.trim() });
      setChats(r.data.chats || []);
      if (!(r.data.chats || []).length) setMsg({ t: 'warn', m: tt('Чаты не найдены. Откройте бота в Telegram, нажмите «Старт», затем повторите.') });
    } catch (e) { setMsg({ t: 'err', m: e.response?.data?.error || e.message }); }
    setBusy('');
  };
  const connect = async () => {
    if (!token.trim() || !chatId.trim()) { setMsg({ t: 'err', m: tt('Нужны токен и chat_id') }); return; }
    setBusy('connect'); setMsg(null);
    try {
      await api.post('/integrations/telegram/connect', { bot_token: token.trim(), chat_id: chatId.trim() });
      setOpen(false); setToken(''); setChatId(''); setChats(null);
      await onReload();
    } catch (e) { setMsg({ t: 'err', m: e.response?.data?.error || e.message }); }
    setBusy('');
  };
  const send = async (path) => {
    setBusy(path); setMsg(null);
    try { await api.post('/integrations/telegram/' + path); setMsg({ t: 'ok', m: tt('Отправлено в Telegram ✓') }); await onReload(); }
    catch (e) { setMsg({ t: 'err', m: e.response?.data?.error || e.message }); }
    setBusy('');
  };
  const disconnect = async () => {
    setBusy('disc'); setMsg(null);
    try { await api.delete('/integrations/telegram'); await onReload(); }
    catch (e) { setMsg({ t: 'err', m: e.response?.data?.error || e.message }); }
    setBusy('');
  };

  const msgColor = msg?.t === 'ok' ? 'var(--green)' : msg?.t === 'warn' ? 'var(--orange)' : 'var(--red)';

  return (
    <Card style={{ padding: 18 }}>
      <CardHead ic="📱" name={tt('Telegram Bot')} badge={<Badge tone={connected ? 'green' : 'gray'}>{connected ? tt('Активна') : tt('Не подключена')}</Badge>} />
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>{tt('Уведомления и отчёты в Telegram')}</div>

      {connected ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700, marginBottom: 8 }}>
            ✓ @{status.info?.bot_username || 'bot'} · chat {status.info?.chat_id}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => send('report')}>{busy === 'report' ? '…' : tt('📊 Отчёт сейчас')}</button>
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => send('test')}>{busy === 'test' ? '…' : tt('Тест')}</button>
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={disconnect} style={{ color: 'var(--red)' }}>{busy === 'disc' ? '…' : tt('Отключить')}</button>
          </div>
        </>
      ) : !open ? (
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>{tt('🔗 Подключить')}</button>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 10 }}>
            <div><b>1.</b> {tt('В Telegram откройте @BotFather → /newbot → скопируйте токен')}</div>
            <div><b>2.</b> {tt('Откройте своего бота и нажмите «Старт» (или добавьте в группу)')}</div>
            <div><b>3.</b> {tt('Вставьте токен ниже и нажмите «Найти чат»')}</div>
          </div>

          <label className="label">{tt('Токен бота')}</label>
          <input className="input" value={token} onChange={e => setToken(e.target.value)} placeholder="123456:ABC-..." style={{ marginBottom: 8 }} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={busy === 'detect'} onClick={detect}>{busy === 'detect' ? '…' : tt('🔍 Найти чат')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setMsg(null); setChats(null); }}>{tt('Отмена')}</button>
          </div>

          {chats && chats.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{tt('Выберите чат для уведомлений:')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chats.map(c => (
                  <button key={c.id} className="btn btn-sm" onClick={() => setChatId(c.id)}
                    style={{ border: chatId === c.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: chatId === c.id ? 'rgba(29,78,216,.08)' : 'transparent' }}>
                    {c.title} <span style={{ color: 'var(--text3)' }}>· {c.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="label">{tt('Chat ID')}</label>
          <input className="input" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="123456789" style={{ marginBottom: 10 }} />

          <button className="btn btn-primary btn-sm" disabled={busy === 'connect'} onClick={connect}>{busy === 'connect' ? tt('Подключение…') : tt('Подключить')}</button>
        </div>
      )}

      {msg && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: msgColor }}>{msg.m}</div>}
    </Card>
  );
}
