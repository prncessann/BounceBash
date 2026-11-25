'use strict';

(() => {
  const project = new URL('../../', document.currentScript.src);
  const sessionKey = 'bouncebash-admin-demo:' + project.pathname;
  const demoEnd = '2026-11-25';
  const storage = window.sessionStorage;
  const backend = window.fetch.bind(window);
  const hostedOnPages = location.hostname.endsWith('.github.io');
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let useDemo;

  function demoMode() {
    if (!useDemo) {
      // Live local servers answer this route. Static preview servers return 404.
      useDemo = hostedOnPages || !localPreview
        ? Promise.resolve(hostedOnPages)
        : backend('/api/staff/session', { credentials: 'same-origin' })
          .then(response => response.status === 404);
    }
    return useDemo;
  }

  function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }

  function matching(bookings, params) {
    const from = params.get('from') || '';
    const to = params.get('to') || '9999';
    const status = params.get('status');
    const payment = params.get('payment');
    const search = (params.get('search') || '').trim().toLowerCase();
    return bookings.filter(row =>
      row.event_date >= from && row.event_date <= to &&
      (!status || row.status === status) &&
      (!payment || payment === 'unpaid' || (payment === 'balance' && row.balance_cents > 0)) &&
      (!search || [row.reference, row.name, row.contact_number].some(value => value.toLowerCase().includes(search))));
  }

  function overview(bookings, params) {
    const rows = matching(bookings, params).sort((a, b) => a.event_date.localeCompare(b.event_date));
    return {
      from: params.get('from') || '2026-08-25',
      to: params.get('to') || demoEnd,
      today: demoEnd,
      bookings: rows.map(row => ({
        ...row, reference_code: row.reference, verified_cents: 0, pending_cents: 0, upcoming: false,
      })),
      totals: {
        bookings: rows.length, confirmed: 0, pending: 0, upcoming: 0, unknown_quotes: 0,
        outstanding_cents: 0, known_booking_value_cents: rows.reduce((sum, row) => sum + (row.total_cents || 0), 0),
        verified_collected_cents: 0, recorded_refunded_cents: 0, gross_collections_cents: 0,
        net_collections_cents: 0, pending_reference_cents: 0, pending_references: 0,
        unresolved_inactive_cents: 0,
      },
      payments: [],
      extras: [],
    };
  }

  function demoRequest(url, options) {
    const { pathname, searchParams: params } = url;
    const method = (options.method || 'GET').toUpperCase();
    const authenticated = storage.getItem(sessionKey) === 'demo';
    if (pathname === '/api/staff/session') {
      return response({ authenticated, name: 'Demo Staff', demo: true });
    }
    if (pathname === '/api/staff/login' && method === 'POST') {
      const { email, password } = JSON.parse(options.body || '{}');
      if (email?.trim().toLowerCase() !== 'demo@bouncebash.example' || password !== 'BounceBashDemo2026') {
        return response({ error: 'Use demo@bouncebash.example and BounceBashDemo2026 for the static preview.' }, 401);
      }
      storage.setItem(sessionKey, 'demo');
      return response({ success: true });
    }
    if (pathname === '/api/staff/logout' && method === 'POST') {
      storage.removeItem(sessionKey);
      return response({ success: true });
    }
    if (!authenticated) return response({ error: 'Sign in to the demo first.' }, 401);
    if (method !== 'GET') return response({ error: 'The GitHub Pages demo is read-only.' }, 405);

    const { bookings, operatorCatalog, policy, editorial } = window.BBAdminDemoData;
    const models = operatorCatalog.models.map(model => ({
      ...model, image_url: model.image_url ? new URL(model.image_url.replace(/^\//, ''), project).href : '',
    }));
    if (pathname === '/api/operator/bookings') {
      const rows = matching(bookings, params).sort((a, b) => {
        if (params.get('sort') === 'soonest') return a.event_date.localeCompare(b.event_date);
        if (params.get('sort') === 'latest') return b.event_date.localeCompare(a.event_date);
        return b.id - a.id;
      });
      const offset = Number(params.get('offset')) || 0;
      const limit = Number(params.get('limit')) || 50;
      return response({ bookings: rows.slice(offset, offset + limit), total: rows.length });
    }
    if (pathname.startsWith('/api/operator/bookings/')) {
      const reference = decodeURIComponent(pathname.slice('/api/operator/bookings/'.length));
      const booking = bookings.find(row => row.reference === reference);
      return booking ? response({ booking }) : response({ error: 'Booking not found.' }, 404);
    }
    switch (pathname) {
      case '/api/operator/overview': return response(overview(bookings, params));
      case '/api/catalog': return response({ ...operatorCatalog, models, cities: policy.cities });
      case '/api/operator/catalog': return response({ ...operatorCatalog, models });
      case '/api/operator/pricing-policy': return response(policy);
      case '/api/operator/articles': return response({ articles: editorial });
      case '/api/operator/reviews': return response({ reviews: [] });
      case '/api/operator/inquiries': return response({ inquiries: [] });
      case '/api/operator/date-blocks': return response({ blocks: [] });
      case '/api/availability/month': return response({ unavailableDates: [] });
      case '/api/operator/audit': return response({ events: [] });
      case '/api/operator/business-settings': return response({ settings: {} });
      case '/api/operator/notifications': return response({ provider_configured: false, notifications: [] });
      case '/api/operator/staff-notices': return response({ preferences: {} });
      default: return response({ error: 'This data is unavailable in the static demo.' }, 404);
    }
  }

  window.BBAdminRequest = async (path, options = {}) => {
    if (!await demoMode()) return backend(path, options);
    return demoRequest(new URL(path, location.href), options);
  };
})();
