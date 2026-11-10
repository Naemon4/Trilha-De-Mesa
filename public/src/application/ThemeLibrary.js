import { YouTubeLink } from '../domain/YouTubeLink.js';
import { ThemeKind, createTheme, createTrack, renameTheme } from '../domain/Theme.js';
import { mapWithConcurrency } from './concurrency.js';

const TITLE_CONCURRENCY = 6;

/** Casos de uso do catálogo de temas: adicionar, renomear, remover, desfazer. */
export class ThemeLibrary {
  /** @param {{ repository: import('./ports.js').ThemeRepository, metadata: import('./ports.js').MetadataGateway, playlists: import('./ports.js').PlaylistGateway }} deps */
  constructor({ repository, metadata, playlists }) {
    this.repository = repository;
    this.metadata = metadata;
    this.playlists = playlists;
  }

  list() {
    return this.repository.findAll();
  }

  find(id) {
    return this.list().find((theme) => theme.id === id);
  }

  async addFromLink(rawLink, customName = '') {
    const link = YouTubeLink.parse(rawLink);
    const draft = link.isPlaylist
      ? await this.#draftFromPlaylist(link)
      : await this.#draftFromVideo(link);

    const theme = createTheme({ ...draft, name: customName.trim() || draft.name });
    this.repository.saveAll([...this.list(), theme]);
    return theme;
  }

  rename(id, name) {
    this.#replace(id, (theme) => renameTheme(theme, name));
  }

  remove(id) {
    const themes = this.list();
    const index = themes.findIndex((theme) => theme.id === id);
    if (index < 0) return null;
    const [theme] = themes.splice(index, 1);
    this.repository.saveAll(themes);
    return { theme, index };
  }

  restore({ theme, index }) {
    const themes = this.list().filter((item) => item.id !== theme.id);
    themes.splice(Math.min(index, themes.length), 0, theme);
    this.repository.saveAll(themes);
  }

  /** Busca em segundo plano os títulos das faixas que ainda não têm nome. */
  async hydrateTitles(themeId, onProgress = () => {}) {
    const tracks = this.find(themeId)?.tracks ?? [];
    const missing = [...new Set(tracks.filter((track) => !track.title).map((track) => track.videoId))];

    await mapWithConcurrency(missing, TITLE_CONCURRENCY, async (videoId) => {
      const title = await this.metadata.fetchVideoTitle(videoId);
      if (title && this.#setTrackTitle(themeId, videoId, title)) onProgress();
    });
  }

  async #draftFromVideo(link) {
    const title = await this.metadata.fetchVideoTitle(link.videoId);
    return {
      name: title ?? 'Novo tema',
      kind: ThemeKind.VIDEO,
      tracks: [createTrack(link.videoId, title ?? '')],
    };
  }

  async #draftFromPlaylist(link) {
    const [videoIds, title] = await Promise.all([
      this.playlists.fetchVideoIds(link.playlistId),
      this.metadata.fetchPlaylistTitle(link.playlistId),
    ]);
    return {
      name: title ?? 'Nova playlist',
      kind: ThemeKind.PLAYLIST,
      tracks: videoIds.map((videoId) => createTrack(videoId)),
    };
  }

  #setTrackTitle(themeId, videoId, title) {
    let changed = false;
    this.#replace(themeId, (theme) => ({
      ...theme,
      tracks: theme.tracks.map((track) => {
        if (track.videoId !== videoId) return track;
        changed = true;
        return { ...track, title };
      }),
    }));
    return changed;
  }

  #replace(id, transform) {
    const themes = this.list();
    const index = themes.findIndex((theme) => theme.id === id);
    if (index < 0) return false;
    themes[index] = transform(themes[index]);
    this.repository.saveAll(themes);
    return true;
  }
}
