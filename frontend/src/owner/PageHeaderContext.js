import { createContext } from 'react';

// Текущая страница «публикует» свой заголовок в топбар через этот сеттер.
// Дефолт — no-op (если PageHeader отрендерится вне шелла).
export const PageHeaderContext = createContext(() => {});

// true внутри окна инструмента (.o-sheet в ToolRouter). PageHeader тогда НЕ
// публикует title/sub в топбар (шапка окна уже показывает название инструмента),
// а actions (пилюли периода, кнопки) рендерит инлайн внутри окна. Иначе топбар
// переполнялся: заголовок+фильтры инструмента дублировались рядом с глобальными
// контролами и «размазывали» строку на два ряда.
export const InsideSheetContext = createContext(false);
