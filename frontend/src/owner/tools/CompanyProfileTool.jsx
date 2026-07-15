import React, { useContext, useRef, useState } from 'react';
import api from '../../api.js';
import { AuthContext } from '../../App.jsx';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

// Профиль компании: название + логотип. Лого показывается в сайдбаре панели
// у всех сотрудников компании (вместо буквы-монограммы). Только учредитель.
export default function CompanyProfileTool() {
  const { tt } = useTt();
  const { user } = useContext(AuthContext);
  const [logo, setLogo] = useState(user?.company_logo_url || null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast(tt('Файл больше 2 МБ — выберите меньший'), 'error'); return; }
    const fd = new FormData();
    fd.append('logo', f);
    setBusy(true);
    try {
      const r = await api.post('/company/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogo(r.data.logo_url);
      // Обновляем user в localStorage, чтобы сайдбар подхватил без повторного логина
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        if (u) { u.company_logo_url = r.data.logo_url; localStorage.setItem('user', JSON.stringify(u)); }
      } catch {}
      toast(tt('Логотип сохранён'));
      setTimeout(() => window.location.reload(), 600);
    } catch (err) { toast(err.response?.data?.error || err.message, 'error'); }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete('/company/logo');
      setLogo(null);
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        if (u) { u.company_logo_url = null; localStorage.setItem('user', JSON.stringify(u)); }
      } catch {}
      toast(tt('Логотип удалён'));
      setTimeout(() => window.location.reload(), 600);
    } catch (err) { toast(err.response?.data?.error || err.message, 'error'); }
    setBusy(false);
  };

  const monogram = (user?.company_name || 'W').slice(0, 1).toUpperCase();

  return (
    <>
      <PageHeader title={tt('Компания')} sub={tt('Название и логотип — видны всем сотрудникам в панели')}
        actions={<Badge tone="green">{tt('Готов')}</Badge>} />
      <Card title={tt('Логотип')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {/* Превью — ровно как в сайдбаре */}
          <div style={{
            width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
            border: '1px solid var(--border)', background: logo ? '#fff' : 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {logo
              ? <img src={logo} alt={tt('Логотип')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{monogram}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.company_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
              {tt('PNG, JPG или WebP до 2 МБ. Лучше всего выглядит квадратный знак на прозрачном или белом фоне.')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={pick}>
                {busy ? tt('Сохранение…') : (logo ? tt('Заменить логотип') : tt('Загрузить логотип'))}
              </button>
              {logo && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={remove}>{tt('Убрать')}</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={onFile} />
          </div>
        </div>
      </Card>
    </>
  );
}
