'use strict';
const toolsStatus = (text, bad = false) => {
  const node = document.getElementById('tools-message');
  if (node) { node.textContent = text; node.dataset.state = bad ? 'error' : 'success'; }
};
async function customerApi(url, method = 'GET', body) {
 let response;
 try {
  response=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 } catch {
  const recovery = method === 'GET' ? 'Check your connection and refresh.' : 'Check your connection and refresh to see whether your change was saved before retrying.';
  throw new Error('The connection was interrupted. ' + recovery);
 }
 const data=await response.json().catch(()=>({}));if(!response.ok){let message=data.error||'Request failed. Please try again.';if(response.status===429){const seconds=response.headers?.get?.('retry-after');message+=' '+(seconds?'Try again in '+seconds+' seconds.':'Please wait before retrying.');}if(response.status===401)message+=' Sign in again using the same browser address.';throw new Error(message);}return data;
}
function peso(cents) { return cents === null || cents === undefined ? 'Awaiting quotation' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100); }
const PAYMENT_LABELS = { pending: 'Awaiting verification', verified: 'Verified', rejected: 'Rejected', refunded: 'Refunded' };

async function loadCustomerInquiries() {
  const inquiries=document.getElementById('inquiry-list');
  if(!inquiries)return;
  try {
    const data=await customerApi('/api/inquiries/mine');
    inquiries.replaceChildren(...data.inquiries.map(row=>{const p=document.createElement('p');p.textContent=`Inquiry ${row.id}: ${row.status}${row.reply ? ' · '+row.reply:''}`;return p;}));
    if(!data.inquiries.length)inquiries.textContent='No inquiries yet.';
  } catch (error) { inquiries.textContent=error.message; }
}

document.addEventListener('DOMContentLoaded', () => {
  const management = document.getElementById('manage-actions');
  if (management) {
    customerApi('/api/business-settings').then(({settings}) => {
      if (settings?.payment) window.BB_PAYMENT_CONFIG = {...window.BB_PAYMENT_CONFIG,...settings.payment};
    }).catch(error => toolsStatus(error.message,true)).finally(() => initBookingManagement(management));
  }
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

function configuredPaymentMethods(config) {
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const {gcash, bank, cash} = config;
  const methods = [];
  if (gcash && hasText(gcash.name) && (hasText(gcash.number) || hasText(gcash.qrImage))) methods.push('GCash');
  if (bank?.businessApproved === true && [bank.bankName, bank.accountName, bank.accountNumber].every(hasText)) methods.push('Bank transfer');
  if (cash?.businessApproved === true && hasText(cash.instructions)) methods.push('Cash');
  return methods;
}

function renderPaymentInstructions(container, amountDue, methods) {
  container.replaceChildren();
  const config = window.BB_PAYMENT_CONFIG || {};
  const h = document.createElement('h3'); h.textContent = 'How to pay';
  container.append(h);
  const due = document.createElement('p');
  const strong = document.createElement('strong'); strong.textContent = 'Amount due: ';
  due.append(strong, document.createTextNode(peso(amountDue)));
  container.append(due);
  if (!methods.length) {
    const p = document.createElement('p'); p.className = 'bb-muted';
    p.textContent = 'Payment details will be shared by the team. Please confirm them with us before sending money.';
    container.append(p); return;
  }
  if (config.note) { const p = document.createElement('p'); p.textContent = config.note; container.append(p); }
  if (methods.includes('GCash')) {
    container.append(document.createTextNode('Confirm these receiving details with the team before transferring.'));
    const p = document.createElement('p');
    p.textContent = `GCash: ${config.gcash.name || ''} ${config.gcash.number || ''}`.trim();
    container.append(p);
    if (config.gcash.qrImage) { const img = document.createElement('img'); img.src = config.gcash.qrImage; img.alt = 'GCash QR code'; img.className = 'bb-qr'; container.append(img); }
  }
  if (methods.includes('Bank transfer')) {
    const p = document.createElement('p');
    p.textContent = `Bank: ${config.bank.bankName || ''} · ${config.bank.accountName || ''} · ${config.bank.accountNumber}`;
    container.append(p);
  }
  if (methods.includes('Cash')) {
    const p = document.createElement('p');
    p.textContent = config.cash.instructions;
    container.append(p);
  }
}
function renderPaymentHistory(b, container, downloadProof) {
  container.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Payment history';
  container.append(h);
  if (!b.payments.length) { const p = document.createElement('p'); p.className = 'bb-muted'; p.textContent = 'No payments recorded yet.'; container.append(p); return; }
  const list = document.createElement('ul'); list.className = 'bb-payments';
  for (const p of b.payments) {
    const li = document.createElement('li');
    li.textContent = `${peso(p.amount_cents)} · ${p.method || 'Payment'} · Ref ${p.reference} · ${PAYMENT_LABELS[p.status] || p.status}${p.review_note ? ` · ${p.review_note}` : ''}`;
    if (p.proof_id && downloadProof) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline no-print';
      button.textContent = 'Download proof';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await downloadProof(b.reference, p.proof_id); }
        catch (error) { toolsStatus(error.message, true); }
        finally { button.disabled = false; }
      });
      li.append(' ', button);
    }
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
  const print = document.createElement('button'); print.type = 'button'; print.className = 'btn btn-receipt-print no-print'; print.textContent = 'Print receipt';
  print.addEventListener('click', () => window.print());
  container.append(print);
}

