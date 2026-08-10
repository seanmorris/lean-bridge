import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

import { canonicalJson } from "../capsule/node.mjs";

const policyPredicate = "https://lean-bridge.dev/policies/publication-signer/v1";
const publicationPredicate = "https://lean-bridge.dev/attestations/publication-authorization/v1";
const statementType = "https://in-toto.io/Statement/v1";
const payloadType = "application/vnd.in-toto+json";
const sha256 = value => createHash("sha256").update(value).digest("hex");
const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};
const canonicalSnapshot = value => deepFreeze(JSON.parse(canonicalJson(value)));

export class PublicationAttestationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublicationAttestationError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new PublicationAttestationError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-publication-attestation", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-publication-attestation", `${label} fields must be closed`, { actual, expected });
  }
};

const string = (value, label) => {
  if (typeof value !== "string" || value === "") {
    fail("invalid-publication-attestation", `${label} must be a non-empty string`);
  }
};

const digest = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail("invalid-publication-attestation", `${label} must be a SHA-256 identity`);
  }
};

const publicKeyRecord = pem => {
  let key;
  try {
    key = createPublicKey(pem);
  } catch {
    fail("invalid-publication-signer-key", "Publication signer public key is not valid PEM");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    fail("unsupported-publication-signer", "Publication signer key must use Ed25519");
  }
  const canonicalPem = key.export({ type: "spki", format: "pem" }).toString();
  if (pem !== canonicalPem) {
    fail("noncanonical-publication-signer-key", "Publication signer public key must use canonical SPKI PEM");
  }
  const bytes = key.export({ type: "spki", format: "der" });
  return Object.freeze({ key, pem: canonicalPem, sha256: sha256(bytes) });
};

export const createPublicationSignerPolicy = ({ identity, publicKeyPem }) => {
  string(identity, "signer identity");
  const publicKey = publicKeyRecord(publicKeyPem);
  const policy = {
    schemaVersion: 1,
    predicateType: policyPredicate,
    threshold: 1,
    envelope: "dsse-v1",
    payloadType,
    statementType,
    publicationPredicateType: publicationPredicate,
    signers: [{
      identity,
      keyId: publicKey.sha256,
      algorithm: "ed25519",
      publicKey: {
        format: "spki-pem",
        sha256: publicKey.sha256,
        value: publicKey.pem,
      },
    }],
  };
  validatePublicationSignerPolicy(policy);
  return canonicalSnapshot(policy);
};

export const validatePublicationSignerPolicy = policy => {
  exactKeys(policy, [
    "schemaVersion", "predicateType", "threshold", "envelope", "payloadType", "statementType",
    "publicationPredicateType", "signers",
  ], "publication signer policy");
  if (
    policy.schemaVersion !== 1 || policy.predicateType !== policyPredicate || policy.threshold !== 1 ||
    policy.envelope !== "dsse-v1" || policy.payloadType !== payloadType || policy.statementType !== statementType ||
    policy.publicationPredicateType !== publicationPredicate
  ) fail("invalid-publication-attestation", "Publication signer policy version or format is invalid");
  if (!Array.isArray(policy.signers) || policy.signers.length === 0) {
    fail("invalid-publication-attestation", "Publication signer policy requires at least one signer");
  }
  let previous = null;
  const identities = new Set();
  for (const signer of policy.signers) {
    exactKeys(signer, ["identity", "keyId", "algorithm", "publicKey"], "publication signer");
    string(signer.identity, "signer.identity");
    digest(signer.keyId, "signer.keyId");
    if (signer.algorithm !== "ed25519") fail("unsupported-publication-signer", "Publication signer must use Ed25519");
    exactKeys(signer.publicKey, ["format", "sha256", "value"], "signer public key");
    if (signer.publicKey.format !== "spki-pem") fail("invalid-publication-signer-key", "Signer key format must be spki-pem");
    digest(signer.publicKey.sha256, "signer.publicKey.sha256");
    const publicKey = publicKeyRecord(signer.publicKey.value);
    if (publicKey.sha256 !== signer.publicKey.sha256 || publicKey.sha256 !== signer.keyId) {
      fail("publication-signer-key-drift", "Signer key identity differs from its public key bytes");
    }
    if (previous !== null && signer.keyId.localeCompare(previous) <= 0) {
      fail("invalid-publication-attestation", "Publication signers must use unique canonical key order");
    }
    if (identities.has(signer.identity)) fail("invalid-publication-attestation", "Publication signer identities must be unique");
    identities.add(signer.identity);
    previous = signer.keyId;
  }
  return true;
};

