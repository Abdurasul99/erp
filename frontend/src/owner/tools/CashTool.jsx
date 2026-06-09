import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader, Sparkline } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { fmt } from '../data.js';

export default function CashTool() {
  const [adding, setAdding] = useState(null); // 'income' | 'expense' | null
  const [form, setForm] = useState({ amount: 0, desc: '', pm: 'cash' });
  const submit = () => {
    if (!form.amount) { toast('Введите сумму', 'error'); return; }
    toast(`${adding === 'income' ? '✓ Приход' : '↓ Расход'} ${fmt(form.amount)} UZS зарегистрирован`);
    setAdding(null);
    setForm({ amount: 0, desc: '', pm: 'cash' });
  };
  return (
    <>
      <PageHeader title="🏦 Касса" sub="Приход · расход по методам оплаты"
        actions={<><button className="btn btn-orange btn-sm" onClick={() => setAdding('expense')}>− Расход</button><button className="btn btn-primary btn-sm" onClick={() => setAdding('income')}>+ Приход</button></>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="💰" label="Баланс" value="148.2M" sub="UZS" color="#22C55E" />
        <Tile icon="📥" label="Приход (день)" value="+8.4M" delta={12} color="#5B4FE8" />
        <Tile icon="📤" label="Расход (день)" value="−2.1M" color="#EF4444" />
        <Tile icon="⏳" label="Ждёт от продавцов" value="4.2M" color="#F59E0B" />
      </div>
      <div className="grid-2">
        <Card icon="💳" title="По способам оплаты">
          {[
            { n: '💵 Наличные', v: '48.2M', pct: 28, c: '#22C55E' },
            { n: '💳 Карта', v: '62.1M', pct: 37, c: '#0EA5E9' },
            { n: '🏦 Перевод', v: '34.5M', pct: 21, c: '#5B4FE8' },
            { n: '📑 Перечисление', v: '23.6M', pct: 14, c: '#7C3AED' },
          ].map(r => (
            <div key={r.n} className="list-item">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{r.n}</span>
                  <span className="mono" style={{ fontWeight: 800, color: r.c }}>{r.v}</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{ width: r.pct + '%', background: r.c }} /></div>
              </div>
            </div>
          ))}
        </Card>
        <Card icon="📈" title="Cash Flow (7 дней)">
          <Sparkline data={[22, 26, 31, 38, 42, 45, 51]} color="#22C55E" />
          <div className="grid-3" style={{ marginTop: 14, fontSize: 12 }}>
            <div><div style={{ color: 'var(--text3)' }}>Приход</div><div className="mono" style={{ fontWeight: 800, color: 'var(--green)' }}>+154M</div></div>
            <div><div style={{ color: 'var(--text3)' }}>Расход</div><div className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>−82M</div></div>
            <div><div style={{ color: 'var(--text3)' }}>Сальдо</div><div className="mono" style={{ fontWeight: 800 }}>+72M</div></div>
          </div>
        </Card>
      </div>

      <Modal open={adding != null} onClose={() => setAdding(null)} title={adding === 'income' ? 'Приход денег' : 'Расход денег'} icon={adding === 'income' ? '📥' : '📤'}
        footer={<><button className="btn btn-ghost" onClick={() => setAdding(null)}>Отмена</button><button className="btn btn-primary" onClick={submit}>Сохранить</button></>}>
        <label className="label">Сумма (UZS)</label><input type="number" className="input mono" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} style={{ fontSize: 18, textAlign: 'center' }} />
        <div style={{ marginTop: 12 }}><label className="label">Способ</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['cash', 'card', 'transfer', 'wire'].map(p => (
              <button key={p} onClick={() => setForm({ ...form, pm: p })} style={{
                flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid ' + (form.pm === p ? '#5B4FE8' : '#E6E8F2'),
                background: form.pm === p ? 'rgba(91,79,232,.08)' : '#fff', color: form.pm === p ? '#5B4FE8' : 'var(--text2)',
                cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
              }}>{ {cash: '💵 Нал', card: '💳 Карта', transfer: '🏦 Перевод', wire: '📑 Перечисл.'}[p] }</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><label className="label">Описание</label><input className="input" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder={adding === 'income' ? 'Например: продажа клиенту X' : 'Например: оплата аренды'} /></div>
      </Modal>
    </>
  );
}
