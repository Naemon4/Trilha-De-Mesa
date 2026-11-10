import { h } from './dom.js';

const MAX_VISIBLE = 3;

export class Toasts {
  element = h('div', { class: 'toasts', role: 'region', 'aria-label': 'Notificações', 'aria-live': 'polite' });

  show(message, { tone = 'info', actionLabel, onAction, durationMs = 6000 } = {}) {
    const dismiss = () => toast.remove();
    const toast = h(
      'div',
      { class: `toast toast--${tone}` },
      h('span', { class: 'toast__message' }, message),
      actionLabel &&
        h('button', {
          class: 'toast__action',
          type: 'button',
          onClick: () => {
            onAction?.();
            dismiss();
          },
        }, actionLabel),
    );

    this.element.append(toast);
    while (this.element.children.length > MAX_VISIBLE) this.element.firstElementChild.remove();
    setTimeout(dismiss, durationMs);
  }
}