function renderBookingSummary(b, target, depositVerified) {
  const status = b.status.charAt(0).toUpperCase() + b.status.slice(1);
  const selection = Array.isArray(b.selection) && b.selection.length ? b.selection : b.add_ons || [];
  const extras = selection.map(item => {
    if (typeof item === 'string') return item;
    const details = [item.name, item.quantity > 1 ? '× ' + item.quantity : '', item.color || item.colors?.join(', '), item.otherEvent || item.eventType].filter(Boolean);
    return details.join(' · ');
  });
  const schedule = b.event_date + ' ' + b.event_time + ' (Philippine time)';
  target.replaceChildren(Object.assign(document.createElement('h2'), {textContent:'Booking summary'}));
  const rows = [
    ['Reference', b.reference], ['Rental', [b.quote?.model_name || b.package_name, b.quote?.variant || b.selected_style].filter(Boolean).join(' · ')],
    ['Event schedule', schedule], ['Address', b.venue], ['Add-ons', extras.join('; ') || 'None'], ['Status', status],
    ['Total', peso(b.total_cents)], ['Verified paid', peso(b.paid_cents)], ['Remaining balance', peso(b.balance_cents)]
  ];
  if (!depositVerified) {
    if (b.total_cents == null && b.subtotal_cents != null) rows.push(['Known subtotal', peso(b.subtotal_cents)]);
    rows.push(['Required deposit', peso(b.deposit_cents)]);
  }
  const list = document.createElement('dl');
  list.className = 'booking-summary';
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    list.append(term, detail);
  }
  target.append(list);
  let note = '';
  if (['cancelled', 'expired'].includes(b.status)) {
    note = b.refund_note || (b.payment_requires_attention ? 'A payment remains on record. Contact the team for review.' : '');
  } else if (b.status === 'pending' && depositVerified) {
    note = 'Downpayment verified — awaiting booking confirmation.';
  } else if (b.total_cents == null || b.pricing_state === 'pending_quote') {
    note = 'The team is preparing your quotation. Payment will be available after the final quotation.';
  }
  if (note) target.append(Object.assign(document.createElement('p'), {textContent:note}));
}

