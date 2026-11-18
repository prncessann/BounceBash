(function () {
  const $ = (id) => document.getElementById(id);
  const money = (c) => c == null ? 'Awaiting quotation' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(c / 100);
  const PAY = { pending: 'Awaiting verification', verified: 'Verified', rejected: 'Rejected', refunded: 'Refunded' };
  const STATUS = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' };
  const STATUS_CLS = { pending: 'p1', confirmed: 'p2', completed: 'p2', cancelled: 'p0', expired: 'p0' };
  const HINT = 'Click a reference to open it.';
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined && text !== null) n.textContent = text; if (cls) n.className = cls; return n; };
  const td = (text, cls) => el('td', text, cls);
  const fieldStyle = 'width:100%;margin:6px 0;padding:8px 12px;border:1px solid var(--line);border-radius:10px';
  let selectedRef = '';
  let drawer = null;
  let scrim = null;
  let msgTimer = null;
  let bookings = [];
  let filterKey = 'all';
  let chipEls = null;
  let countEl = null;

  const FILTERS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'attention', label: 'Needs attention', test: b => b.status === 'pending' || (b.status === 'confirmed' && (b.balance_cents || 0) > 0) },
    { key: 'pending', label: 'Pending', test: b => b.status === 'pending' },
    { key: 'confirmed', label: 'Confirmed', test: b => b.status === 'confirmed' },
    { key: 'completed', label: 'Completed', test: b => b.status === 'completed' },
    { key: 'cancelled', label: 'Cancelled', test: b => b.status === 'cancelled' || b.status === 'expired' }
  ];

  /* ---------- messages (page + drawer) ---------- */
  function setMsg(text, kind) {
    const targets = [$('live-msg'), $('bk-msg')].filter(Boolean);
    for (const m of targets) {
      m.textContent = text;
      m.className = 'mu' + (kind ? ' ' + kind : '');
      m.setAttribute('role', 'status');
    }
    clearTimeout(msgTimer);
    if (kind === 'ok') {
      msgTimer = setTimeout(() => {
        for (const m of targets) {
          if (m.textContent !== text) continue;
          m.textContent = m.id === 'live-msg' ? HINT : '';
          m.className = 'mu';
        }
      }, 5000);
    }
  }

  async function api(method, path, body) {
    const res = await fetch('/api/operator' + path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { location.replace('login.html'); throw new Error('Your session has ended. Please sign in again.'); }
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ').'));
    return data;
  }

  /* ---------- booking list ---------- */
  // Adds a "Status" column header after "Booking" (once), so no HTML edit is needed.
  function ensureStatusColumn() {
    const table = $('live-rows').closest('table');
    if (!table || table.dataset.statusCol) return;
    const headRow = table.querySelector('thead tr');
    if (headRow && headRow.children.length >= 2) {
      headRow.insertBefore(el('th', 'Status'), headRow.children[2] || null);
    }
    table.dataset.statusCol = '1';
  }

  // Builds the filter chips once. Replaces the old static chips (which only worked on sample rows).
  function buildChips() {
    if (chipEls) return;
    const table = $('live-rows').closest('table');
    const host = (table && table.closest('.tw')) || table;
    let box = document.querySelector('.chips');
    if (!box) { box = el('div', null, 'chips'); host.parentNode.insertBefore(box, host); }
    box.replaceChildren();
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Filter bookings');
    chipEls = {};
    for (const f of FILTERS) {
      const c = el('button', f.label, 'chip'); c.type = 'button';
      c.addEventListener('click', () => { filterKey = f.key; renderRows(); });
      box.append(c);
      chipEls[f.key] = c;
    }
  }

  function setCount(text) {
    if (!countEl) {
      // Reuse the old static "11 bookings in total" line if it exists.
      countEl = [...document.querySelectorAll('p,div,span')].find(n => !n.children.length && /^\s*\d+ bookings? in total\s*$/i.test(n.textContent));
      if (!countEl) {
        const table = $('live-rows').closest('table');
        const host = (table && table.closest('.tw')) || table;
        countEl = el('p', '', 'mu');
        host.after(countEl);
      }
    }
    countEl.textContent = text;
  }

  function renderRows() {
    buildChips();
    for (const f of FILTERS) {
      const c = chipEls[f.key], on = f.key === filterKey;
      c.textContent = f.label + ' (' + bookings.filter(f.test).length + ')';
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    }
    const current = FILTERS.find(f => f.key === filterKey) || FILTERS[0];
    const shown = bookings.filter(current.test);
    const tbody = $('live-rows'); tbody.replaceChildren();
    if (!shown.length) {
      const tr = el('tr'); const cell = td(bookings.length ? 'No bookings match this filter.' : 'No bookings yet.', 'mu'); cell.colSpan = 8; tr.append(cell); tbody.append(tr);
    }
    for (const b of shown) {
      const tr = el('tr');
      const payCell = el('td'); payCell.append(el('span', b.payment_status, 'pill'));
      const ref = el('td', null, 'id'); const link = el('a', b.reference); link.href = '#';
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', (e) => { e.preventDefault(); openBooking(b.reference).catch(err => setMsg(err.message, 'bad')); });
      ref.append(link);
      const stCell = el('td'); stCell.append(el('span', STATUS[b.status] || b.status, 'pill ' + (STATUS_CLS[b.status] || '')));
      tr.append(payCell, ref, stCell, td(b.name), td(b.event_date + ' ' + b.event_time), td(b.package_name), td(money(b.total_cents)), td(['cancelled', 'expired'].includes(b.status) ? '—' : money(b.balance_cents)));
      tbody.append(tr);
    }
    setCount('Showing ' + shown.length + ' of ' + bookings.length + (bookings.length === 1 ? ' booking' : ' bookings'));
  }

  async function loadList() {
    ensureStatusColumn();
    const data = await api('GET', '/bookings?limit=100');
    bookings = data.bookings || [];
    renderRows();
  }

  /* ---------- booking drawer ---------- */
  function buildDrawer() {
    if (drawer) return;
    scrim = el('div', null, 'scrim'); scrim.id = 'bk-scrim';
    scrim.addEventListener('click', closeBooking);

    drawer = el('div', null, 'drawer lg bkd'); drawer.id = 'bk-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'bk-title');

    const head = el('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px';
    const title = el('h2', 'Booking details'); title.id = 'bk-title'; title.tabIndex = -1;
    const close = el('button', 'Close', 'btn'); close.type = 'button'; close.id = 'bk-close';
    close.addEventListener('click', closeBooking);
    head.append(title, close);

    const msg = el('p', '', 'mu'); msg.id = 'bk-msg'; msg.setAttribute('role', 'status');

    // Move the existing detail container out of the page and into the drawer.
    drawer.append(head, msg, $('live-detail'));
    document.body.append(scrim, drawer);
  }

  const isOpen = () => !!drawer && drawer.classList.contains('on');

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeBooking(); return; }
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll('button:not([disabled]),input,a[href]')].filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || active === $('bk-title') || active === drawer)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  function showDrawer() {
    buildDrawer();
    if (!isOpen()) {
      scrim.classList.add('on');
      drawer.classList.add('on');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
    }
    $('bk-title').focus();
  }

  function closeBooking() {
    if (!isOpen()) return;
    const ref = selectedRef;
    drawer.classList.remove('on');
    scrim.classList.remove('on');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    selectedRef = '';
    const m = $('bk-msg'); if (m) { m.textContent = ''; m.className = 'mu'; }
    // Return focus to the reference the admin clicked (rows are rebuilt after actions, so look it up).
    const links = [...document.querySelectorAll('#live-rows a')];
    const back = links.find(a => a.textContent === ref) || links[0];
    if (back) back.focus();
  }

  async function openBooking(ref) {
    const data = await api('GET', '/bookings/' + encodeURIComponent(ref));
    selectedRef = ref;
    renderDetail(data.booking);
    showDrawer();
  }

  async function act(fn, okText) {
    try {
      await fn();
      setMsg(okText, 'ok');
      await loadList();
      if (selectedRef) await openBooking(selectedRef);
    } catch (e) { setMsg(e.message, 'bad'); }
  }

  /* ---------- small form helpers ---------- */
  function textField(id, label, placeholder) {
    const l = el('label', label, 'fld'); l.htmlFor = id;
    const i = el('input'); i.id = id; i.type = 'text'; i.minLength = 2; i.placeholder = placeholder || 'At least 2 characters'; i.style.cssText = fieldStyle;
    return { label: l, input: i };
  }
  function needText(value, what) {
    if ((value || '').trim().length < 2) { setMsg('Enter ' + what + ' (at least 2 characters).', 'bad'); return false; }
    return true;
  }

  function renderDetail(b) {
    buildDrawer();
    $('bk-title').textContent = 'Booking ' + b.reference;
    const box = $('live-detail'); box.replaceChildren();
    const active = b.status === 'pending' || b.status === 'confirmed';

    /* summary rows */
    const info = [['Customer', b.name], ['Contact', b.contact_number], ['Email', b.email], ['Event', b.event_date + ' ' + b.event_time], ['Package', b.package_name], ['Venue', b.venue], ['Status', STATUS[b.status] || b.status]];
    if (b.cancellation_reason) info.push(['Cancellation reason', b.cancellation_reason]);
    info.push(['Payment status', b.payment_status], ['Total', money(b.total_cents)], ['Deposit (50%)', money(b.deposit_cents)], ['Verified paid', money(b.paid_cents)], ['Remaining balance', money(b.balance_cents)]);
    for (const [k, v] of info) { const row = el('div', null, 'row'); row.append(el('span', k, 'mu'), el('span', String(v ?? ''))); box.append(row); }
    if (b.refund_note) box.append(el('p', b.refund_note, 'mu hint-box'));

    /* payments */
    box.append(el('h3', 'Payments'));
    if (!b.payments.length) box.append(el('p', 'No payments recorded.', 'mu'));
    for (const p of b.payments) {
      const row = el('div', null, 'row');
      row.append(el('span', money(p.amount_cents) + ' · ' + (p.method || '') + ' · Ref ' + p.reference), el('span', PAY[p.status] || p.status));
      box.append(row);

      if (p.status === 'pending') {
        const note = el('input'); note.type = 'text'; note.minLength = 2; note.placeholder = 'Note (at least 2 characters)'; note.style.cssText = fieldStyle;
        note.setAttribute('aria-label', 'Note for reference ' + p.reference);
        if (active) {
          const verify = el('button', 'Verify payment', 'btn gold'); verify.type = 'button';
          verify.addEventListener('click', () => { if (needText(note.value, 'a verification note')) act(() => api('PUT', '/payments/' + p.id, { status: 'verified', note: note.value }), 'Payment verified.'); });
          box.append(note, verify);
        } else {
          box.append(el('p', 'This booking is ' + (STATUS[b.status] || b.status).toLowerCase() + ', so the payment can only be rejected.', 'mu'), note);
        }
        const reject = el('button', 'Reject', 'btn'); reject.type = 'button';
        reject.addEventListener('click', () => { if (needText(note.value, 'a note explaining the rejection')) act(() => api('PUT', '/payments/' + p.id, { status: 'rejected', note: note.value }), 'Payment rejected.'); });
        box.append(reject);
      }

      // Refund: only after the booking is cancelled/expired. This records a refund made outside the site.
      if (p.status === 'verified' && !active && b.status !== 'completed') {
        const rn = el('input'); rn.type = 'text'; rn.minLength = 2; rn.placeholder = 'Refund note, e.g. GCash refund ref'; rn.style.cssText = fieldStyle;
        rn.setAttribute('aria-label', 'Refund note for reference ' + p.reference);
        const refund = el('button', 'Record refund', 'btn'); refund.type = 'button';
        refund.addEventListener('click', () => {
          if (!needText(rn.value, 'a refund note')) return;
          if (!confirm('Record this ' + money(p.amount_cents) + ' payment as refunded?\n\nThis only records a refund you already sent. No money is moved by the website.')) return;
          act(() => api('PUT', '/payments/' + p.id, { status: 'refunded', note: rn.value }), 'Refund recorded.');
        });
        box.append(rn, refund);
      }
    }

    /* pending: quote + confirm */
    if (b.status === 'pending') {
      box.append(el('h3', b.total_cents == null ? 'Set quote' : 'Update quote'));
      const lt = el('label', 'Total (PHP)', 'fld'); lt.htmlFor = 'q-total';
      const total = el('input'); total.id = 'q-total'; total.type = 'number'; total.min = '1'; total.step = '1'; total.placeholder = 'e.g. 10000'; total.style.cssText = fieldStyle;
      const qn = textField('q-note', 'Quote explanation');
      const save = el('button', 'Save quote', 'btn gold'); save.type = 'button';
      save.addEventListener('click', () => {
        if (!(Number(total.value) > 0)) { setMsg('Enter the total in PHP.', 'bad'); return; }
        if (!needText(qn.input.value, 'a quote explanation')) return;
        act(() => api('PUT', '/bookings/' + b.reference + '/quote', { total: Number(total.value), note: qn.input.value }), 'Quote saved.');
      });
      box.append(lt, total, qn.label, qn.input, save);

      // Confirm needs a quote and a verified deposit; say so instead of letting the API reject it.
      const ready = b.total_cents != null && b.deposit_cents != null && (b.paid_cents || 0) >= b.deposit_cents;
      box.append(el('h3', 'Confirm booking'));
      const hint = el('p', ready ? 'Quote set and deposit verified. Ready to confirm.' :
        (b.total_cents == null ? 'Set a quote first, then verify the 50% deposit.' : 'Verify the ' + money(b.deposit_cents) + ' deposit to enable confirmation.'), 'mu');
      hint.id = 'confirm-hint';
      const confirmBtn = el('button', 'Confirm booking', 'btn dark'); confirmBtn.type = 'button';
      confirmBtn.disabled = !ready;
      confirmBtn.setAttribute('aria-describedby', 'confirm-hint');
      confirmBtn.addEventListener('click', () => act(() => api('PUT', '/bookings/' + b.reference + '/status', { status: 'confirmed' }), 'Booking confirmed.'));
      box.append(hint, confirmBtn);
    }

    /* confirmed: mark completed (event passed + fully paid) */
    if (b.status === 'confirmed') {
      const eventPassed = new Date(b.event_date + 'T' + b.event_time + ':00+08:00').getTime() <= Date.now();
      const fullyPaid = b.total_cents != null && (b.paid_cents || 0) >= b.total_cents;
      const ok = eventPassed && fullyPaid;
      box.append(el('h3', 'Complete booking'));
      const h = el('p', ok ? 'The event is over and payment is complete.' :
        (!eventPassed ? 'Available after the event date (' + b.event_date + ').' : 'Verify the remaining ' + money(b.balance_cents) + ' before completing.'), 'mu');
      h.id = 'complete-hint';
      const done = el('button', 'Mark completed', 'btn dark'); done.type = 'button';
      done.disabled = !ok; done.setAttribute('aria-describedby', 'complete-hint');
      done.addEventListener('click', () => act(() => api('PUT', '/bookings/' + b.reference + '/status', { status: 'completed' }), 'Booking marked completed.'));
      box.append(h, done);
    }

    /* pending or confirmed: cancel */
    if (active) {
      box.append(el('h3', 'Cancel booking'));
      const cr = textField('c-reason', 'Cancellation reason', 'Shown to the customer');
      const cancel = el('button', 'Cancel booking', 'btn danger'); cancel.type = 'button';
      cancel.addEventListener('click', () => {
        if (!needText(cr.input.value, 'a cancellation reason')) return;
        if (!confirm('Cancel booking ' + b.reference + '?\n\nThis cannot be undone and the customer will be notified.')) return;
        act(() => api('PUT', '/bookings/' + b.reference + '/status', { status: 'cancelled', reason: cr.input.value }), 'Booking cancelled.');
      });
      box.append(cr.label, cr.input, cancel);
    }
  }

  async function init() {
    const session = await fetch('/api/staff/session', { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ authenticated: false }));
    if (!session.authenticated) { location.replace('login.html'); return; }
    $('live-user').textContent = 'Signed in as ' + session.name;
    try { setMsg('Loading bookings...'); await loadList(); setMsg(HINT); }
    catch (e) { setMsg(e.message, 'bad'); }
  }

  $('live-signout').addEventListener('click', async () => {
    await fetch('/api/staff/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    location.replace('login.html');
  });

  init();
})();