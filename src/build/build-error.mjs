export class CanonicalBuildError extends Error {
  constructor(code, message, { hint = null, details = {} } = {}) {
    super(message);
    this.name = "CanonicalBuildError";
    this.code = code;
    this.hint = hint;
    this.details = details;
  }
}
