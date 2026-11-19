import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';

// Чанк раздела не загрузился — выкладка удалила старые файлы, а вкладка открыта со вчера, или
// оборвалась сеть. Без этого раздел падал в «Что-то пошло не так» (QA 2026-11-18). Один раз
// перезагружаем страницу: придёт свежий index.html со свежими именами чанков. Не чаще раза в
// 10 с и только если есть sessionStorage — при настоящей поломке не будет петли перезагрузок,
// ошибку покажет ErrorBoundary с кнопкой «Обновить».
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('wv-chunk-reload') || 0);
    if (Date.now() - last < 10000) return;
    sessionStorage.setItem('wv-chunk-reload', String(Date.now()));
  } catch { return; }
  event.preventDefault();
  window.__wvChunkReload = true;          // ErrorBoundary не мигает экраном ошибки до перезагрузки
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
