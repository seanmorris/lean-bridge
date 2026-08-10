const credentialNamePattern = /^[A-Z][A-Z0-9_]*$/;
const safeCodePattern = /^[a-z0-9][a-z0-9._-]*$/;

export class CredentialBoundaryError extends Error {
  constructor(code, message, details = {}) {
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
  if (typeof value !== "string" || value === "") fail("invalid-credential-boundary", `${label} must be a non-empty string`);
};

const credentialNames = (value, label) => {
  if (!Array.isArray(value) || value.some(name => typeof name !== "string" || !credentialNamePattern.test(name))) {
    fail("invalid-credential-boundary", `${label} must contain uppercase environment names`);
  }
  const canonical = [...new Set(value)].sort();
  if (JSON.stringify(value) !== JSON.stringify(canonical)) {
    fail("invalid-credential-boundary", `${label} must use unique canonical order`);
  }
  return canonical;
};

const normalizeProvider = provider => {
  if (provider === null || typeof provider !== "object" || Array.isArray(provider)) {
    fail("credential-provider-required", "A credential provider is required for external publication");
  }
  string(provider.kind, "credential provider kind");
  if (typeof provider.has !== "function" || typeof provider.read !== "function") {
    fail("invalid-credential-provider", "Credential provider must implement has(name) and read(name)");
  }
  return provider;
};

const targetRecords = plan => {
  if (plan === null || typeof plan !== "object" || !Array.isArray(plan.targets) || plan.targets.length === 0) {
    fail("invalid-credential-boundary", "Verified publish plan must contain targets");
  }
  const ids = new Set();
  return plan.targets.map((target, index) => {
    if (target === null || typeof target !== "object" || Array.isArray(target)) {
      fail("invalid-credential-boundary", "Publish target must be an object");
    }
    if (target.order !== index + 1) fail("invalid-credential-boundary", "Publish target order must be contiguous");
    for (const field of ["ecosystem", "coordinate", "operation", "idempotencyKey"]) string(target[field], `target.${field}`);
    if (!new Set(["publish", "retain"]).has(target.operation)) {
      fail("invalid-credential-boundary", `Unsupported credential operation ${target.operation}`);
    }
    if (ids.has(target.idempotencyKey)) fail("invalid-credential-boundary", "Credential targets require unique idempotency keys");
    ids.add(target.idempotencyKey);
    const names = credentialNames(target.credentialEnvironment, `${target.ecosystem} credential requirements`);
    if (target.operation === "publish" && names.length === 0) {
      fail("invalid-credential-boundary", `${target.ecosystem} registry publication requires a credential name`);
    }
    if (target.operation === "retain" && names.length !== 0) {
      fail("invalid-credential-boundary", `${target.ecosystem} archive retention cannot request credentials`);
    }
    return Object.freeze({
      order: target.order,
      ecosystem: target.ecosystem,
      coordinate: target.coordinate,
      operation: target.operation,
      idempotencyKey: target.idempotencyKey,
      names: Object.freeze(names),
    });
  });
};

const targetSelector = target => {
  if (typeof target === "string" && target !== "") return target;
  if (target !== null && typeof target === "object" && typeof target.idempotencyKey === "string") {
    return target.idempotencyKey;
  }
  fail("credential-target-required", "Credential access requires a publish target or idempotency key");
};

const valueContainsSecret = (value, secrets, seen = new WeakSet()) => {
  if (typeof value === "string") return [...secrets].some(secret => secret !== "" && value.includes(secret));
  if (Buffer.isBuffer(value)) return valueContainsSecret(value.toString("utf8"), secrets, seen);
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Error) {
    if (valueContainsSecret(value.message, secrets, seen)) return true;
    if (typeof value.stack === "string" && valueContainsSecret(value.stack, secrets, seen)) return true;
  }
  for (const [key, item] of Object.entries(value)) {
    if (valueContainsSecret(key, secrets, seen) || valueContainsSecret(item, secrets, seen)) return true;
  }
  return false;
};

export const createEnvironmentCredentialProvider = ({ environment = process.env } = {}) => Object.freeze({
  kind: "environment",
  has(name) {
    if (!credentialNamePattern.test(name)) fail("invalid-credential-name", `Invalid credential environment name ${name}`);
    return typeof environment[name] === "string" && environment[name] !== "";
  },
  read(name) {
    if (!credentialNamePattern.test(name)) fail("invalid-credential-name", `Invalid credential environment name ${name}`);
    const value = environment[name];
    if (typeof value !== "string" || value === "") {
      fail("publish-credential-missing", `Required credential ${name} is unavailable`, { name });
    }
    return value;
  },
});

export class PublishCredentialBoundary {
  #provider;
  #targets;
  #byId;
  #state = "created";
  #availability = new Map();
  #accesses = new Map();
  #observedSecrets = new Set();
  #active = false;

