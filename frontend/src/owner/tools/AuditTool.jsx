import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

export default function AuditTool() {
  const [running, setRunning] = useState(false);
  return (
    <>
      <PageHeader title="🔍 Инвентаризация" sub="Сверка фактических остатков vs учёт" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="✓" label="Последняя" value="25 мая 2026" sub="успешно завершена" color="#22C55E" />
        <Tile icon="📊" label="Совпало" value="1224/1248" sub="98%" color="#5B4FE8" />
        <Tile icon="⚠️" label="Расхождения" value="24" sub="14 излишков + 10 недостач" color="#F59E0B" />
      </div>
      <Card icon="🚀" title={running ? 'Идёт инвентаризация...' : 'Запустить новую инвентаризацию'}>
        {running ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 50 }}>🔍</div>
            <div style={{ marginTop: 14, fontWeight: 800 }}>Сканирование склада...</div>
            <div style={{ marginTop: 8, color: 'var(--text3)' }}>Сосчитано 482 / 1 248</div>
            <button className="btn btn-orange" style={{ marginTop: 16 }} onClick={() => { setRunning(false); toast('Инвентаризация завершена · 18 расхождений найдено', 'info'); }}>🛑 Завершить</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <button className="btn btn-primary" onClick={() => setRunning(true)}>🚀 Начать сверку</button>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>Снимок текущих остатков → сверка через сканер штрих-кода</div>
          </div>
        )}
      </Card>
    </>
  );
}
