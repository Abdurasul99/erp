import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api.js';
import { useTt } from './tt.js';
import { useNavigate } from 'react-router-dom';

// AI-диагност «Где у меня проблемы?» — фиксированная логика ответа:
// Где → Кто → Что → Почему → Как решить. Факты приходят с сервера детерминированно
// (из реальных сигналов), «почему/как решить» досчитывает ИИ.

const EASE = [0.22, 1, 0.36, 1];

const STEP = [
  { key: 'gde', label: 'Где', color: '#0A84FF' },
  { key: 'kto', label: 'Кто', color: '#BF5AF2' },
  { key: 'chto', label: 'Что', color: '#FF9F0A' },
  { key: 'pochemu', label: 'Почему', color: '#FF375F' },
  { key: 'kak_reshit', label: 'Как решить', color: '#30D158' },
];

function sevMeta(sev) {
  return sev === 'critical'
    ? { label: 'КРИТИЧНО', bg: 'rgba(229,72,77,.12)', color: '#E5484D' }
    : { label: 'ВНИМАНИЕ', bg: 'rgba(199,138,0,.12)', color: '#B45309' };
}

export default function AiDiagnose() {
  const { tt, lang } = useTt();
  const navigate = useNavigate();
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [problems, setProblems] = useState([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(0);

  const PHASES = [tt('Собираю сигналы…'), tt('Ищу проблемы…'), tt('Определяю причины…'), tt('Готовлю решения…')];

  const run = async () => {
    setState('loading'); setError(''); setPhase(0);
    const timer = setInterval(() => setPhase(p => (p + 1) % PHASES.length), 800);
    try {
      const { data } = await api.post('/ai/diagnose', { lang });
      setProblems(data.problems || []);
      setSummary(data.summary || '');
      setState('done');
    } catch (e) {
      setError(e.response?.data?.error || tt('Не удалось выполнить диагностику. Попробуй ещё раз.'));
      setState('error');
    } finally {
      clearInterval(timer);
    }
  };

  return (
    <div className="aidiag">
      {state === 'idle' && (
        <motion.button
          className="aidiag-cta" onClick={run}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
        >
          <span className="aidiag-cta-orb">✦</span>
          <div className="aidiag-cta-copy">
            <b>{tt('Где у меня проблемы?')}</b>
            <span>{tt('AI пройдётся по бизнесу и ответит: где · кто · что · почему · как решить')}</span>
          </div>
          <span className="aidiag-cta-go">{tt('Проверить')} →</span>
        </motion.button>
      )}

      {state === 'loading' && (
        <div className="aidiag-loading">
          <motion.span className="aidiag-spark" animate={{ rotate: 360, scale: [1, 1.15, 1] }}
            transition={{ rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.3, repeat: Infinity, ease: 'easeInOut' } }}>✦</motion.span>
          <AnimatePresence mode="wait">
            <motion.span key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              {PHASES[phase]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {state === 'error' && (
        <div className="aidiag-error">
          ⚠️ {error}
          <button onClick={run} className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }}>{tt('Повторить')}</button>
        </div>
      )}

      {state === 'done' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div className="aidiag-summary">
            <span className="aidiag-summary-ico">✦</span>
            <span>{summary}</span>
            <button onClick={run} className="aidiag-refresh" title={tt('Проверить заново')}>↻</button>
          </div>

          {problems.length === 0 ? (
            <div className="aidiag-empty">{tt('Острых проблем не найдено — по текущим сигналам всё в норме.')}</div>
          ) : (
            <div className="aidiag-list">
              {problems.map((p, i) => {
                const sv = sevMeta(p.severity);
                return (
                  <motion.div
                    key={i} className="aidiag-card"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.06 * i }}
                  >
                    <div className="aidiag-card-top">
                      <span className="aidiag-num">{i + 1}</span>
                      <span className="aidiag-sev" style={{ background: sv.bg, color: sv.color }}>{sv.label}</span>
                      {p.action && (
                        <button className="aidiag-open" onClick={() => navigate(p.action)}>{tt('Открыть')} →</button>
                      )}
                    </div>
                    <div className="aidiag-steps">
                      {STEP.map(s => (
                        (p[s.key] != null && p[s.key] !== '') && (
                          <div className="aidiag-step" key={s.key}>
                            <span className="aidiag-step-label" style={{ color: s.color }}>{tt(s.label)}</span>
                            <span className="aidiag-step-val">{p[s.key]}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
