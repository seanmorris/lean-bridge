import {
  createHash,
  createPublicKey,
  randomUUID,
  verify as verifySignature,
} from "node:crypto";
import {
  link,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";
import { verifyPublishManifest } from "./publish-manifest.mjs";
import {
  dssePreauthenticationEncoding,
  publicationSignerPolicySha256,
  validatePublicationSignerPolicy,
  verifyPublicationAttestation,
} from "./publication-attestation.mjs";
import { validateRegistryTransaction } from "./registry-transaction.mjs";

const documentType = "urn:lean-bridge:release-receipt:v1";
const receiptPredicateType = "urn:lean-bridge:attestation:release-receipt:v1";
const statementType = "https://in-toto.io/Statement/v1";
const payloadType = "application/vnd.in-toto+json";
const terminalStatuses = new Set(["published", "already-published", "retained"]);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};
const canonicalSnapshot = value => deepFreeze(JSON.parse(canonicalJson(value)));

export class ReleaseReceiptError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReleaseReceiptError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new ReleaseReceiptError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-release-receipt", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-release-receipt", `${label} fields must be closed`, { actual, expected });
  }
};

const string = (value, label) => {
  if (typeof value !== "string" || value === "") fail("invalid-release-receipt", `${label} must be a non-empty string`);
};

const digest = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail("invalid-release-receipt", `${label} must be a SHA-256 identity`);
  }
};

const portablePath = (value, label) => {
  string(value, label);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) {
    fail("invalid-release-receipt", `${label} must be a relative portable path`);
  }
};

const canonicalBase64 = (value, label) => {
  string(value, label);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) fail("invalid-release-receipt", `${label} must use canonical base64`);
  return bytes;
};

const validateEnvelope = (envelope, label) => {
  exactKeys(envelope, ["payloadType", "payload", "signatures"], label);
  if (envelope.payloadType !== payloadType) fail("invalid-release-receipt", `${label} payload type is invalid`);
  canonicalBase64(envelope.payload, `${label}.payload`);
  if (!Array.isArray(envelope.signatures) || envelope.signatures.length === 0) {
    fail("invalid-release-receipt", `${label} requires signatures`);
  }
  const keys = new Set();
  for (const signature of envelope.signatures) {
    exactKeys(signature, ["keyid", "sig"], `${label} signature`);
    digest(signature.keyid, `${label} signature keyid`);
    canonicalBase64(signature.sig, `${label} signature bytes`);
    if (keys.has(signature.keyid)) fail("invalid-release-receipt", `${label} signer identities must be unique`);
    keys.add(signature.keyid);
  }
};

const verifyEnvelope = ({ envelope, policy, predicateType, label }) => {
  validateEnvelope(envelope, label);
  const payload = canonicalBase64(envelope.payload, `${label}.payload`);
  const preauthenticated = dssePreauthenticationEncoding(payloadType, payload);
  let validSignatures = 0;
  for (const signature of envelope.signatures) {
    const accepted = policy.signers.find(item => item.keyId === signature.keyid);
    if (accepted === undefined) continue;
    const bytes = canonicalBase64(signature.sig, `${label} signature bytes`);
    if (verifySignature(null, preauthenticated, createPublicKey(accepted.publicKey.value), bytes)) validSignatures += 1;
  }
  if (validSignatures < policy.threshold) {
    fail("release-receipt-signature-threshold", `${label} does not satisfy the trusted signer policy`);
  }
  let statement;
  try {
    statement = JSON.parse(payload.toString("utf8"));
  } catch {
    fail("invalid-release-receipt", `${label} payload is not valid JSON`);
  }
  if (
    payload.toString("utf8") !== canonicalJson(statement) ||
    statement._type !== statementType ||
    statement.predicateType !== predicateType
  ) fail("invalid-release-receipt", `${label} statement is not canonical or uses the wrong predicate`);
  return { statement: canonicalSnapshot(statement), payload, validSignatures };
};

