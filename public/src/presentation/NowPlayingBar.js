import { h } from './dom.js';
import { icon } from './icons.js';
import { thumbnailUrl, trackLabel, formatTime, formatSeconds } from './format.js';
import { MAX_CROSSFADE_SECONDS, PlaybackStatus } from '../application/PlaybackService.js';
import { LoopType } from '../domain/Loop.js';

const LOOP_LABELS = { [LoopType.NONE]: 'Loop', [LoopType.TRACK]: 'Loop: faixa', [LoopType.SECTION]: 'Loop: trecho' };

/** Barra fixa com o que está tocando e os controles principais. */
export class NowPlayingBar {
  #refs;
  #lastTrackKey = null;

  constructor(actions) {
    this.element = this.#build(actions);
    this.render({ status: PlaybackStatus.IDLE, loading: false, themeId: null, trackIndex: 0, loop: { type: LoopType.NONE }, volume: 0.8, crossfadeSeconds: 4 }, null);
  }

  render(state, theme) {
    const refs = this.#refs;
    const isActive = state.status !== PlaybackStatus.IDLE && Boolean(theme);
    const track = isActive ? theme.tracks[state.trackIndex] : null;

    refs.themeName.textContent = isActive ? theme.name : 'Nada tocando';
    refs.status.textContent = this.#statusText(state, isActive);
    refs.title.textContent = isActive ? trackLabel(track, state.trackIndex) : 'Escolha um tema para começar';

    refs.image.hidden = !isActive;
    refs.imageEmpty.hidden = isActive;
    if (isActive) refs.image.src = thumbnailUrl(track.videoId);

    const isPlaying = state.status === PlaybackStatus.PLAYING;
    const toggleLabel = isPlaying ? 'Pausar' : state.status === PlaybackStatus.PAUSED ? 'Continuar' : 'Tocar';
    refs.toggle.replaceChildren(icon(isPlaying ? 'pause' : 'play', 26));
    refs.toggle.setAttribute('aria-label', toggleLabel);
    refs.toggle.title = `${toggleLabel} (barra de espaço)`;
    refs.toggle.disabled = !isActive || state.loading;
    refs.previous.disabled = !isActive;
    refs.next.disabled = !isActive;
    refs.stop.disabled = !isActive;
    refs.loop.disabled = !isActive;
    refs.loop.classList.toggle('is-active', isActive && state.loop.type !== LoopType.NONE);
    refs.loopLabel.textContent = LOOP_LABELS[state.loop.type];

    this.element.classList.toggle('is-loading', state.loading);
    this.element.setAttribute('aria-busy', String(state.loading));

    refs.volume.set(Math.round(state.volume * 100));
    refs.crossfade.set(state.crossfadeSeconds);

    const trackKey = isActive ? `${state.themeId}:${state.trackIndex}` : null;
    if (trackKey !== this.#lastTrackKey) {
      this.#lastTrackKey = trackKey;
      this.renderProgress({ position: 0, duration: 0 });
    }
  }

  setLoopExpanded(expanded) {
    this.#refs.loop.setAttribute('aria-expanded', String(expanded));
  }

  renderProgress({ position, duration }) {
    const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
    const refs = this.#refs;
    refs.fill.style.width = `${percent}%`;
    refs.progress.setAttribute('aria-valuenow', String(Math.round(percent)));
    refs.elapsed.textContent = formatTime(position);
    refs.total.textContent = formatTime(duration);
  }

  #statusText(state, isActive) {
    if (!isActive) return '';
    if (state.loading) return 'Carregando...';
    return state.status === PlaybackStatus.PAUSED ? 'Pausado' : 'Tocando';
  }

  #build(actions) {
    const image = h('img', { class: 'player__image', alt: '', hidden: true });
    const imageEmpty = h('span', { class: 'player__image-empty' }, icon('music', 24));
    const themeName = h('p', { class: 'player__theme' });
    const status = h('span', { class: 'player__status' });
    const title = h('p', { class: 'player__title' });

    const previous = controlButton('Faixa anterior (P)', 'prev', actions.onPrevious);
    const next = controlButton('Próxima faixa (N)', 'next', actions.onNext);
    const stop = controlButton('Parar com fade-out', 'stop', actions.onStop);
    const loopLabel = h('span', {}, 'Loop');
    const loop = h('button', {
      class: 'control-pill', type: 'button', 'data-loop-toggle': true, 'aria-haspopup': 'true',
      'aria-expanded': 'false', 'aria-controls': 'loop-panel', title: 'Escolher como a faixa se repete',
      onClick: actions.onLoopToggle,
    }, icon('repeat', 18), loopLabel);
    const toggle = h('button', { class: 'control control--main', type: 'button', onClick: actions.onToggle });

    const elapsed = h('span', { class: 'player__time' }, '0:00');
    const total = h('span', { class: 'player__time' }, '0:00');
    const fill = h('span', { class: 'progress__fill' });
    const progress = h('div', {
      class: 'progress', role: 'progressbar', 'aria-label': 'Progresso da faixa',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0',
    }, fill);

    const volume = createSlider({
      id: 'volume', label: 'Volume', iconName: 'volume', min: 0, max: 100, step: 1,
      format: (value) => `${value}%`, onInput: (value) => actions.onVolume(value / 100),
    });
    const crossfade = createSlider({
      id: 'crossfade', label: 'Transição', iconName: 'blend', min: 0, max: MAX_CROSSFADE_SECONDS, step: 0.5,
      format: formatSeconds, onInput: actions.onCrossfade,
    });

    this.#refs = { image, imageEmpty, themeName, status, title, previous, next, stop, toggle, loop, loopLabel, elapsed, total, fill, progress, volume, crossfade };

    return h(
      'section',
      { class: 'player', 'aria-label': 'Reprodução atual' },
      h('div', { class: 'player__now' },
        h('div', { class: 'player__art' }, image, imageEmpty),
        h('div', { class: 'player__text' },
          h('p', { class: 'player__line' }, themeName, status),
          title)),
      h('div', { class: 'player__center' },
        h('div', { class: 'player__controls' }, previous, toggle, next, stop, loop),
        h('div', { class: 'player__progress' }, elapsed, progress, total),
        actions.loopPanel),
      h('div', { class: 'player__settings' }, volume.element, crossfade.element),
    );
  }
}

function controlButton(label, iconName, onClick) {
  return h('button', { class: 'control', type: 'button', 'aria-label': label, title: label, onClick }, icon(iconName, 20));
}

function createSlider({ id, label, iconName, min, max, step, format, onInput }) {
  const input = h('input', { id, class: 'slider__input', type: 'range', min, max, step });
  const output = h('output', { class: 'slider__output', for: id });

  const set = (value) => {
    input.value = value;
    output.textContent = format(Number(value));
    input.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
  };
  input.addEventListener('input', () => {
    set(input.value);
    onInput(Number(input.value));
  });

  const element = h('div', { class: 'slider' },
    h('label', { class: 'slider__label', for: id }, icon(iconName, 18), label),
    input,
    output);
  return { element, set };
}
