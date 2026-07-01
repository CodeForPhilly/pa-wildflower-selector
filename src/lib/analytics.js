const MEASUREMENT_ID = 'G-CHCN0FC8JD';

let initialized = false;

function analyticsEnabled() {
  return (
    typeof window !== 'undefined' &&
    (process.env.NODE_ENV === 'production' || process.env.VUE_APP_GA_DEBUG === 'true')
  );
}

export function initAnalytics() {
  if (!analyticsEnabled() || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  // Vue Router reports page views below, so prevent the config call from
  // creating a duplicate view for the initial route.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

  if (!document.getElementById('google-analytics-tag')) {
    const script = document.createElement('script');
    script.id = 'google-analytics-tag';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
}

export function trackEvent(name, parameters = {}) {
  if (!analyticsEnabled()) return;
  initAnalytics();
  window.gtag('event', name, parameters);
}

export function trackPageView(route) {
  if (!analyticsEnabled()) return;

  // Report the route pattern rather than query strings or individual plant
  // identifiers. This keeps searches and plant choices out of Analytics.
  const matchedRoute = route.matched && route.matched[route.matched.length - 1];
  const pagePath = (matchedRoute && matchedRoute.path) || route.path;

  trackEvent('page_view', {
    page_title: route.name || document.title,
    page_location: `${window.location.origin}${pagePath}`,
    page_path: pagePath,
  });
}
