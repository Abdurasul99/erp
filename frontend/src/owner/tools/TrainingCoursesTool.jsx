import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Progress, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const fmtDur = (min, tt) => {
  const m = parseInt(min) || 0;
  if (m <= 0) return '—';
  if (m < 60) return `${m} ${tt('мин')}`;
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h} ${tt('ч')} ${r} ${tt('мин')}` : `${h} ${tt('ч')}`;
};

// Должности (роли), для которых создаются курсы
const POSITIONS = [
  { value: 'manager',   label: 'Менеджер' },
  { value: 'cashier',   label: 'Кассир' },
  { value: 'seller',    label: 'Продавец' },
  { value: 'warehouse', label: 'Кладовщик' },
  { value: 'director',   label: 'Директор' },
];

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalBox = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

export default function TrainingCoursesTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ position: 'seller', title: '' });
  const [lessonFormFor, setLessonFormFor] = useState(null); // courseId
  const [lessonForm, setLessonForm] = useState({ title: '', video_url: '', duration_min: '' });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    return api.get('/hr/training', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = (id) => {
    setDetailLoading(true);
    return api.get(`/hr/training/${id}`)
      .then(r => setDetail(r.data))
      .catch(e => setDetail({ error: e.response?.data?.error || e.message }))
      .finally(() => setDetailLoading(false));
  };

  const openCourse = (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); setLessonFormFor(null); return; }
    setOpenId(id); setDetail(null); setLessonFormFor(null);
    loadDetail(id);
  };

  const submitCourse = () => {
    if (!courseForm.title.trim()) { setFormError(tt('Введите название курса')); return; }
    setBusy(true); setFormError(null);
    api.post('/hr/training', { position: courseForm.position, title: courseForm.title.trim() })
      .then(() => {
        setShowCourseForm(false);
        setCourseForm({ position: 'seller', title: '' });
        load();
      })
      .catch(e => setFormError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const submitLesson = (courseId) => {
    if (!lessonForm.title.trim()) { setFormError(tt('Введите название урока')); return; }
    setBusy(true); setFormError(null);
    api.post(`/hr/training/${courseId}/lesson`, {
      title: lessonForm.title.trim(),
      video_url: lessonForm.video_url.trim() || null,
      duration_min: parseInt(lessonForm.duration_min, 10) || 0,
    })
      .then(() => {
        setLessonForm({ title: '', video_url: '', duration_min: '' });
        setLessonFormFor(null);
        loadDetail(courseId);
        load(); // обновить счётчик уроков в таблице
      })
      .catch(e => setFormError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const courses = data?.courses || [];
  const learners = data?.learners || [];
  const k = data?.kpi || {};

  return (
    <>
      <PageHeader title={tt('🎬 Обучение')} sub={tt('Курсы по должностям · прогресс сотрудников')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowCourseForm(true)}>{tt('+ Курс')}</button>}
      />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : courses.length === 0 ? (
        <Card><EmptyState icon="🎬" title={tt('Курсов нет')} description={tt('Создайте курс кнопкой «+ Курс», чтобы обучать сотрудников.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="🎓" label={tt('Должностей с курсами')} value={fmtNum(k.positions || 0)} sub={tt('курсов')} color="#9333EA" />
            <Tile icon="📚" label={tt('Сотрудников учатся')} value={fmtNum(k.learning || 0)} sub={tt('в процессе')} color="#0EA5E9" />
            <Tile icon="✅" label={tt('Завершили обучение')} value={fmtNum(k.completed || 0)} sub={tt('сотрудников')} color="#16A34A" />
            <Tile icon="⏱" label={tt('Средний срок обучения')} value={k.avg_days != null ? `${fmtNum(k.avg_days)} ${tt('дн')}` : '—'} sub={tt('на курс')} color="#D97706" />
          </div>

          <Card icon="🗂" title={tt('Курсы по должностям')} style={{ marginBottom: 18 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Должность')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Уроков')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Общая длительность')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Проходят')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Завершили')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Действия')}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.position}</div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.lessons)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtDur(c.duration_min, tt)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.in_progress > 0 ? fmtNum(c.in_progress) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.completed > 0 ? fmtNum(c.completed) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="pill" onClick={() => openCourse(c.id)}>
                            {openId === c.id ? tt('Скрыть') : tt('Открыть курс')}
                          </button>
                        </td>
                      </tr>
                      {openId === c.id && (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--bg2, #F7F9FC)' }}>
                            {detailLoading ? (
                              <Skeleton height={60} />
                            ) : detail?.error ? (
                              <div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {detail.error}</div>
                            ) : (
                              <div style={{ padding: '6px 0' }}>
                                {(detail?.lessons || []).length === 0 ? (
                                  <div style={{ padding: '8px 4px', color: 'var(--text3)', fontSize: 13 }}>{tt('Уроков пока нет — добавьте первый.')}</div>
                                ) : detail.lessons.map((l, i) => (
                                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid var(--border, #E3EAF3)' }}>
                                    <div style={{ width: 24, color: 'var(--text3)', fontSize: 12, textAlign: 'right' }}>{i + 1}.</div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.title}</div>
                                      {l.video_url && <a href={l.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--primary)' }}>{tt('Видео')}</a>}
                                    </div>
                                    <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDur(l.duration_min, tt)}</div>
                                  </div>
                                ))}

                                {lessonFormFor === c.id ? (
                                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: '1px dashed var(--border, #E3EAF3)', background: 'var(--bg)' }}>
                                    <div className="grid-2" style={{ gap: 10 }}>
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={lbl}>{tt('Название урока')}</label>
                                        <input style={inp} value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder={tt('Например: Работа с кассой')} />
                                      </div>
                                      <div>
                                        <label style={lbl}>{tt('Ссылка на видео')}</label>
                                        <input style={inp} value={lessonForm.video_url} onChange={e => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://..." />
                                      </div>
                                      <div>
                                        <label style={lbl}>{tt('Длительность (мин)')}</label>
                                        {/* Минуты — целые. type="number" на «12,5» отдавал '' и урок сохранялся без длительности. */}
                                        <input style={inp} type="text" inputMode="numeric" value={lessonForm.duration_min}
                                          onChange={e => setLessonForm(f => ({ ...f, duration_min: e.target.value.replace(/[^\d]/g, '') }))} />
                                      </div>
                                    </div>
                                    {formError && <div style={{ marginTop: 10, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>⚠️ {formError}</div>}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setLessonFormFor(null); setFormError(null); }}>{tt('Отмена')}</button>
                                      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => submitLesson(c.id)}>{tt('Добавить урок')}</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ marginTop: 10 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setLessonFormFor(c.id); setLessonForm({ title: '', video_url: '', duration_min: '' }); setFormError(null); }}>{tt('+ Урок')}</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="📚" title={tt('Активные ученики')}>
            {learners.length === 0 ? (
              <EmptyState icon="📭" title={tt('Никто не учится')} description={tt('Сотрудники пока не начали проходить курсы.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Должность')}</th>
                      <th style={{ minWidth: 180 }}>{tt('Прогресс')}</th>
                      <th>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map(e => {
                      const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                      const done = e.total > 0 && e.passed >= e.total;
                      return (
                        <tr key={e.employee_id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                              <div style={{ fontWeight: 700 }}>{e.name}</div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text2)' }}>{e.position || '—'}</td>
                          <td>
                            <Progress value={e.passed} max={e.total || 1} color={done ? '#16A34A' : 'var(--primary)'} />
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                              {e.total > 0 ? `${Math.round((e.passed / e.total) * 100)}% (${fmtNum(e.passed)} ${tt('из')} ${fmtNum(e.total)})` : '—'}
                            </div>
                          </td>
                          <td>
                            {done
                              ? <Badge tone="green">✅ {tt('Завершил')}</Badge>
                              : <Badge tone="blue">📚 {tt('Учится')}</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Прогресс считается по завершённым урокам курса должности сотрудника.')}
            </div>
          </Card>
        </>
      )}

      {showCourseForm && (
        <div style={overlay} onClick={() => !busy && setShowCourseForm(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новый курс')}</div>
            <div>
              <label style={lbl}>{tt('Должность')}</label>
              <select style={inp} value={courseForm.position} onChange={e => setCourseForm({ ...courseForm, position: e.target.value })}>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{tt(p.label)}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>{tt('Название курса')}</label>
              <input style={inp} value={courseForm.title} onChange={e => setCourseForm({ ...courseForm, title: e.target.value })} placeholder={tt('Например: Онбординг продавца')} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
              {tt('После создания откройте курс и добавьте уроки.')}
            </div>
            {formError && <div style={{ marginTop: 12, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>⚠️ {formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => { setShowCourseForm(false); setFormError(null); }}>{tt('Отмена')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={submitCourse}>{tt('Создать')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
