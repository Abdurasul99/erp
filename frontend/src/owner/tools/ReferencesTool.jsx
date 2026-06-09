import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum } from '../ui.jsx';
import { AuthContext } from '../../App.jsx';

// Single screen with tabs replacing the four separate "Типы / Бренды / Единицы / Атрибуты" pages.
// Types are managed via /api/types (full CRUD).  Brands and units are free-text on products and
// shown read-only with usage counts; the canonical way to add a new brand/unit is from the product
// edit form.  Attributes (color/size) live as free-text on each product too — listed for visibility.

const TABS = [
  { value: 'types',   label: '🏷️ Типы' },
  { value: 'brands',  label: '🏢 Бренды' },
  { value: 'units',   label: '📐 Единицы' },
  { value: 'attrs',   label: '⚙️ Атрибуты' },
];

export default function ReferencesTool() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('types');
  const [types, setTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Type create form
  const [newType, setNewType] = useState({ name_ru: '', name_uz: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const canEdit = ['admin', 'gen_dir', 'founder', 'manager'].includes(user?.role);

  const reload = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.get('/types'),
        api.get('/products'),
      ]);
      setTypes(t.data || []);
      setProducts(p.data || []);
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || e.message });
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  // Derive brands + units + attrs from products (free-text fields).  Group with counts.
  const aggregate = (key) => {
    const m = new Map();
    for (const p of products) {
      const v = (p[key] || '').toString().trim();
      if (!v) continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const brands = aggregate('brand');
  const units = aggregate('unit');
  const attrs = aggregate('color_size');

  const addType = async () => {
    if (!newType.name_ru.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await api.post('/types', { name_ru: newType.name_ru.trim(), name_uz: newType.name_uz.trim() || newType.name_ru.trim() });
      setNewType({ name_ru: '', name_uz: '' });
      setMsg({ ok: true, text: 'Тип добавлен' });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || e.message });
    }
    setBusy(false);
  };

  const deleteType = async (id, name) => {
    if (!confirm(`Удалить тип "${name}"?`)) return;
    setBusy(true); setMsg(null);
    try {
      await api.delete(`/types/${id}`);
      setMsg({ ok: true, text: 'Тип удалён' });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || e.message });
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title="🏷️ Справочники"
        sub="Типы, бренды, единицы и атрибуты — всё в одном окне"
        actions={<Badge tone="green">Live</Badge>}
      />

      <Card style={{ marginBottom: 16 }}>
        <Pills value={tab} onChange={setTab} options={TABS} />
      </Card>

      {msg && (
        <Card style={{ marginBottom: 16, borderLeft: `4px solid ${msg.ok ? 'var(--green)' : 'var(--red)'}` }}>
          <div style={{ color: msg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{msg.text}</div>
        </Card>
      )}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>Загрузка...</div></div></Card>
      ) : tab === 'types' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="🏷️" label="Всего типов"  value={fmtNum(types.length)} sub="категорий товаров" color="#FF6B2B" />
            <Tile icon="📦" label="Товаров"      value={fmtNum(products.length)} sub="привязаны к типам" color="#5B4FE8" />
            <Tile icon="✨" label="Самый частый" value={
              (() => {
                const counts = {};
                for (const p of products) if (p.type_name) counts[p.type_name] = (counts[p.type_name] || 0) + 1;
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                return top ? top[0] : '—';
              })()
            } sub="по числу товаров" color="#22C55E" />
          </div>

          {canEdit && (
            <Card icon="➕" title="Добавить тип" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
                <input className="input" placeholder="Название (русский)"
                  value={newType.name_ru}
                  onChange={e => setNewType(t => ({ ...t, name_ru: e.target.value }))} />
                <input className="input" placeholder="Nomi (o'zbek)"
                  value={newType.name_uz}
                  onChange={e => setNewType(t => ({ ...t, name_uz: e.target.value }))} />
                <button className="btn btn-primary" disabled={busy || !newType.name_ru.trim()} onClick={addType}>
                  {busy ? '...' : '+ Добавить'}
                </button>
              </div>
            </Card>
          )}

          <Card icon="📋" title={`Типы товаров (${types.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Название (RU)</th>
                    <th>Nomi (UZ)</th>
                    <th style={{ textAlign: 'right' }}>Товаров</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {types.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет типов</td></tr>
                  ) : types.map(t => {
                    const count = products.filter(p => p.type_name === t.name_ru).length;
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}>{t.name_ru}</td>
                        <td style={{ color: 'var(--text2)' }}>{t.name_uz || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{count}</td>
                        {canEdit && (
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => deleteType(t.id, t.name_ru)}
                              disabled={count > 0 || busy}
                              title={count > 0 ? `Используется в ${count} товарах — нельзя удалить` : 'Удалить'}
                              style={{ color: count > 0 ? 'var(--text3)' : 'var(--red)', borderColor: 'var(--border)' }}>
                              🗑
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : tab === 'brands' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="🏢" label="Всего брендов" value={fmtNum(brands.length)} color="#7c3aed" />
            <Tile icon="✨" label="Топ-бренд"     value={brands[0]?.name || '—'} sub={brands[0] ? `${brands[0].count} товаров` : ''} color="#FF6B2B" />
            <Tile icon="📦" label="Без бренда"   value={fmtNum(products.filter(p => !p.brand).length)} sub="не указан" color="#9094B0" />
          </div>
          <Card icon="📋" title={`Бренды (${brands.length})`}
            actions={<span style={{ fontSize: 11, color: 'var(--text3)' }}>Добавляется при создании товара</span>}>
            {brands.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет брендов</div>
            ) : (
              <div className="grid-3" style={{ gap: 10 }}>
                {brands.map(b => (
                  <div key={b.name} style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                    <Badge tone="blue">{b.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : tab === 'units' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="📐" label="Всего единиц"  value={fmtNum(units.length)} sub="разных" color="#0EA5E9" />
            <Tile icon="✨" label="Самая частая"  value={units[0]?.name || '—'} sub={units[0] ? `${units[0].count} товаров` : ''} color="#22C55E" />
            <Tile icon="📦" label="Без ед."       value={fmtNum(products.filter(p => !p.unit).length)} sub="не указана" color="#9094B0" />
          </div>
          <Card icon="📋" title={`Единицы измерения (${units.length})`}
            actions={<span style={{ fontSize: 11, color: 'var(--text3)' }}>Меняется при создании товара</span>}>
            {units.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет единиц</div>
            ) : (
              <div className="grid-4" style={{ gap: 10 }}>
                {units.map(u => (
                  <div key={u.name} style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{u.name}</span>
                    <Badge tone="cyan">{u.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Tile icon="⚙️" label="Атрибутов" value={fmtNum(attrs.length)} sub="цвет / размер / прочее" color="#9333EA" />
            <Tile icon="📦" label="С атрибутами" value={fmtNum(products.filter(p => p.color_size).length)} sub={`из ${products.length} товаров`} color="#5B4FE8" />
          </div>
          <Card icon="📋" title={`Атрибуты (${attrs.length})`}
            actions={<span style={{ fontSize: 11, color: 'var(--text3)' }}>Сейчас — свободный текст. Структурированные атрибуты добавим позже</span>}>
            {attrs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет атрибутов</div>
            ) : (
              <div className="grid-3" style={{ gap: 10 }}>
                {attrs.slice(0, 100).map(a => (
                  <div key={a.name} style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
                    <Badge tone="purple">{a.count}</Badge>
                  </div>
                ))}
              </div>
            )}
            {attrs.length > 100 && (
              <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                Показаны первые 100 из {attrs.length}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
