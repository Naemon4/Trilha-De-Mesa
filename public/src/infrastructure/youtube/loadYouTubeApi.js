let apiPromise = null;

/** Carrega o script da IFrame API do YouTube uma única vez. */
export function loadYouTubeApi() {
  apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.();
      resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('Não foi possível carregar a API do YouTube.'));
    };
    document.head.append(script);
  });
  return apiPromise;
}