const lockArtifact = (authorization, name) => {
  const suffix = `/locks/${name}`;
  const matches = authorization.authorizedArtifacts.filter(item => item.path === `locks/${name}` || item.path.endsWith(suffix));
  if (matches.length !== 1) {
    fail("release-receipt-lock-missing", `Release authorization must identify one ${name}`, { count: matches.length });
  }
  return { path: matches[0].path, sha256: matches[0].sha256 };
};

const installFor = target => {
  if (target.operation === "retain") {
    return {
      kind: "retained-archive",
      commands: target.archives.map(archive => `tar -xf ${archive.path}`),
    };
  }
  const commands = {
    npm: `npm install ${target.coordinate}`,
    cargo: `cargo add ${target.name}@${target.version}`,
    pypi: `python -m pip install ${target.coordinate}`,
  };
  const command = commands[target.ecosystem];
  if (command === undefined) {
    fail("unsupported-receipt-install", `No consumer install command is defined for ${target.ecosystem}`);
  }
  return {
    kind: target.ecosystem === "pypi" ? "pip" : target.ecosystem,
    commands: [command],
  };
};

const assertVerifiedInputs = verified => {
  if (
    verified === null || typeof verified !== "object" ||
    verified.manifest === null || typeof verified.manifest !== "object" ||
    !Array.isArray(verified.manifest.targets) || verified.manifest.targets.length === 0 ||
    verified.authorizationDocument === null || typeof verified.authorizationDocument !== "object" ||
    !Array.isArray(verified.authorizationDocument.authorizedArtifacts)
  ) fail("verified-publication-required", "A verified publication closure is required for a release receipt");
  digest(verified.manifestSha256, "publish manifest identity");
  digest(verified.authorization?.authorizationSha256, "release authorization identity");
  return verified.authorizationDocument;
};

const assertTransaction = ({ verified, transaction, transactionPath, transactionSha256, publicationAttestation }) => {
  validateRegistryTransaction(transaction);
  if (transaction.status !== "complete") {
    fail("release-receipt-transaction-incomplete", "A receipt can be issued only after every registry target completes");
  }
  const manifest = verified.manifest;
  if (
    transaction.candidateId !== manifest.authorization.candidateId ||
    transaction.manifest.path !== basename(verified.manifestPath) ||
    transaction.manifest.sha256 !== verified.manifestSha256 ||
    transaction.attestation.statementSha256 !== publicationAttestation.statementSha256 ||
    transaction.attestation.envelopeSha256 !== publicationAttestation.envelopeSha256 ||
    transaction.targets.length !== manifest.targets.length
  ) fail("release-receipt-transaction-drift", "Registry transaction differs from the authorized publication closure");
  digest(transactionSha256, "registry transaction identity");
  portablePath(basename(transactionPath), "registry transaction path");
  return transaction.targets.map((record, index) => {
    const target = manifest.targets[index];
    const publishStatuses = new Set(["published", "already-published"]);
    if (
      record.order !== target.order || record.ecosystem !== target.ecosystem ||
      record.coordinate !== target.coordinate || record.operation !== target.operation ||
      record.idempotencyKey !== target.idempotencyKey || !terminalStatuses.has(record.status) ||
      record.failure !== null || record.result === null || record.result.status !== record.status ||
      (target.operation === "publish" && (!publishStatuses.has(record.status) || record.result.registryReference === null)) ||
      (target.operation === "retain" && (record.status !== "retained" || record.result.registryReference !== null))
    ) fail("release-receipt-target-drift", `${target.ecosystem} transaction result differs from its authorized target`);
    const expectedHashes = [...new Set(target.archives.map(item => item.sha256))].sort();
    const actualHashes = record.result.artifacts.map(item => item.sha256).sort();
    if (JSON.stringify(expectedHashes) !== JSON.stringify(actualHashes)) {
      fail("release-receipt-artifact-drift", `${target.coordinate} registry result differs from its authorized archive hashes`);
    }
    return {
      order: target.order,
      ecosystem: target.ecosystem,
      coordinate: target.coordinate,
      operation: target.operation,
      destination: target.destination,
      status: record.status,
      registryReference: record.result.registryReference,
      idempotencyKey: target.idempotencyKey,
      backendPlan: target.backendPlan,
      archives: target.archives,
      install: installFor(target),
    };
  });
};

