const api = {
  async request(url, options = {}) {
    const response = await fetch(`/api${url}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (response.status === 204) return null;
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
    return body;
  }
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'success';
}

function localDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initializeBooking() {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const message = document.querySelector('#booking-message');
  const packageSelect = document.querySelector('#package');
  const modelSelect = document.querySelector('#model');
  const addonList = document.querySelector('#booking-addons');
  const dateInput = document.querySelector('#event-date');
  const calendar = document.querySelector('.booking-side .calendar tbody');
  const monthLabel = document.querySelector('.booking-side .calendar-header strong');
  let catalog;
  let displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let availability = [];
  dateInput.min = localDate(new Date());

  async function loadAvailability() {
    if (!catalog || !modelSelect.value) {
      calendar.innerHTML = '<tr><td colspan="7" class="muted">Choose a style to check availability.</td></tr>';
      return;
    }
    const month = `${displayedMonth.getFullYear()}-${String(displayedMonth.getMonth() + 1).padStart(2, '0')}`;
    try {
      const result = await api.request(`/availability?month=${month}`);
      availability = result.bookings.filter(booking => booking.modelId === modelSelect.value);
      renderBookingCalendar();
    } catch (error) {
      calendar.innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  function renderBookingCalendar() {
    const year = displayedMonth.getFullYear();
    const monthIndex = displayedMonth.getMonth();
    monthLabel.textContent = displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const blocked = new Map(availability.map(item => [item.eventDate, item.status]));
    let html = '<tr>';
    for (let blank = 0; blank < firstWeekday; blank++) html += '<td class="empty"></td>';
    for (let day = 1; day <= days; day++) {
      if ((firstWeekday + day - 1) % 7 === 0 && day > 1) html += '</tr><tr>';
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = blocked.get(date);
      const past = date < localDate(new Date());
      const state = status ? (status === 'confirmed' ? 'booked' : 'pending') : past ? 'booked' : 'available';
      const selected = dateInput.value === date ? ' selected' : '';
      html += `<td class="day ${state}${selected}" ${state === 'available' ? `data-date="${date}" role="button" tabindex="0"` : ''}><span class="num">${day}</span></td>`;
    }
    const trailingCells = (7 - ((firstWeekday + days) % 7)) % 7;
    for (let blank = 0; blank < trailingCells; blank++) html += '<td class="empty"></td>';
    html += '</tr>';
    calendar.innerHTML = html;
    calendar.querySelectorAll('[data-date]').forEach(cell => {
      const selectDate = () => { dateInput.value = cell.dataset.date; renderBookingCalendar(); };
      cell.addEventListener('click', selectDate);
      cell.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') selectDate(); });
    });
  }

  document.querySelectorAll('.booking-side .calendar-header button').forEach((button, index) => {
    button.addEventListener('click', () => {
      displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + (index === 0 ? -1 : 1), 1);
      loadAvailability();
    });
  });

  Promise.all([api.request('/catalog'), api.request('/auth/me')]).then(([data, auth]) => {
    catalog = data;
    data.packages.forEach(item => packageSelect.add(new Option(`${item.name} - PHP ${(item.priceCents / 100).toLocaleString()}`, item.id)));
    data.models.forEach(item => modelSelect.add(new Option(`${item.name} (up to ${item.capacity} children)`, item.id)));
    addonList.innerHTML = data.addons.map(item => `<label><input type="checkbox" name="addonIds" value="${escapeHtml(item.id)}"> ${escapeHtml(item.name)}${item.priceCents ? ` - PHP ${(item.priceCents / 100).toLocaleString()}` : ''}</label>`).join('');
    if (auth.customer) {
      document.querySelector('#name').value = auth.customer.name;
      document.querySelector('#contact').value = auth.customer.contact;
      if (!auth.customer.emailVerified) setMessage(message, 'Verify your email address in My Account before submitting a booking request.', true);
    } else {
      setMessage(message, 'Log in or create an account before submitting a booking.');
    }
    const query = new URLSearchParams(location.search);
    if (query.has('package')) packageSelect.value = query.get('package');
    if (query.has('model')) modelSelect.value = query.get('model');
    if (query.has('date')) dateInput.value = query.get('date');
    loadAvailability();
  }).catch(error => setMessage(message, error.message, true));

  modelSelect.addEventListener('change', loadAvailability);
  dateInput.addEventListener('change', () => {
    if (dateInput.value) {
      const [year, month] = dateInput.value.split('-').map(Number);
      displayedMonth = new Date(year, month - 1, 1);
      loadAvailability();
    } else {
      renderBookingCalendar();
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const auth = await api.request('/auth/me').catch(() => ({ customer: null }));
    if (!auth.customer) {
      setMessage(message, 'Please log in or create an account to submit your booking.', true);
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage(message, 'Submitting your request...');
    try {
      const key = crypto.randomUUID();
      const result = await api.request('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          packageId: packageSelect.value,
          modelId: modelSelect.value,
          eventDate: dateInput.value,
          eventTime: document.querySelector('#event-time').value,
          venue: document.querySelector('#venue').value,
          childrenCount: Number(document.querySelector('#children').value),
          notes: document.querySelector('#notes').value,
          addonIds: [...form.querySelectorAll('[name="addonIds"]:checked')].map(input => input.value)
        })
      });
      setMessage(message, `Request #${result.booking.id} received. Sign in to My Account to view its status.`);
      await loadAvailability();
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
}

function initializeCatalogCards() {
  const packageCards = document.querySelectorAll('[data-package-id]');
  const addonCards = document.querySelectorAll('[data-addon-id]');
  if (!packageCards.length && !addonCards.length) return;
  api.request('/catalog').then(catalog => {
    packageCards.forEach(card => {
      const item = catalog.packages.find(entry => entry.id === card.dataset.packageId);
      const price = card.querySelector('.price');
      if (item && price) price.textContent = `PHP ${(item.priceCents / 100).toLocaleString()}`;
    });
    addonCards.forEach(card => {
      const item = catalog.addons.find(entry => entry.id === card.dataset.addonId);
      const price = card.querySelector('.price');
      if (item && price) price.textContent = `from PHP ${(item.priceCents / 100).toLocaleString()}`;
    });
  });
}

function initializeGallery() {
  const items = [...document.querySelectorAll('#gallery-grid a')];
  if (!items.length) return;
  const pageSize = 9;
  let filter = 'all';
  let shown = pageSize;
  const button = document.querySelector('#load-more');
  const empty = document.querySelector('#gallery-empty');

  function render() {
    let matches = 0;
    items.forEach(item => {
      const categories = item.getAttribute('data-cat').split(' ');
      const matchesFilter = filter === 'all' || categories.includes(filter);
      item.hidden = !matchesFilter || matches >= shown;
      if (matchesFilter) matches++;
    });
    button.parentNode.hidden = matches <= shown;
    empty.hidden = matches > 0;
  }

  document.querySelectorAll('[data-filter]').forEach(filterButton => {
    filterButton.addEventListener('click', () => {
      filter = filterButton.getAttribute('data-filter');
      shown = pageSize;
      document.querySelectorAll('[data-filter]').forEach(item => {
        item.className = `btn ${item === filterButton ? 'btn-dark' : 'btn-outline'}`;
      });
      render();
    });
  });
  button.addEventListener('click', () => { shown += pageSize; render(); });
  render();
}

function initializeCustomerForms() {
  const newsletter = document.querySelector('#newsletter-form');
  if (newsletter) {
    newsletter.addEventListener('submit', async event => {
      event.preventDefault();
      if (!newsletter.reportValidity()) return;
      const button = newsletter.querySelector('[type="submit"]');
      button.disabled = true;
      const message = document.querySelector('#newsletter-message');
      setMessage(message, 'Submitting...');
      try {
        const values = Object.fromEntries(new FormData(newsletter));
        values.consent = newsletter.querySelector('[name="consent"]').checked;
        const result = await api.request('/newsletter', { method: 'POST', body: JSON.stringify(values) });
        setMessage(message, result.message);
        newsletter.reset();
      } catch (error) {
        setMessage(message, error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  const newsletterUnsubscribe = document.querySelector('#newsletter-unsubscribe-form');
  if (newsletterUnsubscribe) {
    newsletterUnsubscribe.addEventListener('submit', async event => {
      event.preventDefault();
      if (!newsletterUnsubscribe.reportValidity()) return;
      const button = newsletterUnsubscribe.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await api.request('/newsletter/unsubscribe/request', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(newsletterUnsubscribe)))
        });
        setMessage(document.querySelector('#newsletter-message'), result.message);
        newsletterUnsubscribe.reset();
      } catch (error) {
        setMessage(document.querySelector('#newsletter-message'), error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  const unsubscribeConfirmation = document.querySelector('#newsletter-unsubscribe-confirm-form');
  if (unsubscribeConfirmation) {
    const token = new URLSearchParams(location.search).get('token');
    unsubscribeConfirmation.addEventListener('submit', async event => {
      event.preventDefault();
      const button = unsubscribeConfirmation.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await api.request('/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) });
        setMessage(document.querySelector('#unsubscribe-message'), result.message);
        history.replaceState(null, '', location.pathname);
      } catch (error) {
        setMessage(document.querySelector('#unsubscribe-message'), error.message, true);
        button.disabled = false;
      }
    });
    if (!token) {
      unsubscribeConfirmation.querySelector('[type="submit"]').disabled = true;
      setMessage(document.querySelector('#unsubscribe-message'), 'The unsubscribe link is missing or invalid.', true);
    }
  }

  const feedback = document.querySelector('#feedback-form');
  if (!feedback) return;
  const message = document.querySelector('#feedback-message');
  feedback.querySelector('button[type="button"]')?.addEventListener('click', () => {
    setMessage(message, 'Photo attachments are not enabled. You can submit your written feedback below.');
  });
  feedback.addEventListener('submit', async event => {
    event.preventDefault();
    if (!feedback.reportValidity()) return;
    const button = feedback.querySelector('[type="submit"]');
    button.disabled = true;
    setMessage(message, 'Submitting feedback...');
    try {
      const values = Object.fromEntries(new FormData(feedback));
      const result = await api.request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ ...values, rating: Number(values.rating), publishConsent: values.publishConsent === 'true' })
      });
      setMessage(message, result.message);
      feedback.reset();
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

function initializeAccount() {
  const authPanel = document.querySelector('#auth-panel');
  if (!authPanel) return;
  const message = document.querySelector('#account-message');
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const dashboard = document.querySelector('#account-dashboard');
  const resetRequestForm = document.querySelector('#password-reset-request-form');
  const resetConfirmForm = document.querySelector('#password-reset-confirm-form');
  const query = new URLSearchParams(location.search);
  const flow = query.get('flow');
  const token = query.get('token');

  if (flow === 'reset' && token) {
    loginForm.hidden = true;
    registerForm.hidden = true;
    resetRequestForm.hidden = true;
    resetConfirmForm.hidden = false;
  }

  async function completeEmailFlow() {
    if (!token || !['verify', 'email-change'].includes(flow)) return;
    try {
      const endpoint = flow === 'verify' ? '/auth/email/verification/confirm' : '/customer/email-change/confirm';
      const result = await api.request(endpoint, { method: 'POST', body: JSON.stringify({ token }) });
      setMessage(message, result.message);
      history.replaceState(null, '', location.pathname);
      await refreshAccount();
    } catch (error) {
      setMessage(message, error.message, true);
    }
  }

  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
    const registering = button.dataset.authMode === 'register';
    loginForm.hidden = registering;
    registerForm.hidden = !registering;
    document.querySelectorAll('[data-auth-mode]').forEach(item => item.classList.toggle('btn-dark', item === button));
  }));

  function showBookings(bookings) {
    const target = document.querySelector('#booking-history');
    if (!bookings.length) {
      target.innerHTML = '<p class="muted">You have no booking requests yet.</p>';
      return;
    }
    target.innerHTML = bookings.map(booking => `<article class="account-booking">
      <div><h3>${escapeHtml(booking.package.name)} - ${escapeHtml(booking.model.name)}</h3>
      <p>${escapeHtml(new Date(`${booking.eventDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' }))} at ${escapeHtml(booking.eventTime)} · ${escapeHtml(booking.venue)}</p>
      <p class="small muted">${escapeHtml(booking.status)} · PHP ${(booking.totalCents / 100).toLocaleString()}</p></div>
      ${booking.status === 'pending' && booking.eventDate >= localDate(new Date()) ? `<button class="btn btn-outline" type="button" data-cancel="${booking.id}">Cancel request</button>` : ''}
    </article>`).join('');
    target.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api.request(`/bookings/${button.dataset.cancel}/cancel`, { method: 'POST' });
        await refreshAccount();
        setMessage(message, 'Booking request cancelled.');
      } catch (error) {
        setMessage(message, error.message, true);
        button.disabled = false;
      }
    }));
  }

  async function refreshAccount() {
    if (flow === 'reset') {
      authPanel.hidden = false;
      dashboard.hidden = true;
      return;
    }
    const { customer } = await api.request('/auth/me');
    authPanel.hidden = Boolean(customer);
    dashboard.hidden = !customer;
    if (!customer) return;
    document.querySelector('#profile-name').value = customer.name;
    document.querySelector('#profile-email').value = customer.email;
    document.querySelector('#profile-contact').value = customer.contact;
    const verificationStatus = document.querySelector('#email-verification-status');
    verificationStatus.textContent = customer.emailVerified ? 'Your email address is verified.' : 'Your email address is not verified yet.';
    document.querySelector('#verify-email-button').hidden = customer.emailVerified;
    const { bookings } = await api.request('/bookings');
    showBookings(bookings);
  }

  [loginForm, registerForm].forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    setMessage(message, 'Please wait...');
    try {
      const values = Object.fromEntries(new FormData(form));
      await api.request(form.id === 'login-form' ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(values) });
      await refreshAccount();
      setMessage(message, 'You are signed in.');
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  }));

  resetRequestForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!resetRequestForm.reportValidity()) return;
    const button = resetRequestForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api.request('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(resetRequestForm)))
      });
      setMessage(message, result.message);
      resetRequestForm.reset();
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  resetConfirmForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!token || !resetConfirmForm.reportValidity()) return;
    const button = resetConfirmForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(resetConfirmForm));
      const result = await api.request('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password: values.password })
      });
      resetConfirmForm.reset();
      resetConfirmForm.hidden = true;
      loginForm.hidden = false;
      history.replaceState(null, '', location.pathname);
      setMessage(message, result.message);
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api.request('/customer/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      setMessage(message, 'Profile updated.');
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#verify-email-button').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await api.request('/auth/email/verification', { method: 'POST' });
      setMessage(message, result.message);
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#email-change-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api.request('/customer/email-change', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      setMessage(message, result.message);
      form.reset();
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#password-change-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api.request('/customer/password', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      setMessage(message, result.message);
      await refreshAccount();
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#deactivate-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await api.request('/customer/deactivate', {
        method: 'POST',
        body: JSON.stringify({ password: values.password, confirm: values.confirm === 'true' })
      });
      await refreshAccount();
      setMessage(message, result.message);
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#logout-button').addEventListener('click', async () => {
    try {
      await api.request('/auth/logout', { method: 'POST' });
      await refreshAccount();
      setMessage(message, 'You have logged out.');
    } catch (error) {
      setMessage(message, error.message, true);
    }
  });

  refreshAccount().then(completeEmailFlow).catch(error => setMessage(message, error.message, true));
}

function initializeCalendarPage() {
  const calendar = document.querySelector('#availability-calendar tbody');
  if (!calendar) return;
  const label = document.querySelector('#availability-month');
  const modelSelect = document.querySelector('#calendar-model');
  const selectedDate = document.querySelector('#selected-date-title');
  const selectedStatus = document.querySelector('#selected-date-status');
  const bookLink = document.querySelector('#book-selected-date');
  const query = new URLSearchParams(location.search);
  const queryDate = query.get('date');
  const queryParts = queryDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let month = queryParts
    ? new Date(Number(queryParts[1]), Number(queryParts[2]) - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let bookings = [];
  let chosenDate = queryDate || '';

  function render() {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    label.textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const offset = new Date(year, monthIndex, 1).getDay();
    const dayCount = new Date(year, monthIndex + 1, 0).getDate();
    const booked = new Map(bookings.filter(item => item.modelId === modelSelect.value).map(item => [item.eventDate, item.status]));
    let html = '<tr>';
    for (let i = 0; i < offset; i++) html += '<td class="empty"></td>';
    for (let day = 1; day <= dayCount; day++) {
      if ((offset + day - 1) % 7 === 0 && day > 1) html += '</tr><tr>';
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = booked.get(date);
      const past = date < localDate(new Date());
      const type = status ? (status === 'confirmed' ? 'booked' : 'pending') : past ? 'booked' : 'available';
      const selected = date === chosenDate ? ' selected' : '';
      html += `<td class="day ${type}${selected}" data-date="${date}" role="button" tabindex="0"><span class="num">${day}</span><span class="lbl">${type === 'available' ? 'Available' : type === 'pending' ? 'Pending' : 'Booked'}</span></td>`;
    }
    const trailingCells = (7 - ((offset + dayCount) % 7)) % 7;
    for (let i = 0; i < trailingCells; i++) html += '<td class="empty"></td>';
    html += '</tr>';
    calendar.innerHTML = html;
    calendar.querySelectorAll('[data-date]').forEach(cell => {
      const choose = () => {
        chosenDate = cell.dataset.date;
        const row = [...booked.entries()].find(([date]) => date === chosenDate);
        const isPast = chosenDate < localDate(new Date());
        const status = row ? (row[1] === 'confirmed' ? 'Booked' : 'Pending') : isPast ? 'Unavailable' : 'Available';
        selectedDate.textContent = new Date(`${chosenDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        selectedStatus.textContent = status;
        bookLink.href = status === 'Available' ? `booking.html?date=${encodeURIComponent(chosenDate)}&model=${encodeURIComponent(modelSelect.value)}` : '#';
        bookLink.setAttribute('aria-disabled', status !== 'Available' ? 'true' : 'false');
        render();
      };
      cell.addEventListener('click', choose);
      cell.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') choose(); });
    });
  }

  async function load() {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const result = await api.request(`/availability?month=${monthKey}`);
    bookings = result.bookings;
    render();
  }

  api.request('/catalog').then(({ models }) => {
    models.forEach(model => modelSelect.add(new Option(model.name, model.id)));
    const initialModel = query.get('model');
    if (initialModel) modelSelect.value = initialModel;
    modelSelect.addEventListener('change', load);
    document.querySelectorAll('.cal-layout .calendar-header button').forEach((button, index) => button.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + (index === 0 ? -1 : 1), 1);
      chosenDate = '';
      load();
    }));
    document.querySelector('#use-selected-date').addEventListener('click', event => {
      event.preventDefault();
      if (!chosenDate) {
        selectedDate.textContent = 'Select a date';
        return;
      }
      bookLink.click();
    });
    load().then(() => { if (chosenDate) calendar.querySelector(`[data-date="${chosenDate}"]`)?.click(); });
  }).catch(() => { calendar.innerHTML = '<tr><td colspan="7">Availability could not be loaded. Refresh to try again.</td></tr>'; });
}

initializeBooking();
initializeAccount();
initializeCalendarPage();
initializeCatalogCards();
initializeGallery();
initializeCustomerForms();