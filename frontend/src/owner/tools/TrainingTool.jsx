import React from 'react';
import { Card, Tile, Badge, PageHeader, Progress } from '../ui.jsx';
import { toast } from '../Modal.jsx';

const COURSES = [
  { ic: '🛒', n: 'Продажи 101', mod: 8, dur: '4ч', en: 12, c: 75 },
  { ic: '📞', n: 'Cold calls и возражения', mod: 12, dur: '6ч', en: 8, c: 50 },
  { ic: '💼', n: 'B2B / корпоративные', mod: 10, dur: '8ч', en: 5, c: 40 },
  { ic: '🎯', n: 'CRM · работа с историей', mod: 6, dur: '3ч', en: 14, c: 90 },
  { ic: '💰', n: 'Финансовая грамотность', mod: 5, dur: '2.5ч', en: 10, c: 60 },
  { ic: '🤝', n: 'Сервис · UX', mod: 7, dur: '3.5ч', en: 14, c: 85 },
];

export default function TrainingTool() {
  return (
    <>
      <PageHeader title="🎬 Обучение" sub="Курсы in-app · уроки · аттестация"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Конструктор курса')}>+ Курс</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🎓" label="Курсов" value={COURSES.length} color="#5B4FE8" />
        <Tile icon="✅" label="Выпускников" value="38" color="#22C55E" />
        <Tile icon="⏳" label="В процессе" value="14" color="#FF6B2B" />
        <Tile icon="📚" label="Часов контента" value="124" color="#0EA5E9" />
      </div>
      <div className="grid-3">
        {COURSES.map(c => (
          <Card key={c.n} style={{ padding: 18 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{c.ic}</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{c.n}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>{c.mod} модулей · {c.dur}</div>
            <div style={{ fontSize: 11, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text3)' }}>Прогресс</span>
              <span className="mono" style={{ fontWeight: 800 }}>{c.c}%</span>
            </div>
            <Progress value={c.c} max={100} color="#5B4FE8" />
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge tone="blue">{c.en} учатся</Badge>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Открыт курс «' + c.n + '»')}>▶️ Открыть</button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