function initBookingManagement(actions) {
  if (actions.dataset.initialized) return;
  actions.dataset.initialized = 'true';
  const get = id => document.getElementById(id);
  const ref = new URLSearchParams(location.search).get('reference');
  const endpoint = '/api/bookings/' + encodeURIComponent(ref);
  const payment = get('payment-reference-form');
  const paymentMethod = get('payment-method');
  const methods = configuredPaymentMethods(window.BB_PAYMENT_CONFIG || {});
  paymentMethod.replaceChildren(...methods.map(method => new Option(method,method)));
  const dialog = get('reschedule-dialog');
  const open = get('open-reschedule');
  const keep = get('keep-schedule');
  const move = get('reschedule-booking-form');
  const day = get('move-date');
  const time = get('move-time');
  const refresh = get('refresh-booking');
  let current, busy = false;

  function feedback(id, text, bad = false) {
    const node = get(id);
    node.textContent = text;
    node.dataset.state = bad ? 'error' : 'success';
  }
  function validate(form, id) {
    const first = [...form.querySelectorAll('input,select')].find(field => !field.checkValidity());
    if (!first) return true;
    first.setAttribute('aria-invalid','true');
    feedback(id,'Please complete the highlighted fields with valid values.',true);
    first.focus();
    return false;
  }
  async function show() {
    const {booking:b} = await customerApi(endpoint);
    current = b;
    const verified = b.payments.filter(p => p.status === 'verified').reduce((sum,p) => sum + p.amount_cents,0);
    const final = b.pricing_state === 'final' && Number.isSafeInteger(b.total_cents) && b.total_cents > 0;
    const depositVerified = final && Number.isSafeInteger(b.deposit_cents) && b.deposit_cents > 0 && verified >= b.deposit_cents;
    const now = new Date(b.server_time);
    const future = new Date(b.event_date + 'T' + b.event_time + ':00+08:00') > now;
    const active = ['pending','confirmed'].includes(b.status) && future;
    const pending = b.payments.filter(p => p.status === 'pending').reduce((sum,p) => sum + p.amount_cents,0);
    const unreported = Math.max(0,b.total_cents - verified - pending);
    const canReport = active && final && !depositVerified && unreported > 0;
    const details = get('booking-details');
    renderBookingSummary(b,details,depositVerified);
    const timer = details.appendChild(document.createElement('div'));
    window.BBHoldCountdown?.(timer,b,refreshBooking);
    open.hidden = !active;
    payment.hidden = !canReport || !methods.length;
    const instructions = get('payment-instructions');
    instructions.hidden = !canReport;
    instructions.replaceChildren();
    if (canReport) {
      const due = Math.min(unreported,Math.max(0,b.deposit_cents - verified - pending) || unreported);
      renderPaymentInstructions(instructions,due,methods);
      const amount = get('payment-amount');
      amount.max = (unreported/100).toFixed(2);
      if (!amount.value) amount.value = (due/100).toFixed(2);
    }
    feedback('payment-message','');
    get('payment-message').hidden = depositVerified;
    const history = get('payment-history');
    history.hidden = depositVerified && ['pending','confirmed','completed'].includes(b.status);
    if (!history.hidden) renderPaymentHistory(b,history);
    get('payment-pending-note').textContent = !depositVerified && pending > 0
      ? peso(pending) + ' is awaiting verification. Do not submit the same transfer again.' : '';
    renderReceipt(b,get('booking-receipt'));
    actions.hidden = false;
    toolsStatus('');
  }
  async function refreshBooking() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    try { await show(); }
    catch (error) { toolsStatus(error.message,true); }
    finally { busy = false; refresh.disabled = false; }
  }
  async function run(form, id, action) {
    if (busy) return;
    busy = true;
    const button = form.querySelector('[type=submit]');
    const label = button.textContent;
    button.textContent = 'Please wait…';
    button.disabled = keep.disabled = refresh.disabled = true;
    form.setAttribute('aria-busy','true');
    feedback(id,'Submitting…');
    try {
      const result = await action();
      if (!result) return;
      try { await show(); }
      catch { toolsStatus('Your change was saved. Refresh to see the latest booking details.',true); }
      if (form === move) {
        dialog.close();
        feedback('reschedule-result',result.message);
      } else feedback(id,result.message);
      window.BBNotify?.success(result.message);
    } catch (error) {
      feedback(id,error.message,true);
      window.BBNotify?.error(error.message);
    } finally {
      busy = false;
      button.disabled = keep.disabled = refresh.disabled = false;
      button.textContent = label;
      form.removeAttribute('aria-busy');
    }
  }
  refresh.addEventListener('click',refreshBooking);
  open.addEventListener('click',() => {
    if (busy || dialog.open) return;
    get('current-schedule').textContent = 'Current schedule: ' + current.event_date + ' ' + current.event_time + ' (Philippine time)';
    day.min = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    day.max = '2100-12-31';
    day.value = current.event_date;
    time.value = current.event_time;
    for (const field of [day,time]) field.removeAttribute('aria-invalid');
    feedback('reschedule-message','');
    feedback('reschedule-result','');
    dialog.showModal();
    day.focus();
  });
  keep.addEventListener('click',() => dialog.close());
  dialog.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close',() => { if (!open.hidden) open.focus(); else refresh.focus(); });

  move.addEventListener('submit',event => {
    event.preventDefault();
    if (busy || !dialog.open) return;
    for (const field of [day,time]) field.removeAttribute('aria-invalid');
    const id = 'reschedule-message';
    if (!validate(move,id)) return;
    const {value:eventDate} = day;
    const {value:eventTime} = time;
    if (eventDate === current.event_date && eventTime === current.event_time) {
      feedback(id,'Choose a different date or time before requesting a reschedule.',true);
      day.setAttribute('aria-invalid','true');
      day.focus();
      return;
    }
    if (new Date(eventDate + 'T' + eventTime + ':00+08:00') <= new Date()) {
      feedback(id,'Choose a future schedule in Philippine time.',true);
      time.setAttribute('aria-invalid','true');
      time.focus();
      return;
    }
    void run(move,id,async () => {
      if (eventDate !== current.event_date) {
        feedback(id,'Checking date availability…');
        const {available} = await customerApi('/api/availability?date=' + encodeURIComponent(eventDate));
        if (!available) {
          feedback(id,'This date is unavailable. Choose a different date.',true);
          day.setAttribute('aria-invalid','true');
          day.focus();
          return;
        }
      }
      feedback(id,'Submitting…');
      return customerApi(endpoint + '/reschedule','POST',{eventDate,eventTime});
    });
  });

  payment.noValidate = true;
  payment.addEventListener('submit',event => {
    event.preventDefault();
    if (busy || payment.hidden || !methods.includes(paymentMethod.value) || !validate(payment,'payment-message')) return;
    void run(payment,'payment-message',async () => {
      const result = await customerApi(endpoint + '/payments','POST',{
        amount:get('payment-amount').value,method:paymentMethod.value,reference:get('payment-reference').value.trim()
      });
      payment.reset();
      return result;
    });
  });
  void (async () => {
    try {
      const session = await customerApi('/api/auth/session');
      if (!session.authenticated) {
        location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
        return;
      }
      if (!ref) { toolsStatus('Choose a booking from your profile.'); return; }
      await refreshBooking();
    } catch (error) { toolsStatus(error.message,true); }
  })();
}
function initAccountHelp(form) {
  const passwordField = document.getElementById('help-password'); const emailField = document.getElementById('help-email');
  const button = form.querySelector('button');
  let kind, secret;
  function showAction() {
    const params = new URLSearchParams(location.hash.slice(1));
    kind = ['reset', 'verify', 'unsubscribe'].find(key => params.has(key));
    secret = kind ? params.get(kind) : null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    document.getElementById('help-title').textContent = kind === 'reset' ? 'Reset password' : kind === 'verify' ? 'Verify email' : kind === 'unsubscribe' ? 'Unsubscribe' : 'Forgot password';
    document.getElementById('help-email-field').hidden = !!kind; emailField.required = !kind;
    document.getElementById('help-password-field').hidden = kind !== 'reset'; passwordField.required = kind === 'reset';
    button.textContent = kind === 'reset' ? 'Reset password' : kind === 'verify' ? 'Verify email' : kind === 'unsubscribe' ? 'Unsubscribe' : 'Request reset instructions';
    toolsStatus('');
  }
  showAction();
  window.addEventListener('hashchange', showAction);
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
// A compact profile action opens a focused cancellation dialog, including for paid active bookings.
window.BBCancelBooking = booking => new Promise(resolve => {
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='booking-cancel-dialog';
 dialog.setAttribute('aria-labelledby','cancel-dialog-title');
 dialog.innerHTML='<form method="dialog"><h2 id="cancel-dialog-title">Cancel booking?</h2><p>This releases your date. Recorded payments remain attached; any refund is handled separately by the team.</p><div class="field"><label for="profile-cancel-reason">Reason for cancellation</label><textarea id="profile-cancel-reason" minlength="2" maxlength="1000" required rows="3"></textarea></div><p class="field-error" role="status"></p><div class="button-row"><button type="button" class="btn btn-outline" data-keep>Keep booking</button><button type="submit" class="btn bb-btn-danger">Cancel booking</button></div></form>';
 document.body.append(dialog);const form=dialog.querySelector('form'),reason=dialog.querySelector('textarea'),submit=form.querySelector('[type=submit]'),keep=form.querySelector('[data-keep]');let busy=false,success=false;
 dialog.addEventListener('close',()=>{dialog.remove();previous?.focus();resolve(success);},{once:true});
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});keep.addEventListener('click',()=>dialog.close());
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(reason.value.trim().length<2){reason.setAttribute('aria-invalid','true');dialog.querySelector('[role=status]').textContent='Please enter a reason of at least two characters.';reason.focus();return;}busy=true;submit.disabled=true;keep.disabled=true;
  try{await customerApi('/api/bookings/'+encodeURIComponent(booking.reference)+'/cancel','POST',{reason:reason.value.trim()});success=true;dialog.close();window.BBNotify?.success('Booking cancelled. Contact the team about any recorded payments.');}
  catch(error){dialog.querySelector('[role=status]').textContent=error.message;}
  finally{busy=false;submit.disabled=false;keep.disabled=false;}
 });dialog.showModal();reason.focus();
});
