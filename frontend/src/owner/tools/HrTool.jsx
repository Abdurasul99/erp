import React from 'react';
import { Card, Tile, Badge, PageHeader, Progress } from '../ui.jsx';
import { toast } from '../Modal.jsx';

const TEAM = [
  { n: 'Aziz A.',     r: 'Ген. директор',  kpi: 92, salary: '8.0M',     status: 'on' },
  { n: 'Anvar S.',    r: 'Старший продавец', kpi: 88, salary: '4.5M + %', status: 'on' },
  { n: 'Diana K.',    r: 'Продавец',          kpi: 82, salary: '3.5M + %', status: 'on' },
  { n: 'Bekzod M.',   r: 'Кассир',            kpi: 78, salary: '3.2M',     status: 'off' },
  { n: 'Sotuvchi P.', r: 'Продавец',          kpi: 91, salary: '3.5M + %', status: 'on' },
  { n: 'Aziz R.',     r: 'Складовщик',        kpi: 75, salary: '2.8M',     status: 'on' },
  { n: 'Malika T.',   r: 'Менеджер B2B',      kpi: 84, salary: '4.0M + %', status: 'on' },
];

export default function HrTool() {
  return (
    <>
      <PageHeader title="👤 HR · команда" sub="Сотрудники · KPI · зарплаты · смены"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Форма нового сотрудника')}>+ Сотрудник</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="👥" label="Всего" value={TEAM.length} color="#5B4FE8" />
        <Tile icon="🟢" label="На смене" value={TEAM.filter(t => t.status === 'on').length} color="#22C55E" />
        <Tile icon="🎯" label="Средний KPI" value={Math.round(TEAM.reduce((s, t) => s + t.kpi, 0) / TEAM.length) + '%'} delta={6} color="#FF6B2B" />
        <Tile icon="💰" label="ФОТ" value="38.4M" color="#0EA5E9" />
      </div>
      <Card>
        <table>
          <thead><tr><th></th><th>Сотрудник</th><th>Роль</th><th>KPI</th><th style={{ textAlign: 'right' }}>ЗП</th><th>Статус</th></tr></thead>
          <tbody>
            {TEAM.map((u, i) => (
              <tr key={i}>
                <td><div className="avatar" style={{ width: 32, height: 32 }}>{u.n.split(' ').map(p => p[0]).join('')}</div></td>
                <td style={{ fontWeight: 700 }}>{u.n}</td>
                <td>{u.r}</td>
                <td><div style={{ width: 100 }}><Progress value={u.kpi} max={100} color={u.kpi >= 85 ? '#22C55E' : u.kpi >= 70 ? '#FF6B2B' : '#EF4444'} /><div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontWeight: 700 }}>{u.kpi}%</div></div></td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{u.salary}</td>
                <td>{u.status === 'on' ? <Badge tone="green">● На смене</Badge> : <Badge tone="gray">○ Off</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
