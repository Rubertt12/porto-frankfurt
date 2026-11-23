import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App';
import PWAInstall from './PWAInstall';
import './styles.css';

function BrowserApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
          console.error('Não foi possível registrar o modo instalável:', error);
        });
      }, { once: true });
    }
  }, []);

  return <><App /><PWAInstall /></>;
}

// Desktop e navegador usam a mesma aplicação, autenticação e dados em nuvem.
const Root = isTauri() ? App : BrowserApp;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>);
