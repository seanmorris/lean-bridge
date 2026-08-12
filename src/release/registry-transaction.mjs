import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

const predicateType = "urn:lean-bridge:registry-transaction:v1";
const atomicity = "independent-registry-commits";
const safeCodePattern = /^[a-z0-9][a-z0-9._-]*$/;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const canonicalSnapshot = value => Object.freeze(JSON.parse(canonicalJson(value)));

const recoveryPolicies = Object.freeze({
  npm: Object.freeze({
    strategy: "deprecate-or-publish-corrective-version",
    command: "npm deprecate <name>@<version> \"<reason and replacement>\"",
    effect: "Warn consumers without pretending the immutable name and version can be reused.",
    source: "https://docs.npmjs.com/policies/unpublish/",
  }),
  cargo: Object.freeze({
    strategy: "publish-corrective-version-then-yank",
    command: "cargo yank <name>@<version>",
    effect: "Remove the version from new dependency resolution while preserving downloads and existing lockfiles.",
    source: "https://doc.rust-lang.org/cargo/commands/cargo-yank.html",
  }),
  pypi: Object.freeze({
    strategy: "yank-files-or-publish-corrective-version",
    command: null,
    effect: "Mark files as yanked for ordinary resolution while preserving exact pins and the published files.",
    source: "https://packaging.python.org/en/latest/specifications/file-yanking/",
  }),
  c: Object.freeze({
    strategy: "replace-retained-archive-before-distribution",
    command: null,
    effect: "The local archive has no registry transaction and can be replaced only before a later distribution step.",
    source: "urn:lean-bridge:policy:local-archive-retention:v1",
  }),
  cpp: Object.freeze({
    strategy: "replace-retained-archive-before-distribution",
    command: null,
    effect: "The local archive has no registry transaction and can be replaced only before a later distribution step.",
    source: "urn:lean-bridge:policy:local-archive-retention:v1",
  }),
});

export class RegistryTransactionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RegistryTransactionError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new RegistryTransactionError(code, message, details);
};

const exactKeys = (value, keys, label, code = "invalid-registry-transaction") => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code, `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} fields must be closed`, { actual, expected });
  }
};

const string = (value, label, code = "invalid-registry-transaction") => {
  if (typeof value !== "string" || value === "") fail(code, `${label} must be a non-empty string`);
};

const digest = (value, label, code = "invalid-registry-transaction") => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(code, `${label} must be a SHA-256 identity`);
  }
};

const instant = (value, label) => {
  string(value, label);
  if (!Number.isFinite(Date.parse(value))) fail("invalid-registry-transaction", `${label} must be an ISO timestamp`);
};

const artifactList = (value, label, code = "invalid-registry-adapter-result") => {
  if (!Array.isArray(value)) fail(code, `${label} must be an array`);
  const normalized = value.map((artifact, index) => {
    exactKeys(artifact, ["sha256"], `${label}[${index}]`, code);
    digest(artifact.sha256, `${label}[${index}].sha256`, code);
    return { sha256: artifact.sha256 };
  });
  const canonical = [...normalized].sort((left, right) => left.sha256.localeCompare(right.sha256));
  if (JSON.stringify(normalized) !== JSON.stringify(canonical) || new Set(normalized.map(item => item.sha256)).size !== normalized.length) {
    fail(code, `${label} must use unique SHA-256 order`);
  }
  return canonical;
};

const failureRecord = (value, label, code = "invalid-registry-adapter-result") => {
  if (value === null) return null;
  exactKeys(value, ["code", "retryable"], label, code);
  if (typeof value.code !== "string" || !safeCodePattern.test(value.code)) fail(code, `${label}.code is invalid`);
  if (typeof value.retryable !== "boolean") fail(code, `${label}.retryable must be boolean`);
  return { code: value.code, retryable: value.retryable };
};

