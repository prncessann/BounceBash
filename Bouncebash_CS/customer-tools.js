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
function peso(cents) { return cents === null ? 'Awaiting quote' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100); }
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
  async function show() {
    const data = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}`, 'GET', undefined, currentToken);
    const b = data.booking; content.replaceChildren();
    const details = [ ['Reference', b.reference], ['Status', b.status], ['Payment status', b.payment_status], ['Package', b.package_name], ['Style', b.selected_style || 'Not selected'],
      ['Event', `${b.event_date} ${b.event_time} (Philippine time)`], ['Venue', b.venue], ['Total', peso(b.total_cents)],
      ['Required deposit', peso(b.deposit_cents)], ['Verified paid', peso(b.paid_cents)], ['Balance', peso(b.balance_cents)] ];
    if (b.status === 'pending' && b.expires_at) details.push(['Pending hold expires', new Date(b.expires_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) + ' (Philippine time)']);
    for (const [label, value] of details) { const p = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = `${label}: `; p.append(strong, document.createTextNode(value)); content.append(p); }
    if (b.refund_note) { const p = document.createElement('p'); p.textContent = b.refund_note; content.append(p); }
    for (const p of b.payments) { const line = document.createElement('p'); line.textContent = `Payment ${p.reference}: ${peso(p.amount_cents)} · ${p.status}${p.review_note ? ` · ${p.review_note}` : ''}`; content.append(line); }
    const active = ['pending', 'confirmed'].includes(b.status) && new Date(`${b.event_date}T${b.event_time}:00+08:00`) > new Date();
    cancel.hidden = !active; move.hidden = !active; payment.hidden = !active || b.total_cents === null;
    document.getElementById('move-date').value = b.event_date; document.getElementById('move-time').value = b.event_time;
    document.getElementById('manage-actions').hidden = false;
  }
  async function run(action) {
    if (busy) return; busy = true;
    document.querySelectorAll('form button').forEach(b => { b.disabled = true; });
    try { await action(); } catch (e) { toolsStatus(e.message, true); }
    finally { busy = false; document.querySelectorAll('form button').forEach(b => { b.disabled = false; }); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => { currentRef = referenceField.value.trim(); currentToken = tokenField.value.trim(); await show(); toolsStatus('Booking loaded. Keep your private tracking code confidential.'); });
  });
  cancel.addEventListener('submit', event => {
    event.preventDefault(); if (!confirm('Cancel this booking? Any refund must be handled separately by the team.')) return;
    void run(async () => { const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/cancel`, 'POST', { reason: document.getElementById('cancel-reason').value }, currentToken); await show(); toolsStatus(d.message); });
  });
  move.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/reschedule`, 'POST', { eventDate: document.getElementById('move-date').value, eventTime: document.getElementById('move-time').value }, currentToken);
      await show(); toolsStatus(d.message);
    });
  });
  payment.addEventListener('submit', event => {
    event.preventDefault(); void run(async () => {
      const d = await customerApi(`/api/bookings/${encodeURIComponent(currentRef)}/payments`, 'POST', {
        amount: document.getElementById('payment-amount').value, method: document.getElementById('payment-method').value, reference: document.getElementById('payment-reference').value,
      }, currentToken); payment.reset(); await show(); toolsStatus(d.message);
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
