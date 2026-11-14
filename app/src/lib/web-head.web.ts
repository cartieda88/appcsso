/** Metadatos para instalar la página como app ("Agregar a pantalla de inicio"). */
export function setupWebHead() {
  if (typeof document === 'undefined' || document.querySelector('link[rel="manifest"]')) return;
  document.documentElement.lang = 'es-EC';
  document.title = 'Muévete Netlife';
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  add('link', { rel: 'manifest', href: '/manifest.webmanifest' });
  add('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' });
  add('meta', { name: 'theme-color', content: '#141416' });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Muévete' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' });
}
