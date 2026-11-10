import { h } from './dom.js';
import { formatTime, trackLabel } from './format.js';
import { NO_LOOP, TRACK_LOOP, sameLoop } from '../domain/Loop.js';

export const ChaptersStatus = Object.freeze({ LOADING: 'loading', READY: 'ready', EMPTY: 'empty', ERROR: 'error' });

const STATUS_TEXT = {
  [ChaptersStatus.LOADING]: 'Buscando marcadores no YouTube...',
  [ChaptersStatus.EMPTY]: 'Esta faixa não tem marcadores no YouTube.',
  [ChaptersStatus.ERROR]: 'Não consegui buscar os marcadores. Feche e abra este painel para tentar de novo.',
};

/** Painel flutuante para escolher como a faixa atual se repete. */
export class LoopPanel {
  #onSelect;
  #onToggle;

  constructor({ onSelect, onToggle }) {
    this.#onSelect = onSelect;
    this.#onToggle = onToggle;
    this.element = h('div', { id: 'loop-panel', class: 'loop-panel', role: 'group', 'aria-label': 'Loop da faixa', hidden: true });

    document.addEventListener('click', (event) => {
      if (this.isOpen && !this.element.contains(event.target) && !event.target.closest('[data-loop-toggle]')) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (this.isOpen && event.key === 'Escape') {
        this.close();
        document.querySelector('[data-loop-toggle]')?.focus();
      }
    });
  }

  get isOpen() {
    return !this.element.hidden;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.element.hidden = false;
    this.#onToggle(true);
  }

  close() {
    if (!this.isOpen) return;
    this.element.hidden = true;
    this.#onToggle(false);
  }

  /** view: { theme, trackIndex, loop, chapters: { status, items } } */
  render({ theme, trackIndex, loop, chapters }) {
    const isPlaylist = theme.tracks.length > 1;
    const track = theme.tracks[trackIndex];
    const radios = [...this.element.querySelectorAll('input')];
    const focusedIndex = radios.indexOf(document.activeElement);

    const options = [
      this.#option({
        loop: NO_LOOP, current: loop,
        title: isPlaylist ? 'Seguir a playlist' : 'Faixa toda',
        hint: isPlaylist ? 'Quando acabar, toca a próxima faixa' : 'Repete o vídeo inteiro',
      }),
      isPlaylist && this.#option({
        loop: TRACK_LOOP, current: loop,
        title: 'Repetir esta faixa',
        hint: 'Fica nesta faixa até você mudar',
      }),
    ];

    this.element.replaceChildren(
      h('h3', { class: 'loop-panel__title' }, 'Loop desta faixa'),
      h('p', { class: 'loop-panel__track' }, trackLabel(track, trackIndex)),
      h('ul', { class: 'loop-options' }, options.filter(Boolean)),
      h('p', { class: 'loop-panel__subtitle' }, 'Repetir só um trecho'),
      this.#chapters(chapters, loop),
    );

    if (focusedIndex >= 0) this.element.querySelectorAll('input')[focusedIndex]?.focus();
  }

  #chapters({ status, items }, loop) {
    if (status !== ChaptersStatus.READY) return h('p', { class: 'loop-panel__status', role: 'status' }, STATUS_TEXT[status]);
    return h('ul', { class: 'loop-options' }, items.map((section) =>
      this.#option({
        loop: section, current: loop, title: section.label,
        hint: `${formatTime(section.start)} a ${section.end === null ? 'o fim' : formatTime(section.end)}`,
      })));
  }

  #option({ loop, current, title, hint }) {
    return h('li', {},
      h('label', { class: 'loop-option' },
        h('input', {
          type: 'radio', name: 'loop-mode', checked: sameLoop(loop, current),
          onChange: () => this.#onSelect(loop),
        }),
        h('span', { class: 'loop-option__text' },
          h('span', { class: 'loop-option__title' }, title),
          h('span', { class: 'loop-option__hint' }, hint))));
  }
}
