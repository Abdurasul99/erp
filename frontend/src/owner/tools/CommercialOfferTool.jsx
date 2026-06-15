import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { CLIENTS, PRODUCTS, fmt } from '../data.js';
import { useTt } from '../tt.js';

export default function CommercialOfferTool() {
  const { tt } = useTt();
  const [step, setStep] = useState(0);
  const [client, setClient] = useState(null);
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(false);
  const total = items.reduce((s, i) => s + i.qty * i.sell, 0);

  return (
    <>
      <PageHeader title={`📄 ${tt('Коммерческое предложение')}`} sub={tt('Генератор КП за 3 шага · УТП включено')} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="📤" label={tt('Отправлено')} value="34" sub={tt('за месяц')} color="#5B4FE8" />
        <Tile icon="✅" label={tt('Конверсия')} value="28%" color="#22C55E" />
        <Tile icon="💰" label={tt('Средний чек')} value="14.2M" color="#FF6B2B" />
      </div>

      <Card icon="✨" title={tt('Наше УТП — встраивается в каждое КП')}>
        <div className="list">
          {[
            ['🚚', tt('Доставка 24ч'), tt('vs 3-5 дней у конкурентов')],
            ['💎', tt('Возврат 100%'), tt('70% конкурентов отказывают')],
            ['💰', tt('Цены ниже ЦБ'), tt('для опта от 100 ед')],
            ['🤝', tt('Личный менеджер'), tt('отвечает за час')],
          ].map(([i, t, s]) => (
            <div key={t} className="list-item">
              <span style={{ fontSize: 22 }}>{i}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--text3)' }}>{s}</div></div>
              <Badge tone="green">✓</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card icon="🎯" title={tt('Создать КП за 3 шага')} style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[`1. ${tt('Клиент')}`, `2. ${tt('Товары')}`, `3. ${tt('Готово')}`].map((s, i) => (
            <div key={s} style={{ flex: 1, padding: 10, borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 800, background: step >= i ? 'rgba(91,79,232,.1)' : 'var(--bg-2)', color: step >= i ? 'var(--primary)' : 'var(--text3)' }}>{s}</div>
          ))}
        </div>

        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {CLIENTS.filter(c => c.type === 'B2B').map(c => (
              <button key={c.id} className="btn btn-ghost" onClick={() => { setClient(c); setStep(1); }}
                style={{ justifyContent: 'flex-start', padding: 14 }}>
                🏢 {c.name}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <div style={{ marginBottom: 10, color: 'var(--text2)', fontSize: 13 }}>{tt('Клиент')}: <strong>{client.name}</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {PRODUCTS.slice(0, 9).map(p => {
                const inCart = items.find(i => i.id === p.id);
                return (
                  <button key={p.id} className="btn btn-ghost" onClick={() => {
                    setItems(items => items.find(i => i.id === p.id) ? items.filter(i => i.id !== p.id) : [...items, { ...p, qty: 10 }]);
                  }} style={{ justifyContent: 'flex-start', padding: 10, fontSize: 12, background: inCart ? 'rgba(91,79,232,.1)' : '#fff' }}>
                    {p.photo} {p.name}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{tt('Выбрано')}: <strong>{items.length}</strong> · {tt('Сумма')}: <strong className="mono" style={{ color: 'var(--primary)' }}>{fmt(total)} UZS</strong></span>
              <button className="btn btn-primary" disabled={items.length === 0} onClick={() => { setStep(2); setDone(true); }}>📄 {tt('Сформировать КП')}</button>
            </div>
          </>
        )}
      </Card>

      <Modal open={done} onClose={() => { setDone(false); setStep(0); setClient(null); setItems([]); }} title={tt('КП готово!')} icon="🎉" width={500}
        footer={<><button className="btn btn-ghost" onClick={() => toast(tt('PDF отправлен на') + ' ' + client?.phone, 'info')}>📱 {tt('По Telegram')}</button><button className="btn btn-primary" onClick={() => toast(tt('Email отправлен'))}>📧 {tt('Отправить email')}</button></>}>
        <div style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 50 }}>📄</div>
          <div style={{ fontWeight: 800, marginTop: 8, fontSize: 16 }}>КП #{Date.now().toString().slice(-6)}</div>
          <div style={{ color: 'var(--text3)', marginTop: 4 }}>{client?.name} · {items.length} {tt('позиций')} · <strong className="mono" style={{ color: 'var(--primary)' }}>{fmt(total)} UZS</strong></div>
        </div>
      </Modal>
    </>
  );
}
