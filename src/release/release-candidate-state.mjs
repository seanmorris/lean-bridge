const states = Object.freeze([
  "created",
  "analyze",
  "generate",
  "build-a",
  "build-b",
  "compare",
  "report",
  "authorize",
  "publish",
]);

export class ReleaseCandidateStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReleaseCandidateStateError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new ReleaseCandidateStateError(code, message, details);
};

const digest = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-state-evidence", `${label} must be a SHA-256 identity`);
};

export class ReleaseCandidateState {
  #index = 0;
  #candidateId = null;
  #history;

  constructor({ sourceIdentitySha256 }) {
    digest(sourceIdentitySha256, "source identity");
    this.#history = [{ state: "created", evidenceSha256: sourceIdentitySha256, candidateId: null }];
  }

  transition({ state, evidenceSha256, candidateId = this.#candidateId }) {
    const expected = states[this.#index + 1];
    if (state !== expected) {
      fail("invalid-release-transition", `Release candidate must move from ${states[this.#index]} to ${expected}`, {
        requested: state,
      });
    }
    digest(evidenceSha256, `${state} evidence`);
    if (state === "compare") {
      digest(candidateId, "compared candidate");
      this.#candidateId = candidateId;
    } else if (this.#candidateId === null && candidateId !== null) {
      fail("premature-candidate-identity", `Candidate identity cannot be assigned during ${state}`);
    } else if (this.#candidateId !== null && candidateId !== this.#candidateId) {
      fail("cross-candidate-transition", `${state} evidence belongs to another release candidate`);
    }
    this.#index += 1;
    this.#history.push({ state, evidenceSha256, candidateId: this.#candidateId });
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({
      current: states[this.#index],
      candidateId: this.#candidateId,
      history: Object.freeze(this.#history.map(item => Object.freeze({ ...item }))),
    });
  }
}
