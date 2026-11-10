import { InvalidLinkError } from './errors.js';

const VIDEO_ID = /^[\w-]{11}$/;
const PLAYLIST_ID = /^[\w-]{12,}$/;
const AUTO_MIX_PREFIX = 'RD';
const EMBED_PATH_KINDS = ['embed', 'shorts', 'live', 'v'];

/** Value object: um link do YouTube já validado (vídeo e/ou playlist). */
export class YouTubeLink {
  constructor({ videoId = null, playlistId = null }) {
    this.videoId = videoId;
    this.playlistId = playlistId;
    Object.freeze(this);
  }

  get isPlaylist() {
    return this.playlistId !== null;
  }

  static parse(raw) {
    const url = toUrl(raw);
    if (!url || !isYouTubeHost(url.hostname)) {
      throw new InvalidLinkError('Cole um link válido do YouTube.');
    }

    const videoId = findVideoId(url);
    const playlistId = findPlaylistId(url);
    if (!videoId && !playlistId) {
      throw new InvalidLinkError('Não encontrei um vídeo ou uma playlist nesse link.');
    }
    return new YouTubeLink({ videoId, playlistId });
  }
}

function toUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function isYouTubeHost(hostname) {
  return ['youtube.com', 'youtu.be'].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function findVideoId(url) {
  const { hostname, pathname, searchParams } = url;
  let candidate = null;

  if (hostname.endsWith('youtu.be')) {
    candidate = pathname.split('/')[1];
  } else if (pathname === '/watch') {
    candidate = searchParams.get('v');
  } else {
    const [, kind, id] = pathname.split('/');
    if (EMBED_PATH_KINDS.includes(kind)) candidate = id;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

// Mixes automáticos (RD...) não podem ser listados, então são tratados como vídeo.
function findPlaylistId(url) {
  const id = url.searchParams.get('list');
  if (!id || id.startsWith(AUTO_MIX_PREFIX)) return null;
  return PLAYLIST_ID.test(id) ? id : null;
}
