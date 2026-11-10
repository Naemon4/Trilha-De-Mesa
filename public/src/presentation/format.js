export const thumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

export const trackLabel = (track, index) => track.title || `Faixa ${index + 1}`;

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatSeconds(value) {
  return value === 0 ? 'Sem transição' : `${String(value).replace('.', ',')} s`;
}

export const countLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;
