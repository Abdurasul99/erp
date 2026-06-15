import { createContext } from 'react';

// Текущая страница «публикует» свой заголовок в топбар через этот сеттер.
// Дефолт — no-op (если PageHeader отрендерится вне шелла).
export const PageHeaderContext = createContext(() => {});