  constructor({ plan, provider }) {
    this.#provider = normalizeProvider(provider);
    this.#targets = Object.freeze(targetRecords(plan));
    this.#byId = new Map(this.#targets.map(target => [target.idempotencyKey, target]));
    for (const target of this.#targets) this.#accesses.set(target.idempotencyKey, 0);
  }

  get state() {
    return this.#state;
  }

  async preflight() {
    if (this.#state !== "created") fail("credential-boundary-state", `Credential preflight cannot run from ${this.#state}`);
    const missing = [];
    for (const target of this.#targets) {
      const unavailable = [];
      for (const name of target.names) {
        let available;
        try {
          available = await this.#provider.has(name);
        } catch {
          this.#state = "blocked";
          fail("credential-provider-failed", `Credential provider could not check ${name}`, { name });
        }
        if (available !== true) unavailable.push(name);
      }
      this.#availability.set(target.idempotencyKey, unavailable.length === 0);
      if (unavailable.length > 0) missing.push({
        order: target.order,
        ecosystem: target.ecosystem,
        coordinate: target.coordinate,
        names: unavailable,
      });
    }
    if (missing.length > 0) {
      this.#state = "blocked";
      fail("publish-credentials-missing", "Required registry credentials are unavailable", { missing });
    }
    this.#state = "ready";
    return this.snapshot();
  }

  async withTarget(target, operation) {
    if (this.#state !== "ready") fail("credential-boundary-state", `Credential access cannot run from ${this.#state}`);
    if (this.#active) fail("credential-boundary-busy", "Credential access is limited to one target at a time");
    if (typeof operation !== "function") fail("credential-operation-required", "Credential access requires an operation callback");
    const id = targetSelector(target);
    const record = this.#byId.get(id);
    if (record === undefined) fail("credential-target-unknown", "Credential target is outside the verified publish plan");
    if (record.operation !== "publish") fail("credential-target-has-no-secret", `${record.ecosystem} does not use registry credentials`);
    this.#active = true;
    const values = new Map();
    try {
      for (const name of record.names) {
        let value;
        try {
          value = await this.#provider.read(name);
        } catch (error) {
          if (error instanceof CredentialBoundaryError && error.code === "publish-credential-missing") {
            this.#state = "blocked";
            fail("publish-credentials-changed", `Credential ${name} disappeared after preflight`, { name, ecosystem: record.ecosystem });
          }
          this.#state = "blocked";
          fail("credential-provider-failed", `Credential provider could not read ${name}`, { name, ecosystem: record.ecosystem });
        }
        if (typeof value !== "string" || value === "") {
          this.#state = "blocked";
          fail("invalid-credential-provider-value", `Credential provider returned no value for ${name}`, { name, ecosystem: record.ecosystem });
        }
        values.set(name, value);
        this.#observedSecrets.add(value);
      }
      const view = Object.freeze({
        names: record.names,
        get: name => {
          if (!record.names.includes(name)) fail("credential-name-not-authorized", `${name} is not authorized for ${record.ecosystem}`, { name, ecosystem: record.ecosystem });
          return values.get(name);
        },
      });
      this.#accesses.set(record.idempotencyKey, this.#accesses.get(record.idempotencyKey) + 1);
      let result;
      try {
        result = await operation(view);
      } catch (error) {
        this.#state = "failed";
        if (error instanceof CredentialBoundaryError) throw error;
        const causeCode = typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : null;
        fail("credential-operation-failed", `Registry operation failed for ${record.coordinate}`, {
          ecosystem: record.ecosystem,
          coordinate: record.coordinate,
          causeCode,
        });
      }
      this.assertSafe(result);
      return result;
    } finally {
      values.clear();
      this.#active = false;
    }
  }

  assertSafe(value) {
    let containsSecret;
    try {
      containsSecret = valueContainsSecret(value, this.#observedSecrets);
    } catch {
      this.#state = "failed";
      fail("credential-output-uninspectable", "Registry output could not be inspected for credential values");
    }
    if (containsSecret) {
      this.#state = "failed";
      fail("credential-value-leak", "Registry output contains a credential value");
    }
    return true;
  }

  complete() {
    if (this.#state !== "ready") fail("credential-boundary-state", `Credential boundary cannot complete from ${this.#state}`);
    const unused = this.#targets
      .filter(target => target.operation === "publish" && this.#accesses.get(target.idempotencyKey) === 0)
      .map(target => ({ ecosystem: target.ecosystem, coordinate: target.coordinate }));
    if (unused.length > 0) {
      this.#state = "failed";
      fail("publisher-skipped-credential-boundary", "Registry publisher skipped the credential boundary", { unused });
    }
    this.#state = "complete";
    return this.snapshot();
  }

  sanitize(error) {
    try {
      this.assertSafe(error);
    } catch (leak) {
      return leak;
    }
    if (error instanceof CredentialBoundaryError) return error;
    this.#state = "failed";
    const causeCode = typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : null;
    return new CredentialBoundaryError(
      "registry-publisher-failed",
      "Registry publisher failed after credential preflight",
      { causeCode },
    );
  }

  snapshot() {
    const status = new Set(["ready", "complete", "blocked", "failed"]).has(this.#state) ? this.#state : "ready";
    return Object.freeze({
      schemaVersion: 1,
      status,
      providerKind: this.#provider.kind,
      valuesRead: [...this.#accesses.values()].some(count => count > 0),
      valuesRetained: false,
      targets: Object.freeze(this.#targets.map(target => Object.freeze({
        order: target.order,
        ecosystem: target.ecosystem,
        coordinate: target.coordinate,
        requiredNames: target.names,
        available: this.#availability.get(target.idempotencyKey) === true,
        accessCount: this.#accesses.get(target.idempotencyKey),
      }))),
    });
  }

  markFailed() {
    if (!new Set(["blocked", "closed"]).has(this.#state)) this.#state = "failed";
    return true;
  }

  close() {
    this.#observedSecrets.clear();
    this.#state = "closed";
    this.#active = false;
    return true;
  }
}

export const createPublishCredentialBoundary = options => new PublishCredentialBoundary(options);
