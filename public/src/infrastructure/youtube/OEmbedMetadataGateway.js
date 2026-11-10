const OEMBED_URL = 'https://www.youtube.com/oembed';

/** Busca títulos pelo oEmbed público do YouTube (sem chave de API). */
export class OEmbedMetadataGateway {
  fetchVideoTitle(videoId) {
    return this.#fetchTitle(`https://www.youtube.com/watch?v=${videoId}`);
  }

  fetchPlaylistTitle(playlistId) {
    return this.#fetchTitle(`https://www.youtube.com/playlist?list=${playlistId}`);
  }

  async #fetchTitle(resourceUrl) {
    try {
      const response = await fetch(`${OEMBED_URL}?format=json&url=${encodeURIComponent(resourceUrl)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.title ?? null;
    } catch {
      return null;
    }
  }
}
