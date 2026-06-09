import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

const INIT = [
  { ic: '📱', n: 'Telegram Bot', stat: 'on', d: 'Уведомления, отчёты' },
  { ic: '💱', n: 'Курсы валют ЦБ', stat: 'on', d: 'USD/RUB/EUR ежедневно' },
  { ic: '💬', n: 'WhatsApp Cloud', stat: 'wait', d: 'Двусторонняя переписка' },
  { ic: '📧', n: 'Email (Gmail)', stat: 'on', d: 'Рассылки, КП' },
  { ic: '🔔', n: 'SMS UZ (Eskiz.uz)', stat: 'on', d: 'SMS уведомления' },
  { ic: '💳', n: 'Click', stat: 'on', d: 'Онлайн-оплата' },
  { ic: '💎', n: 'Payme', stat: 'on', d: 'Онлайн-оплата' },
  { ic: '🏦', n: 'Банк-клиент', stat: 'wait', d: 'Авто-разнесение выписки' },
  { ic: '📊', n: 'Google Analytics', stat: 'off', d: 'Источники трафика' },
  { ic: '🛒', n: 'OZON / WB', stat: 'off', d: 'Синхронизация остатков' },
  { ic: '🚚', n: 'Yandex.Delivery', stat: 'wait', d: 'Курьеры API' },
  { ic: '📦', n: '1C Бухгалтерия', stat: 'off', d: 'Выгрузка бухгалтеру' },
];

export default function IntegrationsTool() {
  const [list, setList] = useState(INIT);
  const toggle = (n) => setList(l => l.map(x => x.n === n ? { ...x, stat: x.stat === 'on' ? 'off' : 'on' } : x));
  return (
    <>
      <PageHeader title="🔌 Интеграции" sub="12 систем · API · webhooks" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🔌" label="Активных" value={list.filter(x => x.stat === 'on').length} sub="из " color="#5B4FE8" />
        <Tile icon="📡" label="Запросов API" value="48K" sub="за месяц" color="#FF6B2B" />
        <Tile icon="⚠️" label="Ошибок" value="2" sub="за неделю" color="#EF4444" />
      </div>
      <div className="grid-3">
        {list.map(i => (
          <Card key={i.n} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 28 }}>{i.ic}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{i.n}</div>
                <Badge tone={i.stat === 'on' ? 'green' : i.stat === 'wait' ? 'yellow' : 'gray'}>{i.stat === 'on' ? 'Активна' : i.stat === 'wait' ? 'Скоро' : 'Не подключена'}</Badge>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>{i.d}</div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}
              onClick={() => { toggle(i.n); toast(i.n + ': ' + (i.stat === 'on' ? 'отключена' : 'подключена')); }}>
              {i.stat === 'on' ? '🔴 Отключить' : '🟢 Подключить'}
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}
