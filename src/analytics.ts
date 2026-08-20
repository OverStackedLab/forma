const MEASUREMENT_ID = 'G-X3H2JF8SQN';

declare global {
  interface Window {
    dataLayer: Array<Array<string | Date>>;
  }
}

function gtag(...args: Array<string | Date>): void {
  window.dataLayer.push(args);
}

/** Google Analytics 4 — production builds only, so local/e2e traffic stays out. */
export function startAnalytics(): void {
  if (!import.meta.env.PROD) return;

  window.dataLayer = window.dataLayer ?? [];
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
}
