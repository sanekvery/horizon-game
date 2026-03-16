import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Hide loading fallback when React starts
const loadingFallback = document.getElementById('loading-fallback');
if (loadingFallback) {
  loadingFallback.style.display = 'none';
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
