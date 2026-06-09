import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { PRODUCTS, fmt } from '../data.js';

export default function PosTool() {
  const [cart, setCart] = useState([]);
  const [pm, setPm] = useState('cash');
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(false);

  const filtered = search ? PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)).slice(0, 5) : [];
  const total = cart.reduce((s, i) => s + i.qty * i.sell, 0);
  const finalTotal = Math.max(0, total - discount);

  const addToCart = (p) => {
    setCart(c => {
      const ex = c.find(i => i.id === p.id);
      if (ex) return c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...p, qty: 1 }];
    });
    setSearch('');
  };
  const changeQty = (id, d) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const remove = (id) => setCart(c => c.filter(i => i.id !== id));
  const complete = () => {
    if (cart.length === 0) { toast('Корзина пустая', 'error'); return; }
    setPaid(true);
  };
  const newSale = () => { setCart([]); setDiscount(0); setPaid(false); setPm('cash'); };

  return (
    <>
      <PageHeader title="🛒 Касса B2C" sub="Розничная продажа · сканер · корзина · оплата"
        actions={<button className="btn btn-orange btn-sm" onClick={() => toast('Смена закрыта · отчёт сформирован', 'info')}>🔒 Закрыть смену</button>} />

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🧾" label="Чеков" value="84" sub="за смену" color="#5B4FE8" />
        <Tile icon="💰" label="Выручка" value="28.4M" sub="UZS" color="#22C55E" />
        <Tile icon="💳" label="Безнал" value="42%" color="#0EA5E9" />
        <Tile icon="↩️" label="Возвратов" value="2" color="#EF4444" />
      </div>

      <div className="grid-2">
        <Card icon="🔍" title="Поиск товара" actions={<Badge tone="green">Сканер готов</Badge>}>
          <input className="input" placeholder="Название или штрих-код..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus
            style={{ fontSize: 15, padding: '12px 14px' }} />
          {filtered.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  cursor: 'pointer', borderBottom: '1px solid var(--border)',
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.photo}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.stock} {p.unit} · {fmt(p.sell)} UZS</div>
                  </div>
                  <button className="btn btn-primary btn-sm">+</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div className="label">Способ оплаты</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { k: 'cash', l: '💵 Нал' },
                { k: 'card', l: '💳 Карта' },
                { k: 'transfer', l: '🏦 Перевод' },
                { k: 'wire', l: '📑 Перечисление' },
                { k: 'debt', l: '📒 В долг' },
              ].map(o => (
                <button key={o.k} onClick={() => setPm(o.k)}
                  style={{ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${pm===o.k?'#5B4FE8':'#E6E8F2'}`, background: pm===o.k?'rgba(91,79,232,.08)':'#fff', color: pm===o.k?'#5B4FE8':'#5C6080', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{o.l}</button>
              ))}
            </div>
          </div>
        </Card>

        <Card icon="🧾" title={`Корзина · ${cart.length} поз.`} actions={cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}>🧹 Очистить</button>}>
          {cart.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div style={{ marginTop: 10, fontWeight: 700 }}>Корзина пустая</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Найдите товар слева и добавьте</div>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {cart.map(i => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{i.photo}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(i.sell)} UZS / {i.unit}</div>
                    </div>
                    <button onClick={() => changeQty(i.id, -1)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span className="mono" style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{i.qty}</span>
                    <button onClick={() => changeQty(i.id, +1)} style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                    <div className="mono" style={{ minWidth: 80, textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmt(i.qty * i.sell)}</div>
                    <button onClick={() => remove(i.id)} style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="label">Скидка (UZS)</label>
                <input className="input mono" type="number" value={discount} onChange={e => setDiscount(+e.target.value || 0)} style={{ textAlign: 'right' }} />
              </div>

              <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 14, marginTop: 12 }}>
                <Row label="Сумма" value={fmt(total) + ' UZS'} />
                {discount > 0 && <Row label="Скидка" value={'−' + fmt(discount) + ' UZS'} mute />}
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                <Row label="К ОПЛАТЕ" value={fmt(finalTotal) + ' UZS'} big />
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 16 }}
                onClick={complete}>💰 Оформить продажу</button>
            </>
          )}
        </Card>
      </div>

      <Modal open={paid} onClose={newSale} title="✓ Продажа завершена" icon="🎉"
        footer={<><button className="btn btn-ghost" onClick={() => toast('Чек отправлен на принтер', 'info')}>🖨️ Печать чека</button><button className="btn btn-primary" onClick={newSale}>+ Новая продажа</button></>}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 60 }}>✅</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)', marginTop: 10 }}>{fmt(finalTotal)} UZS</div>
          <div style={{ color: 'var(--text3)', marginTop: 6 }}>{cart.length} позиций · оплата: <strong>{ {cash:'наличными', card:'картой', transfer:'переводом', wire:'перечислением', debt:'в долг'}[pm] }</strong></div>
        </div>
        <div style={{ marginTop: 14, background: 'var(--bg-2)', borderRadius: 10, padding: 12 }}>
          {cart.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
              <span>{i.name} × {i.qty}</span>
              <span className="mono" style={{ fontWeight: 700 }}>{fmt(i.qty * i.sell)}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value, big, mute }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: big ? 16 : 13, fontWeight: big ? 900 : 600, color: mute ? 'var(--text3)' : 'var(--text)' }}>
      <span>{label}</span>
      <span className="mono" style={{ color: big ? 'var(--primary)' : 'inherit' }}>{value}</span>
    </div>
  );
}
