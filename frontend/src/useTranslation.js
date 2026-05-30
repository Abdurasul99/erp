import { useContext } from 'react';
import { LangContext } from './App.jsx';
import { translations } from './i18n.js';

export function useTranslation() {
  const ctx = useContext(LangContext);
  const lang = ctx?.lang || localStorage.getItem('lang') || 'ru';
  const t = (key) => translations[lang]?.[key] ?? translations.ru[key] ?? key;
  return { t, lang };
}
