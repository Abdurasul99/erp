import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, fmtNum, fmtMoneyFull } from '../ui.jsx';

const CURR_FLAG = { UZS: '🇺🇿', USD: '🇺🇸', EUR: '🇪🇺', RUB: '🇷🇺', KZT: '🇰🇿', CNY: '🇨🇳', TRY: '🇹🇷', KRW: '🇰🇷', GBP: '🇬🇧', AED: '🇦🇪' };

export default function ScalingTool() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    api.get('/settings/overview')
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const branches = data?.branches || [];
  const currencies = data?.currencies || [];

  return (
    <>
      <PageHeader title="🌍 Масштабирование" sub="Филиалы · валюты · языки · реальные данные" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="🏢" label="Компания" value={data.company?.name || '—'} sub="ваш аккаунт" color="#5B4FE8" />
            <Tile icon="🏭" label="Филиалов" value={fmtNum(branches.length)} sub="работают в системе" color="#FF6B2B" />
            <Tile icon="💱" label="Валют в обороте" value={fmtNum(currencies.length)} sub="по реальным операциям" color="#22C55E" />
            <Tile icon="🌐" label="Языков" value={(data.languages || []).length} sub={(data.languages || []).join(' · ')} color="#0EA5E9" />
          </div>

          <div className="grid-2">
            <Card icon="🏭" title="Филиалы">
              <div className="list">
                {branches.map(b => (
                  <div key={b.id} className="list-item">
                    <div style={{ fontSize: 16 }} aria-hidden="true">📍</div>
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{b.name}</div>
                      <div className="list-item-sub">
                        в системе с {new Date(b.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <Badge tone="green">Активен</Badge>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                Новый филиал добавляется через раздел «Персонал → Сотрудники» или администратором системы.
              </div>
            </Card>

            <Card icon="💱" title="Валюты в обороте (из ваших операций)">
              {currencies.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '14px 0' }}>Операций пока нет</div>
              ) : (
                <div className="list">
                  {currencies.map(c => (
                    <div key={c.currency} className="list-item">
                      <div style={{ fontSize: 16 }} aria-hidden="true">{CURR_FLAG[c.currency] || '💱'}</div>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{c.currency}</div>
                        <div className="list-item-sub">{fmtNum(c.tx_count)} операций</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 13 }}>
                        {c.currency === 'UZS' ? '1' : (c.last_rate ? fmtMoneyFull(c.last_rate) : '—')}
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>сум</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                Курс — последний использованный в операциях (кассир вводит уличный курс при продаже).
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
