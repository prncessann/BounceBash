'use strict';
const toolsStatus = (text, bad = false) => {
  const node = document.getElementById('tools-message');
  if (node) { node.textContent = text; node.dataset.state = bad ? 'error' : 'success'; }
};
async function customerApi(url, method = 'GET', body, secret) {
  const response = await fetch(url, { method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Booking-Token': secret } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
function peso(cents) { return cents === null || cents === undefined ? 'Awaiting quotation' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100); }
const PAYMENT_LABELS = { pending: 'Awaiting verification', verified: 'Verified', rejected: 'Rejected', refunded: 'Refunded' };
const manilaTime = value => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) + ' (Philippine time)';

document.addEventListener('DOMContentLoaded', () => {
  const inquiries=document.getElementById('inquiry-list');
  if(inquiries)customerApi('/api/inquiries/mine').then(data=>{inquiries.replaceChildren(...data.inquiries.map(row=>{const p=document.createElement('p');p.textContent=`Inquiry ${row.id}: ${row.status}${row.reply ? ' · '+row.reply:''}`;return p;}));if(!data.inquiries.length)inquiries.textContent='No inquiries yet.';}).catch(e=>{inquiries.textContent=e.message;});
  const management = document.getElementById('track-booking-form');
  if (management) initBookingManagement(management);
  const recovery = document.getElementById('account-help-form');
  if (recovery) initAccountHelp(recovery);
  const changeEmail = document.getElementById('change-email-form');
  if (changeEmail) changeEmail.addEventListener('submit', async event => {
    event.preventDefault(); const button = changeEmail.querySelector('button'); button.disabled = true;
    try {
      const data = await customerApi('/api/customers/email', 'PUT', { email: document.getElementById('new-email').value, current: document.getElementById('email-password').value });
      document.getElementById('email-message').textContent = data.message; changeEmail.reset();
      if (typeof loadProfileData === 'function') await loadProfileData();
    } catch (e) { document.getElementById('email-message').textContent = e.message; }
    finally { button.disabled = false; }
  });
  const resend = document.getElementById('resend-verification');
  if (resend) resend.addEventListener('click', async () => {
    resend.disabled = true;
    try { const d = await customerApi('/api/auth/verification-request', 'POST', {}); document.getElementById('email-message').textContent = d.message; }
    catch (e) { document.getElementById('email-message').textContent = e.message; }
    finally { resend.disabled = false; }
  });
});

/* Progress steps derived from real booking data, never from guessed state. */
function progressSteps(b) {
  const labels = ['Booking submitted', 'Quoted', 'Payment submitted', 'Payment verified', 'Booking confirmed'];
  const done = [
    true,
    b.total_cents !== null,
    b.payments.some(p => p.status === 'pending' || p.status === 'verified'),
    b.paid_cents > 0,
    ['confirmed', 'completed'].includes(b.status),
  ];
  const current = done.indexOf(false);
  return labels.map((label, i) => ({ label, state: done[i] ? 'done' : i === current ? 'current' : 'todo' }));
}
function renderProgress(b, container) {
  container.replaceChildren();
  if (['cancelled', 'expired'].includes(b.status)) {
    const p = document.createElement('p'); p.className = 'bb-muted';
    p.textContent = b.status === 'cancelled' ? 'This booking was cancelled.' : 'This booking expired before payment was confirmed.';
    container.append(p); return;
  }
  const list = document.createElement('ol'); list.className = 'bb-progress';
  for (const step of progressSteps(b)) {
    const li = document.createElement('li'); li.className = `bb-step bb-step-${step.state}`;
    li.textContent = step.label;
    if (step.state === 'done') li.setAttribute('aria-label', `${step.label}, done`);
    if (step.state === 'current') li.setAttribute('aria-current', 'step');
    list.append(li);
  }
  container.append(list);
}
function renderBanner(b) {
  const pendingPayment = b.payments.some(p => p.status === 'pending');
  if (['cancelled', 'expired'].includes(b.status)) { BBNotify.banner('booking-banner', b.status === 'cancelled' ? 'This booking was cancelled and the date was released.' : 'This booking expired. The date was released.', { type: 'info' }); return; }
  if (b.status === 'confirmed') { BBNotify.banner('booking-banner', 'Your booking is confirmed. We look forward to your event!', { type: 'success' }); return; }
  if (b.total_cents === null) { BBNotify.banner('booking-banner', 'Your booking request is in. The team is preparing your quote and will update this page.', { type: 'info' }); return; }
  if (pendingPayment) { BBNotify.banner('booking-banner', 'Your payment reference was received and is awaiting verification by our team.', { type: 'info' }); return; }
  if (b.status === 'pending' && b.expires_at) {
    BBNotify.banner('booking-banner', `Your booking is pending payment. Complete your payment before ${manilaTime(b.expires_at)} to keep your date.`, {
      type: 'warning', actionLabel: 'Pay now', onAction: () => document.getElementById('payment-reference-form')?.scrollIntoView({ behavior: 'smooth' }) });
    return;
  }
  document.getElementById('booking-banner')?.replaceChildren();
}
function renderPriceSummary(b, container) {
  container.replaceChildren();
  const rows = b.total_cents === null
    ? [['Total', 'Awaiting quotation'], ['Required deposit', 'Awaiting quotation']]
    : [['Total', peso(b.total_cents)], ['Required deposit (50%)', peso(b.deposit_cents)], ['Verified paid', peso(b.paid_cents)], ['Balance', peso(b.balance_cents)]];
  for (const [label, value] of rows) {
    const p = document.createElement('p'); const strong = document.createElement('strong');
    strong.textContent = `${label}: `; p.append(strong, document.createTextNode(value)); container.append(p);
  }
  if (b.total_cents === null) {
    const note = document.createElement('p'); note.className = 'bb-muted';
    note.textContent = 'No amount is due yet. The team will confirm the price before any payment is requested.';
    container.append(note);
  }
}
function renderPaymentInstructions(b, container, amountDue) {
  container.replaceChildren();
  const config = window.BB_PAYMENT_CONFIG || {};
  const h = document.createElement('h3'); h.textContent = 'How to pay';
  container.append(h);
  const due = document.createElement('p');
  const strong = document.createElement('strong'); strong.textContent = 'Amount due: ';
  due.append(strong, document.createTextNode(peso(amountDue)));
  container.append(due);
  const hasGcash = config.gcash && (config.gcash.number || config.gcash.qrImage);
  const hasBank = config.bank && config.bank.accountNumber;
  if (!hasGcash && !hasBank) {
    const p = document.createElement('p'); p.className = 'bb-muted';
    p.textContent = 'Payment details will be shared by the team. Please confirm them with us before sending money.';
    container.append(p); return;
  }
  if (config.note) { const p = document.createElement('p'); p.textContent = config.note; container.append(p); }
  if (hasGcash) {
    const p = document.createElement('p');
    p.textContent = `GCash: ${config.gcash.name || ''} ${config.gcash.number || ''}`.trim();
    container.append(p);
    if (config.gcash.qrImage) { const img = document.createElement('img'); img.src = config.gcash.qrImage; img.alt = 'GCash QR code'; img.className = 'bb-qr'; container.append(img); }
  }
  if (hasBank) {
    const p = document.createElement('p');
    p.textContent = `Bank: ${config.bank.bankName || ''} · ${config.bank.accountName || ''} · ${config.bank.accountNumber}`;
    container.append(p);
  }
}
function renderPaymentHistory(b, container) {
  container.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Payment history';
  container.append(h);
  if (!b.payments.length) { const p = document.createElement('p'); p.className = 'bb-muted'; p.textContent = 'No payments recorded yet.'; container.append(p); return; }
  const list = document.createElement('ul'); list.className = 'bb-payments';
  for (const p of b.payments) {
    const li = document.createElement('li');
    li.textContent = `${peso(p.amount_cents)} · ${p.method || 'Payment'} · Ref ${p.reference} · ${PAYMENT_LABELS[p.status] || p.status}${p.review_note ? ` · ${p.review_note}` : ''}`;
    list.append(li);
  }
  container.append(list);
}

function renderReceipt(b, container) {
  container.replaceChildren();
  const verified = b.payments.filter(p => p.status === 'verified');
  if (!verified.length) { container.hidden = true; return; }
  container.hidden = false;
  const h = document.createElement('h3'); h.textContent = 'Receipt';
  const note = document.createElement('p'); note.className = 'bb-muted';
  note.textContent = 'Summary of verified payments. This is a record from our system, not an official receipt.';
  container.append(h, note);
  const rows = [['Reference', b.reference], ['Name', b.name], ['Event', `${b.event_date} ${b.event_time} (Philippine time)`], ['Package', b.package_name], ['Total', peso(b.total_cents)], ['Verified paid', peso(b.paid_cents)], ['Balance', peso(b.balance_cents)]];
  for (const [label, value] of rows) {
    const p = document.createElement('p'); const strong = document.createElement('strong');
    strong.textContent = `${label}: `; p.append(strong, document.createTextNode(value)); container.append(p);
  }
  const list = document.createElement('ul'); list.className = 'bb-payments';
  for (const p of verified) {
    const li = document.createElement('li');
    li.textContent = `${peso(p.amount_cents)} · ${p.method || 'Payment'} · Ref ${p.reference}`;
    list.append(li);
  }
  container.append(list);
  const print = document.createElement('button'); print.type = 'button'; print.className = 'btn btn-outline no-print'; print.textContent = 'Print receipt';
  print.addEventListener('click', () => window.print());
  container.append(print);
}

function initBookingManagement(form) {
  const referenceField = document.getElementById('tracking-reference'); const tokenField = document.getElementById('tracking-token');
  const params = new URLSearchParams(location.hash.slice(1));
  referenceField.value = params.get('reference') || new URLSearchParams(location.search).get('reference') || '';
  tokenField.value = params.get('token') || '';
  // Remove private bearer credentials from the visible URL and history as soon as read.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  let currentRef = ''; let currentToken = ''; let busy = false;
  const content = document.getElementById('booking-details');
  const cancel = document.getElementById('cancel-booking-form');
  const move = document.getElementById('reschedule-booking-form');
  const payment = document.getElementById('payment-reference-form');
  const proofInput = document.getElementById('payment-proof');
  const proofPreview = document.getElementById('payment-proof-preview');
  const proofImg = proofPreview ? proofPreview.querySelector('img') : null;
  const proofRemove = document.getElementById('payment-proof-remove');
  function clearProof() {
    if (proofImg && proofImg.src && proofImg.src.startsWith('blob:')) URL.revokeObjectURL(proofImg.src);
    if (proofImg) proofImg.removeAttribute('src');
    if (proofPreview) proofPreview.hidden = true;
    if (proofInput) proofInput.value = '';
  }
  if (proofInput) proofInput.addEventListener('change', () => {
    const file = proofInput.files[0];
    if (!file) { clearProof(); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { BBNotify.error('Please choose a PNG, JPG, or WebP image.'); clearProof(); return; }
    if (file.size > 5 * 1024 * 1024) { BBNotify.error('That image is too large. Please use a file under 5 MB.'); clearProof(); return; }
    if (proofImg) proofImg.src = URL.createObjectURL(file);
    if (proofPreview) proofPreview.hidden = false;
  });
  if (proofRemove) proofRemove.addEventListener('click', clearProof);
  if (payment) payment.addEventListener('reset', () => setTimeout(clearProof, 0));
  const progress = document.getElementById('booking-progress');
  const summary = document.getElementById('booking-price-summary');
  const instructions = document.getElementById('payment-instructions');
  const paymentHistoryEl = document.getElementById('payment-history');
  const receiptEl = document.getElementById('booking-receipt');
  async function show() {
    const data = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}`, 'GET', undefined, currentToken);
    const b = data.booking; content.replaceChildren();
    renderBanner(b);
    if (progress) renderProgress(b, progress);
    if (summary) renderPriceSummary(b, summary);
    const details = [ ['Reference', b.reference], ['Status', b.status], ['Payment status', b.payment_status], ['Package', b.package_name], ['Style', b.selected_style || 'Not selected'],
      ['Event', `${b.event_date} ${b.event_time} (Philippine time)`], ['Venue', b.venue] ];
    if (b.status === 'pending' && b.expires_at) details.push(['Pending hold expires', manilaTime(b.expires_at)]);
    for (const [label, value] of details) { const p = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = `${label}: `; p.append(strong, document.createTextNode(value)); content.append(p); }
    if (b.refund_note) { const p = document.createElement('p'); p.textContent = b.refund_note; content.append(p); }
    if (paymentHistoryEl) renderPaymentHistory(b, paymentHistoryEl);
    if (receiptEl) renderReceipt(b, receiptEl);
    const active = ['pending', 'confirmed'].includes(b.status) && new Date(`${b.event_date}T${b.event_time}:00+08:00`) > new Date();
    const amountDue = b.total_cents === null ? null : (b.paid_cents < (b.deposit_cents || 0) ? (b.deposit_cents - b.paid_cents) : b.balance_cents);
    if (instructions) { if (active && b.total_cents !== null) { renderPaymentInstructions(b, instructions, amountDue); instructions.hidden = false; } else instructions.hidden = true; }
    cancel.hidden = !active; move.hidden = !active; payment.hidden = !active || b.total_cents === null;
    document.getElementById('move-date').value = b.event_date; document.getElementById('move-time').value = b.event_time;
    document.getElementById('manage-actions').hidden = false;
  }
  async function run(action) {
    if (busy) return; busy = true;
    document.querySelectorAll('form button').forEach(b => { b.disabled = true; });
    try { await action(); } catch (e) { toolsStatus(e.message, true); BBNotify.error(e.message); }
    finally { busy = false; document.querySelectorAll('form button').forEach(b => { b.disabled = false; }); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => { currentRef = referenceField.value.trim(); currentToken = tokenField.value.trim(); await show(); toolsStatus('Booking loaded. Keep your private tracking code confidential.'); });
  });
  cancel.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const ok = await BBNotify.confirm({ title: 'Cancel booking?', message: 'Are you sure you want to cancel this booking? This releases the date and cannot be undone. Any refund is handled separately by the team.', confirmLabel: 'Cancel booking', cancelLabel: 'Keep booking', danger: true });
    if (!ok) return;
    void run(async () => {
      const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/cancel`, 'POST', { reason: document.getElementById('cancel-reason').value }, currentToken);
      await show(); toolsStatus(d.message); BBNotify.success('Booking cancelled.');
    });
  });
  move.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/reschedule`, 'POST', { eventDate: document.getElementById('move-date').value, eventTime: document.getElementById('move-time').value }, currentToken);
      await show(); toolsStatus(d.message); BBNotify.warning('Schedule change requested. Your booking needs confirmation again.', { duration: 7000 });
    });
  });
  payment.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/payments`, 'POST', {
        amount: document.getElementById('payment-amount').value, method: document.getElementById('payment-method').value, reference: document.getElementById('payment-reference').value,
      }, currentToken); payment.reset(); await show(); toolsStatus(d.message); BBNotify.warning('Your payment is awaiting verification by our team.', { duration: 7000 });
    });
  });
  if (referenceField.value) form.requestSubmit();
}
function initAccountHelp(form) {
  const params = new URLSearchParams(location.hash.slice(1));
  const kind = ['reset', 'verify', 'unsubscribe'].find(k => params.has(k)); const secret = kind ? params.get(kind) : null;
  if (location.hash) history.replaceState(null, '', location.pathname);
  const passwordField = document.getElementById('help-password'); const emailField = document.getElementById('help-email');
  const button = form.querySelector('button');
  document.getElementById('help-title').textContent = kind === 'reset' ? 'Reset password' : kind === 'verify' ? 'Verify email' : kind === 'unsubscribe' ? 'Unsubscribe' : 'Forgot password';
  document.getElementById('help-email-field').hidden = !!kind; emailField.required = !kind;
  document.getElementById('help-password-field').hidden = kind !== 'reset'; passwordField.required = kind === 'reset';
  button.textContent = kind === 'reset' ? 'Reset password' : kind === 'verify' ? 'Verify email' : kind === 'unsubscribe' ? 'Unsubscribe' : 'Request reset instructions';
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true;
    try {
      let route = '/api/auth/forgot-password'; let body = { email: emailField.value };
      if (kind === 'reset') { route = '/api/auth/reset-password'; body = { token: secret, password: passwordField.value }; }
      if (kind === 'verify') { route = '/api/auth/verify-email'; body = { token: secret }; }
      if (kind === 'unsubscribe') { route = '/api/newsletter/unsubscribe'; body = { token: secret }; }
      const data = await customerApi(route, 'POST', body); toolsStatus(data.message); form.reset();
    } catch (e) { toolsStatus(e.message, true); }
    finally { button.disabled = false; }
  });
}