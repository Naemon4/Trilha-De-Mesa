// Raiz de composição: o único lugar que conhece todas as camadas e as conecta.
import { ThemeLibrary } from './application/ThemeLibrary.js';
import { PlaybackService } from './application/PlaybackService.js';
import { PlaybackMemory } from './application/PlaybackMemory.js';
import { ChapterCatalog } from './application/ChapterCatalog.js';
import { CrossfadeAudioEngine } from './infrastructure/youtube/CrossfadeAudioEngine.js';
import { ServerChapterGateway } from './infrastructure/youtube/ServerChapterGateway.js';
import { OEmbedMetadataGateway } from './infrastructure/youtube/OEmbedMetadataGateway.js';
import { YouTubePlaylistResolver } from './infrastructure/youtube/YouTubePlaylistResolver.js';
import { JsonFileDocument } from './infrastructure/storage/JsonFileDocument.js';
import { JsonThemeRepository } from './infrastructure/storage/JsonThemeRepository.js';
import { JsonSettingsRepository } from './infrastructure/storage/JsonSettingsRepository.js';
import { JsonPlaybackMemoryRepository } from './infrastructure/storage/JsonPlaybackMemoryRepository.js';
import { migrateLegacyStorage } from './infrastructure/storage/migrateLegacyStorage.js';
import { App } from './presentation/App.js';

const store = new JsonFileDocument();
let loadFailed = false;
try {
  await store.load();
  migrateLegacyStorage(store, window.localStorage);
} catch {
  loadFailed = true;
}

const library = new ThemeLibrary({
  repository: new JsonThemeRepository(store),
  metadata: new OEmbedMetadataGateway(),
  playlists: new YouTubePlaylistResolver(),
});

const memory = new PlaybackMemory(new JsonPlaybackMemoryRepository(store));
// Descarta posições de temas que já foram removidos em sessões anteriores.
memory.retainOnly(library.list().map((theme) => theme.id));

const playback = new PlaybackService({
  engine: new CrossfadeAudioEngine({ host: document.getElementById('player-host') }),
  settingsRepository: new JsonSettingsRepository(store),
  memory,
});

const app = new App({
  root: document.getElementById('app'),
  library,
  playback,
  chapters: new ChapterCatalog(new ServerChapterGateway()),
});
app.start();

store.onError(() => app.warn('Não consegui salvar no arquivo. Confira se a janela do servidor continua aberta.'));
if (loadFailed) {
  app.warn('Não consegui ler o arquivo de dados, então nada será salvo nesta sessão (seus temas no disco continuam intactos). Abra o app pelo arquivo Iniciar e recarregue a página.');
}
