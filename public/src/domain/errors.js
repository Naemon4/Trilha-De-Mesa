export class DomainError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class InvalidLinkError extends DomainError {}
export class PlaylistUnavailableError extends DomainError {}
export class TrackUnavailableError extends DomainError {}
export class PlayerLoadError extends DomainError {}