export const createReleaseReceiptStatement = ({
  verified,
  transaction,
  transactionPath,
  transactionSha256,
  publicationAttestation,
  policy,
}) => {
  validatePublicationSignerPolicy(policy);
  const authorization = assertVerifiedInputs(verified);
  const policySha256 = publicationSignerPolicySha256(policy);
  if (
    publicationAttestation === null || typeof publicationAttestation !== "object" ||
    publicationAttestation.policySha256 !== policySha256
  ) fail("release-receipt-publication-drift", "Publication authorization uses another signer policy");
  digest(publicationAttestation.statementSha256, "publication statement identity");
  digest(publicationAttestation.envelopeSha256, "publication envelope identity");
  const targets = assertTransaction({
    verified,
    transaction,
    transactionPath,
    transactionSha256,
    publicationAttestation,
  });
  const flake = lockArtifact(authorization, "flake.lock");
  const graph = lockArtifact(authorization, "graph-lock.json");
  if (flake.sha256 !== authorization.candidate.flakeLockSha256) {
    fail("release-receipt-flake-drift", "Authorized flake lock differs from the release candidate identity");
  }
  const subjects = [
    { name: basename(verified.manifest.authorization.path), digest: { sha256: verified.authorization.authorizationSha256 } },
    { name: basename(verified.manifestPath), digest: { sha256: verified.manifestSha256 } },
    { name: "publication-authorization.dsse.json", digest: { sha256: publicationAttestation.envelopeSha256 } },
    { name: basename(transactionPath), digest: { sha256: transactionSha256 } },
    ...targets.flatMap(target => target.archives.map(archive => ({
      name: archive.path,
      digest: { sha256: archive.sha256 },
    }))),
  ].sort((left, right) => left.name.localeCompare(right.name));
  for (let index = 1; index < subjects.length; index += 1) {
    if (subjects[index].name === subjects[index - 1].name) {
      fail("release-receipt-subject-collision", `Receipt subject path is duplicated: ${subjects[index].name}`);
    }
  }
  return canonicalSnapshot({
    _type: statementType,
    subject: subjects,
    predicateType: receiptPredicateType,
    predicate: {
      schemaVersion: 1,
      release: {
        candidate: authorization.candidate,
        authorization: {
          path: basename(verified.manifest.authorization.path),
          sha256: verified.authorization.authorizationSha256,
        },
        manifest: { path: basename(verified.manifestPath), sha256: verified.manifestSha256 },
        flake,
        componentGraph: graph,
      },
      publicationAuthorization: {
        statementSha256: publicationAttestation.statementSha256,
        envelopeSha256: publicationAttestation.envelopeSha256,
      },
      registryTransaction: {
        path: basename(transactionPath),
        sha256: transactionSha256,
        id: transaction.transactionId,
        status: transaction.status,
        atomicity: transaction.atomicity,
        completedAt: transaction.updatedAt,
        targets,
      },
      signerPolicy: {
        sha256: policySha256,
        threshold: policy.threshold,
        acceptedSigners: policy.signers.map(item => ({
          identity: item.identity,
          keyId: item.keyId,
          algorithm: item.algorithm,
        })),
      },
      verification: {
        command: "npm run verify:release-receipt -- --receipt release-receipt.json --policy <trusted-policy.json>",
        requiredInputs: [
          "release-receipt.json",
          "release-receipt.sha256",
          "publish-manifest.json",
          "publish-manifest.sha256",
          "registry-transaction.json",
          "release/",
          "<trusted-policy.json>",
        ],
      },
    },
  });
};

const normalizeSigner = (signer, policy) => {
  if (signer === null || typeof signer !== "object" || Array.isArray(signer)) {
    fail("release-receipt-signer-required", "A release receipt signer provider is required");
  }
  string(signer.kind, "receipt signer provider kind");
  digest(signer.keyId, "receipt signer provider keyId");
  if (typeof signer.sign !== "function") fail("invalid-release-receipt-signer", "Receipt signer must implement sign(bytes)");
  const accepted = policy.signers.find(item => item.keyId === signer.keyId);
  if (accepted === undefined) fail("release-receipt-signer-not-authorized", "Receipt signer is outside the trusted signer policy");
  return { provider: signer, accepted };
};

