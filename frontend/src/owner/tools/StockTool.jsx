import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { PRODUCTS, fmt } from '../data.js';
import { useTt } from '../tt.js';

export default function StockTool() {
  const { tt } = useTt();
  const [list] = useState(PRODUCTS.map(p => ({ ...p, addr: ['A','B','C','D'][p.id % 4] + '-' + (10 + p.id) + '-' + ((p.id % 9) + 1) })));
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const showing = list.filter(p => filter === 'all' ? true : filter === 'low' ? p.stock > 0 && p.stock < 10 : filter === 'out' ? p.stock === 0 : true);
  const totalValue = list.reduce((s, p) => s + p.stock * p.buy, 0);

  return (
    <>
      <PageHeader title={tt('📦 Остатки склада')} sub={tt('Текущие запасы · адресное хранение')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Запуск инвентаризации'), 'info')}>{tt('🔍 Инвентаризация')}</button>} />

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📦" label={tt('Позиций')} value={list.length} color="#5B4FE8" />
        <Tile icon="💰" label={tt('Стоимость')} value={(totalValue / 1e6).toFixed(1) + 'M'} sub={tt('UZS · по закупке')} color="#FF6B2B" />
        <Tile icon="⚠️" label={tt('Заканчиваются')} value={list.filter(p => p.stock > 0 && p.stock < 10).length} color="#F59E0B" />
        <Tile icon="🚫" label={tt('Нет')} value={list.filter(p => p.stock === 0).length} color="#EF4444" />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['all', tt('Все')], ['low', tt('⚠️ Мало')], ['out', tt('🚫 Нет в наличии')]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${filter===k?'#5B4FE8':'#E6E8F2'}`,
              background: filter===k?'rgba(91,79,232,.08)':'#fff', color: filter===k?'#5B4FE8':'#5C6080',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>
        <table>
          <thead><tr><th></th><th>{tt('Товар')}</th><th>{tt('Адрес')}</th><th style={{ textAlign: 'right' }}>{tt('Остаток')}</th><th style={{ textAlign: 'right' }}>{tt('Стоимость')}</th><th>{tt('Статус')}</th></tr></thead>
          <tbody>
            {showing.map(p => (
              <tr key={p.id} onClick={() => setOpen(p)} style={{ cursor: 'pointer' }}>
                <td><div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.photo}</div></td>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td><Badge tone="gray">{p.addr}</Badge></td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: p.stock === 0 ? '#dc2626' : p.stock < 10 ? '#d97706' : '#16a34a' }}>{p.stock} {p.unit}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{fmt(p.stock * p.buy)}</td>
                <td>{p.stock === 0 ? <Badge tone="red">{tt('нет')}</Badge> : p.stock < 10 ? <Badge tone="yellow">{tt('мало')}</Badge> : <Badge tone="green">{tt('в норме')}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={open != null} onClose={() => setOpen(null)} title={open?.name || ''} icon={open?.photo} width={520}
        footer={<><button className="btn btn-ghost" onClick={() => { toast(tt('Создать списание'), 'info'); setOpen(null); }}>{tt('🗑️ Списать')}</button><button className="btn btn-primary" onClick={() => { toast(tt('Создан приход на склад')); setOpen(null); }}>{tt('+ Приход')}</button></>}>
        {open && (
          <>
            <div className="grid-3">
              <Tile icon="📦" label={tt('Остаток')} value={open.stock + ' ' + open.unit} color="#5B4FE8" />
              <Tile icon="💰" label={tt('Закупка')} value={fmt(open.buy)} sub="UZS / " color="#FF6B2B" />
              <Tile icon="💎" label={tt('Продажа')} value={fmt(open.sell)} sub="UZS / " color="#22C55E" />
            </div>
            <div style={{ marginTop: 14, background: 'var(--bg-2)', borderRadius: 10, padding: 14, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                <span style={{ color: 'var(--text3)' }}>{tt('Штрих-код')}:</span><span className="mono"><strong>{open.sku}</strong></span>
                <span style={{ color: 'var(--text3)' }}>{tt('Адрес')}:</span><Badge tone="gray">{open.addr}</Badge>
                <span style={{ color: 'var(--text3)' }}>{tt('Тип')}:</span><span>{open.type}</span>
                <span style={{ color: 'var(--text3)' }}>{tt('Бренд')}:</span><span>{open.brand}</span>
                <span style={{ color: 'var(--text3)' }}>{tt('Стоимость')}:</span><span className="mono"><strong style={{ color: 'var(--primary)' }}>{fmt(open.stock * open.buy)} UZS</strong></span>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
