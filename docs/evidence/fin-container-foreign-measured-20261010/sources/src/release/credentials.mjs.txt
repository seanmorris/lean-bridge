/**
 * Implements the credentials module in the release subsystem.
 *
 * @file
 */

const credentialNamePattern = /^[A-Z][A-Z0-9_]*$/;
const safeCodePattern = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * Reports credential boundary failures with stable machine-readable codes and structured diagnostic context.
 */
export class CredentialBoundaryError extends Error
{
	/**
   * Initializes the error used to report credential boundary failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CredentialBoundaryError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new CredentialBoundaryError(code, message, details);
};

const string = (value, label) => {
	if(typeof value !== "string" || value === "") fail("invalid-credential-boundary", `${label} must be a non-empty string`);
};

const credentialNames = (value, label) => {
	if(!Array.isArray(value) || value.some(name => typeof name !== "string" || !credentialNamePattern.test(name)))
	{
		fail("invalid-credential-boundary", `${label} must contain uppercase environment names`);
	}
	const canonical = [...new Set(value)].sort();
	if(JSON.stringify(value) !== JSON.stringify(canonical))
	{
		fail("invalid-credential-boundary", `${label} must use unique canonical order`);
	}
	return canonical;
};

const normalizeProvider = provider => {
	if(provider === null || typeof provider !== "object" || Array.isArray(provider))
	{
		fail("credential-provider-required", "A credential provider is required for external publication");
	}
	string(provider.kind, "credential provider kind");
	if(typeof provider.has !== "function" || typeof provider.read !== "function")
	{
		fail("invalid-credential-provider", "Credential provider must implement has(name) and read(name)");
	}
	return provider;
};

const targetRecords = plan => {
	if(plan === null || typeof plan !== "object" || !Array.isArray(plan.targets) || plan.targets.length === 0)
	{
		fail("invalid-credential-boundary", "Verified publish plan must contain targets");
	}
	const ids = new Set();
	return plan.targets.map((target, index) => {
    if(target === null || typeof target !== "object" || Array.isArray(target))
{
      fail("invalid-credential-boundary", "Publish target must be an object");
}
    if(target.order !== index + 1) fail("invalid-credential-boundary", "Publish target order must be contiguous");
    for(const field of ["ecosystem", "coordinate", "operation", "idempotencyKey"]) string(target[field], `target.${field}`);
    if(!new Set(["publish", "retain"]).has(target.operation))
{
      fail("invalid-credential-boundary", `Unsupported credential operation ${target.operation}`);
}
    if(ids.has(target.idempotencyKey)) fail("invalid-credential-boundary", "Credential targets require unique idempotency keys");
    ids.add(target.idempotencyKey);
    const names = credentialNames(target.credentialEnvironment, `${target.ecosystem} credential requirements`);
    if(target.operation === "publish" && names.length === 0)
{
      fail("invalid-credential-boundary", `${target.ecosystem} registry publication requires a credential name`);
}
    if(target.operation === "retain" && names.length !== 0)
{
      fail("invalid-credential-boundary", `${target.ecosystem} archive retention cannot request credentials`);
}
    return Object.freeze({
      order: target.order
      , ecosystem: target.ecosystem
      , coordinate: target.coordinate
      , operation: target.operation
      , idempotencyKey: target.idempotencyKey
      , names: Object.freeze(names)
    });
	});
};

const targetSelector = target => {
	if(typeof target === "string" && target !== "") return target;
	if(target !== null && typeof target === "object" && typeof target.idempotencyKey === "string")
	{
		return target.idempotencyKey;
	}
	fail("credential-target-required", "Credential access requires a publish target or idempotency key");
};

const valueContainsSecret = (value, secrets, seen = new WeakSet()) => {
	if(typeof value === "string") return [...secrets].some(secret => secret !== "" && value.includes(secret));
	if(Buffer.isBuffer(value)) return valueContainsSecret(value.toString("utf8"), secrets, seen);
	if(value === null || typeof value !== "object") return false;
	if(seen.has(value)) return false;
	seen.add(value);
	if(value instanceof Error)
	{
		if(valueContainsSecret(value.message, secrets, seen)) return true;
		if(typeof value.stack === "string" && valueContainsSecret(value.stack, secrets, seen)) return true;
	}
	for(const [key, item] of Object.entries(value))
	{
		if(valueContainsSecret(key, secrets, seen) || valueContainsSecret(item, secrets, seen)) return true;
	}
	return false;
};

/**
 * Exposes uppercase environment credentials through a minimal presence-and-read interface without enumerating secret values.
 *
 * @param root0 - Named inputs and dependency overrides used to create environment credential provider.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 */
export const createEnvironmentCredentialProvider = ({ environment = process.env } = {}) => Object.freeze({
	kind: "environment"
	, has:
		/**
     * Checks whether the named registry credential is available without reading its secret value.
     *
     * @param name - Uppercase environment-variable name requested by the publication target.
     */
		function(name) {
			if(!credentialNamePattern.test(name)) fail("invalid-credential-name", `Invalid credential environment name ${name}`);
			return typeof environment[name] === "string" && environment[name] !== "";
		}
	, read:
		/**
     * Validates an uppercase credential name and returns its nonempty environment value, failing closed when absent.
     *
     * @param name - Authorized environment-variable name for the required registry credential.
     */
		function(name) {
			if(!credentialNamePattern.test(name)) fail("invalid-credential-name", `Invalid credential environment name ${name}`);
			const value = environment[name];
			if(typeof value !== "string" || value === "")
			{
				fail("publish-credential-missing", `Required credential ${name} is unavailable`, { name });
			}
			return value;
		}
});

/**
 * Mediates one-time credential access while preventing secret values from escaping a publication transaction.
 */
export class PublishCredentialBoundary
{
	/**
   * Holds the opaque credential provider so callers cannot access secret material directly.
   */
	#provider;
	/**
   * Stores the closed set of publication targets authorized for this credential boundary.
   */
	#targets;
	/**
   * Indexes authorized publication targets by stable identifier for constant-time policy checks.
   */
	#byId;
	/**
   * Tracks the credential boundary lifecycle so access cannot continue after completion or failure.
   */
	#state = "created";
	/**
   * Records credential preflight results without retaining any credential values.
   */
	#availability = new Map();
	/**
   * Counts credential reads per target to enforce one-time access.
   */
	#accesses = new Map();
	/**
   * Tracks secret values transiently so accidental leakage can be detected and rejected.
   */
	#observedSecrets = new Set();
	/**
   * Marks whether a credential callback is currently executing inside the protected boundary.
   */
	#active = false;

