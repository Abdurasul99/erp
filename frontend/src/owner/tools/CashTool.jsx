import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader, Sparkline } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { fmt } from '../data.js';
import { useTt } from '../tt.js';

export default function CashTool() {
  const { tt } = useTt();
  const [adding, setAdding] = useState(null); // 'income' | 'expense' | null
  const [form, setForm] = useState({ amount: 0, desc: '', pm: 'cash' });
  const submit = () => {
    if (!form.amount) { toast(tt('Введите сумму'), 'error'); return; }
    toast(`${adding === 'income' ? tt('✓ Приход') : tt('↓ Расход')} ${fmt(form.amount)} UZS ${tt('зарегистрирован')}`);
    setAdding(null);
    setForm({ amount: 0, desc: '', pm: 'cash' });
  };
  return (
    <>
      <PageHeader title={tt('🏦 Касса')} sub={tt('Приход · расход по методам оплаты')}
        actions={<><button className="btn btn-orange btn-sm" onClick={() => setAdding('expense')}>− {tt('Расход')}</button><button className="btn btn-primary btn-sm" onClick={() => setAdding('income')}>+ {tt('Приход')}</button></>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="💰" label={tt('Баланс')} value="148 200 000" sub="UZS" color="#16A34A" />
        <Tile icon="📥" label={tt('Приход (день)')} value="+8.4M" delta={12} color="#1D4ED8" />
        <Tile icon="📤" label={tt('Расход (день)')} value="−2.1M" color="#DC2626" />
        <Tile icon="⏳" label={tt('Ждёт от продавцов')} value="4 200 000" color="#D97706" />
      </div>
      <div className="grid-2">
        <Card icon="💳" title={tt('По способам оплаты')}>
          {[
            { n: '💵 Наличные', v: '48 200 000', pct: 28, c: '#16A34A' },
            { n: '💳 Карта', v: '62 100 000', pct: 37, c: '#0EA5E9' },
            { n: '🏦 Перевод', v: '34 500 000', pct: 21, c: '#1D4ED8' },
            { n: '📑 Перечисление', v: '23 600 000', pct: 14, c: '#1D4ED8' },
          ].map(r => (
            <div key={r.n} className="list-item">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{tt(r.n)}</span>
                  <span className="mono" style={{ fontWeight: 800, color: r.c }}>{r.v}</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{ width: r.pct + '%', background: r.c }} /></div>
              </div>
            </div>
          ))}
        </Card>
        <Card icon="📈" title={tt('Cash Flow (7 дней)')}>
          <Sparkline data={[22, 26, 31, 38, 42, 45, 51]} color="#16A34A" />
          <div className="grid-3" style={{ marginTop: 14, fontSize: 12 }}>
            <div><div style={{ color: 'var(--text3)' }}>{tt('Приход')}</div><div className="mono" style={{ fontWeight: 800, color: 'var(--green)' }}>+154M</div></div>
            <div><div style={{ color: 'var(--text3)' }}>{tt('Расход')}</div><div className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>−82M</div></div>
            <div><div style={{ color: 'var(--text3)' }}>{tt('Сальдо')}</div><div className="mono" style={{ fontWeight: 800 }}>+72M</div></div>
          </div>
        </Card>
      </div>

      <Modal open={adding != null} onClose={() => setAdding(null)} title={adding === 'income' ? tt('Приход денег') : tt('Расход денег')} icon={adding === 'income' ? '📥' : '📤'}
        footer={<><button className="btn btn-ghost" onClick={() => setAdding(null)}>{tt('Отмена')}</button><button className="btn btn-primary" onClick={submit}>{tt('Сохранить')}</button></>}>
        <label className="label">{tt('Сумма (UZS)')}</label><input type="number" className="input mono" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} style={{ fontSize: 18, textAlign: 'center' }} />
        <div style={{ marginTop: 12 }}><label className="label">{tt('Способ')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['cash', 'card', 'transfer', 'wire'].map(p => (
              <button key={p} onClick={() => setForm({ ...form, pm: p })} style={{
                flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid ' + (form.pm === p ? '#1D4ED8' : '#E3EAF3'),
                background: form.pm === p ? 'rgba(29,78,216,.08)' : '#fff', color: form.pm === p ? '#1D4ED8' : 'var(--text2)',
                cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
              }}>{ {cash: tt('💵 Нал'), card: tt('💳 Карта'), transfer: tt('🏦 Перевод'), wire: tt('📑 Перечисл.')}[p] }</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><label className="label">{tt('Описание')}</label><input className="input" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder={adding === 'income' ? tt('Например: продажа клиенту X') : tt('Например: оплата аренды')} /></div>
      </Modal>
    </>
  );
}
