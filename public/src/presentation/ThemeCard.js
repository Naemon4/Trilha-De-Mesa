import { h } from './dom.js';
import { icon, equalizer } from './icons.js';
import { thumbnailUrl, trackLabel, countLabel } from './format.js';
import { ThemeKind } from '../domain/Theme.js';

const MAX_HOTKEY_INDEX = 9;

/**
 * Cartão de um tema. Função pura de (tema, estado visual) para DOM.
 * view: { index, isCurrent, isPlaying, isLoading, trackIndex, isExpanded, isEditing }
 */
export function createThemeCard(theme, view, actions) {
  const isPlaylist = theme.kind === ThemeKind.PLAYLIST;
  const classes = ['card', view.isCurrent && 'is-current', view.isPlaying && 'is-playing', view.isExpanded && 'is-expanded'];

  return h(
    'article',
    { class: classes.filter(Boolean).join(' '), 'aria-current': view.isCurrent ? 'true' : null },
    renderCover(theme, view, isPlaylist, actions),
    renderBody(theme, view, isPlaylist, actions),
    view.isExpanded && isPlaylist && renderTracklist(theme, view, actions),
  );
}

function renderCover(theme, view, isPlaylist, actions) {
  const coverTrack = theme.tracks[Math.max(view.trackIndex, 0)] ?? theme.tracks[0];
  const showPause = view.isCurrent && view.isPlaying;

  return h(
    'button',
    { class: 'card__cover', type: 'button', 'aria-label': coverLabel(theme, view), onClick: () => actions.onPlay(theme) },
    h('img', { class: 'card__image', src: thumbnailUrl(coverTrack.videoId), alt: '', loading: 'lazy' }),
    h('span', { class: 'card__shade' }),
    view.index < MAX_HOTKEY_INDEX &&
      h('kbd', { class: 'card__key', title: `Atalho: tecla ${view.index + 1}` }, view.index + 1),
    isPlaylist &&
      h('span', { class: 'card__chip' }, icon('list', 14), countLabel(theme.tracks.length, 'faixa', 'faixas')),
    view.isCurrent && !view.isLoading && equalizer(),
    h('span', { class: `card__action${view.isLoading ? ' is-busy' : ''}` }, icon(showPause ? 'pause' : 'play', 22)),
  );
}

function coverLabel(theme, view) {
  if (view.isCurrent && view.isPlaying) return `Pausar ${theme.name}`;
  if (view.isCurrent) return `Continuar ${theme.name}`;
  return `Tocar ${theme.name}`;
}

function renderBody(theme, view, isPlaylist, actions) {
  return h(
    'div',
    { class: 'card__body' },
    renderTitle(theme, view, actions),
    h('p', { class: 'card__meta' }, isPlaylist ? 'Playlist completa' : 'Vídeo único, em loop'),
    h(
      'div',
      { class: 'card__tools' },
      isPlaylist &&
        h('button', {
          class: 'btn btn--ghost btn--small',
          type: 'button',
          'aria-expanded': String(view.isExpanded),
          onClick: () => actions.onToggleTracks(theme.id),
        }, 'Faixas', icon('chevron', 16)),
      h('span', { class: 'card__spacer' }),
      iconButton('pencil', `Renomear ${theme.name}`, () => actions.onStartRename(theme.id)),
      iconButton('trash', `Remover ${theme.name}`, () => actions.onRemove(theme), 'danger'),
    ),
  );
}

function renderTitle(theme, view, actions) {
  if (!view.isEditing) {
    return h('h3', { class: 'card__name', onDblclick: () => actions.onStartRename(theme.id) }, theme.name);
  }

  let finished = false;
  const finish = (input, commit) => {
    if (finished) return;
    finished = true;
    actions.onFinishRename(theme.id, commit ? input.value : null);
  };

  return h('input', {
    class: 'card__rename',
    type: 'text',
    maxlength: '60',
    'aria-label': 'Nome do tema',
    value: theme.name,
    onKeydown: (event) => {
      if (event.key === 'Enter') finish(event.currentTarget, true);
      if (event.key === 'Escape') finish(event.currentTarget, false);
    },
    onBlur: (event) => finish(event.currentTarget, true),
  });
}

function renderTracklist(theme, view, actions) {
  return h(
    'ol',
    { class: 'tracklist', 'data-theme-id': theme.id, 'aria-label': `Faixas de ${theme.name}` },
    theme.tracks.map((track, index) => {
      const isCurrentTrack = view.isCurrent && view.trackIndex === index;
      return h(
        'li',
        {},
        h(
          'button',
          {
            class: `track${isCurrentTrack ? ' is-current' : ''}`,
            type: 'button',
            'aria-current': isCurrentTrack ? 'true' : null,
            onClick: () => actions.onPlayTrack(theme, index),
          },
          h('span', { class: 'track__number' }, index + 1),
          h('span', { class: `track__title${track.title ? '' : ' is-pending'}` }, track.title || trackLabel(track, index)),
          isCurrentTrack && equalizer(),
        ),
      );
    }),
  );
}

function iconButton(name, label, onClick, tone = '') {
  return h(
    'button',
    { class: `btn-icon${tone ? ` btn-icon--${tone}` : ''}`, type: 'button', 'aria-label': label, title: label, onClick },
    icon(name, 18),
  );
}
