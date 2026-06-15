import React, { useState } from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const BRANDS = [
  { n: 'Nike', country: '🇺🇸', products: 28, share: 12 },
  { n: 'Tashkent Wood', country: '🇺🇿', products: 14, share: 8 },
  { n: 'Karpov', country: '🇷🇺', products: 9, share: 5 },
  { n: 'Local', country: '🇺🇿', products: 142, share: 38 },
  { n: 'Buxoro', country: '🇺🇿', products: 22, share: 11 },
  { n: 'Karven', country: '🇺🇿', products: 18, share: 7 },
  { n: 'Atlas', country: '🇺🇿', products: 24, share: 9 },
  { n: 'Rishtan', country: '🇺🇿', products: 16, share: 6 },
];

export default function BrandsTool() {
  const { tt } = useTt();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader title={`🏢 ${tt('Бренды')}`} sub={tt('Производители · доля в продажах')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ {tt('Бренд')}</button>} />
      <Card>
        <table>
          <thead><tr><th>{tt('Бренд')}</th><th>{tt('Страна')}</th><th style={{ textAlign: 'right' }}>{tt('Товаров')}</th><th style={{ textAlign: 'right' }}>{tt('Доля в продажах')}</th><th></th></tr></thead>
          <tbody>
            {BRANDS.map(b => (
              <tr key={b.n}>
                <td style={{ fontWeight: 700 }}>{b.n}</td>
                <td style={{ fontSize: 20 }}>{b.country}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{b.products}</td>
                <td style={{ textAlign: 'right' }}><Badge tone={b.share > 20 ? 'green' : b.share > 8 ? 'blue' : 'gray'}>{b.share}%</Badge></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toast(tt('Открыта карточка') + ' ' + b.n)}>👁️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={adding} onClose={() => setAdding(false)} title={tt('Новый бренд')} icon="🏢"
        footer={<button className="btn btn-primary" onClick={() => { toast(tt('Бренд создан')); setAdding(false); }}>{tt('Создать')}</button>}>
        <label className="label">{tt('Название')}</label><input className="input" placeholder={tt('Например: Adidas')} />
        <div style={{ marginTop: 12 }}><label className="label">{tt('Страна')}</label><input className="input" placeholder={`🇩🇪 ${tt('Германия')}`} /></div>
      </Modal>
    </>
  );
}
