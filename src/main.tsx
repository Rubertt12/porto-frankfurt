import React from 'react';
import ReactDOM from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App';
import LocalWorkspace from './desktop/LocalWorkspace';
import './styles.css';

const Root = isTauri() ? LocalWorkspace : App;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
