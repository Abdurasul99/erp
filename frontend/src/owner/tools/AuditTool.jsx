import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function AuditTool() {
  const { tt } = useTt();
  const [running, setRunning] = useState(false);
  return (
    <>
      <PageHeader title={tt('🔍 Инвентаризация')} sub={tt('Сверка фактических остатков vs учёт')} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="✓" label={tt('Последняя')} value="25 мая 2026" sub={tt('успешно завершена')} color="#16A34A" />
        <Tile icon="📊" label={tt('Совпало')} value="1224/1248" sub="98%" color="#1D4ED8" />
        <Tile icon="⚠️" label={tt('Расхождения')} value="24" sub={tt('14 излишков + 10 недостач')} color="#D97706" />
      </div>
      <Card icon="🚀" title={running ? tt('Идёт инвентаризация...') : tt('Запустить новую инвентаризацию')}>
        {running ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 50 }}>🔍</div>
            <div style={{ marginTop: 14, fontWeight: 800 }}>{tt('Сканирование склада...')}</div>
            <div style={{ marginTop: 8, color: 'var(--text3)' }}>{tt('Сосчитано')} 482 / 1 248</div>
            <button className="btn btn-orange" style={{ marginTop: 16 }} onClick={() => { setRunning(false); toast(tt('Инвентаризация завершена · 18 расхождений найдено'), 'info'); }}>{tt('🛑 Завершить')}</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <button className="btn btn-primary" onClick={() => setRunning(true)}>{tt('🚀 Начать сверку')}</button>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>{tt('Снимок текущих остатков → сверка через сканер штрих-кода')}</div>
          </div>
        )}
      </Card>
    </>
  );
}