const signStatement = async ({ statement, signer, policy }) => {
  const { provider, accepted } = normalizeSigner(signer, policy);
  const source = canonicalJson(statement);
  const preauthenticated = dssePreauthenticationEncoding(payloadType, Buffer.from(source));
  let signature;
  try {
    signature = Buffer.from(await provider.sign(preauthenticated));
  } catch {
    fail("release-receipt-signer-failed", "Release receipt signer provider failed");
  }
  if (signature.length === 0 || !verifySignature(null, preauthenticated, createPublicKey(accepted.publicKey.value), signature)) {
    fail("release-receipt-signature-invalid", "Receipt signer returned a signature that does not match its trusted identity");
  }
  const envelope = {
    payloadType,
    payload: Buffer.from(source).toString("base64"),
    signatures: [{ keyid: accepted.keyId, sig: signature.toString("base64") }],
  };
  return { provider, accepted, source, envelope: canonicalSnapshot(envelope) };
};

export const authorizeReleaseReceipt = async options => {
  const { verified, transaction, transactionPath, transactionSha256, publicationAttestation, policy, signer } = options;
  validatePublicationSignerPolicy(policy);
  const publicationVerification = verifyPublicationAttestation({
    policy,
    envelope: publicationAttestation?.envelope,
    verified,
  });
  if (
    publicationVerification.statementSha256 !== publicationAttestation.statementSha256 ||
    publicationVerification.envelopeSha256 !== publicationAttestation.envelopeSha256
  ) fail("release-receipt-publication-drift", "Embedded publication authorization differs from its verified envelope");
  const statement = createReleaseReceiptStatement({
    verified,
    transaction,
    transactionPath,
    transactionSha256,
    publicationAttestation,
    policy,
  });
  const signed = await signStatement({ statement, signer, policy });
  const statementSha256 = sha256(signed.source);
  const envelopeSha256 = sha256(canonicalJson(signed.envelope));
  const policySha256 = publicationSignerPolicySha256(policy);
  return canonicalSnapshot({
    schemaVersion: 1,
    predicateType: documentType,
    publicationAuthorization: {
      statementSha256: publicationAttestation.statementSha256,
      envelopeSha256: publicationAttestation.envelopeSha256,
      envelope: publicationAttestation.envelope,
    },
    statement,
    statementSha256,
    envelope: signed.envelope,
    envelopeSha256,
    audit: {
      schemaVersion: 1,
      status: "verified",
      providerKind: signed.provider.kind,
      signer: {
        identity: signed.accepted.identity,
        keyId: signed.accepted.keyId,
        algorithm: signed.accepted.algorithm,
      },
      policySha256,
      publicationEnvelopeSha256: publicationAttestation.envelopeSha256,
      transactionSha256,
      statementSha256,
      envelopeSha256,
      privateMaterialReceived: false,
    },
  });
};

