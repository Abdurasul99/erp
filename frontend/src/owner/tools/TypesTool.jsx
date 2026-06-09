import React, { useState } from 'react';
import { Card, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';

const INIT = ['Одежда', 'Дерево', 'Декор', 'Латунь', 'Игры', 'Косметика', 'Керамика', 'Посуда', 'Шахматы', 'Кожа'];

export default function TypesTool() {
  const [list, setList] = useState(INIT);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const counts = { 'Одежда': 18, 'Дерево': 12, 'Декор': 24, 'Латунь': 9, 'Игры': 11, 'Косметика': 38, 'Керамика': 22, 'Посуда': 14, 'Шахматы': 6, 'Кожа': 5 };

  return (
    <>
      <PageHeader title="🏷️ Типы товаров" sub="Категории каталога"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Тип</button>} />
      <div className="grid-4">
        {list.map(t => (
          <Card key={t} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{t}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{counts[t] || Math.floor(Math.random() * 20) + 3} товаров</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Удалить ' + t + '?')) { setList(l => l.filter(x => x !== t)); toast(t + ' удалён', 'info'); } }}>🗑️</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Новый тип" icon="🏷️"
        footer={<><button className="btn btn-ghost" onClick={() => setAdding(false)}>Отмена</button>
          <button className="btn btn-primary" onClick={() => { if (name.trim()) { setList(l => [name.trim(), ...l]); setAdding(false); setName(''); toast('Тип создан'); } }}>Создать</button></>}>
        <label className="label">Название типа</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Например: Электроника" />
      </Modal>
    </>
  );
}
