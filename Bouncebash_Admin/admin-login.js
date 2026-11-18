(function () {
  const form = document.getElementById('login-form');
  const message = document.getElementById('login-message');
  const submit = document.getElementById('login-submit');
  fetch('/api/staff/session', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => { if (d.authenticated) location.replace('index.html'); })
    .catch(() => {});
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    submit.disabled = true;
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('staff-email').value,
          password: document.getElementById('staff-password').value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sign in failed.');
      location.replace('index.html');
    } catch (e) {
      message.textContent = e.message;
      message.className = 'bad';
    } finally {
      submit.disabled = false;
    }
  });
})();