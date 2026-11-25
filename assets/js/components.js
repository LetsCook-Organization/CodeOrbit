/**
 * CODEORBIT — SHARED UI PIECES
 * Toasts (pop-up messages), modals (dialogs), the "Are you sure?" dialog, and
 * search (Ctrl+K).
 */

import { icon } from './icons.js';
import {
  escapeHTML,
  sounds,
  formatDate,
  formatDuration,
  statusLabel,
  projectStatusLabel,
  skillLabel
} from './utils.js';
import { storage } from './storage.js';

/* ==========================================================================
   TOAST NOTIFICATION ENGINE
   ========================================================================== */
class ToastManager {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
      }
      this.container = el;
    }
  }

  show({ type = 'info', title, message, duration = 4000 }) {
    this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let iconSvg;
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'achievement') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      sounds.achievement(); // the only sound in CodeOrbit (Settings → Sounds)
    } else {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        <div class="toast-title">${escapeHTML(title)}</div>
        ${message ? `<div class="toast-message">${escapeHTML(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    const close = () => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.remove) toast.remove();
      }, 250);
    };

    const closeBtn = toast.querySelector ? toast.querySelector('.toast-close') : null;
    if (closeBtn && closeBtn.addEventListener) {
      closeBtn.addEventListener('click', close);
    }
    if (this.container && this.container.appendChild) {
      this.container.appendChild(toast);
    }

    if (duration > 0) {
      setTimeout(close, duration);
    }
  }

  success(title, message) {
    this.show({ type: 'success', title, message });
  }

  error(title, message) {
    this.show({ type: 'error', title, message });
  }

  warning(title, message) {
    this.show({ type: 'warning', title, message });
  }

  info(title, message) {
    this.show({ type: 'info', title, message });
  }

  achievement(title, message) {
    this.show({ type: 'achievement', title, message, duration: 6000 });
  }
}

export const toast = new ToastManager();

/* ==========================================================================
   MODAL CONTROLLER
   ========================================================================== */
const dialogStack = [];
const closingDialogs = new WeakMap();
let previousOverflow = '';

function tabStops(modal) {
  return [
    ...modal.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]'
    )
  ].filter(
    el =>
      el.tabIndex >= 0 &&
      !el.matches(':disabled') &&
      !el.closest('[inert], [hidden]') &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility === 'visible'
  );
}

function focusInside(modal) {
  const stops = tabStops(modal);
  const initial = stops.find(el => !el.classList.contains('modal-close-btn')) || stops[0];
  // A dialog without controls must still have somewhere to put focus.
  if (!initial) modal.setAttribute('tabindex', '-1');
  (initial || modal).focus();
}

function trapFocus(event, modal) {
  if (event.key !== 'Tab') return;
  // Recalculate each time: search results and form controls can change.
  const stops = tabStops(modal);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const current = document.activeElement;
  if (!first) {
    event.preventDefault();
    focusInside(modal);
  } else if (!stops.includes(current) || (event.shiftKey ? current === first : current === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const current = dialogStack[dialogStack.length - 1];
  if (current?.modal === modal) {
    focusInside(modal);
    return;
  }
  // An already covered dialog stays behind the current one.
  if (dialogStack.some(entry => entry.modal === modal)) return;

  const opener = document.activeElement;
  if (!current) previousOverflow = document.body.style.overflow;
  closingDialogs.get(modal)?.();
  modal.classList.remove('closing');
  modal.classList.add('active');
  modal.inert = false;
  modal.setAttribute('aria-hidden', 'false');
  dialogStack.push({ modal, opener });
  document.body.style.overflow = 'hidden';
  focusInside(modal);
  // Keep a covered dialog out of the tab order and accessibility tree.
  if (current) current.modal.inert = true;
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  const index = dialogStack.findIndex(entry => entry.modal === modal);
  if (index === -1) return;
  const wasTop = index === dialogStack.length - 1;
  const [{ opener }] = dialogStack.splice(index, 1);
  const current = dialogStack[dialogStack.length - 1];

  // If a covered dialog is closed, don't return to one of its hidden controls later.
  if (!wasTop && modal.contains(dialogStack[index].opener)) {
    dialogStack[index].opener = opener;
  }
  if (wasTop) {
    if (current) current.modal.inert = false;
    if (opener?.isConnected && (!current || current.modal.contains(opener))) {
      opener.focus();
    }
    if (current && !current.modal.contains(document.activeElement)) focusInside(current.modal);
    if (!current && modal.contains(document.activeElement)) document.activeElement.blur();
  }
  modal.inert = true;
  modal.setAttribute('aria-hidden', 'true');
  if (!current) document.body.style.overflow = previousOverflow;

  // Keep the existing closing animation, but cancel stale callbacks on reopen.
  modal.classList.add('closing');
  let timer;
  const cleanup = () => {
    clearTimeout(timer);
    modal.removeEventListener('animationend', finish);
    closingDialogs.delete(modal);
  };
  function finish(event) {
    if (event && event.target !== modal) return;
    cleanup();
    modal.classList.remove('closing', 'active');
  }
  timer = setTimeout(finish, 250);
  closingDialogs.set(modal, cleanup);
  modal.addEventListener('animationend', finish);
}

/**
 * Initializes generic modal close handlers (ESC key and backdrop click).
 */
export function setupModalDismissHandlers() {
  document.addEventListener('keydown', e => {
    const current = dialogStack[dialogStack.length - 1];
    if (!current) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(current.modal.id);
    } else {
      trapFocus(e, current.modal);
    }
  });

  document.addEventListener('focusin', e => {
    const current = dialogStack[dialogStack.length - 1];
    if (current && !current.modal.contains(e.target)) focusInside(current.modal);
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal(e.target.id);
    }
    if (e.target.closest('.modal-close-btn') || e.target.closest('[data-modal-close]')) {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) closeModal(modal.id);
    }
  });
}

/**
 * Reusable Confirmation Dialog
 */
export function showConfirmDialog({
  title = 'Are you sure?',
  message = 'Please confirm to continue.',
  confirmText = 'Confirm',
  confirmClass = 'btn-danger',
  onConfirm = () => {}
}) {
  let modal = document.getElementById('confirm-action-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-action-modal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'confirm-title');
    modal.innerHTML = `
      <div class="modal-container modal-sm">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon-badge" style="border-color: var(--accent-text); color: var(--accent-text);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3 class="modal-title" id="confirm-title">Are you sure?</h3>
          </div>
          <button type="button" class="modal-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirm-message" style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
          <button type="button" class="btn ${confirmClass}" id="confirm-proceed-btn">Proceed</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;

  const proceedBtn = document.getElementById('confirm-proceed-btn');
  proceedBtn.className = `btn ${confirmClass}`;
  proceedBtn.textContent = confirmText;

  // Clone button to remove previous listeners
  const newProceedBtn = proceedBtn.cloneNode(true);
  proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);

  newProceedBtn.addEventListener('click', () => {
    closeModal('confirm-action-modal');
    onConfirm();
  });

  openModal('confirm-action-modal');
}

