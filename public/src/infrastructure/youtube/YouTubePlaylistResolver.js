import { PlaylistUnavailableError } from '../../domain/errors.js';
import { loadYouTubeApi } from './loadYouTubeApi.js';

const POLL_MS = 300;
const TIMEOUT_MS = 15000;
const FAILURE_MESSAGE = 'Não consegui ler essa playlist. Confira se ela é pública ou não listada.';

/**
 * Lista os vídeos de uma playlist sem precisar de chave de API:
 * carrega a playlist num player temporário e lê os IDs dele.
 */
export class YouTubePlaylistResolver {
  async fetchVideoIds(playlistId) {
    const YT = await loadYouTubeApi().catch(() => {
      throw new PlaylistUnavailableError('Não consegui falar com o YouTube. Verifique sua conexão.');
    });

    const holder = document.body.appendChild(document.createElement('div'));
    holder.className = 'player-host';
    const mount = holder.appendChild(document.createElement('div'));

    return new Promise((resolve, reject) => {
      let player = null;
      let poller = null;

      const finish = (settle) => {
        clearInterval(poller);
        clearTimeout(timeout);
        player?.destroy();
        holder.remove();
        settle();
      };
      const fail = () => finish(() => reject(new PlaylistUnavailableError(FAILURE_MESSAGE)));
      const timeout = setTimeout(fail, TIMEOUT_MS);

      player = new YT.Player(mount, {
        width: '200',
        height: '200',
        playerVars: { listType: 'playlist', list: playlistId, origin: window.location.origin },
        events: {
          onReady: () => {
            poller = setInterval(() => {
              const ids = player.getPlaylist?.();
              if (ids?.length) finish(() => resolve([...ids]));
            }, POLL_MS);
          },
          onError: fail,
        },
      });
    });
  }
}
