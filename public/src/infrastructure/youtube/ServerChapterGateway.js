/** Pede os marcadores ao servidor local, que lê a página do vídeo. */
export class ServerChapterGateway {
  async fetchChapters(videoId) {
    const response = await fetch(`/api/chapters?v=${encodeURIComponent(videoId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { chapters } = await response.json();
    return chapters.filter((chapter) => chapter.title && Number.isFinite(chapter.start));
  }
}