export const validateReleaseReceipt = receipt => {
  exactKeys(receipt, [
    "schemaVersion", "predicateType", "publicationAuthorization", "statement", "statementSha256",
    "envelope", "envelopeSha256", "audit",
  ], "release receipt");
  if (receipt.schemaVersion !== 1 || receipt.predicateType !== documentType) {
    fail("invalid-release-receipt", "Release receipt version or predicate is invalid");
  }
  exactKeys(receipt.publicationAuthorization, ["statementSha256", "envelopeSha256", "envelope"], "publication authorization");
  digest(receipt.publicationAuthorization.statementSha256, "publication statement identity");
  digest(receipt.publicationAuthorization.envelopeSha256, "publication envelope identity");
  validateEnvelope(receipt.publicationAuthorization.envelope, "publication authorization envelope");
  if (sha256(canonicalJson(receipt.publicationAuthorization.envelope)) !== receipt.publicationAuthorization.envelopeSha256) {
    fail("release-receipt-publication-drift", "Publication authorization envelope hash differs from its bytes");
  }
  digest(receipt.statementSha256, "receipt statement identity");
  digest(receipt.envelopeSha256, "receipt envelope identity");
  validateEnvelope(receipt.envelope, "release receipt envelope");
  if (
    canonicalJson(receipt.statement) !== canonicalBase64(receipt.envelope.payload, "release receipt payload").toString("utf8") ||
    sha256(canonicalJson(receipt.statement)) !== receipt.statementSha256 ||
    sha256(canonicalJson(receipt.envelope)) !== receipt.envelopeSha256
  ) fail("release-receipt-envelope-drift", "Receipt statement or envelope hash differs from its signed bytes");
  exactKeys(receipt.audit, [
    "schemaVersion", "status", "providerKind", "signer", "policySha256", "publicationEnvelopeSha256",
    "transactionSha256", "statementSha256", "envelopeSha256", "privateMaterialReceived",
  ], "release receipt audit");
  if (receipt.audit.schemaVersion !== 1 || receipt.audit.status !== "verified" || receipt.audit.privateMaterialReceived !== false) {
    fail("invalid-release-receipt", "Release receipt audit is invalid");
  }
  string(receipt.audit.providerKind, "audit.providerKind");
  exactKeys(receipt.audit.signer, ["identity", "keyId", "algorithm"], "receipt audit signer");
  string(receipt.audit.signer.identity, "audit signer identity");
  digest(receipt.audit.signer.keyId, "audit signer keyId");
  if (receipt.audit.signer.algorithm !== "ed25519") fail("invalid-release-receipt", "Receipt signer algorithm must be Ed25519");
  for (const field of ["policySha256", "publicationEnvelopeSha256", "transactionSha256", "statementSha256", "envelopeSha256"]) {
    digest(receipt.audit[field], `audit.${field}`);
  }
  if (
    receipt.audit.publicationEnvelopeSha256 !== receipt.publicationAuthorization.envelopeSha256 ||
    receipt.audit.statementSha256 !== receipt.statementSha256 || receipt.audit.envelopeSha256 !== receipt.envelopeSha256
  ) fail("release-receipt-audit-drift", "Receipt audit differs from the signed document");
  return true;
};

export const verifyReleaseReceiptDocument = ({ receipt, policy, verified, transaction, transactionPath, transactionSha256 }) => {
  validatePublicationSignerPolicy(policy);
  validateReleaseReceipt(receipt);
  const policySha256 = publicationSignerPolicySha256(policy);
  if (receipt.audit.policySha256 !== policySha256) fail("release-receipt-signer-policy-drift", "Receipt names another signer policy");
  const publication = verifyPublicationAttestation({
    policy,
    envelope: receipt.publicationAuthorization.envelope,
    verified,
  });
  if (
    publication.statementSha256 !== receipt.publicationAuthorization.statementSha256 ||
    publication.envelopeSha256 !== receipt.publicationAuthorization.envelopeSha256
  ) fail("release-receipt-publication-drift", "Receipt contains another publication authorization");
  const signed = verifyEnvelope({
    envelope: receipt.envelope,
    policy,
    predicateType: receiptPredicateType,
    label: "release receipt envelope",
  });
  const expected = createReleaseReceiptStatement({
    verified,
    transaction,
    transactionPath,
    transactionSha256,
    publicationAttestation: {
      policySha256,
      statementSha256: publication.statementSha256,
      envelopeSha256: publication.envelopeSha256,
    },
    policy,
  });
  if (canonicalJson(signed.statement) !== canonicalJson(expected) || canonicalJson(receipt.statement) !== canonicalJson(expected)) {
    fail("release-receipt-input-drift", "Signed receipt differs from the verified manifest and registry transaction");
  }
  if (receipt.audit.transactionSha256 !== transactionSha256) {
    fail("release-receipt-transaction-drift", "Receipt audit names another transaction");
  }
  return canonicalSnapshot({
    status: "verified",
    candidate: expected.predicate.release.candidate,
    transaction: {
      id: expected.predicate.registryTransaction.id,
      sha256: transactionSha256,
      atomicity: expected.predicate.registryTransaction.atomicity,
    },
    targets: expected.predicate.registryTransaction.targets.map(target => ({
      ecosystem: target.ecosystem,
      coordinate: target.coordinate,
      registryReference: target.registryReference,
      status: target.status,
      archives: target.archives,
      install: target.install,
    })),
    validSignatures: signed.validSignatures,
  });
};

