import { PlaybackStatus } from '../application/PlaybackService.js';
import { DomainError } from '../domain/errors.js';
import { sectionsFromChapters } from '../domain/Loop.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { Toasts } from './Toasts.js';
import { createAddThemeForm } from './AddThemeForm.js';
import { createThemeCard } from './ThemeCard.js';
import { NowPlayingBar } from './NowPlayingBar.js';
import { LoopPanel, ChaptersStatus } from './LoopPanel.js';

const RENDER_DEBOUNCE_MS = 250;
const WARN_INTERVAL_MS = 30000;

/** Controlador da tela: liga eventos da interface aos casos de uso e redesenha. */
export class App {
  #root;
  #library;
  #playback;
  #chapterCatalog;
  #chapterView = { videoId: null, status: ChaptersStatus.LOADING, items: [] };
  #loopPanel;
  #toasts = new Toasts();
  #expandedIds = new Set();
  #scrollByTheme = new Map();
  #editingId = null;
  #lastTrackKey = '';
  #lastNoticeId = 0;
  #lastWarnAt = 0;
  #renderTimer = null;
  #form;
  #bar;
  #grid;
  #count;

  #cardActions = {
    onPlay: (theme) => this.#play(theme),
    onPlayTrack: (theme, index) => this.#play(theme, index),
    onToggleTracks: (id) => this.#toggleTracks(id),
    onStartRename: (id) => this.#startRename(id),
    onFinishRename: (id, name) => this.#finishRename(id, name),
    onRemove: (theme) => this.#remove(theme),
  };

  constructor({ root, library, playback, chapters }) {
    this.#root = root;
    this.#chapterCatalog = chapters;
    this.#library = library;
    this.#playback = playback;
  }

  start() {
    this.#build();
    this.#playback.subscribe((state) => this.#onPlaybackChange(state));
    this.#playback.subscribeProgress((progress) => this.#bar.renderProgress(progress));
    document.addEventListener('keydown', (event) => this.#onKeydown(event));
    document.addEventListener('keyup', (event) => {
      if (event.code === 'Space' && !isTyping(event.target)) event.preventDefault();
    });

    this.#renderThemes();
    this.#renderBar(this.#playback.getState());
    this.#library.list().forEach((theme) => this.#hydrateTitles(theme.id));
  }

  #build() {
    this.#form = createAddThemeForm({ onSubmit: (input) => this.#addTheme(input) });
    this.#loopPanel = new LoopPanel({
      onSelect: (loop) => this.#playback.setLoop(loop),
      onToggle: (isOpen) => {
        this.#bar.setLoopExpanded(isOpen);
        if (isOpen) this.#refreshLoopPanel();
      },
    });
    this.#bar = new NowPlayingBar({
      loopPanel: this.#loopPanel.element,
      onLoopToggle: () => this.#loopPanel.toggle(),
      onToggle: () => this.#playback.togglePause(),
      onPrevious: () => this.#playback.previous(),
      onNext: () => this.#playback.next(),
      onStop: () => this.#playback.stop(),
      onVolume: (volume) => this.#playback.setVolume(volume),
      onCrossfade: (seconds) => this.#playback.setCrossfade(seconds),
    });
    this.#count = h('span', { class: 'section__count' });
    this.#grid = h('div', { class: 'grid' });

    this.#root.append(
      h('header', { class: 'hero' },
        h('div', { class: 'hero__text' },
          h('h1', { class: 'hero__title' }, 'Trilha de Mesa'),
          h('p', { class: 'hero__lead' }, 'Um tema para cada personagem. A música muda com transição suave e fica em loop até a luta acabar.')),
        this.#form.element),
      h('main', { id: 'main', class: 'themes' },
        h('div', { class: 'section__head' }, h('h2', { class: 'section__title' }, 'Seus temas'), this.#count),
        this.#grid),
      h('footer', { class: 'shortcuts' },
        shortcut('Espaço', 'pausa ou continua'),
        shortcut('1 a 9', 'toca o tema'),
        shortcut('N', 'próxima faixa'),
        shortcut('P', 'faixa anterior'),
        shortcut('L', 'loop da faixa')),
      this.#bar.element,
      this.#toasts.element,
    );
  }

  // ----- ações do usuário -----

  async #addTheme({ link, name }) {
    this.#form.setBusy(true);
    try {
      const theme = await this.#library.addFromLink(link, name);
      this.#form.reset();
      this.#toasts.show(`"${theme.name}" foi adicionado.`, { tone: 'success' });
      this.#renderThemes();
      this.#hydrateTitles(theme.id);
    } catch (error) {
      this.#form.setError(error instanceof DomainError ? error.message : 'Não consegui adicionar. Tente de novo.');
    } finally {
      this.#form.setBusy(false);
    }
  }

  /** Sem trackIndex, o tema retoma de onde parou. */
  #play(theme, trackIndex) {
    const state = this.#playback.getState();
    const isCurrentTheme = state.themeId === theme.id && state.status !== PlaybackStatus.IDLE;
    if (isCurrentTheme && (trackIndex === undefined || trackIndex === state.trackIndex)) {
      this.#playback.togglePause();
      return;
    }
    this.#playback.playTheme(theme, trackIndex);
  }

  #toggleTracks(id) {
    if (!this.#expandedIds.delete(id)) this.#expandedIds.add(id);
    this.#renderThemes();
  }

  #startRename(id) {
    this.#editingId = id;
    this.#renderThemes({ force: true });
    const input = this.#grid.querySelector('.card__rename');
    input?.focus();
    input?.select();
  }

  #finishRename(id, name) {
    this.#editingId = null;
    if (name !== null) {
      try {
        this.#library.rename(id, name);
      } catch (error) {
        this.#toasts.show(error.message, { tone: 'warning' });
      }
    }
    this.#renderThemes();
    this.#renderBar(this.#playback.getState());
  }

  #remove(theme) {
    if (this.#playback.getState().themeId === theme.id) this.#playback.stop();
    const removed = this.#library.remove(theme.id);
    this.#expandedIds.delete(theme.id);
    this.#renderThemes();
    this.#toasts.show(`"${theme.name}" foi removido.`, {
      actionLabel: 'Desfazer',
      onAction: () => {
        this.#library.restore(removed);
        this.#renderThemes();
      },
    });
  }

  async #hydrateTitles(themeId) {
    await this.#library.hydrateTitles(themeId, () => this.#scheduleRender());
    this.#scheduleRender();
  }

  // ----- reação ao estado -----

  #onPlaybackChange(state) {
    this.#renderThemes();
    this.#renderBar(state);
    this.#refreshLoopPanel();
    this.#showNotice(state.notice);
  }

  #showNotice(notice) {
    if (!notice || notice.id === this.#lastNoticeId) return;
    this.#lastNoticeId = notice.id;
    this.#toasts.show(notice.message, { tone: 'warning' });
  }

  #onKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;

    if (event.code === 'Space') {
      event.preventDefault();
      this.#playback.togglePause();
    } else if (/^[1-9]$/.test(event.key)) {
      const theme = this.#library.list()[Number(event.key) - 1];
      if (theme) this.#play(theme);
    } else if (event.key.toLowerCase() === 'n') {
      this.#playback.next();
    } else if (event.key.toLowerCase() === 'p') {
      this.#playback.previous();
    } else if (event.key.toLowerCase() === 'l' && this.#playback.getState().status !== PlaybackStatus.IDLE) {
      this.#loopPanel.toggle();
    }
  }

  // ----- desenho -----

  #scheduleRender() {
    clearTimeout(this.#renderTimer);
    this.#renderTimer = setTimeout(() => {
      this.#renderThemes();
      this.#renderBar(this.#playback.getState());
    }, RENDER_DEBOUNCE_MS);
  }

  /** Aviso discreto para problemas de gravação, no máximo um a cada 30 segundos. */
  warn(message) {
    const now = Date.now();
    if (now - this.#lastWarnAt < WARN_INTERVAL_MS) return;
    this.#lastWarnAt = now;
    this.#toasts.show(message, { tone: 'warning', durationMs: 10000 });
  }

  /** Redesenha o painel de loop e busca os marcadores da faixa atual quando preciso. */
  #refreshLoopPanel() {
    if (!this.#loopPanel.isOpen) return;
    const state = this.#playback.getState();
    const theme = state.themeId ? this.#library.find(state.themeId) : null;
    if (!theme || state.status === PlaybackStatus.IDLE) {
      this.#loopPanel.close();
      return;
    }

    const { videoId } = theme.tracks[state.trackIndex];
    if (videoId !== this.#chapterView.videoId) this.#loadChapters(videoId);
    this.#loopPanel.render({ theme, trackIndex: state.trackIndex, loop: state.loop, chapters: this.#chapterView });
  }

  async #loadChapters(videoId) {
    this.#chapterView = { videoId, status: ChaptersStatus.LOADING, items: [] };
    try {
      const chapters = await this.#chapterCatalog.get(videoId);
      this.#updateChapterView(videoId, {
        status: chapters.length ? ChaptersStatus.READY : ChaptersStatus.EMPTY,
        items: sectionsFromChapters(chapters),
      });
    } catch {
      // Sem videoId guardado, abrir o painel de novo tenta outra vez.
      this.#updateChapterView(videoId, { status: ChaptersStatus.ERROR, items: [] }, { retry: true });
    }
  }

  #updateChapterView(videoId, view, { retry = false } = {}) {
    if (this.#chapterView.videoId !== videoId) return;
    this.#chapterView = { videoId: retry ? null : videoId, ...view };
    this.#refreshLoopPanelWith(view);
  }

  #refreshLoopPanelWith(view) {
    if (!this.#loopPanel.isOpen) return;
    const state = this.#playback.getState();
    const theme = state.themeId ? this.#library.find(state.themeId) : null;
    if (theme) this.#loopPanel.render({ theme, trackIndex: state.trackIndex, loop: state.loop, chapters: view });
  }

  #renderBar(state) {
    const theme = state.themeId ? this.#library.find(state.themeId) : null;
    this.#bar.render(state, theme);
  }

  /** Durante a edição do nome, só redesenha se for forçado (não destrói o campo). */
  #renderThemes({ force = false } = {}) {
    if (this.#editingId !== null && !force) return;

    const themes = this.#library.list();
    const state = this.#playback.getState();
    this.#rememberScroll();
    this.#count.textContent = themes.length ? String(themes.length) : '';

    if (themes.length === 0) {
      this.#grid.replaceChildren(emptyState());
      return;
    }

    this.#grid.replaceChildren(
      ...themes.map((theme, index) => createThemeCard(theme, this.#viewFor(theme, index, state), this.#cardActions)),
    );
    this.#restoreScroll(state);
  }

  #viewFor(theme, index, state) {
    const isCurrent = state.themeId === theme.id;
    return {
      index,
      isCurrent,
      isPlaying: isCurrent && state.status === PlaybackStatus.PLAYING,
      isLoading: isCurrent && state.loading,
      trackIndex: isCurrent ? state.trackIndex : -1,
      isExpanded: this.#expandedIds.has(theme.id),
      isEditing: this.#editingId === theme.id,
    };
  }

  #rememberScroll() {
    for (const list of this.#grid.querySelectorAll('.tracklist')) {
      this.#scrollByTheme.set(list.dataset.themeId, list.scrollTop);
    }
  }

  /** Mantém a rolagem das playlists e centraliza a faixa nova quando ela muda. */
  #restoreScroll(state) {
    const trackKey = `${state.themeId}:${state.trackIndex}`;
    const trackChanged = trackKey !== this.#lastTrackKey;
    this.#lastTrackKey = trackKey;

    for (const list of this.#grid.querySelectorAll('.tracklist')) {
      list.scrollTop = this.#scrollByTheme.get(list.dataset.themeId) ?? 0;
      const current = list.querySelector('.track.is-current');
      if (trackChanged && current) {
        list.scrollTop = current.offsetTop - (list.clientHeight - current.offsetHeight) / 2;
      }
    }
  }
}

function emptyState() {
  return h('div', { class: 'empty' },
    h('span', { class: 'empty__icon' }, icon('music', 28)),
    h('h3', { class: 'empty__title' }, 'Nenhum tema por aqui ainda'),
    h('p', { class: 'empty__text' }, 'Cole um link do YouTube acima e clique em Adicionar tema. Se for uma playlist, todas as faixas aparecem no cartão.'));
}

function shortcut(keys, description) {
  return h('span', { class: 'shortcut' }, h('kbd', {}, keys), description);
}

function isTyping(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