export const publicationSignerPolicySha256 = policy => {
  validatePublicationSignerPolicy(policy);
  return sha256(canonicalJson(policy));
};

const artifactReference = artifact => Object.freeze({ path: artifact.path, sha256: artifact.sha256 });
const isManifest = path => /(?:^|\/)(?:canonical-package|publication-index)\.json$/.test(path);
const isLock = path => /(?:^|\/)locks\/(?:flake\.lock|graph-lock\.json)$/.test(path);
const isAssurance = path => /(?:^|\/)(?:assurance|proof)(?:[./]|$)/.test(path);
const isSbom = path => /(?:^|\/)(?:sbom(?:\.|\/)|[^/]*\.spdx\.json$)/.test(path);
const isProvenance = path => /(?:provenance|\.intoto\.json$)/.test(path);

const requireVerifiedInput = verified => {
  if (verified === null || typeof verified !== "object") {
    fail("verified-publication-required", "A verified publication plan is required for signing");
  }
  if (
    verified.manifest === null || typeof verified.manifest !== "object" ||
    !Array.isArray(verified.manifest.targets) || verified.manifest.targets.length === 0 ||
    !Array.isArray(verified.manifest.selection?.plannedEcosystems) ||
    verified.manifest.authorization === null || typeof verified.manifest.authorization !== "object"
  ) fail("verified-publication-required", "Verified publish manifest is incomplete");
  const authorization = verified.authorization;
  if (authorization === null || typeof authorization !== "object") {
    fail("verified-publication-required", "Verified release authorization is missing");
  }
  const document = verified.authorizationDocument;
  if (
    document === null || typeof document !== "object" ||
    document.candidate === null || typeof document.candidate !== "object" ||
    document.evidence === null || typeof document.evidence !== "object" ||
    !Array.isArray(document.authorizedArtifacts) || document.authorizedArtifacts.length === 0
  ) fail("verified-publication-required", "Verified release authorization document is incomplete");
  for (const field of [
    "id", "flakeLockSha256", "canonicalManifestSha256", "coreArtifactSetSha256", "artifactInventorySha256",
  ]) digest(document.candidate[field], `candidate.${field}`);
  string(document.candidate.sourceRevision, "candidate.sourceRevision");
  for (const field of ["reportSha256", "attestationSha256"]) digest(document.evidence[field], `evidence.${field}`);
  digest(verified.manifestSha256, "publish manifest identity");
  digest(authorization.authorizationSha256, "release authorization identity");
  if (
    sha256(canonicalJson(document)) !== authorization.authorizationSha256 ||
    authorization.candidate === null || typeof authorization.candidate !== "object" ||
    document.candidate.id !== authorization.candidate.id ||
    sha256(canonicalJson(verified.manifest)) !== verified.manifestSha256 ||
    verified.manifest.authorization.sha256 !== authorization.authorizationSha256 ||
    verified.manifest.authorization.candidateId !== document.candidate.id
  ) fail("publication-attestation-input-drift", "Verified publication inputs do not identify one release closure");
  return document;
};

const selectedArtifact = (authorized, file, target) => {
  if (
    file === null || typeof file !== "object" || typeof file.path !== "string" ||
    !Number.isSafeInteger(file.bytes) || file.bytes < 0 || typeof file.sha256 !== "string"
  ) fail("publication-attestation-target-drift", `${target.ecosystem} target artifact record is invalid`);
  const path = file.path.startsWith("release/") ? file.path.slice("release/".length) : file.path;
  const found = authorized.get(path);
  if (found === undefined || found.sha256 !== file.sha256 || found.bytes !== file.bytes) {
    fail("publication-attestation-target-drift", `${target.ecosystem} target artifact is outside the authorized inventory`, {
      path: file.path,
    });
  }
  return Object.freeze({ name: file.path, digest: Object.freeze({ sha256: file.sha256 }) });
};

