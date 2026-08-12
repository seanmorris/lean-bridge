import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";
import {
  validateReleaseAuthorization,
  verifyReleaseAuthorization,
} from "./reproducibility-gate.mjs";
import { parsePublicationIndex, validatePublicationIndex } from "./release-rehearsal.mjs";

const predicateType = "urn:lean-bridge:publication-plan:v1";
const sha256 = value => createHash("sha256").update(value).digest("hex");

const destinations = Object.freeze({
  npm: Object.freeze({
    operation: "publish",
    kind: "npm",
    endpoint: "https://registry.npmjs.org/",
    credentialEnvironment: Object.freeze(["NPM_TOKEN"]),
  }),
  cargo: Object.freeze({
    operation: "publish",
    kind: "cargo",
    endpoint: "https://crates.io/",
    credentialEnvironment: Object.freeze(["CARGO_REGISTRY_TOKEN"]),
  }),
  pypi: Object.freeze({
    operation: "publish",
    kind: "pypi",
    endpoint: "https://upload.pypi.org/legacy/",
    credentialEnvironment: Object.freeze(["TWINE_USERNAME", "TWINE_PASSWORD"]),
  }),
  c: Object.freeze({
    operation: "retain",
    kind: "archive",
    endpoint: null,
    credentialEnvironment: Object.freeze([]),
  }),
  cpp: Object.freeze({
    operation: "retain",
    kind: "archive",
    endpoint: null,
    credentialEnvironment: Object.freeze([]),
  }),
});

export class PublishManifestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublishManifestError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new PublishManifestError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-publish-manifest", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-publish-manifest", `${label} fields must be closed`, { actual, expected });
  }
};

const string = (value, label) => {
  if (typeof value !== "string" || value === "") fail("invalid-publish-manifest", `${label} must be a non-empty string`);
};

const digest = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail("invalid-publish-manifest", `${label} must be a SHA-256 identity`);
  }
};

const portablePath = (value, label) => {
  string(value, label);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) {
    fail("invalid-publish-manifest", `${label} must be a relative portable path`);
  }
};

const sortedUniqueStrings = (values, label) => {
  if (!Array.isArray(values) || values.some(value => typeof value !== "string" || value === "")) {
    fail("invalid-publish-manifest", `${label} must be an array of non-empty strings`);
  }
  const canonical = [...new Set(values)].sort();
  if (JSON.stringify(values) !== JSON.stringify(canonical)) {
    fail("invalid-publish-manifest", `${label} must use unique canonical order`);
  }
};

const coordinateFor = item => {
  if (item.ecosystem === "pypi") return `${item.name}==${item.version}`;
  return `${item.name}@${item.version}`;
};

const targetIdentity = target => sha256(canonicalJson({
  candidateId: target.candidateId,
  ecosystem: target.ecosystem,
  name: target.name,
  version: target.version,
  target: target.target,
  operation: target.operation,
  destination: target.destination,
  coordinate: target.coordinate,
  backendPlan: target.backendPlan,
  archives: target.archives.map(item => ({ path: item.path, sha256: item.sha256 })),
  credentialEnvironment: target.credentialEnvironment,
}));

const targetRecord = ({ item, candidateId, order }) => {
  const destination = destinations[item.ecosystem];
  if (destination === undefined) {
    fail("unsupported-publication-target", `No publication destination is defined for ${item.ecosystem}`, {
      ecosystem: item.ecosystem,
    });
  }
  const target = {
    order,
    candidateId,
    ecosystem: item.ecosystem,
    name: item.name,
    version: item.version,
    target: item.target,
    operation: destination.operation,
    destination: {
      kind: destination.kind,
      endpoint: destination.endpoint,
    },
    coordinate: coordinateFor(item),
    backendPlan: {
      ...item.backendPlan,
      path: `release/packages/${item.backendPlan.path}`,
    },
    archives: item.archives.map(archive => ({
      ...archive,
      path: `release/packages/${archive.path}`,
    })),
    credentialEnvironment: [...destination.credentialEnvironment].sort(),
    idempotencyKey: "",
  };
  target.idempotencyKey = targetIdentity(target);
  return target;
};

