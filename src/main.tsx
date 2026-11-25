import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource-variable/dm-sans';
import 'katex/dist/katex.min.css';
import './styles/app.css';
import { App } from './App';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch((error) => console.warn('Offline fallback unavailable', error));
  });
