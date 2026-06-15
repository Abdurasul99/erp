import React, { useState, useContext } from 'react';
import api from '../api.js';
import { BranchScope } from './OwnerShell.jsx';
import { Card } from './ui.jsx';
import { useTt } from './tt.js';

// Кнопка «🤖 AI-анализ» — отправляет topic на backend, который ПЕРЕСЧИТЫВАЕТ
// реальные цифры на сервере и просит DeepSeek дать разбор + рекомендации.
// Доступна только руководителям (founder/gen_dir/admin) — у менеджера AI нет.
export default function AiAnalyze({ topic, branchId }) {
  const { tt, lang } = useTt();
  const { role } = useContext(BranchScope);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');

  if (!['founder', 'gen_dir', 'admin'].includes(role)) return null;

  const run = () => {
    setOpen(true); setLoading(true); setError(''); setAnalysis('');
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.post('/ai/analyze', { topic, lang }, { params })
      .then(r => setAnalysis(r.data?.analysis || tt('Пустой ответ от AI.')))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ marginTop: 16 }}>
      {!open ? (
        <button className="btn btn-primary" onClick={run}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          🤖 {tt('AI-анализ этих данных')}
        </button>
      ) : (
        <Card icon="🤖" title={tt('AI-анализ')}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{tt('Скрыть')}</button>}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)', padding: '8px 0' }}>
              <span className="ai-spinner" /> {tt('AI анализирует ваши реальные цифры…')}
            </div>
          ) : error ? (
            <div style={{ color: 'var(--red)', fontWeight: 600 }}>
              ⚠️ {error}
              <button className="btn btn-ghost btn-sm" onClick={run} style={{ marginLeft: 10 }}>{tt('Повторить')}</button>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {analysis}
            </div>
          )}
          <style>{`.ai-spinner{width:16px;height:16px;border:2px solid var(--border,#e6e8f2);border-top-color:var(--primary,#5B4FE8);border-radius:50%;display:inline-block;animation:aispin .7s linear infinite}@keyframes aispin{to{transform:rotate(360deg)}}`}</style>
        </Card>
      )}
    </div>
  );
}
