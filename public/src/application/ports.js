/**
 * Contratos (portas) que a camada de aplicação espera da infraestrutura.
 * Nada aqui é executado: são apenas tipos para documentação e autocomplete.
 */

/**
 * @typedef {{ videoId: string, title: string }} Track
 * @typedef {{ id: string, name: string, kind: 'video'|'playlist', tracks: Track[], createdAt: number }} Theme
 * @typedef {{ volume: number, crossfadeSeconds: number }} Settings
 */

/**
 * @typedef {Object} ThemeRepository
 * @property {() => Theme[]} findAll
 * @property {(themes: Theme[]) => void} saveAll
 */

/**
 * @typedef {Object} SettingsRepository
 * @property {() => Settings} load
 * @property {(settings: Settings) => void} save
 */

/**
 * @typedef {Object} PlaybackMemoryRepository
 * @property {() => Object} load
 * @property {(memory: Object) => void} save
 */

/**
 * @typedef {Object} ChapterGateway
 * @property {(videoId: string) => Promise<{ title: string, start: number }[]>} fetchChapters
 */

/**
 * @typedef {Object} MetadataGateway
 * @property {(videoId: string) => Promise<string|null>} fetchVideoTitle
 * @property {(playlistId: string) => Promise<string|null>} fetchPlaylistTitle
 */

/**
 * @typedef {Object} PlaylistGateway
 * @property {(playlistId: string) => Promise<string[]>} fetchVideoIds
 */

/**
 * @typedef {Object} AudioEngine
 * @property {(videoId: string, fadeMs: number, startSeconds?: number) => Promise<void>} transitionTo
 *   Resolve quando a nova faixa começou a tocar (o fade continua em segundo plano).
 * @property {(fadeMs: number) => Promise<void>} fadeOut
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {(volume: number) => void} setVolume  0 a 1
 * @property {(listener: (p: { position: number, duration: number }) => void) => void} onProgress
 * @property {(listener: () => void) => void} onTrackEnded
 */
export {};
