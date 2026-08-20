import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startAnalytics } from './analytics';
import { App } from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles/theme.css';

startAnalytics();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
