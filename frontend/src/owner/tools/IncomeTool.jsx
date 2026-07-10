import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { PRODUCTS, SUPPLIERS, fmt } from '../data.js';
import { useTt } from '../tt.js';

export default function IncomeTool() {
  const { tt } = useTt();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ product: '', supplier: '', qty: 0, price: 0 });
  const submit = () => {
    if (!form.product || !form.supplier || !form.qty) { toast(tt('Заполните все поля'), 'error'); return; }
    toast(`${tt('Принято')}: ${form.qty} «${form.product}» — ${form.supplier}`);
    setAdding(false);
  };
  return (
    <>
      <PageHeader title={tt('📥 Приход товара')} sub={tt('От поставщиков · на склад')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>{tt('+ Приход')}</button>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="📥" label={tt('Сегодня приходов')} value="8" color="#1D4ED8" />
        <Tile icon="💰" label={tt('Сумма закупа')} value="42 800 000" sub="UZS" color="#D97706" />
        <Tile icon="📦" label={tt('Единиц получено')} value="284" color="#16A34A" />
      </div>
      <Card>
        <table>
          <thead><tr><th>{tt('Дата')}</th><th>{tt('Товар')}</th><th>{tt('Поставщик')}</th><th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th><th style={{ textAlign: 'right' }}>{tt('Цена')}</th><th style={{ textAlign: 'right' }}>{tt('Сумма')}</th></tr></thead>
          <tbody>
            {[
              { d: '30.05', p: 'Бейсболка синяя',  s: 'Nike Distrib.',   q: 50, pr: 80000 },
              { d: '30.05', p: 'Брус 50×100',       s: 'Tashkent Wood',   q: 30, pr: 280000 },
              { d: '29.05', p: 'Шахматы 40×40',     s: 'Karpov Games',    q: 20, pr: 180000 },
              { d: '28.05', p: 'Йогоч ваза 45',     s: 'Local Craft',     q: 15, pr: 90000 },
              { d: '27.05', p: 'Латун шамдон',      s: 'Buxoro Latun',    q: 10, pr: 350000 },
            ].map((r, i) => (
              <tr key={i}>
                <td>{r.d}</td>
                <td style={{ fontWeight: 700 }}>{r.p}</td>
                <td><Badge tone="purple">{r.s}</Badge></td>
                <td className="mono" style={{ textAlign: 'right' }}>{r.q}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{fmt(r.pr)}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmt(r.q * r.pr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title={tt('Новый приход')} icon="📥"
        footer={<><button className="btn btn-ghost" onClick={() => setAdding(false)}>{tt('Отмена')}</button><button className="btn btn-primary" onClick={submit}>{tt('💾 Принять')}</button></>}>
        <label className="label">{tt('Товар')}</label>
        <select className="input" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
          <option value="">{tt('— Выбрать —')}</option>
          {PRODUCTS.map(p => <option key={p.id}>{p.name}</option>)}
        </select>
        <div style={{ marginTop: 12 }}><label className="label">{tt('Поставщик')}</label>
          <select className="input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
            <option value="">{tt('— Выбрать —')}</option>
            {SUPPLIERS.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div><label className="label">{tt('Количество')}</label><input type="number" className="input" value={form.qty} onChange={e => setForm({ ...form, qty: +e.target.value })} /></div>
          <div><label className="label">{tt('Цена закупки')}</label><input type="number" className="input" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}
