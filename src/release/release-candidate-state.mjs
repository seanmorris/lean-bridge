const states = Object.freeze([
	"created"
	, "analyze"
	, "generate"
	, "build-a"
	, "build-b"
	, "compare"
	, "report"
	, "authorize"
	, "publish"
]);

/**
 * Reports release candidate state failures with stable machine-readable codes and structured diagnostic context.
 */
export class ReleaseCandidateStateError extends Error
{
	/**
   * Initializes the error used to report release candidate state failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
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
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-state-evidence", `${label} must be a SHA-256 identity`);
};

/**
 * Enforces the ordered release-candidate state machine and records the evidence for each transition.
 */
export class ReleaseCandidateState
{
	/**
   * Tracks the current position in the ordered release-candidate state machine.
   */
	#index = 0;
	/**
   * Stores the content-derived candidate identity once enough evidence exists to compute it.
   */
	#candidateId = null;
	/**
   * Stores immutable evidence for every accepted release-candidate transition.
   */
	#history;

	/**
   * Initializes a release candidate at its first state using the verified source identity.
   *
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.sourceIdentitySha256 - Expected SHA-256 identity used to detect drift in source identity.
   */
	constructor({ sourceIdentitySha256 })
	{
		digest(sourceIdentitySha256, "source identity");
		this.#history = [{ state: "created", evidenceSha256: sourceIdentitySha256, candidateId: null }];
	}

	/**
   * Applies one allowed state transition and records immutable evidence for the change.
   *
   * @param root0 - Requested lifecycle state and supporting evidence applied to the release candidate.
   * @param root0.state - Candidate lifecycle state requested by the transition.
   * @param root0.evidenceSha256 - Expected SHA-256 identity used to detect drift in evidence.
   * @param root0.candidateId - Stable identifier for the candidate.
   */
	transition({ state, evidenceSha256, candidateId = this.#candidateId })
	{
		const expected = states[this.#index + 1];
		if(state !== expected)
		{
			fail("invalid-release-transition", `Release candidate must move from ${states[this.#index]} to ${expected}`, {
				requested: state
			});
		}
		digest(evidenceSha256, `${state} evidence`);
		if(state === "compare")
		{
			digest(candidateId, "compared candidate");
			this.#candidateId = candidateId;
		} else if(this.#candidateId === null && candidateId !== null)
		{
			fail("premature-candidate-identity", `Candidate identity cannot be assigned during ${state}`);
		} else if(this.#candidateId !== null && candidateId !== this.#candidateId)
		{
			fail("cross-candidate-transition", `${state} evidence belongs to another release candidate`);
		}
		this.#index += 1;
		this.#history.push({ state, evidenceSha256, candidateId: this.#candidateId });
		return this.snapshot();
	}

	/**
   * Returns an immutable diagnostic view of current state without exposing mutable registry internals.
   */
	snapshot()
	{
		return Object.freeze({
			current: states[this.#index]
			, candidateId: this.#candidateId
			, history: Object.freeze(this.#history.map(item => Object.freeze({ ...item })))
		});
	}
}
