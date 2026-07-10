import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const STAGES = ['Лид', 'Квалификация', 'Переговоры', 'КП', 'Договор', 'Оплачено'];

export default function B2BTool() {
  const { tt } = useTt();
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
      <PageHeader title={tt('🏢 B2B / B2G сделки')} sub={tt('Корпоративный pipeline · PITCH · тарифы')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Открыта форма новой сделки'))}>+ {tt('Сделка')}</button>} />
      <div className="grid-5" style={{ marginBottom: 18 }}>
        <Tile icon="📞" label={tt('Лидов')} value={deals.filter(d => d.stage === 0).length} color="#94A0B5" />
        <Tile icon="💌" label={tt('КП отправлено')} value={deals.filter(d => d.stage === 3).length} color="#1D4ED8" />
        <Tile icon="🤝" label={tt('В договоре')} value={deals.filter(d => d.stage === 4).length} color="#D97706" />
        <Tile icon="✅" label={tt('Выиграно')} value={deals.filter(d => d.stage === 5).length} color="#16A34A" />
        <Tile icon="💰" label={tt('Пайплайн')} value={fmtMoneyFull(deals.reduce((s, d) => s + d.value, 0))} color="#0EA5E9" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {STAGES.map((s, si) => (
          <div key={s} style={{ minHeight: 320 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8, textAlign: 'center' }}>{tt(s)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.filter(d => d.stage === si).map(d => (
                <div key={d.id} onClick={() => setOpen(d)} style={{
                  background: '#fff', padding: 12, borderRadius: 10, cursor: 'pointer',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{d.id}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, margin: '4px 0' }}>{d.client}</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{fmtMoneyFull(d.value)} UZS</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>👤 {d.owner}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open != null} onClose={() => setOpen(null)} title={open?.client} icon="🏢"
        footer={<><button className="btn btn-ghost" onClick={() => { moveDeal(open.id, -1); setOpen({ ...open, stage: open.stage - 1 }); toast(tt('Сделка возвращена назад')); }}>{tt('← Назад')}</button>
                  <button className="btn btn-primary" onClick={() => { moveDeal(open.id, +1); setOpen({ ...open, stage: open.stage + 1 }); toast(tt('Сделка продвинута')); }}>{tt('Дальше →')}</button></>}>
        {open && (
          <>
            <div className="grid-2" style={{ marginBottom: 14 }}>
              <Tile icon="💰" label={tt('Сумма')} value={fmtMoneyFull(open.value)} color="#1D4ED8" />
              <Tile icon="🎯" label={tt('Стадия')} value={tt(STAGES[open.stage])} color="#D97706" />
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12, fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}><strong>{tt('Ответственный')}:</strong> {open.owner}</div>
              <div><strong>ID:</strong> <span className="mono">{open.id}</span></div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
