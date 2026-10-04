import React, { useState } from 'react';
import { TIERS, MATRIX, MARKET, FAQ, STEPS, APP_URL, CONTACT_TG, CONTACT_PHONE, YEAR_DISCOUNT } from './data.js';

const money = (n) => n.toLocaleString('ru-RU');

function Cell({ v }) {
  if (v === true) return <span className="yes" aria-label="есть">✓</span>;
  if (!v) return <span className="no" aria-label="нет">—</span>;
  return <span className="partial">{v}</span>;
}

export default function App() {
  // Год даёт скидку — считаем из одной константы, чтобы цена на кнопке и в
  // таблице не разъехались с обещанием в подвале.
  const [yearly, setYearly] = useState(false);
  const priceOf = (t) => (yearly ? Math.round(t.price * (1 - YEAR_DISCOUNT)) : t.price);

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <div className="logo">
            <div className="logo-mark">W</div>
            <div>
              WOW Combinator
              <small>Платформа Wave</small>
            </div>
          </div>
          <nav className="top-nav">
            <a href="#what">Что это</a>
            <a href="#tariffs">Тарифы</a>
            <a href="#matrix">Что входит</a>
            <a href="#market">Сравнение</a>
            <a href="#faq">Вопросы</a>
          </nav>
          <a className="btn btn-ghost btn-sm" href={APP_URL} target="_blank" rel="noreferrer">Войти в систему</a>
        </div>
      </header>

      {/* ── Герой ─────────────────────────────────────────────── */}
      <div className="wrap hero">
        <div className="hero-grid">
          <div>
            <span className="pill">Wave · система управления торговым бизнесом</span>
            <h1>Это не касса. Это система, которая показывает, где ваши деньги.</h1>
            <p className="lead">
              Приход, продажи, склад, долги, зарплаты, закупки и аналитика — в одном окне.
              Продавец работает с телефона, кассир — на кассе, владелец видит всю сеть.
              80 инструментов вместо десяти таблиц в Excel.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#tariffs">Смотреть тарифы</a>
              <a className="btn btn-ghost" href={APP_URL} target="_blank" rel="noreferrer">Войти в систему</a>
            </div>
            <div className="hero-note">7 дней бесплатно на ваших данных · запуск за 1–3 дня · русский и узбекский</div>

            <div className="stat-row">
              <div className="stat"><b>80</b><span>инструментов в системе</span></div>
              <div className="stat"><b>7</b><span>ролей со своим окном</span></div>
              <div className="stat"><b>1–3 дня</b><span>до старта работы</span></div>
            </div>
          </div>

          {/* Схематичное окно системы — не скриншот, чтобы не обещать лишнего */}
          <div className="shot" aria-hidden="true">
            <div className="shot-bar">
              <span className="shot-dot" /><span className="shot-dot" /><span className="shot-dot" />
            </div>
            <div className="shot-body">
              <div className="shot-cards">
                <div className="shot-card"><span>Выручка</span><b>48 200 000</b></div>
                <div className="shot-card"><span>Прибыль</span><b>9 100 000</b></div>
                <div className="shot-card"><span>Касса</span><b>3 400 000</b></div>
              </div>
              <div className="shot-chart">
                {[38, 52, 44, 61, 57, 72, 66, 84, 79, 92].map((h, i) => (
                  <i key={i} style={{ height: h + '%' }} />
                ))}
              </div>
              <div className="shot-line" style={{ width: '70%' }} />
              <div className="shot-line" style={{ width: '45%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Для кого ──────────────────────────────────────────── */}
      <section id="what" className="section-soft">
        <div className="wrap">
          <h2 className="h2">Знакомо?</h2>
          <p className="sub">
            Мы собрали Wave из проблем, которые слышим от торговых сетей в Узбекистане
            каждый день. Не из списка модных функций.
          </p>
          <div className="cards-3">
            <div className="card">
              <div className="card-n">1</div>
              <h3>Товар кончился — узнали от клиента</h3>
              <p>Система сама говорит, что заканчивается и что заказывать: остатки, скорость продаж, прогноз закупок, долги поставщикам.</p>
            </div>
            <div className="card">
              <div className="card-n">2</div>
              <h3>Выручка есть, а денег нет</h3>
              <p>Видно, куда ушли деньги: расходы по статьям, долги клиентов, маржа по товарам, денежный поток и точка безубыточности.</p>
            </div>
            <div className="card">
              <div className="card-n">3</div>
              <h3>Продавцы «работают», а результат не видно</h3>
              <p>Средний чек по каждому продавцу, смены, план и факт, поручения с историей статусов, зарплата и нарушения — без ручных таблиц.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Тарифы ────────────────────────────────────────────── */}
      <section id="tariffs">
        <div className="wrap">
          <h2 className="h2">Тарифы</h2>
          <p className="sub">
            Начните с учёта прихода и продаж — дальше открывайте разделы по мере роста.
            Тариф меняется в тот же день, данные остаются на месте.
          </p>

          <div className="toggle" role="group" aria-label="Период оплаты">
            <button type="button" className={yearly ? '' : 'on'} onClick={() => setYearly(false)}>Помесячно</button>
            <button type="button" className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>
              За год<span className="save"> −20%</span>
            </button>
          </div>

          <div className="tiers">
            {TIERS.map((t) => (
              <div key={t.id} className={'tier' + (t.popular ? ' hot' : '')}>
                {t.popular && <span className="tier-badge">Чаще всего берут</span>}
                <h3>{t.name}</h3>
                <div className="tag">{t.tagline}</div>

                <div className="price">
                  {money(priceOf(t))}
                  <small>сум в месяц{yearly ? ' при оплате за год' : ''}</small>
                </div>
                {yearly && <div className="price-year">Экономия {money(t.price - priceOf(t))} сум в месяц</div>}

                <div className="tier-limits">
                  <div><span>Филиалы</span><b>{t.branches.replace('до ', 'до ').replace(' филиалов', '').replace(' филиал', '')}</b></div>
                  <div><span>Пользователи</span><b>без лимита</b></div>
                  <div><span>Инструментов</span><b>{t.tools}</b></div>
                </div>

                <ul>
                  {t.highlights.map((h) => <li key={h}>{h}</li>)}
                </ul>

                <a className={'btn ' + (t.popular ? 'btn-primary' : 'btn-ghost')}
                   href={CONTACT_TG} target="_blank" rel="noreferrer">
                  {t.id === 'corp' ? 'Обсудить внедрение' : 'Попробовать 7 дней'}
                </a>
              </div>
            ))}
          </div>

          <p className="sub" style={{ marginTop: 26, marginBottom: 0, fontSize: 13.5 }}>
            Все тарифы: без ограничения пользователей, два языка, права по ролям, журнал действий,
            мобильные окна для продавца, кассира и складовщика. Дополнительный филиал сверх тарифа — по договорённости.
          </p>
        </div>
      </section>

      {/* ── Матрица возможностей ──────────────────────────────── */}
      <section id="matrix" className="section-soft">
        <div className="wrap">
          <h2 className="h2">Что входит в каждый тариф</h2>
          <p className="sub">Список — это реальные разделы системы, а не обещания. Открывается ровно то, что здесь отмечено.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Возможность</th>
                  {TIERS.map((t) => <th key={t.id}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((g) => (
                  <React.Fragment key={g.section}>
                    <tr className="group"><td colSpan={5}>{g.section}</td></tr>
                    {g.items.map((it) => (
                      <tr key={it.name}>
                        <td>{it.name}</td>
                        <td><Cell v={it.start} /></td>
                        <td><Cell v={it.business} /></td>
                        <td><Cell v={it.pro} /></td>
                        <td><Cell v={it.corp} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Сравнение с рынком ────────────────────────────────── */}
      <section id="market">
        <div className="wrap">
          <h2 className="h2">Где мы на рынке Узбекистана</h2>
          <p className="sub">
            Честно: кассовые программы дешевле. Они и решают одну задачу — пробить чек.
            Настоящая ERP начинается от 1С за 157 миллионов и месяцев внедрения. Мы посередине.
          </p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="market-row market-head">
              <div>Решение</div><div>Цена, сум в месяц</div><div>Что закрывает</div>
            </div>
            {MARKET.map((m) => (
              <div key={m.name} className={'market-row' + (m.us ? ' us' : '')}>
                <div>{m.name}</div>
                <div>{m.price}</div>
                <div style={{ color: 'var(--ink-2)' }}>{m.what}</div>
              </div>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 16, marginBottom: 0, fontSize: 12.5 }}>
            Цены конкурентов — с их публичных сайтов, август 2026. Проверяйте актуальные условия у поставщиков.
          </p>
        </div>
      </section>

      {/* ── Как начинаем ──────────────────────────────────────── */}
      <section className="section-soft">
        <div className="wrap">
          <h2 className="h2">Как проходит запуск</h2>
          <p className="sub">Без месяцев внедрения и толстых договоров.</p>
          <div className="cards-3">
            {STEPS.map((s) => (
              <div className="card" key={s.n}>
                <div className="card-n">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Вопросы ───────────────────────────────────────────── */}
      <section id="faq">
        <div className="wrap">
          <h2 className="h2">Частые вопросы</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Призыв ────────────────────────────────────────────── */}
      <div className="wrap">
        <div className="cta">
          <h2>Посмотрите на своих цифрах</h2>
          <p>Семь дней бесплатно. Заведём вашу компанию, загрузим остатки и покажем, что система видит в вашем бизнесе.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="btn btn-ghost" href={CONTACT_TG} target="_blank" rel="noreferrer">Написать в Telegram</a>
            <a className="btn btn-ghost" href={APP_URL} target="_blank" rel="noreferrer">Войти в систему</a>
          </div>
        </div>
      </div>

      <footer>
        <div className="wrap foot">
          <div>
            <div className="logo" style={{ marginBottom: 6 }}>
              <div className="logo-mark">W</div>
              <div>WOW Combinator<small>Оператор платформы Wave</small></div>
            </div>
            Ташкент, Узбекистан
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <a href={APP_URL} target="_blank" rel="noreferrer">mywarehouse.uz</a>
            <a href={CONTACT_TG} target="_blank" rel="noreferrer">Telegram</a>
            <a href={'tel:' + CONTACT_PHONE.replace(/[^\d+]/g, '')}>{CONTACT_PHONE}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
