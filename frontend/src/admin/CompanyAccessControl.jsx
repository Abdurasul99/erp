import React from 'react';

export default function CompanyAccessControl({ enabled, busy = false, onToggle }) {
  const isEnabled = enabled !== false;

  return (
    <div
      data-testid="company-access-control"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}
    >
      <div style={{ flex: '1 1 320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <span className={`badge badge-${isEnabled ? 'green' : 'red'}`}>
            {isEnabled ? '● Доступ разрешён' : '● Доступ приостановлен'}
          </span>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55 }}>
          {isEnabled
            ? 'При отключении все текущие сессии завершатся, а пользователи компании не смогут войти.'
            : 'Пользователи компании не могут войти. Персональные блокировки пользователей не изменены.'}
        </div>
      </div>

      <button
        type="button"
        className={`btn ${isEnabled ? 'btn-danger' : 'btn-success'}`}
        disabled={busy}
        onClick={() => onToggle?.(!isEnabled)}
      >
        {busy
          ? 'Сохранение…'
          : isEnabled ? 'Отключить компанию' : 'Включить компанию'}
      </button>
    </div>
  );
}