export const validatePublishManifest = manifest => {
  exactKeys(manifest, [
    "schemaVersion", "predicateType", "mode", "createdAt", "authorization", "selection",
    "policy", "targets", "omitted",
  ], "publish manifest");
  if (manifest.schemaVersion !== 1 || manifest.predicateType !== predicateType || manifest.mode !== "authorized-no-publish") {
    fail("invalid-publish-manifest", "Publish manifest version, predicate, or mode is invalid");
  }
  string(manifest.createdAt, "createdAt");
  if (!Number.isFinite(Date.parse(manifest.createdAt))) fail("invalid-publish-manifest", "createdAt must be an ISO timestamp");

  exactKeys(manifest.authorization, [
    "path", "sha256", "candidatePath", "candidateId", "sourceRevision", "artifactInventorySha256",
    "publicationIndexPath", "publicationIndexSha256",
  ], "manifest authorization");
  for (const field of ["path", "candidatePath", "publicationIndexPath"]) portablePath(manifest.authorization[field], `authorization.${field}`);
  for (const field of ["sha256", "candidateId", "artifactInventorySha256", "publicationIndexSha256"]) {
    digest(manifest.authorization[field], `authorization.${field}`);
  }
  string(manifest.authorization.sourceRevision, "authorization.sourceRevision");

  exactKeys(manifest.selection, ["allTargets", "requested", "plannedEcosystems"], "manifest selection");
  if (typeof manifest.selection.allTargets !== "boolean") fail("invalid-publish-manifest", "selection.allTargets must be boolean");
  sortedUniqueStrings(manifest.selection.requested, "selection.requested");
  sortedUniqueStrings(manifest.selection.plannedEcosystems, "selection.plannedEcosystems");
  if (manifest.selection.allTargets !== (manifest.selection.requested.length === 0)) {
    fail("invalid-publish-manifest", "Target selection is contradictory");
  }

  exactKeys(manifest.policy, [
    "networkAccessPerformed", "externalRegistryWritesPerformed", "credentialsRead",
    "immutableAuthorizedArtifacts", "idempotentExecutionRequired",
  ], "manifest policy");
  if (
    manifest.policy.networkAccessPerformed !== false ||
    manifest.policy.externalRegistryWritesPerformed !== false ||
    manifest.policy.credentialsRead !== false ||
    manifest.policy.immutableAuthorizedArtifacts !== true ||
    manifest.policy.idempotentExecutionRequired !== true
  ) fail("invalid-publish-manifest", "Dry-run policy must forbid network, credential, and registry effects");

  if (!Array.isArray(manifest.targets) || manifest.targets.length === 0) {
    fail("invalid-publish-manifest", "Publish manifest must contain at least one ready target");
  }
  let previousEcosystem = null;
  const ecosystems = [];
  manifest.targets.forEach((target, index) => {
    exactKeys(target, [
      "order", "candidateId", "ecosystem", "name", "version", "target", "operation", "destination",
      "coordinate", "backendPlan", "archives", "credentialEnvironment", "idempotencyKey",
    ], "publish target");
    if (target.order !== index + 1) fail("invalid-publish-manifest", "Publish target order must be contiguous");
    for (const field of ["ecosystem", "name", "version", "target", "operation", "coordinate"]) string(target[field], `target.${field}`);
    if (previousEcosystem !== null && target.ecosystem.localeCompare(previousEcosystem) <= 0) {
      fail("invalid-publish-manifest", "Publish targets must use unique ecosystem order");
    }
    previousEcosystem = target.ecosystem;
    ecosystems.push(target.ecosystem);
    digest(target.candidateId, "target.candidateId");
    if (target.candidateId !== manifest.authorization.candidateId) fail("publish-candidate-drift", `${target.ecosystem} names another candidate`);
    if (!new Set(["publish", "retain"]).has(target.operation)) fail("invalid-publish-manifest", `Unsupported operation ${target.operation}`);
    exactKeys(target.destination, ["kind", "endpoint"], "publish destination");
    string(target.destination.kind, "destination.kind");
    if (target.destination.endpoint !== null) string(target.destination.endpoint, "destination.endpoint");
    if (target.operation === "publish" && target.destination.endpoint === null) fail("invalid-publish-manifest", "Registry publication requires an endpoint");
    if (target.operation === "retain" && target.destination.endpoint !== null) fail("invalid-publish-manifest", "Archive retention cannot name a registry endpoint");
    exactKeys(target.backendPlan, ["path", "bytes", "sha256"], "publish backend plan");
    portablePath(target.backendPlan.path, "backendPlan.path");
    if (!Number.isSafeInteger(target.backendPlan.bytes) || target.backendPlan.bytes < 0) fail("invalid-publish-manifest", "backendPlan.bytes must be non-negative");
    digest(target.backendPlan.sha256, "backendPlan.sha256");
    if (!Array.isArray(target.archives) || target.archives.length === 0) fail("invalid-publish-manifest", "Publish target requires an archive");
    target.archives.forEach(archive => {
      exactKeys(archive, ["kind", "path", "bytes", "sha256"], "publish archive");
      string(archive.kind, "archive.kind");
      portablePath(archive.path, "archive.path");
      if (!Number.isSafeInteger(archive.bytes) || archive.bytes < 0) fail("invalid-publish-manifest", "archive.bytes must be non-negative");
      digest(archive.sha256, "archive.sha256");
    });
    sortedUniqueStrings(target.credentialEnvironment, "target.credentialEnvironment");
    digest(target.idempotencyKey, "target.idempotencyKey");
    if (target.idempotencyKey !== targetIdentity(target)) fail("publish-idempotency-drift", `${target.ecosystem} idempotency key differs from its action`);
  });
  if (JSON.stringify(ecosystems) !== JSON.stringify(manifest.selection.plannedEcosystems)) {
    fail("publish-selection-drift", "Planned ecosystems differ from the ordered targets");
  }

  if (!Array.isArray(manifest.omitted)) fail("invalid-publish-manifest", "omitted must be an array");
  let previousOmitted = null;
  manifest.omitted.forEach(item => {
    exactKeys(item, ["ecosystem", "name", "version", "target", "reason"], "omitted target");
    for (const field of ["ecosystem", "name", "version", "target", "reason"]) string(item[field], `omitted.${field}`);
    if (previousOmitted !== null && item.ecosystem.localeCompare(previousOmitted) <= 0) {
      fail("invalid-publish-manifest", "Omitted targets must use unique ecosystem order");
    }
    previousOmitted = item.ecosystem;
    if (ecosystems.includes(item.ecosystem)) fail("invalid-publish-manifest", `${item.ecosystem} cannot be ready and omitted`);
  });
  return true;
};

