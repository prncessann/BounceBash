let refreshPublicReviews = null;

document.addEventListener('DOMContentLoaded', () => {
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm && bookingForm.dataset.wizard !== 'true') {
    console.error('Use the current booking wizard.');
  }

  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    initFeedbackForm(feedbackForm);
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    initLoginForm(loginForm);
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    initSignupForm(signupForm);
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    initProfileForm(profileForm);
  }

  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    initPasswordForm(passwordForm);
  }

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    initNewsletterForm(newsletterForm);
  }

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    initLogout(logoutLink);
  }

  if (document.getElementById('availability-calendar')) {
    initAvailabilityCalendar();
  }

  if (document.getElementById('mini-calendar')) {
    renderMiniCalendar('mini-calendar', 'mini-calendar-month', 'mini-calendar-message');
  }

  if (document.getElementById('booking-mini-calendar')) {
    renderMiniCalendar('booking-mini-calendar', 'booking-mini-calendar-month', 'booking-mini-calendar-message');
  }

  if (document.getElementById('reviews-grid')) {
    initReviews();
  }

  if (document.getElementById('home-testimonials')) {
    initHomepageReviews();
  }

  const returnTo=new URLSearchParams(location.search).get('next');
  if(returnTo&&safeAuthReturn()!=='profile.html')document.querySelectorAll('a[href="login.html"],a[href="signup.html"]').forEach(a=>{a.href=a.getAttribute('href')+'?next='+encodeURIComponent(returnTo);});
  initPackageBookingLinks();
  initSessionState();
});

async function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || '';
  element.dataset.state = isError ? 'error' : 'success';
}