const readTransaction = async path => {
  const source = await readFile(path, "utf8");
  let transaction;
  try {
    transaction = JSON.parse(source);
  } catch {
    fail("invalid-registry-transaction-json", "Registry transaction is not valid JSON", { path });
  }
  validateRegistryTransaction(transaction);
  if (source !== canonicalJson(transaction)) fail("noncanonical-registry-transaction", "Registry transaction is not canonical", { path });
  return { transaction, source, sha256: sha256(source) };
};

const receiptHashPath = path => join(dirname(path), `${basename(path, ".json")}.sha256`);

const acquireReceiptLock = async path => {
  const lockPath = `${path}.lock`;
  let handle;
  let created = false;
  try {
    handle = await open(lockPath, "wx", 0o600);
    created = true;
    await handle.writeFile(canonicalJson({ pid: process.pid }));
    await handle.sync();
  } catch (error) {
    await handle?.close();
    if (error.code === "EEXIST") fail("release-receipt-locked", "Another publisher owns the release receipt lock", { lockPath });
    if (created) await rm(lockPath, { force: true });
    throw error;
  }
  return async () => {
    try {
      await handle.close();
    } finally {
      await rm(lockPath, { force: true });
    }
  };
};

const readReceipt = async path => {
  const source = await readFile(path, "utf8");
  let receipt;
  try {
    receipt = JSON.parse(source);
  } catch {
    fail("invalid-release-receipt-json", "Release receipt is not valid JSON", { path });
  }
  validateReleaseReceipt(receipt);
  if (source !== canonicalJson(receipt)) fail("noncanonical-release-receipt", "Release receipt JSON is not canonical", { path });
  const identity = sha256(source);
  const hashLine = await readFile(receiptHashPath(path), "utf8");
  if (hashLine !== `${identity}  ${basename(path)}\n`) {
    fail("release-receipt-hash-drift", "Release receipt hash record differs from its bytes");
  }
  return { receipt, source, sha256: identity };
};

const summary = ({ path, receiptSha256, receipt, verification }) => canonicalSnapshot({
  path,
  hashPath: receiptHashPath(path),
  receiptSha256,
  statementSha256: receipt.statementSha256,
  envelopeSha256: receipt.envelopeSha256,
  candidateId: verification.candidate.id,
  transactionId: verification.transaction.id,
  targets: verification.targets,
});

export const verifyReleaseReceipt = async ({
  receiptPath,
  policy,
  signal = undefined,
  verifyPublishPlan = verifyPublishManifest,
} = {}) => {
  validatePublicationSignerPolicy(policy);
  const path = resolve(receiptPath);
  signal?.throwIfAborted();
  const loaded = await readReceipt(path);
  const release = loaded.receipt.statement.predicate?.release;
  const registry = loaded.receipt.statement.predicate?.registryTransaction;
  if (release === null || typeof release !== "object" || registry === null || typeof registry !== "object") {
    fail("invalid-release-receipt", "Receipt statement does not identify its manifest and transaction");
  }
  portablePath(release.manifest?.path, "receipt manifest path");
  portablePath(registry.path, "receipt transaction path");
  const verified = await verifyPublishPlan({ manifestPath: resolve(dirname(path), release.manifest.path), signal });
  signal?.throwIfAborted();
  const transactionPath = resolve(dirname(path), registry.path);
  const loadedTransaction = await readTransaction(transactionPath);
  const verification = verifyReleaseReceiptDocument({
    receipt: loaded.receipt,
    policy,
    verified,
    transaction: loadedTransaction.transaction,
    transactionPath,
    transactionSha256: loadedTransaction.sha256,
  });
  return canonicalSnapshot({
    ...verification,
    receipt: {
      path,
      hashPath: receiptHashPath(path),
      sha256: loaded.sha256,
      statementSha256: loaded.receipt.statementSha256,
      envelopeSha256: loaded.receipt.envelopeSha256,
    },
  });
};