export const createPublishManifest = ({ authorization, authorizationSha256, publicationIndex, requestedTargets = [] }) => {
  validateReleaseAuthorization(authorization);
  validatePublicationIndex(publicationIndex);
  digest(authorizationSha256, "authorizationSha256");
  const requested = [...new Set(requestedTargets)].sort();
  const unknown = requested.filter(value => !publicationIndex.packages.some(item => item.ecosystem === value || item.target === value));
  if (unknown.length > 0) fail("unknown-publication-target", `Unknown publication target ${unknown.join(", ")}`, { unknown });
  const readyPackages = publicationIndex.packages.filter(item => item.status === "ready");
  const ready = readyPackages
    .filter(item => requested.length === 0 || requested.includes(item.ecosystem) || requested.includes(item.target))
    .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem));
  if (ready.length === 0) fail("no-publishable-targets", "The authorized candidate contains no registry-ready package projections");
  if (
    authorization.candidate.id === undefined ||
    authorization.candidate.sourceRevision !== publicationIndex.bundle.sourceRevision ||
    authorization.candidate.canonicalManifestSha256 !== publicationIndex.bundle.canonicalManifestSha256 ||
    authorization.publication.packagesSha256 !== sha256(canonicalJson(publicationIndex))
  ) fail("publication-authorization-drift", "Publication index differs from its release authorization");
  const targets = ready.map((item, index) => targetRecord({ item, candidateId: authorization.candidate.id, order: index + 1 }));
  const manifest = {
    schemaVersion: 1,
    predicateType,
    mode: "authorized-no-publish",
    createdAt: publicationIndex.createdAt,
    authorization: {
      path: "release-authorization.json",
      sha256: authorizationSha256,
      candidatePath: "release",
      candidateId: authorization.candidate.id,
      sourceRevision: authorization.candidate.sourceRevision,
      artifactInventorySha256: authorization.candidate.artifactInventorySha256,
      publicationIndexPath: authorization.publication.packagesPath,
      publicationIndexSha256: authorization.publication.packagesSha256,
    },
    selection: {
      allTargets: requested.length === 0,
      requested,
      plannedEcosystems: targets.map(item => item.ecosystem),
    },
    policy: {
      networkAccessPerformed: false,
      externalRegistryWritesPerformed: false,
      credentialsRead: false,
      immutableAuthorizedArtifacts: true,
      idempotentExecutionRequired: true,
    },
    targets,
    omitted: publicationIndex.packages
      .filter(item => item.status === "omitted" || !ready.includes(item))
      .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem))
      .map(item => ({
        ecosystem: item.ecosystem,
        name: item.name,
        version: item.version,
        target: item.target,
        reason: item.status === "omitted" ? item.reason : "not selected by the dry-run target constraint",
      })),
  };
  validatePublishManifest(manifest);
  return Object.freeze(manifest);
};

const digestPathFor = manifestPath => join(dirname(manifestPath), `${basename(manifestPath, ".json")}.sha256`);