export const createPublicationStatement = ({ verified, policy }) => {
  validatePublicationSignerPolicy(policy);
  const authorization = requireVerifiedInput(verified);
  const authorized = new Map(authorization.authorizedArtifacts.map(artifact => [artifact.path, artifact]));
  const targetSubjects = [];
  for (const target of verified.manifest.targets) {
    if (
      target === null || typeof target !== "object" || target.backendPlan === undefined ||
      !Array.isArray(target.archives) || target.archives.length === 0
    ) fail("publication-attestation-target-drift", "Verified publication target is incomplete");
    targetSubjects.push(selectedArtifact(authorized, target.backendPlan, target));
    for (const archive of target.archives) targetSubjects.push(selectedArtifact(authorized, archive, target));
  }
  const subjects = [
    Object.freeze({ name: "release-authorization.json", digest: Object.freeze({ sha256: verified.authorization.authorizationSha256 }) }),
    Object.freeze({ name: "publish-manifest.json", digest: Object.freeze({ sha256: verified.manifestSha256 }) }),
    ...targetSubjects,
  ].sort((left, right) => left.name.localeCompare(right.name));
  for (let index = 1; index < subjects.length; index += 1) {
    if (subjects[index].name === subjects[index - 1].name) {
      fail("publication-attestation-subject-collision", `Publication subject path is duplicated: ${subjects[index].name}`);
    }
  }
  const assuranceArtifacts = {
    manifests: authorization.authorizedArtifacts.filter(item => isManifest(item.path)).map(artifactReference),
    locks: authorization.authorizedArtifacts.filter(item => isLock(item.path)).map(artifactReference),
    assurance: authorization.authorizedArtifacts.filter(item => isAssurance(item.path)).map(artifactReference),
    sbom: authorization.authorizedArtifacts.filter(item => isSbom(item.path)).map(artifactReference),
    provenance: authorization.authorizedArtifacts.filter(item => isProvenance(item.path)).map(artifactReference),
  };
  if (Object.values(assuranceArtifacts).some(items => items.length === 0)) {
    fail("publication-assurance-artifact-missing", "Authorized release must contain manifests, locks, assurance, SBOM, and provenance artifacts");
  }
  const statement = {
    _type: statementType,
    subject: subjects,
    predicateType: publicationPredicate,
    predicate: {
      schemaVersion: 1,
      authorization: {
        sha256: verified.authorization.authorizationSha256,
        candidate: authorization.candidate,
        reproducibilityReport: {
          path: authorization.evidence.reportPath,
          sha256: authorization.evidence.reportSha256,
        },
        reproducibilityAttestation: {
          path: authorization.evidence.attestationPath,
          sha256: authorization.evidence.attestationSha256,
        },
      },
      assuranceArtifacts,
      publication: {
        manifestSha256: verified.manifestSha256,
        plannedEcosystems: verified.manifest.selection.plannedEcosystems,
        targets: verified.manifest.targets.map(target => ({
          order: target.order,
          ecosystem: target.ecosystem,
          coordinate: target.coordinate,
          operation: target.operation,
          destination: target.destination,
          idempotencyKey: target.idempotencyKey,
          backendPlan: target.backendPlan,
          archives: target.archives,
        })),
      },
      signerPolicy: {
        sha256: publicationSignerPolicySha256(policy),
        threshold: policy.threshold,
        acceptedSigners: policy.signers.map(signer => ({
          identity: signer.identity,
          keyId: signer.keyId,
          algorithm: signer.algorithm,
        })),
      },
    },
  };
  return canonicalSnapshot(statement);
};

export const dssePreauthenticationEncoding = (type, payload) => {
  const typeBytes = Buffer.from(type, "utf8");
  const payloadBytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  return Buffer.concat([
    Buffer.from(`DSSEv1 ${typeBytes.length} `, "utf8"),
    typeBytes,
    Buffer.from(` ${payloadBytes.length} `, "utf8"),
    payloadBytes,
  ]);
};

const normalizeSigner = signer => {
  if (signer === null || typeof signer !== "object" || Array.isArray(signer)) {
    fail("publication-signer-required", "A publication signer provider is required");
  }
  string(signer.kind, "signer provider kind");
  digest(signer.keyId, "signer provider keyId");
  if (typeof signer.sign !== "function") fail("invalid-publication-signer", "Publication signer must implement sign(bytes)");
  return signer;
};

const signatureBytes = value => {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    fail("invalid-publication-signature", "Publication signer must return signature bytes");
  }
  const bytes = Buffer.from(value);
  if (bytes.length === 0) fail("invalid-publication-signature", "Publication signer returned an empty signature");
  return bytes;
};

