import { DomainError } from './errors.js';

export const ThemeKind = Object.freeze({ VIDEO: 'video', PLAYLIST: 'playlist' });

const MAX_NAME_LENGTH = 60;

export function createTrack(videoId, title = '') {
  return { videoId, title };
}

export function createTheme({ name, kind, tracks }) {
  if (tracks.length === 0) {
    throw new DomainError('O tema precisa ter ao menos uma faixa.');
  }
  return {
    id: generateId(),
    name: normalizeName(name),
    kind,
    tracks,
    createdAt: Date.now(),
  };
}

export function renameTheme(theme, name) {
  return { ...theme, name: normalizeName(name) };
}

function normalizeName(name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  if (!clean) throw new DomainError('Dê um nome ao tema.');
  return clean;
}

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