const guidanceFor = target => {
  const policy = recoveryPolicies[target.ecosystem] ?? Object.freeze({
    strategy: "consult-registry-policy-and-publish-a-new-version",
    command: null,
    effect: "Do not delete or overwrite a published coordinate without a registry-specific reviewed procedure.",
    source: target.destination?.endpoint ?? "urn:lean-bridge:policy:registry-recovery:v1",
  });
  return { ...policy };
};

const expectedArtifacts = target => [...new Set(target.archives.map(item => item.sha256))]
  .sort()
  .map(value => ({ sha256: value }));

const normalizeDependencies = (value, target) => {
  if (!Array.isArray(value)) fail("invalid-registry-adapter-result", `${target.ecosystem} dependencies must be an array`);
  const normalized = value.map((dependency, index) => {
    exactKeys(dependency, ["coordinate", "status"], `${target.ecosystem} dependency ${index}`, "invalid-registry-adapter-result");
    string(dependency.coordinate, "dependency.coordinate", "invalid-registry-adapter-result");
    if (!new Set(["available", "planned-earlier", "unavailable"]).has(dependency.status)) {
      fail("invalid-registry-adapter-result", `${dependency.coordinate} has an unsupported dependency status`);
    }
    return { coordinate: dependency.coordinate, status: dependency.status };
  });
  const canonical = [...normalized].sort((left, right) => left.coordinate.localeCompare(right.coordinate));
  if (JSON.stringify(normalized) !== JSON.stringify(canonical) || new Set(normalized.map(item => item.coordinate)).size !== normalized.length) {
    fail("invalid-registry-adapter-result", `${target.ecosystem} dependencies must use unique coordinate order`);
  }
  return canonical;
};

const normalizePreflight = (raw, target) => {
  exactKeys(raw, [
    "permission", "coordinateState", "immutable", "registryReference", "artifacts", "dependencies",
  ], `${target.ecosystem} preflight`, "invalid-registry-adapter-result");
  if (!new Set(["granted", "denied"]).has(raw.permission)) {
    fail("invalid-registry-adapter-result", `${target.ecosystem} permission must be granted or denied`);
  }
  if (!new Set(["available", "matching", "collision"]).has(raw.coordinateState)) {
    fail("invalid-registry-adapter-result", `${target.ecosystem} coordinate state is invalid`);
  }
  if (typeof raw.immutable !== "boolean") fail("invalid-registry-adapter-result", `${target.ecosystem} immutability must be boolean`);
  if (raw.registryReference !== null) string(raw.registryReference, `${target.ecosystem} registry reference`, "invalid-registry-adapter-result");
  const artifacts = artifactList(raw.artifacts, `${target.ecosystem} artifacts`);
  const dependencies = normalizeDependencies(raw.dependencies, target);
  if (raw.coordinateState === "available" && (raw.registryReference !== null || artifacts.length !== 0)) {
    fail("invalid-registry-adapter-result", `${target.coordinate} is available but names published artifacts`);
  }
  if (raw.coordinateState === "matching") {
    if (raw.registryReference === null || JSON.stringify(artifacts) !== JSON.stringify(expectedArtifacts(target))) {
      fail("registry-coordinate-collision", `${target.coordinate} exists but does not match the authorized archive hashes`);
    }
  }
  return {
    permission: raw.permission,
    coordinateState: raw.coordinateState,
    immutable: raw.immutable,
    registryReference: raw.registryReference,
    artifacts,
    dependencies,
  };
};

