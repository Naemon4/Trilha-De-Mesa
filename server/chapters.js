const VIDEO_ID = /^[\w-]{11}$/;
const CACHE_LIMIT = 500;
const REQUEST_TIMEOUT_MS = 10000;
const MIN_CHAPTERS = 2;

// Capítulos oficiais embutidos na página: {"chapterRenderer":{"title":{"simpleText":"..."},"timeRangeStartMillis":0
const OFFICIAL_CHAPTER = /"chapterRenderer":\{"title":\{"simpleText":"((?:[^"\\]|\\.)*)"\},"timeRangeStartMillis":(\d+)/g;
const DESCRIPTION = /"shortDescription":"((?:[^"\\]|\\.)*)"/;
// Linha da descrição que começa com tempo: "1:23 Título", "[01:02:03] - Título"
const TIMESTAMP_LINE = /^\s*[[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-:|\u2013\u2014]?\s*(.+?)\s*$/;

const cache = new Map();

export class InvalidVideoIdError extends Error {}

/** Busca os marcadores (capítulos) de um vídeo lendo a página pública dele. */
export async function fetchChapters(videoId) {
  if (!VIDEO_ID.test(videoId)) throw new InvalidVideoIdError('ID de vídeo inválido');
  if (cache.has(videoId)) return cache.get(videoId);

  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=pt-BR`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      Cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`YouTube respondeu ${response.status}`);

  const chapters = parseChapters(await response.text());
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(videoId, chapters);
  return chapters;
}

/** Retorna [{ title, start }] com start em segundos, ou [] se não houver marcadores. */
export function parseChapters(html) {
  const official = normalize(
    [...html.matchAll(OFFICIAL_CHAPTER)].map((match) => ({
      title: decode(match[1]),
      start: Number(match[2]) / 1000,
    })),
  );
  if (official.length >= MIN_CHAPTERS) return official;

  const description = html.match(DESCRIPTION);
  return description ? parseDescription(decode(description[1])) : [];
}

export function parseDescription(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(TIMESTAMP_LINE);
    if (match) entries.push({ title: match[2], start: toSeconds(match[1]) });
  }
  const chapters = normalize(entries);
  return chapters.length >= MIN_CHAPTERS ? chapters : [];
}

function toSeconds(timestamp) {
  return timestamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function decode(jsonEscaped) {
  try {
    return JSON.parse(`"${jsonEscaped}"`);
  } catch {
    return jsonEscaped;
  }
}

/** Remove repetidos e mantém só os tempos em ordem crescente. */
function normalize(entries) {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const result = [];
  for (const entry of sorted) {
    if (!entry.title.trim()) continue;
    if (result.length && entry.start <= result.at(-1).start) continue;
    result.push({ title: entry.title.trim(), start: Math.floor(entry.start) });
  }
  return result;
}
