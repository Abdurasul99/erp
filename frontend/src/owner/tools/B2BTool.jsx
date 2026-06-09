import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';

const STAGES = ['Лид', 'Квалификация', 'Переговоры', 'КП', 'Договор', 'Оплачено'];

export default function B2BTool() {
  const [deals, setDeals] = useState([
    { id: 'D-2401', client: 'ООО «Меркурий»',  stage: 2, value: 24500000, owner: 'Anvar S.' },
    { id: 'D-2402', client: 'ЧП «Барс»',        stage: 3, value: 8200000,  owner: 'Diana K.' },
    { id: 'D-2403', client: 'TashTrade LLC',    stage: 4, value: 42000000, owner: 'Anvar S.' },
    { id: 'D-2404', client: 'Khorezm Mebel',    stage: 5, value: 17800000, owner: 'Bekzod M.' },
    { id: 'D-2405', client: 'Tashkent Hotel',   stage: 1, value: 12000000, owner: 'Malika T.' },
    { id: 'D-2406', client: 'ГУП Старт',        stage: 0, value: 6500000,  owner: 'Aziz R.' },
  ]);
  const [open, setOpen] = useState(null);

  const moveDeal = (id, dir) => setDeals(d => d.map(x => x.id === id ? { ...x, stage: Math.max(0, Math.min(5, x.stage + dir)) } : x));

  return (
    <>
      <PageHeader title="🏢 B2B / B2G сделки" sub="Корпоративный pipeline · PITCH · тарифы"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Открыта форма новой сделки')}>+ Сделка</button>} />
      <div className="grid-5" style={{ marginBottom: 18 }}>
        <Tile icon="📞" label="Лидов" value={deals.filter(d => d.stage === 0).length} color="#9094B0" />
        <Tile icon="💌" label="КП отправлено" value={deals.filter(d => d.stage === 3).length} color="#5B4FE8" />
        <Tile icon="🤝" label="В договоре" value={deals.filter(d => d.stage === 4).length} color="#FF6B2B" />
        <Tile icon="✅" label="Выиграно" value={deals.filter(d => d.stage === 5).length} color="#22C55E" />
        <Tile icon="💰" label="Пайплайн" value={(deals.reduce((s, d) => s + d.value, 0) / 1e6).toFixed(1) + 'M'} color="#0EA5E9" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {STAGES.map((s, si) => (
          <div key={s} style={{ minHeight: 320 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8, textAlign: 'center' }}>{s}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.filter(d => d.stage === si).map(d => (
                <div key={d.id} onClick={() => setOpen(d)} style={{
                  background: '#fff', padding: 12, borderRadius: 10, cursor: 'pointer',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{d.id}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, margin: '4px 0' }}>{d.client}</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{(d.value / 1e6).toFixed(1)}M UZS</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>👤 {d.owner}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open != null} onClose={() => setOpen(null)} title={open?.client} icon="🏢"
        footer={<><button className="btn btn-ghost" onClick={() => { moveDeal(open.id, -1); setOpen({ ...open, stage: open.stage - 1 }); toast('Сделка возвращена назад'); }}>← Назад</button>
                  <button className="btn btn-primary" onClick={() => { moveDeal(open.id, +1); setOpen({ ...open, stage: open.stage + 1 }); toast('Сделка продвинута'); }}>Дальше →</button></>}>
        {open && (
          <>
            <div className="grid-2" style={{ marginBottom: 14 }}>
              <Tile icon="💰" label="Сумма" value={(open.value / 1e6).toFixed(1) + 'M'} color="#5B4FE8" />
              <Tile icon="🎯" label="Стадия" value={STAGES[open.stage]} color="#FF6B2B" />
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12, fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}><strong>Ответственный:</strong> {open.owner}</div>
              <div><strong>ID:</strong> <span className="mono">{open.id}</span></div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