export const authorizePublication = async ({ verified, policy, signer }) => {
  if (policy === null || policy === undefined) {
    fail("publication-signer-policy-required", "A publication signer policy is required");
  }
  validatePublicationSignerPolicy(policy);
  const policySnapshot = canonicalSnapshot(policy);
  const provider = normalizeSigner(signer);
  const accepted = policySnapshot.signers.find(item => item.keyId === provider.keyId);
  if (accepted === undefined) fail("publication-signer-not-authorized", "Publication signer is outside the accepted signer policy");
  const statement = createPublicationStatement({ verified, policy: policySnapshot });
  const statementSource = canonicalJson(statement);
  const statementSha256 = sha256(statementSource);
  const preauthenticated = dssePreauthenticationEncoding(payloadType, Buffer.from(statementSource));
  let signature;
  try {
    signature = signatureBytes(await provider.sign(preauthenticated));
  } catch (error) {
    if (error instanceof PublicationAttestationError) throw error;
    fail("publication-signer-failed", "Publication signer provider failed");
  }
  const key = createPublicKey(accepted.publicKey.value);
  if (!verifySignature(null, preauthenticated, key, signature)) {
    fail("publication-signature-invalid", "Publication signer returned a signature that does not match its authorized identity");
  }
  const envelope = Object.freeze({
    payloadType,
    payload: Buffer.from(statementSource).toString("base64"),
    signatures: Object.freeze([Object.freeze({ keyid: accepted.keyId, sig: signature.toString("base64") })]),
  });
  const envelopeSha256 = sha256(canonicalJson(envelope));
  const policySha256 = publicationSignerPolicySha256(policySnapshot);
  return Object.freeze({
    policy: policySnapshot,
    policySha256,
    statement: canonicalSnapshot(statement),
    statementSha256,
    envelope,
    envelopeSha256,
    audit: Object.freeze({
      schemaVersion: 1,
      status: "verified",
      providerKind: provider.kind,
      signer: Object.freeze({ identity: accepted.identity, keyId: accepted.keyId, algorithm: accepted.algorithm }),
      policySha256,
      statementSha256,
      envelopeSha256,
      privateMaterialReceived: false,
    }),
  });
};

export const verifyPublicationAttestation = ({ policy, envelope, verified }) => {
  validatePublicationSignerPolicy(policy);
  exactKeys(envelope, ["payloadType", "payload", "signatures"], "DSSE envelope");
  if (envelope.payloadType !== payloadType || typeof envelope.payload !== "string" || !Array.isArray(envelope.signatures)) {
    fail("invalid-publication-attestation", "DSSE envelope fields are invalid");
  }
  let payload;
  try {
    payload = Buffer.from(envelope.payload, "base64");
    if (payload.toString("base64") !== envelope.payload) throw new Error("noncanonical base64");
  } catch {
    fail("invalid-publication-attestation", "DSSE payload must use canonical base64");
  }
  const preauthenticated = dssePreauthenticationEncoding(payloadType, payload);
  let validSignatures = 0;
  const used = new Set();
  for (const signature of envelope.signatures) {
    exactKeys(signature, ["keyid", "sig"], "DSSE signature");
    digest(signature.keyid, "DSSE signature keyid");
    if (used.has(signature.keyid)) fail("invalid-publication-attestation", "DSSE signer identities must be unique");
    used.add(signature.keyid);
    const accepted = policy.signers.find(item => item.keyId === signature.keyid);
    if (accepted === undefined || typeof signature.sig !== "string") continue;
    const bytes = Buffer.from(signature.sig, "base64");
    if (bytes.toString("base64") !== signature.sig) continue;
    if (verifySignature(null, preauthenticated, createPublicKey(accepted.publicKey.value), bytes)) validSignatures += 1;
  }
  if (validSignatures < policy.threshold) fail("publication-signature-threshold", "Publication attestation does not satisfy signer policy");
  let statement;
  try {
    statement = JSON.parse(payload.toString("utf8"));
  } catch {
    fail("invalid-publication-attestation", "Signed publication statement is not valid JSON");
  }
  if (payload.toString("utf8") !== canonicalJson(statement) || statement._type !== statementType || statement.predicateType !== publicationPredicate) {
    fail("invalid-publication-attestation", "Signed publication statement is not canonical or uses the wrong predicate");
  }
  if (statement.predicate?.signerPolicy?.sha256 !== publicationSignerPolicySha256(policy)) {
    fail("publication-signer-policy-drift", "Signed publication statement names another signer policy");
  }
  if (verified === undefined) {
    fail("verified-publication-required", "Publication attestation verification requires the authorized release closure");
  }
  if (payload.toString("utf8") !== canonicalJson(createPublicationStatement({ verified, policy }))) {
    fail("publication-attestation-input-drift", "Signed publication statement differs from the verified release closure");
  }
  return Object.freeze({
    status: "verified",
    statement: canonicalSnapshot(statement),
    statementSha256: sha256(payload),
    envelopeSha256: sha256(canonicalJson(envelope)),
    validSignatures,
  });
};