export const writePublishManifest = async ({ gateRoot, requestedTargets = [], signal = undefined }) => {
  const root = resolve(gateRoot);
  signal?.throwIfAborted();
  const verified = await verifyReleaseAuthorization({ authorizationRoot: root, candidateRoot: join(root, "release") });
  signal?.throwIfAborted();
  const [authorizationSource, publicationSource] = await Promise.all([
    readFile(join(root, "release-authorization.json"), "utf8"),
    readFile(join(root, "release", "packages", "publication-index.json"), "utf8"),
  ]);
  if (sha256(authorizationSource) !== verified.authorizationSha256) {
    fail("publish-authorization-drift", "Release authorization changed while deriving the publish manifest");
  }
  const authorization = JSON.parse(authorizationSource);
  const publicationIndex = parsePublicationIndex(publicationSource);
  const manifest = createPublishManifest({
    authorization,
    authorizationSha256: verified.authorizationSha256,
    publicationIndex,
    requestedTargets,
  });
  const manifestSource = canonicalJson(manifest);
  const manifestSha256 = sha256(manifestSource);
  const path = join(root, "publish-manifest.json");
  const hashPath = digestPathFor(path);
  for (const candidate of [path, hashPath]) {
    try {
      await stat(candidate);
      fail("publish-manifest-exists", `Publish manifest output already exists: ${candidate}`);
    } catch (error) {
      if (error instanceof PublishManifestError) throw error;
      if (error.code !== "ENOENT") throw error;
    }
  }
  const staging = await mkdtemp(join(root, ".publish-manifest-"));
  let publishedManifest = false;
  try {
    signal?.throwIfAborted();
    await Promise.all([
      writeFile(join(staging, "publish-manifest.json"), manifestSource, { flag: "wx" }),
      writeFile(join(staging, "publish-manifest.sha256"), `${manifestSha256}  publish-manifest.json\n`, { flag: "wx" }),
    ]);
    signal?.throwIfAborted();
    await rename(join(staging, "publish-manifest.json"), path);
    publishedManifest = true;
    await rename(join(staging, "publish-manifest.sha256"), hashPath);
  } catch (error) {
    if (publishedManifest) await rm(path, { force: true });
    await rm(hashPath, { force: true });
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return Object.freeze({ path, hashPath, manifestSha256, manifest, authorization: verified });
};

export const verifyPublishManifest = async ({ manifestPath, requestedTargets = [], signal = undefined }) => {
  const path = resolve(manifestPath);
  const root = dirname(path);
  signal?.throwIfAborted();
  const source = await readFile(path, "utf8");
  const manifestSha256 = sha256(source);
  const hashLine = (await readFile(digestPathFor(path), "utf8")).trim();
  if (hashLine !== `${manifestSha256}  ${basename(path)}`) fail("publish-manifest-hash-drift", "Publish manifest hash record differs from its bytes");
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    fail("invalid-publish-manifest-json", "Publish manifest is not valid JSON", { cause: error.message });
  }
  validatePublishManifest(manifest);
  if (source !== canonicalJson(manifest)) fail("noncanonical-publish-manifest", "Publish manifest JSON is not canonical");
  const requested = [...new Set(requestedTargets)].sort();
  if (requested.length > 0 && JSON.stringify(requested) !== JSON.stringify(manifest.selection.requested)) {
    fail("publish-selection-drift", "Execute-time targets differ from the dry-run selection", {
      requested,
      authorized: manifest.selection.requested,
    });
  }
  const authorizationRoot = resolve(root, dirname(manifest.authorization.path));
  const candidateRoot = resolve(root, manifest.authorization.candidatePath);
  const authorization = await verifyReleaseAuthorization({ authorizationRoot, candidateRoot });
  signal?.throwIfAborted();
  if (
    authorization.authorizationSha256 !== manifest.authorization.sha256 ||
    authorization.candidate.id !== manifest.authorization.candidateId ||
    authorization.candidate.sourceRevision !== manifest.authorization.sourceRevision ||
    authorization.candidate.artifactInventorySha256 !== manifest.authorization.artifactInventorySha256
  ) fail("publish-authorization-drift", "Publish manifest differs from the verified release authorization");
  const authorizationSource = await readFile(resolve(root, manifest.authorization.path), "utf8");
  if (sha256(authorizationSource) !== authorization.authorizationSha256) {
    fail("publish-authorization-drift", "Release authorization changed during publish verification");
  }
  const publicationPath = resolve(root, manifest.authorization.publicationIndexPath);
  const publicationSource = await readFile(publicationPath, "utf8");
  if (sha256(publicationSource) !== manifest.authorization.publicationIndexSha256) {
    fail("publish-index-drift", "Publication index differs from the publish manifest");
  }
  const publicationIndex = parsePublicationIndex(publicationSource);
  const authorizationDocument = JSON.parse(authorizationSource);
  const expected = createPublishManifest({
    authorization: authorizationDocument,
    authorizationSha256: authorization.authorizationSha256,
    publicationIndex,
    requestedTargets: manifest.selection.requested,
  });
  if (canonicalJson(expected) !== source) fail("publish-plan-drift", "Publish actions differ from the authorized publication index");
  return Object.freeze({
    manifest,
    manifestPath: path,
    manifestSha256,
    authorization,
    authorizationDocument,
    authorizationRoot,
    candidateRoot,
    publicationIndexPath: publicationPath,
  });
};
