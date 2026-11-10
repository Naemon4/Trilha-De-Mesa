export class JsonThemeRepository {
  constructor(document) {
    this.document = document;
  }

  findAll() {
    const themes = this.document.get('themes', []);
    return Array.isArray(themes) ? themes : [];
  }

  saveAll(themes) {
    this.document.set('themes', themes);
  }
}
