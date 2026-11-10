const DEFAULTS = Object.freeze({ volume: 0.8, crossfadeSeconds: 4 });

export class JsonSettingsRepository {
  constructor(document) {
    this.document = document;
  }

  load() {
    return { ...DEFAULTS, ...this.document.get('settings', {}) };
  }

  save(settings) {
    this.document.set('settings', settings);
  }
}