const normalizePublishResult = (raw, target) => {
  exactKeys(raw, ["status", "registryReference", "artifacts", "externalWrite", "failure"], `${target.ecosystem} publish result`, "invalid-registry-adapter-result");
  if (!new Set(["published", "already-published", "failed"]).has(raw.status)) {
    fail("invalid-registry-adapter-result", `${target.ecosystem} publish status is invalid`);
  }
  if (raw.registryReference !== null) string(raw.registryReference, `${target.ecosystem} registry reference`, "invalid-registry-adapter-result");
  const artifacts = artifactList(raw.artifacts, `${target.ecosystem} published artifacts`);
  const failure = failureRecord(raw.failure, `${target.ecosystem} failure`);
  if (![true, false, "unknown"].includes(raw.externalWrite)) {
    fail("invalid-registry-adapter-result", `${target.ecosystem} externalWrite must be true, false, or unknown`);
  }
  if (raw.status === "failed") {
    if (failure === null || raw.registryReference !== null || artifacts.length !== 0 || raw.externalWrite === true) {
      fail("invalid-registry-adapter-result", `${target.ecosystem} failed result is contradictory`);
    }
  } else {
    if (failure !== null || raw.registryReference === null || JSON.stringify(artifacts) !== JSON.stringify(expectedArtifacts(target))) {
      fail("registry-published-artifact-drift", `${target.coordinate} publish result differs from the authorized archive hashes`);
    }
    if (raw.status === "published" && raw.externalWrite !== true) {
      fail("invalid-registry-adapter-result", `${target.ecosystem} published result must acknowledge its external write`);
    }
    if (raw.status === "already-published" && raw.externalWrite !== false) {
      fail("invalid-registry-adapter-result", `${target.ecosystem} already-published result cannot claim a write`);
    }
  }
  return {
    status: raw.status,
    registryReference: raw.registryReference,
    artifacts,
    externalWrite: raw.externalWrite,
    failure,
  };
};

const normalizeAdapters = adapters => {
  if (!Array.isArray(adapters)) fail("invalid-registry-adapters", "Registry adapters must be an array");
  const result = new Map();
  for (const adapter of adapters) {
    if (adapter === null || typeof adapter !== "object" || Array.isArray(adapter)) {
      fail("invalid-registry-adapters", "Registry adapter must be an object");
    }
    string(adapter.ecosystem, "adapter.ecosystem", "invalid-registry-adapters");
    string(adapter.kind, "adapter.kind", "invalid-registry-adapters");
    if (typeof adapter.preflight !== "function" || typeof adapter.publish !== "function") {
      fail("invalid-registry-adapters", `${adapter.ecosystem} adapter must implement preflight and publish`);
    }
    if (result.has(adapter.ecosystem)) fail("invalid-registry-adapters", `Duplicate registry adapter for ${adapter.ecosystem}`);
    result.set(adapter.ecosystem, adapter);
  }
  return result;
};

const validatePlanTarget = (target, index, candidateId) => {
  if (target === null || typeof target !== "object" || Array.isArray(target)) fail("invalid-registry-publisher-request", "Publish target must be an object");
  if (target.order !== index + 1) fail("invalid-registry-publisher-request", "Publish target order must be contiguous");
  for (const field of ["candidateId", "ecosystem", "coordinate", "operation", "idempotencyKey"]) string(target[field], `target.${field}`, "invalid-registry-publisher-request");
  if (target.candidateId !== candidateId) fail("registry-transaction-candidate-drift", `${target.ecosystem} names another candidate`);
  if (!new Set(["publish", "retain"]).has(target.operation)) fail("invalid-registry-publisher-request", `${target.ecosystem} operation is invalid`);
  if (!Array.isArray(target.archives) || target.archives.length === 0) fail("invalid-registry-publisher-request", `${target.ecosystem} requires an archive`);
  for (const archive of target.archives) digest(archive.sha256, `${target.ecosystem} archive`, "invalid-registry-publisher-request");
  digest(target.idempotencyKey, `${target.ecosystem} idempotency key`, "invalid-registry-publisher-request");
};

const transactionIdentity = ({ plan, manifestSha256, attestation }) => sha256(canonicalJson({
  candidateId: plan.authorization.candidateId,
  manifestSha256,
  attestationEnvelopeSha256: attestation.envelopeSha256,
  targets: plan.targets.map(target => ({ order: target.order, idempotencyKey: target.idempotencyKey })),
}));

const initialTarget = target => ({
  order: target.order,
  ecosystem: target.ecosystem,
  coordinate: target.coordinate,
  operation: target.operation,
  idempotencyKey: target.idempotencyKey,
  status: "pending",
  attempts: 0,
  preflight: null,
  result: null,
  failure: null,
  recovery: guidanceFor(target),
});

