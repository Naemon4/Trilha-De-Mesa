import { h } from './dom.js';

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SOLID = 'fill="currentColor" stroke="none"';

// Conteúdo estático e confiável, por isso o uso de innerHTML é seguro aqui.
const SHAPES = {
  play: `<g ${SOLID}><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></g>`,
  pause: `<g ${SOLID}><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></g>`,
  stop: `<g ${SOLID}><rect x="6" y="6" width="12" height="12" rx="2"/></g>`,
  next: `<g ${SOLID}><path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l8.6-5.8a.8.8 0 0 0 0-1.4L6.2 5.5A.8.8 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.5" height="14" rx="1"/></g>`,
  prev: `<g ${SOLID}><path d="M19 6.2v11.6a.8.8 0 0 1-1.2.7l-8.6-5.8a.8.8 0 0 1 0-1.4l8.6-5.8A.8.8 0 0 1 19 6.2z"/><rect x="5" y="5" width="2.5" height="14" rx="1"/></g>`,
  plus: `<g ${STROKE}><path d="M12 5v14M5 12h14"/></g>`,
  trash: `<g ${STROKE}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/></g>`,
  pencil: `<g ${STROKE}><path d="M4 20l1-4.5L16.5 4a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"/></g>`,
  list: `<g ${STROKE}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></g>`,
  chevron: `<g ${STROKE}><path d="M6 9l6 6 6-6"/></g>`,
  volume: `<g ${STROKE}><path d="M4 10v4h3.5L12 18V6l-4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></g>`,
  blend: `<g ${STROKE}><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/></g>`,
  repeat: `<g ${STROKE}><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></g>`,
  music: `<g ${STROKE}><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></g>`,
};

export function icon(name, size = 20) {
  const wrapper = h('span', { class: 'icon', 'aria-hidden': 'true' });
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}">${SHAPES[name]}</svg>`;
  return wrapper;
}

/** Barrinhas animadas que indicam o que está tocando. */
export function equalizer() {
  return h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
}