async function initFeedbackForm(form) {
  const feedbackMessage = document.getElementById('feedback-message');
  apiRequest('/api/catalog').then(data=>{const select=document.getElementById('fb-pkg');if(select){const chosen=select.value;select.replaceChildren(new Option('Select rental',''),...data.packages.map(p=>new Option(p.name.replace(/ — Demo rental$/,''),p.name)));select.value=chosen;}}).catch(()=>{});
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: document.getElementById('fb-name')?.value,
      eventType: document.getElementById('fb-event')?.value,
      packageName: document.getElementById('fb-pkg')?.value,
      rating: document.getElementById('fb-rating')?.value || 5,
      message: document.getElementById('fb-text')?.value,
      canFeature: document.getElementById('share-publicly')?.checked || false,
    };

    try {
      setStatus(feedbackMessage, 'Submitting your feedback...', false);
      const result = await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(feedbackMessage, result.message, false);
      form.reset();
      if (refreshPublicReviews) await refreshPublicReviews();
    } catch (error) {
      setStatus(feedbackMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initLoginForm(form) {
  const authMessage = document.getElementById('login-message') || document.getElementById('auth-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      email: form.querySelector('input[name="email"]')?.value,
      password: form.querySelector('input[name="password"]')?.value,
    };

    try {
      setStatus(authMessage, 'Logging in...', false);
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(authMessage, result.message, false);
      setTimeout(() => {
        window.location.href = safeAuthReturn();
      }, 600);
    } catch (error) {
      setStatus(authMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initSignupForm(form) {
  const authMessage = document.getElementById('signup-message') || document.getElementById('auth-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: form.querySelector('input[name="name"]')?.value,
      email: form.querySelector('input[name="email"]')?.value,
      password: form.querySelector('input[name="password"]')?.value,
    };

    try {
      setStatus(authMessage, 'Creating your account...', false);
      const result = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(authMessage, result.message, false);
      setTimeout(() => {
        window.location.href = safeAuthReturn();
      }, 600);
    } catch (error) {
      setStatus(authMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initProfileForm(form) {
  const profileMessage = document.getElementById('profile-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      name: document.getElementById('profile-name')?.value,
      email: document.getElementById('profile-email')?.value,
      phone: document.getElementById('profile-phone')?.value,
      city: document.getElementById('profile-city')?.value,
      address: document.getElementById('profile-address')?.value,
    };

    try {
      setStatus(profileMessage, 'Saving changes...', false);
      const result = await apiRequest('/api/customers/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setStatus(profileMessage, result.message, false);
      const summaryName = document.querySelector('.profile-summary-name');
      const summaryMeta = document.querySelector('.profile-summary-meta');
      if (summaryName) summaryName.textContent = result.user.name;
      if (summaryMeta) summaryMeta.textContent = `${result.user.email} | Member since ${new Date(result.user.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`;
    } catch (error) {
      setStatus(profileMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initPasswordForm(form) {
  const profileMessage = document.getElementById('password-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const payload = {
      current: document.getElementById('current-password')?.value,
      new: document.getElementById('new-password')?.value,
    };

    try {
      setStatus(profileMessage, 'Updating password...', false);
      const result = await apiRequest('/api/customers/password', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setStatus(profileMessage, result.message, false);
      form.reset();
    } catch (error) {
      setStatus(profileMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initNewsletterForm(form) {
  const newsletterMessage = document.getElementById('newsletter-message');
  const submitButton = form.querySelector('button[type="submit"]');
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;
    const email = form.querySelector('input[type="email"]')?.value;
    try {
      setStatus(newsletterMessage, 'Subscribing...', false);
      const result = await apiRequest('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus(newsletterMessage, result.message, false);
      form.reset();
    } catch (error) {
      setStatus(newsletterMessage, error.message, true);
    } finally {
      submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function initLogout(link) {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    if (link.getAttribute('aria-disabled') === 'true') return;
    link.setAttribute('aria-disabled', 'true');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
      window.location.replace('index.html');
    } catch (error) {
      link.removeAttribute('aria-disabled');
      const message = document.getElementById('logout-message');
      setStatus(message, error.message, true);
    }
  });
}

async function initAvailabilityCalendar() {
  const monthLabel = document.getElementById('calendar-month');
  const daysBody = document.getElementById('availability-days');
  const statusMessage = document.getElementById('calendar-message');
  const selectedLabel = document.getElementById('selected-date-label');
  const selectedStatus = document.getElementById('selected-date-status');
  const bookingLink = document.getElementById('book-selected-date');
  const styleLabel = document.getElementById('availability-style');
  const previous = document.getElementById('calendar-previous');
  const next = document.getElementById('calendar-next');
  const monthCursor = new Date();
  monthCursor.setDate(1);
  let selectedDate = '';
  let unavailable = new Map();
  let requestSequence=0;
  const requestedStyle = new URLSearchParams(window.location.search).get('style');
  const validStyles = ['Classic White Castle', 'Boho Pastel Playground', 'Rainbow Racer Slide', 'Carnival Pop Castle'];
  const selectedStyle = validStyles.includes(requestedStyle) ? requestedStyle : '';
  styleLabel.textContent = selectedStyle || 'All rentals';

  const render = async () => {
    const sequence=++requestSequence;
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    monthLabel.textContent = monthCursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    daysBody.replaceChildren();
    setStatus(statusMessage, 'Checking date requests...', false);

    try {
      const data = await apiRequest(`/api/availability/month?year=${year}&month=${month + 1}`);
      if(sequence!==requestSequence)return;
      unavailable = new Map(data.unavailableDates.map((item) => [item.date, item.status]));
      setStatus(statusMessage, '', false);
    } catch (error) {
      if(sequence!==requestSequence)return;
      unavailable = new Map();
      setStatus(statusMessage, `Availability could not be loaded: ${error.message}`, true);
      return;
    }

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let row = document.createElement('tr');

    const addEmptyCell = () => {
      const cell = document.createElement('td');
      cell.className = 'empty';
      row.append(cell);
    };

    const finishRow = () => {
      while (row.children.length < 7) addEmptyCell();
      daysBody.append(row);
      row = document.createElement('tr');
    };

    for (let i = 0; i < firstWeekday; i++) addEmptyCell();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObject = new Date(year, month, day);
      const state = unavailable.get(date);
      const isPast = dateObject < today;
      const cell = document.createElement('td');
      cell.className = `day ${state ? 'booked' : 'available'}`;
      cell.dataset.date = date;
      cell.tabIndex = isPast ? -1 : 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `${date}, ${state ? 'unavailable' : 'available'}`);
      if (isPast) cell.setAttribute('aria-disabled', 'true');
      if (date === selectedDate) cell.classList.add('selected');
      const number = document.createElement('span');
      number.className = 'num';
      number.textContent = String(day);
      const label = document.createElement('span');
      label.className = 'lbl';
      label.textContent = state ? 'Unavailable' : 'Available';
      cell.append(number, label);

      const chooseDate = () => {
        if (isPast) return;
        selectedDate = date;
        updateSelection();
        render();
      };
      cell.addEventListener('click', chooseDate);
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseDate();
        }
      });
      row.append(cell);
      if (row.children.length === 7) finishRow();
    }
    if (row.children.length) finishRow();
    updateSelection();
  };

  const updateSelection = () => {
    if (!selectedDate) {
      selectedLabel.textContent = 'Pick a date';
      selectedStatus.textContent = 'Choose a date on the calendar to check it.';
      bookingLink.hidden = true;
      return;
    }

    const date = new Date(`${selectedDate}T00:00:00`);
    const state = unavailable.get(selectedDate);
    const available = !state;
    selectedLabel.textContent = date.toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    selectedStatus.textContent = available
      ? 'No booking request is currently recorded for this date. Final availability is confirmed by our team.'
      : 'This date is unavailable.';
    selectedStatus.dataset.state = available ? 'success' : 'error';
    bookingLink.hidden = !available;
    const params = new URLSearchParams({ date: selectedDate });
    if (selectedStyle) params.set('style', selectedStyle);
    bookingLink.href = `booking.html?${params}`;
  };

  previous.addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() - 1);
    selectedDate = '';
    render();
  });
  next.addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() + 1);
    selectedDate = '';
    render();
  });
  await render();
}

async function renderMiniCalendar(calendarId, monthId, messageId) {
  const calendar = document.getElementById(calendarId);
  const monthLabel = document.getElementById(monthId);
  const status = document.getElementById(messageId);
  if (!calendar || !monthLabel) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  monthLabel.textContent = today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  calendar.replaceChildren();

  const appendDay = (className, text) => {
    const day = document.createElement('span');
    day.className = className;
    day.textContent = text;
    calendar.append(day);
  };

  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((day) => appendDay('mini-dow', day));
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstWeekday; i++) appendDay('mini-day empty', '');

  try {
    const data = await apiRequest(`/api/availability/month?year=${year}&month=${month + 1}`);
    const unavailable = new Map(data.unavailableDates.map((item) => [item.date, item.status]));
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const state = unavailable.get(date);
      appendDay(`mini-day ${state ? 'booked' : 'available'}`, String(day));
    }
  } catch (error) {
    console.error('Unable to load availability calendar:', error);
    calendar.replaceChildren();
    setStatus(status, 'Availability is temporarily unavailable.', true);
  }
}

async function initReviews() {
  const grid = document.getElementById('reviews-grid');
  const status = document.getElementById('reviews-message');
  const loadMore = document.getElementById('load-reviews');
  const filters = Array.from(document.querySelectorAll('[data-review-filter]'));
  const limit = 6;
  let offset = 0;
  let selectedFilter = {};
  let requestSequence=0;

  const renderReview = (review) => {
    const card = document.createElement('div');
    card.className = 'review-card';
    const stars = document.createElement('p');
    stars.className = 'stars';
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const message = document.createElement('p');
    message.textContent = review.message;
    const reviewer = document.createElement('p');
    reviewer.className = 'reviewer';
    const name = document.createElement('strong');
    name.textContent = review.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = [review.event_type, review.package_name].filter(Boolean).join(' · ');
    reviewer.append(name);
    if (meta.textContent) {
      reviewer.append(document.createElement('br'), meta);
    }
    card.append(stars, message, reviewer);
    appendReviewCorrection(card,review.correction);
    return card;
  };

  const load = async (append) => {
    const sequence=++requestSequence;
    loadMore.disabled = true;
    setStatus(status, 'Loading feedback...', false);
    const params = new URLSearchParams({ limit: String(limit), offset: String(append ? offset : 0) });
    if (selectedFilter.rating) params.set('rating', selectedFilter.rating);
    if (selectedFilter.eventType) params.set('eventType', selectedFilter.eventType);

    try {
      const data = await apiRequest(`/api/reviews?${params}`);
      if(sequence!==requestSequence)return;
      if (!append) {
        grid.replaceChildren();
        offset = 0;
      }
      data.reviews.forEach((review) => grid.append(renderReview(review)));
      offset += data.reviews.length;
      setStatus(status, data.total ? '' : 'No public feedback matches this filter yet.', false);
      const noMoreReviews = offset >= data.total;
      loadMore.hidden = noMoreReviews;
      loadMore.parentElement.hidden = noMoreReviews;
      loadMore.disabled = false;
      updateReviewSummary(data.summary);
    } catch (error) {
      if(sequence!==requestSequence)return;
      setStatus(status, `Feedback could not be loaded: ${error.message}`, true);
      loadMore.disabled = false;
    }
  };

  filters.forEach((filter) => {
    filter.addEventListener('click', (event) => {
      event.preventDefault();
      selectedFilter = {};
      if (filter.dataset.reviewRating) selectedFilter.rating = filter.dataset.reviewRating;
      if (filter.dataset.reviewEvent) selectedFilter.eventType = filter.dataset.reviewEvent;
      filters.forEach((item) => {
        item.classList.toggle('btn-dark', item === filter);
        item.classList.toggle('btn-outline', item !== filter);
        item.setAttribute('aria-pressed', item === filter ? 'true' : 'false');
      });
      load(false);
    });
  });

  loadMore.addEventListener('click', () => load(true));
  refreshPublicReviews = async () => {
    selectedFilter = {};
    filters.forEach((item, index) => {
      const active = index === 0;
      item.classList.toggle('btn-dark', active);
      item.classList.toggle('btn-outline', !active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    await load(false);
  };
  await load(false);
}

async function initHomepageReviews() {
  const grid = document.getElementById('home-testimonials');
  const status = document.getElementById('home-reviews-message');
  try {
    const data = await apiRequest('/api/reviews?limit=3&featured=true');
    if (!data.reviews.length) {
      status.textContent = 'Customer reviews will appear here when shared.';
      return;
    }

    data.reviews.forEach((review) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      const stars = document.createElement('p');
      stars.className = 'stars';
      stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const message = document.createElement('p');
      message.textContent = review.message;
      const reviewer = document.createElement('p');
      reviewer.className = 'reviewer';
      const name = document.createElement('strong');
      name.textContent = review.name;
      const event = document.createElement('span');
      event.textContent = review.event_type || 'Customer review';
      reviewer.append(name, document.createElement('br'), event);
      card.append(stars, message, reviewer);
      appendReviewCorrection(card,review.correction);
      grid.append(card);
    });
  } catch (error) {
    console.error('Unable to load public reviews:', error);
    status.textContent = 'Customer reviews are temporarily unavailable.';
  }
}

function appendReviewCorrection(card,correction) {
  if(!correction)return;
  const note=document.createElement('p');
  note.className='muted small';
  note.textContent='Editorial note: '+correction;
  card.append(note);
}

function initPackageBookingLinks() {
  if (!window.location.pathname.endsWith('/packages.html')) return;
  document.querySelectorAll('.package-card').forEach((card) => {
    const packageName = card.querySelector('h3')?.textContent.trim();
    if (!packageName) return;
    card.querySelectorAll('a[href="booking.html"]').forEach((link) => {
      link.href = `booking.html?package=${encodeURIComponent(packageName)}`;
    });
  });
}

function updateReviewSummary(summary) {
  const score = document.getElementById('review-score');
  const count = document.getElementById('review-count');
  const breakdown = document.getElementById('review-breakdown');
  if (score) score.textContent = summary.average.toFixed(1);
  if (count) count.textContent = `Based on ${summary.count} public review${summary.count === 1 ? '' : 's'}`;
  if (!breakdown) return;

  const rows = breakdown.querySelectorAll('[data-rating-row]');
  rows.forEach((row) => {
    const rating = Number(row.dataset.ratingRow);
    const value = summary.distribution[rating] || 0;
    const total = summary.count || 0;
    const bar = row.querySelector('.bar span');
    const countLabel = row.querySelector('[data-count]');
    if (bar) bar.style.width = `${total ? (value / total) * 100 : 0}%`;
    if (countLabel) countLabel.textContent = String(value);
  });
}

async function initSessionState() {
  const isProfilePage = window.location.pathname.endsWith('/profile.html');
  try {
    const result = await apiRequest('/api/auth/session');
    if (!result.authenticated) {
      if (isProfilePage) window.location.replace('login.html');
      return;
    }

    document.querySelectorAll('.auth-link[href$="#login"], .auth-link[href$="#signup"]').forEach((link) => {
      link.style.display = 'none';
    });

    const profileLinks = document.querySelectorAll('a[href="profile.html"]');
    profileLinks.forEach((link) => {
      link.textContent = 'Profile';
    });
  } catch (error) {
    console.error('Session check failed:', error);
    if (isProfilePage) {
      setStatus(document.getElementById('profile-message'), 'Your account could not be loaded. Please try again.', true);
      return;
    }
  }

  if (isProfilePage) {
    loadProfileData();
  }
}

async function loadProfileData() {
  try {
    const session = await apiRequest('/api/auth/session');
    if (!session.authenticated) {
      window.location.href = 'login.html';
      return;
    }

    const profile = await apiRequest('/api/customers/me');
    void window.loadCustomerInquiries?.();
    const user = profile.user;

    const nameHeading = document.querySelector('.profile-summary-name');
    const summaryMeta = document.querySelector('.profile-summary-meta');
    if (nameHeading) nameHeading.textContent = user.name;
    const avatar = document.querySelector('.account-layout .profile-link');
    if (avatar) avatar.textContent = user.name.trim().charAt(0).toUpperCase();
    if (summaryMeta) {
      const joinDate = new Date(user.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      summaryMeta.textContent = `${user.email} | Member since ${joinDate}`;
    }

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profilePhone = document.getElementById('profile-phone');
    const profileCity = document.getElementById('profile-city');
    const profileAddress = document.getElementById('profile-address');

    if (profileName) profileName.value = user.name || '';
    if (profileEmail) profileEmail.value = user.email || '';
    if (profilePhone) profilePhone.value = user.phone || '';
    if (profileCity) profileCity.value = user.city || '';
    if (profileAddress) profileAddress.value = user.address || '';

    const bookings = await apiRequest('/api/bookings/mine');
    const list = document.getElementById('booking-list');
    if (list) {
      if (!bookings.bookings.length) {
        const empty = document.createElement('p');
        empty.className = 'muted small center mt-20 m-0';
        empty.textContent = 'No bookings yet.';
        list.replaceChildren(empty);
        return;
      }

      const bookingItems = bookings.bookings.map((booking) => {
        const item = document.createElement('div');
        item.className = 'account-booking';
        const details = document.createElement('div');
        const packageName = document.createElement('h3');
        packageName.textContent = booking.package_name;
        const event = document.createElement('p');
        event.className = 'muted small';
        event.textContent = `${new Date(`${booking.event_date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} | ${booking.venue}`;
        const reference = document.createElement('p');
        reference.className = 'small m-0';
        reference.textContent = `Reference: ${booking.reference} | Status: ${booking.status}${booking.selected_style ? ` | Style: ${booking.selected_style}` : ''}`;
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = booking.status;
        if(window.BBHoldCountdown){const timer=document.createElement('div');details.append(timer);BBHoldCountdown(timer,booking,()=>loadProfileData());}
        const manage = document.createElement('a'); manage.className = 'btn btn-outline';
        manage.href = 'manage-booking.html?reference=' + encodeURIComponent(booking.reference); manage.textContent = 'Manage booking';
        details.append(packageName, event, reference, manage);
        const statusActions=document.createElement('div');statusActions.className='booking-status-actions';statusActions.append(tag);
        const future=new Date(`${booking.event_date}T${booking.event_time}:00+08:00`)>new Date();
        if(['pending','confirmed'].includes(booking.status)&&future){
          const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-outline booking-cancel';cancel.textContent='Cancel booking';
          cancel.addEventListener('click',async()=>{
            cancel.disabled=true;
            try { if(await window.BBCancelBooking(booking))await loadProfileData(); }
            finally { cancel.disabled=false; if(cancel.isConnected)cancel.focus(); }
          });
          statusActions.append(cancel);
        }
        item.append(details, statusActions);
        return item;
      });
      list.replaceChildren(...bookingItems);
    }
  } catch (error) {
    console.error('Profile data loading failed:', error);
    if (window.location.pathname.endsWith('/profile.html')) {
      window.location.href = 'login.html';
    }
  }
}


/* Mobile menu button: shows and hides the nav and sign-in links on phones */
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const nav = header.querySelector('.site-nav');
  const actions = header.querySelector('.header-actions');
  if (!nav && !actions) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  header.append(btn);
  const close = () => {
    header.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
  };
  btn.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  header.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
function safeAuthReturn(){
 const value=new URLSearchParams(location.search).get('next');
 if(value){try{const target=new URL(value,location.href);if(target.origin===location.origin&&['booking.html','manage-booking.html','profile.html'].some(p=>target.pathname==='/Bouncebash_CS/'+p))return target.pathname+target.search;}catch{}}
 return 'profile.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  const footer=document.querySelector('.site-footer');
  if(!footer)return;
  try{
    const {settings}=await apiRequest('/api/business-settings');
    const details=settings?.contact;
    if(!details||!Object.values(details).some(Boolean))return;
    const section=document.createElement('div');section.className='footer-col';
    const heading=document.createElement('h4');heading.textContent=details.name||'Contact';section.append(heading);
    for(const [value,scheme] of [[details.email,'mailto:'],[details.phone,'tel:']]){
      if(!value)continue;
      const existing=footer.querySelector('a[href^="'+scheme+'"]');
      const link=existing||document.createElement('a');
      link.href=scheme+(scheme==='tel:'?value.replace(/[^+\d]/g,''):value);link.textContent=value;
      if(!existing)section.append(link);
    }
    for(const value of [details.area,details.hours])if(value){const p=document.createElement('p');p.textContent=value;section.append(p);}
    footer.append(section);
  }catch{/* Retain the existing contact links if the settings request fails. */}
});