const createInitialState = ({ plan, manifestPath, manifestSha256, attestation, now }) => {
  const timestamp = now();
  instant(timestamp, "transaction time");
  return {
    schemaVersion: 1,
    predicateType,
    transactionId: transactionIdentity({ plan, manifestSha256, attestation }),
    candidateId: plan.authorization.candidateId,
    manifest: { path: basename(manifestPath), sha256: manifestSha256 },
    attestation: {
      statementSha256: attestation.statementSha256,
      envelopeSha256: attestation.envelopeSha256,
    },
    status: "preflighting",
    atomicity,
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    externalRegistryWrites: false,
    targets: plan.targets.map(initialTarget),
  };
};

const validatePreflightRecord = (preflight, label) => {
  exactKeys(preflight, ["permission", "coordinateState", "immutable", "registryReference", "artifacts", "dependencies"], label);
  if (!new Set(["granted", "denied", "not-required"]).has(preflight.permission)) fail("invalid-registry-transaction", `${label}.permission is invalid`);
  if (!new Set(["available", "matching", "collision", "local"]).has(preflight.coordinateState)) fail("invalid-registry-transaction", `${label}.coordinateState is invalid`);
  if (typeof preflight.immutable !== "boolean") fail("invalid-registry-transaction", `${label}.immutable must be boolean`);
  if (preflight.registryReference !== null) string(preflight.registryReference, `${label}.registryReference`);
  artifactList(preflight.artifacts, `${label}.artifacts`, "invalid-registry-transaction");
  normalizeDependencies(preflight.dependencies, { ecosystem: label });
};

export const validateRegistryTransaction = state => {
  exactKeys(state, [
    "schemaVersion", "predicateType", "transactionId", "candidateId", "manifest", "attestation", "status",
    "atomicity", "attemptCount", "createdAt", "updatedAt", "externalRegistryWrites", "targets",
  ], "registry transaction");
  if (state.schemaVersion !== 1 || state.predicateType !== predicateType || state.atomicity !== atomicity) {
    fail("invalid-registry-transaction", "Registry transaction version, predicate, or atomicity model is invalid");
  }
  digest(state.transactionId, "transactionId");
  digest(state.candidateId, "candidateId");
  exactKeys(state.manifest, ["path", "sha256"], "transaction manifest");
  string(state.manifest.path, "manifest.path");
  digest(state.manifest.sha256, "manifest.sha256");
  exactKeys(state.attestation, ["statementSha256", "envelopeSha256"], "transaction attestation");
  digest(state.attestation.statementSha256, "attestation.statementSha256");
  digest(state.attestation.envelopeSha256, "attestation.envelopeSha256");
  if (!new Set(["preflighting", "ready", "publishing", "partial", "blocked", "complete"]).has(state.status)) {
    fail("invalid-registry-transaction", "Registry transaction status is invalid");
  }
  if (!Number.isSafeInteger(state.attemptCount) || state.attemptCount < 0) fail("invalid-registry-transaction", "attemptCount must be non-negative");
  instant(state.createdAt, "createdAt");
  instant(state.updatedAt, "updatedAt");
  if (![true, false, "unknown"].includes(state.externalRegistryWrites)) fail("invalid-registry-transaction", "externalRegistryWrites is invalid");
  if (!Array.isArray(state.targets) || state.targets.length === 0) fail("invalid-registry-transaction", "Registry transaction requires targets");
  const ids = new Set();
  state.targets.forEach((target, index) => {
    exactKeys(target, [
      "order", "ecosystem", "coordinate", "operation", "idempotencyKey", "status", "attempts",
      "preflight", "result", "failure", "recovery",
    ], `transaction target ${index}`);
    if (target.order !== index + 1) fail("invalid-registry-transaction", "Transaction target order must be contiguous");
    for (const field of ["ecosystem", "coordinate", "operation", "idempotencyKey", "status"]) string(target[field], `target.${field}`);
    digest(target.idempotencyKey, "target.idempotencyKey");
    if (ids.has(target.idempotencyKey)) fail("invalid-registry-transaction", "Transaction idempotency keys must be unique");
    ids.add(target.idempotencyKey);
    if (!new Set(["publish", "retain"]).has(target.operation)) fail("invalid-registry-transaction", "Transaction operation is invalid");
    if (!new Set(["pending", "ready", "publishing", "published", "already-published", "retained", "failed", "blocked"]).has(target.status)) {
      fail("invalid-registry-transaction", "Transaction target status is invalid");
    }
    if (!Number.isSafeInteger(target.attempts) || target.attempts < 0) fail("invalid-registry-transaction", "Target attempts must be non-negative");
    if (target.preflight !== null) validatePreflightRecord(target.preflight, `target ${index} preflight`);
    if (target.result !== null) {
      exactKeys(target.result, ["status", "registryReference", "artifacts", "externalWrite"], `target ${index} result`);
      if (!new Set(["published", "already-published", "retained"]).has(target.result.status)) fail("invalid-registry-transaction", "Stored result status is invalid");
      if (target.result.registryReference !== null) string(target.result.registryReference, "result.registryReference");
      artifactList(target.result.artifacts, "result.artifacts", "invalid-registry-transaction");
      if (typeof target.result.externalWrite !== "boolean") fail("invalid-registry-transaction", "Stored result externalWrite must be boolean");
    }
    failureRecord(target.failure, `target ${index} failure`, "invalid-registry-transaction");
    exactKeys(target.recovery, ["strategy", "command", "effect", "source"], `target ${index} recovery`);
    string(target.recovery.strategy, "recovery.strategy");
    if (target.recovery.command !== null) string(target.recovery.command, "recovery.command");
    string(target.recovery.effect, "recovery.effect");
    string(target.recovery.source, "recovery.source");
  });
  return true;
};

