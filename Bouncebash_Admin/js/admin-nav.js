(function () {
  const aside = document.querySelector('aside');
  const nav = aside && aside.querySelector('nav');
  if (!aside || !nav) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-nav-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  aside.classList.add('has-toggle');
  aside.prepend(btn);
  const close = () => { aside.classList.remove('nav-open'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); };
  btn.addEventListener('click', () => {
    const open = aside.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();