import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { CLIENTS, fmt } from '../data.js';

export default function CrmTool() {
  const [list, setList] = useState(CLIENTS);
  const [open, setOpen] = useState(null);
  const [search, setSearch] = useState('');
  const filtered = list.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <>
      <PageHeader title="👥 Клиентская база" sub="2 184 активных · история · сегменты"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Форма добавления — клик ✕ в карточке клиента → «Создать на основе»', 'info')}>+ Клиент</button>} />

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="👥" label="Активных" value={list.filter(c => c.status === 'active').length} color="#5B4FE8" />
        <Tile icon="💎" label="VIP" value={list.filter(c => c.tag === 'VIP').length} color="#FF6B2B" />
        <Tile icon="😴" label="Спящих" value={list.filter(c => c.status === 'sleeping').length} color="#F59E0B" />
        <Tile icon="💰" label="Общий LTV" value={(list.reduce((s, c) => s + c.ltv, 0) / 1e6).toFixed(0) + 'M'} color="#22C55E" />
      </div>

      <Card>
        <input className="input" placeholder="🔍 Поиск по имени или телефону..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 14, maxWidth: 400 }} />
        <table>
          <thead><tr><th>Клиент</th><th>Тип</th><th>Тег</th><th>Телефон</th><th style={{ textAlign: 'right' }}>LTV</th><th style={{ textAlign: 'right' }}>Сделок</th><th>Статус</th></tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} onClick={() => setOpen(c)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 700 }}>{c.name}</td>
                <td><Badge tone={c.type === 'B2B' ? 'purple' : 'blue'}>{c.type}</Badge></td>
                <td><Badge tone={c.tag === 'VIP' ? 'orange' : c.tag === 'Спящий' ? 'yellow' : c.tag === 'Ушёл' ? 'red' : 'green'}>{c.tag}</Badge></td>
                <td className="mono" style={{ fontSize: 12 }}>{c.phone}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmt(c.ltv)}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{c.deals}</td>
                <td>{c.status === 'active' && <Badge tone="green">●  активен</Badge>}{c.status === 'sleeping' && <Badge tone="yellow">●  спит</Badge>}{c.status === 'lost' && <Badge tone="red">●  ушёл</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={open != null} onClose={() => setOpen(null)} title={open?.name || ''} icon={open?.type === 'B2B' ? '🏢' : '👤'} width={600}
        footer={<><button className="btn btn-ghost" onClick={() => { toast('Звонок инициирован: ' + open.phone, 'info'); }}>📞 Позвонить</button><button className="btn btn-primary" onClick={() => { toast('Открыта форма создания сделки'); setOpen(null); }}>+ Сделка</button></>}>
        {open && (
          <>
            <div className="grid-3" style={{ marginBottom: 18 }}>
              <Tile icon="💰" label="LTV" value={fmt(open.ltv)} sub="UZS" color="#5B4FE8" />
              <Tile icon="🧾" label="Сделок" value={open.deals} color="#FF6B2B" />
              <Tile icon="📅" label="Посл. покупка" value={open.lastDate.slice(5)} color="#22C55E" />
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text3)' }}>Телефон:</span><span className="mono"><strong>{open.phone}</strong></span>
                <span style={{ color: 'var(--text3)' }}>Тип:</span><Badge tone={open.type === 'B2B' ? 'purple' : 'blue'}>{open.type}</Badge>
                <span style={{ color: 'var(--text3)' }}>Тег:</span><Badge tone="orange">{open.tag}</Badge>
                <span style={{ color: 'var(--text3)' }}>Статус:</span><span style={{ fontWeight: 700 }}>{open.status}</span>
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>История взаимодействий</div>
            {[
              { d: open.lastDate, e: 'Покупка', n: 'Бейсболка синяя × 2, Шахматы × 1 · 580K UZS' },
              { d: '2026-04-12', e: 'Звонок',   n: 'Уточнение по доставке · 6 мин' },
              { d: '2026-04-10', e: 'NPS',      n: '9/10 — «Доставка быстрая, ассортимент богатый»' },
              { d: '2026-03-28', e: 'Покупка',  n: 'Латун шамдон × 1 · 580K UZS' },
              { d: '2026-03-15', e: 'Email',    n: 'Отправлена акция «Весна-2026»' },
            ].map((h, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 2 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text3)', minWidth: 80 }}>{h.d}</span>
                  <Badge tone="blue">{h.e}</Badge>
                </div>
                <div style={{ color: 'var(--text2)', paddingLeft: 90 }}>{h.n}</div>
              </div>
            ))}
          </>
        )}
      </Modal>
    </>
  );
}
