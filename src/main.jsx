import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadState } from './storage';
import './styles.css';

loadState().then((initialState) => createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App initialState={initialState} />
  </React.StrictMode>,
));

// Ask the browser not to clear this app's saved data when the device is low on space.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
}