const writeAtomic = async (path, value) => {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(canonicalJson(value));
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
    let directory;
    try {
      directory = await open(dirname(path), "r");
      await directory.sync();
    } catch (error) {
      if (!new Set(["EINVAL", "ENOTSUP", "EISDIR"]).has(error.code)) throw error;
    } finally {
      await directory?.close();
    }
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
};

const loadState = async path => {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  let state;
  try {
    state = JSON.parse(source);
  } catch {
    fail("invalid-registry-transaction-json", "Registry transaction state is not valid JSON", { path });
  }
  validateRegistryTransaction(state);
  if (source !== canonicalJson(state)) fail("noncanonical-registry-transaction", "Registry transaction state is not canonical", { path });
  return state;
};

const stateResult = (state, path) => {
  const source = canonicalJson(state);
  return canonicalSnapshot({
    schemaVersion: 1,
    transaction: {
      path,
      sha256: sha256(source),
      id: state.transactionId,
      status: state.status,
      attemptCount: state.attemptCount,
      atomicity: state.atomicity,
    },
    candidateId: state.candidateId,
    results: state.targets.map(target => ({
      order: target.order,
      ecosystem: target.ecosystem,
      coordinate: target.coordinate,
      idempotencyKey: target.idempotencyKey,
      status: target.status,
      result: target.result,
      failure: target.failure,
      recovery: target.recovery,
    })),
    externalRegistryWrites: state.externalRegistryWrites,
  });
};

const acquireLock = async (path, transactionId, now) => {
  const lockPath = `${path}.lock`;
  const createdAt = now();
  instant(createdAt, "transaction lock time");
  let handle;
  let created = false;
  try {
    handle = await open(lockPath, "wx", 0o600);
    created = true;
    await handle.writeFile(canonicalJson({ transactionId, pid: process.pid, createdAt }));
    await handle.sync();
    return async () => {
      try {
        await handle.close();
      } finally {
        await rm(lockPath, { force: true });
      }
    };
  } catch (error) {
    await handle?.close();
    if (error.code === "EEXIST") {
      fail("registry-transaction-locked", "Another publisher owns the registry transaction lock", { lockPath });
    }
    if (created) await rm(lockPath, { force: true });
    throw error;
  }
};

