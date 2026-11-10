const LEGACY_THEMES_KEY = 'trilha-de-mesa:themes:v1';
const LEGACY_SETTINGS_KEY = 'trilha-de-mesa:settings:v1';

/** Versão anterior guardava tudo no navegador. Copia para o arquivo uma única vez. */
export function migrateLegacyStorage(document, storage) {
  if (document.get('themes', null) !== null) return false;

  const themes = read(storage, LEGACY_THEMES_KEY);
  if (!Array.isArray(themes) || themes.length === 0) return false;

  document.set('themes', themes);
  const settings = read(storage, LEGACY_SETTINGS_KEY);
  if (settings) document.set('settings', settings);
  document.flush();
  return true;
}

function read(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}