export const writeReleaseReceipt = async ({
  verified,
  transactionResult,
  publicationAttestation,
  policy,
  signer,
  signal = undefined,
  receiptFile = "release-receipt.json",
} = {}) => {
  if (transactionResult?.transaction?.status !== "complete") {
    fail("release-receipt-transaction-incomplete", "A completed registry transaction result is required");
  }
  if (receiptFile.includes("/") || receiptFile.includes("\\") || !receiptFile.endsWith(".json")) {
    fail("invalid-release-receipt-path", "Receipt file must be one JSON file name");
  }
  const transactionPath = resolve(transactionResult.transaction.path);
  const loadedTransaction = await readTransaction(transactionPath);
  if (
    transactionResult.transaction.sha256 !== loadedTransaction.sha256 ||
    transactionResult.transaction.id !== loadedTransaction.transaction.transactionId
  ) fail("release-receipt-transaction-drift", "Registry transaction result differs from its durable journal");
  const path = resolve(dirname(verified.manifestPath), receiptFile);
  if (dirname(transactionPath) !== dirname(path)) {
    fail("release-receipt-transaction-drift", "Receipt and registry transaction must share the publish manifest directory");
  }
  const releaseLock = await acquireReceiptLock(path);
  try {
    signal?.throwIfAborted();
    let receiptExists = true;
    try {
      await stat(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      receiptExists = false;
    }
    if (receiptExists) {
      let existing;
      try {
        existing = await readReceipt(path);
      } catch (error) {
        if (error.code === "ENOENT") {
          fail("release-receipt-output-conflict", "Release receipt exists without its content hash record", { path });
        }
        throw error;
      }
      const verification = verifyReleaseReceiptDocument({
        receipt: existing.receipt,
        policy,
        verified,
        transaction: loadedTransaction.transaction,
        transactionPath,
        transactionSha256: loadedTransaction.sha256,
      });
      return summary({ path, receiptSha256: existing.sha256, receipt: existing.receipt, verification });
    }
    const hashPath = receiptHashPath(path);
    try {
      await stat(hashPath);
      fail("release-receipt-output-conflict", `Receipt hash exists without its receipt: ${hashPath}`);
    } catch (error) {
      if (error instanceof ReleaseReceiptError) throw error;
      if (error.code !== "ENOENT") throw error;
    }
    const receipt = await authorizeReleaseReceipt({
      verified,
      transaction: loadedTransaction.transaction,
      transactionPath,
      transactionSha256: loadedTransaction.sha256,
      publicationAttestation,
      policy,
      signer,
    });
    const source = canonicalJson(receipt);
    const receiptSha256 = sha256(source);
    const staging = await mkdtemp(join(dirname(path), `.release-receipt-${process.pid}-${randomUUID()}-`));
    let publishedReceipt = false;
    let publishedHash = false;
    try {
      signal?.throwIfAborted();
      await Promise.all([
        writeFile(join(staging, basename(path)), source, { flag: "wx", mode: 0o644 }),
        writeFile(join(staging, basename(hashPath)), `${receiptSha256}  ${basename(path)}\n`, { flag: "wx", mode: 0o644 }),
      ]);
      await link(join(staging, basename(path)), path);
      publishedReceipt = true;
      await link(join(staging, basename(hashPath)), hashPath);
      publishedHash = true;
    } catch (error) {
      if (publishedReceipt) await rm(path, { force: true });
      if (publishedHash) await rm(hashPath, { force: true });
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    const verification = verifyReleaseReceiptDocument({
      receipt,
      policy,
      verified,
      transaction: loadedTransaction.transaction,
      transactionPath,
      transactionSha256: loadedTransaction.sha256,
    });
    return summary({ path, receiptSha256, receipt, verification });
  } finally {
    await releaseLock();
  }
};