	/**
   * Initializes a credential boundary from a closed publication plan and an opaque provider.
   *
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.plan - Validated plan that defines the allowed operation and targets.
   * @param root0.provider - Opaque provider used to obtain credentials or generated WIT inputs through a constrained interface.
   */
	constructor({ plan, provider })
	{
		this.#provider = normalizeProvider(provider);
		this.#targets = Object.freeze(targetRecords(plan));
		this.#byId = new Map(this.#targets.map(target => [target.idempotencyKey, target]));
		for(const target of this.#targets) this.#accesses.set(target.idempotencyKey, 0);
	}

	/**
   * Returns state derived from current publish credential boundary state without exposing mutable internals.
   */
	get state()
	{
		return this.#state;
	}

	/**
   * Checks credential availability for every target without reading or retaining secret values.
   */
	async preflight()
	{
		if(this.#state !== "created") fail("credential-boundary-state", `Credential preflight cannot run from ${this.#state}`);
		const missing = [];
		for(const target of this.#targets)
		{
			const unavailable = [];
			for(const name of target.names)
			{
				let available;
				try
				{
					available = await this.#provider.has(name);
				} catch
				{
					this.#state = "blocked";
					fail("credential-provider-failed", `Credential provider could not check ${name}`, { name });
				}
				if(available !== true) unavailable.push(name);
			}
			this.#availability.set(target.idempotencyKey, unavailable.length === 0);
			if(unavailable.length > 0) missing.push({
				order: target.order
				, ecosystem: target.ecosystem
				, coordinate: target.coordinate
				, names: unavailable
			});
		}
		if(missing.length > 0)
		{
			this.#state = "blocked";
			fail("publish-credentials-missing", "Required registry credentials are unavailable", { missing });
		}
		this.#state = "ready";
		return this.snapshot();
	}

	/**
   * Provides one target credential to a bounded callback and verifies that no secret escapes it.
   *
   * @param target - Authorized publication target whose credential names bound the callback.
   * @param operation - Callback allowed to read only the selected target’s credentials.
   */
	async withTarget(target, operation)
	{
		if(this.#state !== "ready") fail("credential-boundary-state", `Credential access cannot run from ${this.#state}`);
		if(this.#active) fail("credential-boundary-busy", "Credential access is limited to one target at a time");
		if(typeof operation !== "function") fail("credential-operation-required", "Credential access requires an operation callback");
		const id = targetSelector(target);
		const record = this.#byId.get(id);
		if(record === undefined) fail("credential-target-unknown", "Credential target is outside the verified publish plan");
		if(record.operation !== "publish") fail("credential-target-has-no-secret", `${record.ecosystem} does not use registry credentials`);
		this.#active = true;
		const values = new Map();
		try
		{
			for(const name of record.names)
			{
				let value;
				try
				{
					value = await this.#provider.read(name);
				} catch(error)
				{
					if(error instanceof CredentialBoundaryError && error.code === "publish-credential-missing")
					{
						this.#state = "blocked";
						fail("publish-credentials-changed", `Credential ${name} disappeared after preflight`, { name, ecosystem: record.ecosystem });
					}
					this.#state = "blocked";
					fail("credential-provider-failed", `Credential provider could not read ${name}`, { name, ecosystem: record.ecosystem });
				}
				if(typeof value !== "string" || value === "")
				{
					this.#state = "blocked";
					fail("invalid-credential-provider-value", `Credential provider returned no value for ${name}`, { name, ecosystem: record.ecosystem });
				}
				values.set(name, value);
				this.#observedSecrets.add(value);
			}
			const view = Object.freeze({
				names: record.names
				, get: name => {
					if(!record.names.includes(name)) fail("credential-name-not-authorized", `${name} is not authorized for ${record.ecosystem}`, { name, ecosystem: record.ecosystem });
					return values.get(name);
				}
			});
			this.#accesses.set(record.idempotencyKey, this.#accesses.get(record.idempotencyKey) + 1);
			let result;
			try
			{
				result = await operation(view);
			} catch(error)
			{
				this.#state = "failed";
				if(error instanceof CredentialBoundaryError) throw error;
				const causeCode = typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : null;
				fail("credential-operation-failed", `Registry operation failed for ${record.coordinate}`, {
					ecosystem: record.ecosystem
					, coordinate: record.coordinate
					, causeCode
				});
			}
			this.assertSafe(result);
			return result;
		} finally
		{
			values.clear();
			this.#active = false;
		}
	}

	/**
   * Rejects values whose reachable data contains a credential observed inside the boundary.
   *
   * @param value - Callback result recursively inspected for any credential observed by this boundary.
   */
	assertSafe(value)
	{
		let containsSecret;
		try
		{
			containsSecret = valueContainsSecret(value, this.#observedSecrets);
		} catch
		{
			this.#state = "failed";
			fail("credential-output-uninspectable", "Registry output could not be inspected for credential values");
		}
		if(containsSecret)
		{
			this.#state = "failed";
			fail("credential-value-leak", "Registry output contains a credential value");
		}
		return true;
	}

	/**
   * Closes the credential boundary after verifying that each required target was accessed exactly once.
   */
	complete()
	{
		if(this.#state !== "ready") fail("credential-boundary-state", `Credential boundary cannot complete from ${this.#state}`);
		const unused = this.#targets
      .filter(target => target.operation === "publish" && this.#accesses.get(target.idempotencyKey) === 0)
      .map(target => ({ ecosystem: target.ecosystem, coordinate: target.coordinate }));
		if(unused.length > 0)
		{
			this.#state = "failed";
			fail("publisher-skipped-credential-boundary", "Registry publisher skipped the credential boundary", { unused });
		}
		this.#state = "complete";
		return this.snapshot();
	}

	/**
   * Converts an arbitrary provider failure into a credential-free diagnostic error.
   *
   * @param error - Error or rejection value to normalize and propagate.
   */
	sanitize(error)
	{
		try
		{
			this.assertSafe(error);
		} catch(leak)
		{
			return leak;
		}
		if(error instanceof CredentialBoundaryError) return error;
		this.#state = "failed";
		const causeCode = typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : null;
		return new CredentialBoundaryError(
			"registry-publisher-failed",
			"Registry publisher failed after credential preflight",
			{ causeCode },
		);
	}

	/**
   * Returns an immutable diagnostic view of current state without exposing mutable registry internals.
   */
	snapshot()
	{
		const status = new Set(["ready", "complete", "blocked", "failed"]).has(this.#state) ? this.#state : "ready";
		return Object.freeze({
			schemaVersion: 1
			, status
			, providerKind: this.#provider.kind
			, valuesRead: [...this.#accesses.values()].some(count => count > 0)
			, valuesRetained: false
			, targets: Object.freeze(this.#targets.map(target => Object.freeze({
				order: target.order
				, ecosystem: target.ecosystem
				, coordinate: target.coordinate
				, requiredNames: target.names
				, available: this.#availability.get(target.idempotencyKey) === true
				, accessCount: this.#accesses.get(target.idempotencyKey)
			})))
		});
	}

	/**
   * Moves the credential boundary into its terminal failed state.
   */
	markFailed()
	{
		if(!new Set(["blocked", "closed"]).has(this.#state)) this.#state = "failed";
		return true;
	}

	/**
   * Erases transient secret observations and prevents further credential access.
   */
	close()
	{
		this.#observedSecrets.clear();
		this.#state = "closed";
		this.#active = false;
		return true;
	}
}

/**
 * Constructs the one-target-at-a-time credential boundary that prevents observed secrets from escaping publication callbacks.
 *
 * @param options - Verified publish plan and opaque credential provider confined by the new boundary.
 */
export const createPublishCredentialBoundary = options => new PublishCredentialBoundary(options);