const preflightFailure = (preflight, target, targets) => {
  if (preflight.permission !== "granted") return { code: "registry-permission-denied", retryable: false };
  if (preflight.immutable !== true) return { code: "registry-immutability-unverified", retryable: false };
  if (preflight.coordinateState === "collision") return { code: "registry-coordinate-collision", retryable: false };
  for (const dependency of preflight.dependencies) {
    if (dependency.status === "unavailable") return { code: "registry-dependency-unavailable", retryable: true };
    if (dependency.status === "planned-earlier") {
      const provider = targets.find(item => item.coordinate === dependency.coordinate);
      if (provider === undefined || provider.order >= target.order) return { code: "registry-dependency-order-invalid", retryable: false };
    }
  }
  return null;
};

const assertStateIdentity = ({ state, plan, manifestPath, manifestSha256, attestation }) => {
  const expectedId = transactionIdentity({ plan, manifestSha256, attestation });
  if (
    state.transactionId !== expectedId || state.candidateId !== plan.authorization.candidateId ||
    state.manifest.path !== basename(manifestPath) || state.manifest.sha256 !== manifestSha256 ||
    state.attestation.statementSha256 !== attestation.statementSha256 ||
    state.attestation.envelopeSha256 !== attestation.envelopeSha256 || state.targets.length !== plan.targets.length
  ) fail("registry-transaction-drift", "Existing registry transaction belongs to another authorized publication closure");
  for (let index = 0; index < plan.targets.length; index += 1) {
    const expected = plan.targets[index];
    const actual = state.targets[index];
    if (
      actual.order !== expected.order || actual.ecosystem !== expected.ecosystem ||
      actual.coordinate !== expected.coordinate || actual.operation !== expected.operation ||
      actual.idempotencyKey !== expected.idempotencyKey
    ) fail("registry-transaction-drift", "Existing transaction target order or identity differs from the publish manifest");
  }
};

const aggregateExternalWrites = state => {
  if (state.targets.some(target => target.result?.externalWrite === true)) return true;
  if (state.externalRegistryWrites === "unknown") return "unknown";
  return false;
};

