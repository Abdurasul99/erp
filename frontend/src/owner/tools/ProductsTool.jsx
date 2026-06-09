import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { Modal, toast } from '../Modal.jsx';
import { PRODUCTS, fmt } from '../data.js';

export default function ProductsTool() {
  const [list, setList] = useState(PRODUCTS);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', brand: '', stock: 0, unit: 'шт', buy: 0, sell: 0, photo: '📦' });

  const types = [...new Set(PRODUCTS.map(p => p.type))];
  const filtered = list.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)) &&
    (!filterType || p.type === filterType)
  );

  const openAdd = () => { setForm({ name: '', type: 'Декор', brand: '', stock: 0, unit: 'шт', buy: 0, sell: 0, photo: '📦' }); setAdding(true); };
  const saveNew = () => {
    if (!form.name) { toast('Введите название', 'error'); return; }
    setList(l => [{ ...form, id: Date.now(), sku: String(Date.now()).slice(-13), buy: +form.buy, sell: +form.sell, stock: +form.stock }, ...l]);
    setAdding(false);
    toast(`Товар «${form.name}» добавлен`);
  };
  const openEdit = (p) => { setForm(p); setEditing(p.id); };
  const saveEdit = () => {
    setList(l => l.map(p => p.id === editing ? { ...form, buy: +form.buy, sell: +form.sell, stock: +form.stock } : p));
    setEditing(null);
    toast('Изменения сохранены');
  };
  const remove = (id, name) => {
    if (!confirm(`Удалить «${name}»?`)) return;
    setList(l => l.filter(p => p.id !== id));
    toast(`«${name}» удалён`, 'info');
  };

  return (
    <>
      <PageHeader title="📦 Товары" sub="Каталог · поиск · фильтры · добавление"
        actions={<><button className="btn btn-ghost btn-sm" onClick={() => toast('Импорт XLSX — в разработке', 'info')}>📥 Импорт</button><button className="btn btn-primary btn-sm" onClick={openAdd}>+ Новый товар</button></>} />

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📦" label="Всего" value={list.length} color="#5B4FE8" />
        <Tile icon="✅" label="В наличии" value={list.filter(p => p.stock > 0).length} color="#22C55E" />
        <Tile icon="⚠️" label="Заканчиваются" value={list.filter(p => p.stock > 0 && p.stock < 10).length} color="#F59E0B" />
        <Tile icon="🚫" label="Нет в наличии" value={list.filter(p => p.stock === 0).length} color="#EF4444" />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="🔍 Поиск по названию или штрих-коду..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 180 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Все типы</option>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <table>
          <thead>
            <tr><th></th><th>Название</th><th>Тип</th><th>Бренд</th>
                <th style={{ textAlign: 'right' }}>Закупка</th>
                <th style={{ textAlign: 'right' }}>Продажа</th>
                <th style={{ textAlign: 'right' }}>Маржа</th>
                <th style={{ textAlign: 'right' }}>Остаток</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const margin = p.sell ? Math.round((1 - p.buy / p.sell) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td><div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.photo}</div></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{p.sku}</div>
                  </td>
                  <td><Badge tone="blue">{p.type}</Badge></td>
                  <td>{p.brand}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{fmt(p.buy)}</td>
                  <td style={{ textAlign: 'right' }} className="mono"><strong>{fmt(p.sell)}</strong></td>
                  <td style={{ textAlign: 'right' }}><Badge tone={margin > 40 ? 'green' : margin > 20 ? 'yellow' : 'red'}>{margin}%</Badge></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 800, color: p.stock === 0 ? '#dc2626' : p.stock < 10 ? '#d97706' : '#16a34a' }}>{p.stock} {p.unit}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id, p.name)} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>🗑️</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={adding || editing != null} onClose={() => { setAdding(false); setEditing(null); }}
        title={adding ? 'Новый товар' : 'Редактировать товар'} icon="📦"
        footer={<><button className="btn btn-ghost" onClick={() => { setAdding(false); setEditing(null); }}>Отмена</button><button className="btn btn-primary" onClick={adding ? saveNew : saveEdit}>💾 Сохранить</button></>}>
        <FormField label="Название" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Тип" value={form.type} onChange={v => setForm({ ...form, type: v })} />
          <FormField label="Бренд" value={form.brand} onChange={v => setForm({ ...form, brand: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <FormField label="Количество" value={form.stock} onChange={v => setForm({ ...form, stock: v })} type="number" />
          <FormField label="Единица" value={form.unit} onChange={v => setForm({ ...form, unit: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Цена закупки (UZS)" value={form.buy} onChange={v => setForm({ ...form, buy: v })} type="number" />
          <FormField label="Цена продажи (UZS)" value={form.sell} onChange={v => setForm({ ...form, sell: v })} type="number" />
        </div>
        {form.sell > 0 && form.buy > 0 && (
          <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-2)', borderRadius: 8, fontSize: 13, color: 'var(--text2)' }}>
            Маржа: <strong style={{ color: 'var(--primary)' }}>{Math.round((1 - form.buy / form.sell) * 100)}%</strong> · Прибыль с единицы: <strong className="mono">{fmt(form.sell - form.buy)} UZS</strong>
          </div>
        )}
      </Modal>
    </>
  );
}

function FormField({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