/* ==========================================================================
   SEARCH (Ctrl+K, "/" or the search button)
   ========================================================================== */
export function openCommandPalette() {
  const modal = document.getElementById('command-palette-modal');
  if (!modal) return;
  const input = document.getElementById('palette-search-input');
  if (input) {
    input.value = '';
    renderPaletteResults('');
  }
  openModal('command-palette-modal');
}

function closeCommandPalette() {
  closeModal('command-palette-modal');
}

export function renderPaletteResults(query) {
  const container = document.getElementById('palette-results-list');
  if (!container) return;

  const q = query.trim().toLowerCase();
  const data = storage.getUniverse();
  const results = [];

  // Skills
  (data.skills || []).forEach(s => {
    const nameMatch = s.name && s.name.toLowerCase().includes(q);
    const catMatch = s.category && s.category.toLowerCase().includes(q);
    const descMatch = s.description && s.description.toLowerCase().includes(q);
    if (!q || nameMatch || catMatch || descMatch) {
      results.push({
        type: 'Skill',
        icon: 'planet',
        title: s.name,
        subtitle: `${s.category || 'Other'} · ${statusLabel(s.status)} · ${Number(s.progress) || 0}%`,
        action: () => {
          window.location.hash = '#skills';
          closeCommandPalette();
        }
      });
    }
  });

  // Projects
  (data.projects || []).forEach(p => {
    const nameMatch = p.name && p.name.toLowerCase().includes(q);
    const descMatch = p.description && p.description.toLowerCase().includes(q);
    const techMatch = p.technologies && p.technologies.some(t => t && t.toLowerCase().includes(q));
    if (!q || nameMatch || descMatch || techMatch) {
      results.push({
        type: 'Project',
        icon: 'folder',
        title: p.name,
        subtitle: [projectStatusLabel(p.status), ...(p.technologies || []).slice(0, 3)].join(' · '),
        action: () => {
          window.location.hash = '#projects';
          closeCommandPalette();
        }
      });
    }
  });

  // Study sessions
  (data.activities || []).forEach(a => {
    const titleMatch = a.title && a.title.toLowerCase().includes(q);
    const skillMatch = a.skill && a.skill.toLowerCase().includes(q);
    const notesMatch = a.notes && a.notes.toLowerCase().includes(q);
    if (!q || titleMatch || skillMatch || notesMatch) {
      results.push({
        type: 'Study session',
        icon: 'clock',
        title: a.title,
        subtitle: `${skillLabel(a.skill)} · ${formatDuration(a.duration)} · ${formatDate(a.date)}`,
        action: () => {
          window.location.hash = '#progress';
          closeCommandPalette();
        }
      });
    }
  });

  // Goals
  (data.goals || []).forEach(g => {
    const titleMatch = g.title && g.title.toLowerCase().includes(q);
    const catMatch = g.category && g.category.toLowerCase().includes(q);
    if (!q || titleMatch || catMatch) {
      results.push({
        type: 'Goal',
        icon: 'flag',
        title: g.title,
        subtitle: `${g.priority || 'Medium'} priority · ${g.deadline ? `due ${formatDate(g.deadline)}` : 'no due date'}`,
        action: () => {
          window.location.hash = '#goals';
          closeCommandPalette();
        }
      });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
        Nothing found for "${escapeHTML(query)}".
      </div>
    `;
    return;
  }

  container.innerHTML = results
    .slice(0, 10)
    .map(
      (r, i) => `
    <button type="button" class="palette-result-item" data-index="${i}" style="width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 10px 14px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s; margin-bottom: 2px;">
      <span style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
        <span style="color: var(--text-muted); display: flex;">${icon(r.icon)}</span>
        <span style="display: flex; flex-direction: column; overflow: hidden;">
          <span style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHTML(r.title)}</span>
          <span style="font-size: var(--text-xs); color: var(--text-muted);">${escapeHTML(r.subtitle)}</span>
        </span>
      </span>
      <span class="badge badge-muted" style="flex-shrink: 0;">${escapeHTML(r.type)}</span>
    </button>
  `
    )
    .join('');

  container.querySelectorAll('.palette-result-item').forEach((item, idx) => {
    const highlight = () => {
      container
        .querySelectorAll('.palette-result-item')
        .forEach(el => (el.style.background = 'transparent'));
      item.style.background = 'var(--bg-card-elevated)';
    };
    item.addEventListener('mouseenter', highlight);
    item.addEventListener('focus', highlight);
    item.addEventListener('click', () => {
      results[idx].action();
    });
  });
}