export const createRegistryTransactionPublisher = ({
  adapters = [],
  transactionFile = "registry-transaction.json",
  now = () => new Date().toISOString(),
} = {}) => {
  const byEcosystem = normalizeAdapters(adapters);
  string(transactionFile, "transactionFile", "invalid-registry-adapters");
  if (transactionFile.includes("/") || transactionFile.includes("\\") || transactionFile === "." || transactionFile === "..") {
    fail("invalid-registry-adapters", "transactionFile must be one file name");
  }

  return async ({
    plan,
    manifestPath,
    manifestSha256,
    candidateRoot,
    credentials,
    attestation,
    signal = undefined,
    onProgress = undefined,
  }) => {
    if (plan === null || typeof plan !== "object" || !Array.isArray(plan.targets) || plan.targets.length === 0) {
      fail("invalid-registry-publisher-request", "Registry publisher requires a verified plan with targets");
    }
    if (plan.authorization === null || typeof plan.authorization !== "object") {
      fail("invalid-registry-publisher-request", "Registry publisher requires the candidate authorization identity");
    }
    digest(plan.authorization.candidateId, "plan candidateId", "invalid-registry-publisher-request");
    digest(manifestSha256, "manifestSha256", "invalid-registry-publisher-request");
    string(manifestPath, "manifestPath", "invalid-registry-publisher-request");
    string(candidateRoot, "candidateRoot", "invalid-registry-publisher-request");
    if (credentials === null || typeof credentials !== "object" || typeof credentials.withTarget !== "function") {
      fail("invalid-registry-publisher-request", "Registry publisher requires the target-scoped credential boundary");
    }
    if (attestation === null || typeof attestation !== "object") fail("invalid-registry-publisher-request", "Registry publisher requires a publication attestation");
    digest(attestation.statementSha256, "attestation statement", "invalid-registry-publisher-request");
    digest(attestation.envelopeSha256, "attestation envelope", "invalid-registry-publisher-request");
    plan.targets.forEach((target, index) => validatePlanTarget(target, index, plan.authorization.candidateId));
    if (new Set(plan.targets.map(target => target.idempotencyKey)).size !== plan.targets.length) {
      fail("invalid-registry-publisher-request", "Registry transaction requires unique idempotency keys");
    }

    const path = resolve(dirname(manifestPath), transactionFile);
    const expectedId = transactionIdentity({ plan, manifestSha256, attestation });
    const releaseLock = await acquireLock(path, expectedId, now);
    let state;
    const persist = async () => {
      state.updatedAt = now();
      instant(state.updatedAt, "updatedAt");
      state.externalRegistryWrites = aggregateExternalWrites(state);
      validateRegistryTransaction(state);
      await writeAtomic(path, state);
    };
    const stop = (code, message, status) => {
      state.status = status;
      return persist().then(() => fail(code, message, { result: stateResult(state, path) }));
    };

    try {
      signal?.throwIfAborted();
      state = await loadState(path) ?? createInitialState({ plan, manifestPath, manifestSha256, attestation, now });
      assertStateIdentity({ state, plan, manifestPath, manifestSha256, attestation });
      state.attemptCount += 1;
      state.status = "preflighting";
      await persist();
      onProgress?.({ phase: "registry-preflight", state: "started", message: "Checking every registry target before the first write", current: 0, total: plan.targets.length });

      for (let index = 0; index < plan.targets.length; index += 1) {
        signal?.throwIfAborted();
        const target = plan.targets[index];
        const record = state.targets[index];
        if (target.operation === "retain") {
          record.preflight = {
            permission: "not-required",
            coordinateState: "local",
            immutable: true,
            registryReference: null,
            artifacts: expectedArtifacts(target),
            dependencies: [],
          };
          record.failure = null;
          if (record.status !== "retained") record.status = "ready";
          await persist();
          onProgress?.({ phase: "registry-preflight", state: "info", message: `${target.ecosystem} archive retention is ready`, current: index + 1, total: plan.targets.length });
          continue;
        }
        const adapter = byEcosystem.get(target.ecosystem);
        if (adapter === undefined) {
          record.status = "blocked";
          record.failure = { code: "registry-adapter-unavailable", retryable: false };
          await stop("registry-adapter-unavailable", `No registry adapter is installed for ${target.ecosystem}`, "blocked");
        }
        let preflight;
        try {
          const raw = await credentials.withTarget(target, credentialView => adapter.preflight({
            target,
            candidateRoot,
            manifestSha256,
            attestation,
            credentials: credentialView,
            signal,
          }));
          preflight = normalizePreflight(raw, target);
        } catch (error) {
          record.status = "blocked";
          record.failure = {
            code: typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : "registry-preflight-call-failed",
            retryable: !(error instanceof RegistryTransactionError),
          };
          if (error instanceof RegistryTransactionError) {
            await stop(error.code, error.message, "blocked");
          }
          await stop("registry-preflight-call-failed", `Registry preflight failed for ${target.coordinate}`, "blocked");
        }
        record.preflight = preflight;
        const blocked = preflightFailure(preflight, target, plan.targets);
        if (blocked !== null) {
          record.status = "blocked";
          record.failure = blocked;
          await stop(blocked.code, `Registry preflight blocked ${target.coordinate}`, "blocked");
        }
        record.failure = null;
        if (preflight.coordinateState === "matching") {
          if (record.status === "publishing" || record.status === "failed") {
            record.status = "published";
            record.result = {
              status: "published",
              registryReference: preflight.registryReference,
              artifacts: preflight.artifacts,
              externalWrite: true,
            };
          } else if (record.status !== "published") {
            record.status = "already-published";
            record.result = {
              status: "already-published",
              registryReference: preflight.registryReference,
              artifacts: preflight.artifacts,
              externalWrite: false,
            };
          }
        } else if (new Set(["published", "already-published"]).has(record.status)) {
          record.status = "blocked";
          record.failure = { code: "registry-published-coordinate-missing", retryable: false };
          await stop("registry-published-coordinate-missing", `${target.coordinate} disappeared after a recorded publication`, "blocked");
        } else {
          record.status = "ready";
          record.result = null;
        }
        await persist();
        onProgress?.({ phase: "registry-preflight", state: "info", message: `${target.ecosystem} registry preflight passed`, current: index + 1, total: plan.targets.length });
      }

      state.status = "ready";
      await persist();
      onProgress?.({ phase: "registry-preflight", state: "completed", message: "Every registry target passed before publication", current: plan.targets.length, total: plan.targets.length });
      onProgress?.({ phase: "registry-publish", state: "started", message: "Publishing targets in authorized order", current: 0, total: plan.targets.length });

      for (let index = 0; index < plan.targets.length; index += 1) {
        signal?.throwIfAborted();
        const target = plan.targets[index];
        const record = state.targets[index];
        if (new Set(["published", "already-published", "retained"]).has(record.status)) {
          onProgress?.({ phase: "registry-publish", state: "info", message: `${target.ecosystem} is already complete`, current: index + 1, total: plan.targets.length });
          continue;
        }
        if (target.operation === "retain") {
          record.status = "retained";
          record.result = {
            status: "retained",
            registryReference: null,
            artifacts: expectedArtifacts(target),
            externalWrite: false,
          };
          record.failure = null;
          await persist();
          onProgress?.({ phase: "registry-publish", state: "info", message: `${target.ecosystem} archive retained`, current: index + 1, total: plan.targets.length });
          continue;
        }
        const adapter = byEcosystem.get(target.ecosystem);
        record.status = "publishing";
        record.attempts += 1;
        record.failure = null;
        state.status = "publishing";
        await persist();
        let published;
        try {
          const raw = await credentials.withTarget(target, credentialView => adapter.publish({
            target,
            candidateRoot,
            manifestSha256,
            attestation,
            credentials: credentialView,
            signal,
          }));
          published = normalizePublishResult(raw, target);
        } catch (error) {
          state.externalRegistryWrites = state.externalRegistryWrites === true ? true : "unknown";
          record.status = "failed";
          record.failure = {
            code: typeof error?.code === "string" && safeCodePattern.test(error.code) ? error.code : "registry-publish-call-failed",
            retryable: !(error instanceof RegistryTransactionError),
          };
          if (error instanceof RegistryTransactionError) {
            await stop(error.code, error.message, "partial");
          }
          await stop("registry-transaction-partial", `Publication stopped after an ambiguous failure for ${target.coordinate}`, "partial");
        }
        if (published.status === "failed") {
          if (published.externalWrite === "unknown" && state.externalRegistryWrites !== true) state.externalRegistryWrites = "unknown";
          record.status = "failed";
          record.failure = published.failure;
          await stop("registry-transaction-partial", `Publication stopped after ${target.coordinate} failed`, "partial");
        }
        record.status = published.status;
        record.result = {
          status: published.status,
          registryReference: published.registryReference,
          artifacts: published.artifacts,
          externalWrite: published.externalWrite,
        };
        record.failure = null;
        await persist();
        onProgress?.({ phase: "registry-publish", state: "info", message: `${target.ecosystem} ${published.status}`, current: index + 1, total: plan.targets.length });
      }

      state.status = "complete";
      await persist();
      onProgress?.({ phase: "registry-publish", state: "completed", message: "Every registry target reached a durable terminal state", current: plan.targets.length, total: plan.targets.length });
      return stateResult(state, path);
    } finally {
      await releaseLock();
    }
  };
};

export const registryRecoveryPolicies = recoveryPolicies;
