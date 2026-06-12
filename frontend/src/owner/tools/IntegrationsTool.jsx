import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, fmtNum } from '../ui.jsx';

// Честные статусы интеграций: «Активна» — только то, что РЕАЛЬНО работает
// на сервере (проверяется backend-ом). Остальное — план развития, не фейк.
const CATALOG = [
  { key: 'deepseek',      ic: '🤖', n: 'AI-консультант (DeepSeek)', d: 'Чат · анализ финансов · рекомендации' },
  { key: 'eskiz_sms',     ic: '🔔', n: 'SMS UZ (Eskiz.uz)',         d: 'SMS-уведомления клиентам' },
  { key: 'telegram',      ic: '📱', n: 'Telegram Bot',              d: 'Уведомления и отчёты в Telegram' },
  { key: 'click',         ic: '💳', n: 'Click',                     d: 'Онлайн-оплата' },
  { key: 'payme',         ic: '💠', n: 'Payme',                     d: 'Онлайн-оплата' },
  { key: 'bank_client',   ic: '🏦', n: 'Банк-клиент',               d: 'Авто-разнесение выписки' },
  { key: 'accounting_1c', ic: '📦', n: '1С Бухгалтерия',            d: 'Выгрузка бухгалтеру' },
  { key: 'marketplaces',  ic: '🛒', n: 'OZON / Wildberries',        d: 'Синхронизация остатков' },
];

export default function IntegrationsTool() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    api.get('/settings/overview')
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const integrations = data?.integrations || {};
  const activeCount = Object.values(integrations).filter(Boolean).length;

  return (
    <>
      <PageHeader title="🔌 Интеграции" sub="Реальный статус подключений · без макетов" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile icon="🔌" label="Активных" value={fmtNum(activeCount)} sub={`из ${CATALOG.length} в каталоге`} color="#22C55E" />
            <Tile icon="🤖" label="AI-запросов" value={fmtNum(data.ai_requests_30d)} sub="за 30 дней" color="#5B4FE8" />
            <Tile icon="🧮" label="AI-токенов" value={fmtNum(data.ai_tokens_30d)} sub="за 30 дней" color="#0EA5E9" />
          </div>

          <div className="grid-3">
            {CATALOG.map(it => {
              const active = !!integrations[it.key];
              return (
                <Card key={it.key} style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 24 }} aria-hidden="true">{it.ic}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{it.n}</div>
                    </div>
                    <Badge tone={active ? 'green' : 'gray'}>{active ? 'Активна' : 'Не подключена'}</Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>{it.d}</div>
                  {active ? (
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ Работает на сервере</div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      Подключается администратором системы — напишите нам, если нужна в первую очередь.
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ Статус «Активна» означает, что интеграция реально работает на сервере прямо сейчас —
            здесь нет демонстрационных переключателей.
          </div>
        </>
      )}
    </>
  );
}
