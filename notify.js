'use strict';
/* BounceBash notification UI: toast, snackbar (with action), page banner, and confirmation modal.
   All message text is set with textContent, so server or user text is never parsed as HTML. */
(function () {
  const ICONS = { success: '\u2713', warning: '!', error: '\u2715', info: 'i' };

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function region(id, className, ariaLive) {
    let node = document.getElementById(id);
    if (!node) {
      node = make('div', className);
      node.id = id;
      node.setAttribute('aria-live', ariaLive);
      document.body.append(node);
    }
    return node;
  }

  function dismissible(node, onClose) {
    const close = make('button', 'bb-close', '\u00d7');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => { node.remove(); if (onClose) onClose(); });
    return close;
  }

  /* Toast: temporary pop-up for success, info, warning or error. */
  function toast(message, options = {}) {
    const type = options.type || 'info';
    const node = make('div', `bb-toast bb-${type}`);
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.append(make('span', 'bb-icon', ICONS[type] || 'i'), make('span', 'bb-text', message), dismissible(node));
    region('bb-toast-region', 'bb-toast-stack', 'polite').append(node);
    const ms = options.duration === undefined ? 5000 : options.duration;
    if (ms > 0) setTimeout(() => node.remove(), ms);
    return node;
  }

  /* Snackbar: brief bottom message with an optional action such as Undo. */
  function snackbar(message, options = {}) {
    const node = make('div', 'bb-snackbar');
    node.setAttribute('role', 'status');
    node.append(make('span', 'bb-text', message));
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = make('button', 'bb-snackbar-action', options.actionLabel);
      action.type = 'button';
      action.addEventListener('click', () => { node.remove(); options.onAction(); });
      node.append(action);
    }
    node.append(dismissible(node));
    region('bb-snackbar-region', 'bb-snackbar-stack', 'polite').append(node);
    const ms = options.duration === undefined ? 8000 : options.duration;
    if (ms > 0) setTimeout(() => node.remove(), ms);
    return node;
  }

  /* Banner: page-level notice placed inside a container element (by id or element). */
  function banner(target, message, options = {}) {
    const host = typeof target === 'string' ? document.getElementById(target) : target;
    if (!host) return null;
    host.replaceChildren();
    const node = make('div', `bb-banner bb-${options.type || 'info'}`);
    node.setAttribute('role', options.type === 'error' ? 'alert' : 'status');
    node.append(make('span', 'bb-icon', ICONS[options.type || 'info'] || 'i'), make('span', 'bb-text', message));
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = make('button', 'btn btn-book bb-banner-action', options.actionLabel);
      action.type = 'button';
      action.addEventListener('click', options.onAction);
      node.append(action);
    }
    if (options.dismissible) node.append(dismissible(node));
    host.append(node);
    return node;
  }

  /* Confirmation modal: resolves true or false. Escape and the backdrop cancel. */
  function confirmDialog(options = {}) {
    return new Promise(resolve => {
      const previous = document.activeElement;
      const backdrop = make('div', 'bb-modal-backdrop');
      const dialog = make('div', 'bb-modal');
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      const titleId = 'bb-modal-title-' + Date.now();
      dialog.setAttribute('aria-labelledby', titleId);

      const icon = make('div', `bb-modal-icon${options.danger ? ' bb-danger' : ''}`, options.danger ? '\ud83d\uddd1' : '?');
      const title = make('h2', 'bb-modal-title', options.title || 'Are you sure?');
      title.id = titleId;
      const body = make('p', 'bb-modal-body', options.message || '');
      const actions = make('div', 'bb-modal-actions');
      const cancel = make('button', 'btn btn-outline bb-modal-cancel', options.cancelLabel || 'Keep');
      const confirm = make('button', `btn ${options.danger ? 'bb-btn-danger' : 'btn-book'} bb-modal-confirm`, options.confirmLabel || 'Confirm');
      cancel.type = 'button'; confirm.type = 'button';
      actions.append(cancel, confirm);
      dialog.append(icon, title, body, actions);
      backdrop.append(dialog);
      document.body.append(backdrop);

      const finish = result => {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        if (previous && previous.focus) previous.focus();
        resolve(result);
      };
      const onKey = event => {
        if (event.key === 'Escape') finish(false);
        if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === cancel ? confirm : cancel).focus(); }
      };
      cancel.addEventListener('click', () => finish(false));
      confirm.addEventListener('click', () => finish(true));
      backdrop.addEventListener('click', event => { if (event.target === backdrop) finish(false); });
      document.addEventListener('keydown', onKey);
      confirm.focus();
    });
  }

  window.BBNotify = {
    toast,
    success: (m, o = {}) => toast(m, { ...o, type: 'success' }),
    warning: (m, o = {}) => toast(m, { ...o, type: 'warning' }),
    error: (m, o = {}) => toast(m, { ...o, type: 'error', duration: o.duration === undefined ? 7000 : o.duration }),
    snackbar,
    banner,
    confirm: confirmDialog,
  };
})();