import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum } from '../../owner/ui.jsx';

const ACTION_META = {
  create:      { icon: '➕', tone: 'green',  label: 'Создание' },
  update:      { icon: '✏️', tone: 'blue',   label: 'Изменение' },
  delete:      { icon: '🗑️', tone: 'red',    label: 'Удаление' },
  feature_on:  { icon: '🟢', tone: 'green',  label: 'Фича вкл' },
  feature_off: { icon: '🔴', tone: 'red',    label: 'Фича выкл' },
  login:       { icon: '🔑', tone: 'cyan',   label: 'Логин' },
  logout:      { icon: '🚪', tone: 'gray',   label: 'Логаут' },
  block:       { icon: '🔒', tone: 'red',    label: 'Блокировка' },
  unblock:     { icon: '🔓', tone: 'green',  label: 'Разблок' },
  close:       { icon: '✋', tone: 'orange', label: 'Закрытие' },
  open:        { icon: '🔓', tone: 'green',  label: 'Открытие' },
};

const ENTITY_LABEL = {
  user:           '👤 Юзер',
  product:        '📦 Товар',
  stock_outcome:  '📤 Списание',
  stock_income:   '📥 Приход',
  cash_income:    '💰 Касса+',
  cash_expense:   '💸 Касса−',
  company_feature:'🚦 Фича',
  branch:         '🏭 Филиал',
  customer:       '👥 Клиент',
  supplier:       '🏭 Поставщик',
  shift:          '⏰ Смена',
  role:           '🎭 Роль',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true); setError(null);
    api.get('/audit-log', { params: { limit: 500 } })
      .then(r => setLogs(r.data || []))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  const entityOptions = useMemo(() => {
    const set = new Set(logs.map(l => l.entity_type).filter(Boolean));
    return [{ value: 'all', label: 'Все' }, ...Array.from(set).map(e => ({ value: e, label: ENTITY_LABEL[e] || e }))];
  }, [logs]);

  const actionOptions = useMemo(() => {
    const set = new Set(logs.map(l => l.action).filter(Boolean));
    return [{ value: 'all', label: 'Все' }, ...Array.from(set).map(a => ({ value: a, label: (ACTION_META[a]?.icon || '·') + ' ' + (ACTION_META[a]?.label || a) }))];
  }, [logs]);

  const filtered = useMemo(() => logs.filter(l => {
    if (filterEntity !== 'all' && l.entity_type !== filterEntity) return false;
    if (filterAction !== 'all' && l.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.username || ''} ${l.entity_type || ''} ${l.action || ''} ${l.ip_address || ''} ${l.entity_id || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [logs, filterEntity, filterAction, search]);

  return (
    <>
      <PageHeader
        title="📋 Audit Log"
        sub={`Все важные действия в системе · ${fmtNum(logs.length)} записей за последнее время`}
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 240 }}>
            <span style={{ color: 'var(--text3)' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по юзеру, IP, entity id..." />
          </div>
          {entityOptions.length > 1 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Сущность</div>
              <Pills value={filterEntity} onChange={setFilterEntity} options={entityOptions.slice(0, 8)} />
            </div>
          )}
          {actionOptions.length > 1 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Действие</div>
              <Pills value={filterAction} onChange={setFilterAction} options={actionOptions.slice(0, 8)} />
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="card" style={{ padding: 20 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} height={48} style={{ marginBottom: 8 }} />
          ))}
        </div>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="Нет записей" description="Под текущие фильтры ничего не подходит. Сбрось фильтры или подожди — записи скоро появятся." />
      ) : (
        <Card icon="📋" title={`События · ${filtered.length}`}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Юзер</th>
                  <th>Действие</th>
                  <th>Сущность</th>
                  <th>ID</th>
                  <th>IP</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map(l => {
                  const meta = ACTION_META[l.action] || { icon: '·', tone: 'gray', label: l.action };
                  return (
                    <tr key={l.id}>
                      <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {new Date(l.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 700 }}>@{l.username || '—'}</td>
                      <td><Badge tone={meta.tone}>{meta.icon} {meta.label}</Badge></td>
                      <td style={{ fontSize: 12 }}>{ENTITY_LABEL[l.entity_type] || l.entity_type || '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{l.entity_id || '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{l.ip_address || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.new_value ? JSON.stringify(l.new_value).slice(0, 60) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 300 && (
            <div style={{ padding: 10, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              Показаны первые 300 из {filtered.length}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
