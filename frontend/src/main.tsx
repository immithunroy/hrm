/**
 * Application entry point.
 *
 * Mounts the root <App /> component into the #root DOM element.
 * React.StrictMode is enabled to surface potential issues during development
 * (double-invokes effects, highlights deprecated APIs, etc.).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);