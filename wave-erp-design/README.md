# Wave ERP — дизайн-концепт (Apple style)

Интерфейс ERP-системы в стиле Apple: bento-грид главной, macOS-док с магнификацией,
App Store-раскрытие инструментов, виджеты погоды (живой API Open-Meteo) и календаря.
Все 115 инструментов Wave ERP (9 отделов) из реального каталога `modules.js`.

**Прод:** https://wave-erp-design.vercel.app

## Стек
- React 18 + Vite 5
- Framer Motion 11 (док, layoutId-морфы, пружинные stagger-анимации)
- Чистый CSS (дизайн-токены в `src/styles.css`), SVG-иконки в духе SF Symbols

## Запуск
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # прод-сборка в dist/
```

## Деплой (Vercel)
```bash
vercel deploy --prod --yes
```

## Структура
```
src/
  App.jsx      — оболочка: топбар, док, главная (bento), отдел, шит инструмента, ⌘K
  data.js      — каталог: 9 отделов, 115 инструментов (источник: frontend/src/owner/modules.js)
  icons.jsx    — SVG-иконки (SF Symbols-style) + цвета/градиенты отделов
  charts.jsx   — графики: area+crosshair, дивергентные бары, кольцо BHI, спарклайны
  widgets.jsx  — виджеты: погода (Open-Meteo, Ташкент) и календарь Apple-style
  mock.js      — детерминированные демо-данные экранов инструментов (seed = id)
  styles.css   — дизайн-токены и вся вёрстка
```

## Навигация
- Док внизу — отделы; ⌘K — поиск по всем инструментам
- Ссылки: `#/section/finance`, `#/tool/cash-gap`
- Период 7/30/90 дней — в топбаре
