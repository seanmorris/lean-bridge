import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalJson } from "../src/capsule/node.mjs";
import {
  authorizePublication,
  createPublicationSignerPolicy,
} from "../src/release/publication-attestation.mjs";
import {
  authorizeReleaseReceipt,
  createReleaseReceiptStatement,
  validateReleaseReceipt,
  verifyReleaseReceipt,
  verifyReleaseReceiptDocument,
  writeReleaseReceipt,
} from "../src/release/release-receipt.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const hash = character => character.repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const policy = createPublicationSignerPolicy({
  identity: "https://example.test/release-functionary",
  publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
});
const signer = Object.freeze({
  kind: "test-ed25519",
  keyId: policy.signers[0].keyId,
  sign: bytes => sign(null, bytes, privateKey),
});

const artifact = (path, bytes, digest) => ({
  path,
  mediaType: path.endsWith(".json") ? "application/json" : "application/octet-stream",
  target: "release",
  profile: "browser",
  bytes,
  mode: 0o644,
  sha256: digest,
});

const makeVerified = manifestPath => {
  const candidate = {
    id: hash("1"),
    sourceRevision: "release-revision",
    sourceTree: "source-tree",
    flakeLockSha256: hash("2"),
    component: "lean-bridge-alpha",
    version: "1.2.3",
    canonicalManifestSha256: hash("3"),
    coreArtifactSetSha256: hash("4"),
    artifactInventorySha256: hash("5"),
  };
  const authorizationDocument = {
    schemaVersion: 1,
    predicateType: "https://lean-bridge.dev/attestations/release-authorization/v1",
    status: "authorized",
    candidate,
    evidence: {
      reportPath: "evidence/reproducibility.json",
      reportSha256: hash("6"),
      humanReportPath: "evidence/reproducibility.md",
      humanReportSha256: hash("7"),
      attestationPath: "evidence/reproducibility.intoto.json",
      attestationSha256: hash("8"),
    },
    authorizedArtifacts: [
      artifact("bundle/canonical-package.json", 98, hash("3")),
      artifact("bundle/locks/flake.lock", 99, hash("2")),
      artifact("bundle/locks/graph-lock.json", 100, hash("9")),
      artifact("bundle/metadata/assurance.json", 101, hash("a")),
      artifact("bundle/metadata/provenance.intoto.json", 102, hash("b")),
      artifact("bundle/metadata/sbom.spdx.json", 103, hash("c")),
      artifact("packages/c/alpha.tar.gz", 104, hash("d")),
      artifact("packages/c/c-projection.json", 105, hash("e")),
      artifact("packages/npm/alpha.tgz", 106, hash("f")),
      artifact("packages/npm/npm-projection.json", 107, hash("0")),
      artifact("packages/publication-index.intoto.json", 108, hash("6")),
    ],
    publication: {
      externalRegistryWritesPerformed: false,
      packagesPath: "release/packages/publication-index.json",
      packagesSha256: hash("7"),
    },
  };
  const authorizationSha256 = sha256(canonicalJson(authorizationDocument));
  const manifest = {
    authorization: {
      path: "release-authorization.json",
      sha256: authorizationSha256,
      candidateId: candidate.id,
    },
    selection: { plannedEcosystems: ["c", "npm"] },
    targets: [
      {
        order: 1,
        candidateId: candidate.id,
        ecosystem: "c",
        name: "lean-bridge-alpha",
        version: "1.2.3",
        target: "c-source",
        coordinate: "lean-bridge-alpha@1.2.3",
        operation: "retain",
        destination: { kind: "archive", endpoint: null },
        idempotencyKey: hash("a"),
        backendPlan: { path: "release/packages/c/c-projection.json", bytes: 105, sha256: hash("e") },
        archives: [{ kind: "source", path: "release/packages/c/alpha.tar.gz", bytes: 104, sha256: hash("d") }],
      },
      {
        order: 2,
        candidateId: candidate.id,
        ecosystem: "npm",
        name: "@lean-bridge/alpha",
        version: "1.2.3",
        target: "node-esm",
        coordinate: "@lean-bridge/alpha@1.2.3",
        operation: "publish",
        destination: { kind: "npm", endpoint: "https://registry.npmjs.org/" },
        idempotencyKey: hash("b"),
        backendPlan: { path: "release/packages/npm/npm-projection.json", bytes: 107, sha256: hash("0") },
        archives: [{ kind: "package", path: "release/packages/npm/alpha.tgz", bytes: 106, sha256: hash("f") }],
      },
    ],
  };
  return {
    manifest,
    manifestPath,
    manifestSha256: sha256(canonicalJson(manifest)),
    authorizationDocument,
    authorization: {
      status: "authorized",
      candidate,
      authorizationSha256,
      artifactCount: authorizationDocument.authorizedArtifacts.length,
    },
  };
};

const transactionFor = (verified, publicationAttestation, status = "complete") => ({
  schemaVersion: 1,
  predicateType: "https://lean-bridge.dev/registry-transaction/v1",
  transactionId: hash("8"),
  candidateId: verified.authorization.candidate.id,
  manifest: { path: "publish-manifest.json", sha256: verified.manifestSha256 },
  attestation: {
    statementSha256: publicationAttestation.statementSha256,
    envelopeSha256: publicationAttestation.envelopeSha256,
  },
  status,
  atomicity: "independent-registry-commits",
  attemptCount: 1,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:01:00.000Z",
  externalRegistryWrites: true,
  targets: verified.manifest.targets.map(target => {
    const retained = target.operation === "retain";
    const targetStatus = retained ? "retained" : "published";
    return {
      order: target.order,
      ecosystem: target.ecosystem,
      coordinate: target.coordinate,
      operation: target.operation,
      idempotencyKey: target.idempotencyKey,
      status: targetStatus,
      attempts: retained ? 0 : 1,
      preflight: {
        permission: retained ? "not-required" : "granted",
        coordinateState: retained ? "local" : "available",
        immutable: true,
        registryReference: null,
        artifacts: retained ? target.archives.map(item => ({ sha256: item.sha256 })) : [],
        dependencies: [],
      },
      result: {
        status: targetStatus,
        registryReference: retained ? null : `https://registry.npmjs.org/${encodeURIComponent(target.name)}/-/${target.version}`,
        artifacts: target.archives.map(item => ({ sha256: item.sha256 })),
        externalWrite: !retained,
      },
      failure: null,
      recovery: {
        strategy: retained ? "replace-retained-archive-before-distribution" : "deprecate-or-publish-corrective-version",
        command: retained ? null : "npm deprecate <name>@<version> \"<reason and replacement>\"",
        effect: "Record a registry-specific corrective action.",
        source: "https://example.test/recovery",
      },
    };
  }),
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-release-receipt-"));
  const manifestPath = join(root, "publish-manifest.json");
  await writeFile(manifestPath, "{}", "utf8");
  const verified = makeVerified(manifestPath);
  const publicationAttestation = await authorizePublication({ verified, policy, signer });
  const transaction = transactionFor(verified, publicationAttestation);
  const transactionPath = join(root, "registry-transaction.json");
  const transactionSource = canonicalJson(transaction);
  await writeFile(transactionPath, transactionSource);
  return {
    root,
    verified,
    publicationAttestation,
    transaction,
    transactionPath,
    transactionSha256: sha256(transactionSource),
  };
};

test("receipt signs completed registry coordinates, package hashes, locks, and install commands", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const statement = createReleaseReceiptStatement({ ...value, policy });
  assert.equal(statement.predicate.release.flake.sha256, hash("2"));
  assert.equal(statement.predicate.release.componentGraph.sha256, hash("9"));
  assert.equal(statement.predicate.registryTransaction.targets[1].registryReference.startsWith("https://registry.npmjs.org/"), true);
  assert.deepEqual(statement.predicate.registryTransaction.targets[1].install, {
    kind: "npm",
    commands: ["npm install @lean-bridge/alpha@1.2.3"],
  });
  assert.deepEqual(statement.predicate.registryTransaction.targets[0].install, {
    kind: "retained-archive",
    commands: ["tar -xf release/packages/c/alpha.tar.gz"],
  });
  assert.equal(statement.subject.some(item => item.digest.sha256 === hash("f")), true);
});

test("writer emits one content-addressed receipt and verifies it independently", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const transactionResult = {
    transaction: {
      path: value.transactionPath,
      sha256: value.transactionSha256,
      id: value.transaction.transactionId,
      status: "complete",
    },
  };
  const written = await writeReleaseReceipt({
    verified: value.verified,
    transactionResult,
    publicationAttestation: value.publicationAttestation,
    policy,
    signer,
  });
  assert.equal(written.receiptSha256, sha256(await readFile(written.path, "utf8")));
  assert.equal(await readFile(written.hashPath, "utf8"), `${written.receiptSha256}  release-receipt.json\n`);
  assert.equal(written.targets[1].coordinate, "@lean-bridge/alpha@1.2.3");
  assert.equal(written.targets[1].install.commands[0], "npm install @lean-bridge/alpha@1.2.3");

  const verified = await verifyReleaseReceipt({
    receiptPath: written.path,
    policy,
    verifyPublishPlan: async ({ manifestPath }) => {
      assert.equal(manifestPath, value.verified.manifestPath);
      return value.verified;
    },
  });
  assert.equal(verified.status, "verified");
  assert.equal(verified.receipt.sha256, written.receiptSha256);
  assert.equal(verified.validSignatures, 1);

  let signCalls = 0;
  const idempotent = await writeReleaseReceipt({
    verified: value.verified,
    transactionResult,
    publicationAttestation: value.publicationAttestation,
    policy,
    signer: { ...signer, sign: bytes => { signCalls += 1; return signer.sign(bytes); } },
  });
  assert.equal(idempotent.receiptSha256, written.receiptSha256);
  assert.equal(signCalls, 0);

  await rm(written.hashPath);
  await assert.rejects(
    writeReleaseReceipt({
      verified: value.verified,
      transactionResult,
      publicationAttestation: value.publicationAttestation,
      policy,
      signer,
    }),
    error => error.code === "release-receipt-output-conflict",
  );
});

test("writer rejects concurrent receipt ownership before signing", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  await writeFile(join(value.root, "release-receipt.json.lock"), "occupied");
  let signCalls = 0;
  await assert.rejects(
    writeReleaseReceipt({
      verified: value.verified,
      transactionResult: {
        transaction: {
          path: value.transactionPath,
          sha256: value.transactionSha256,
          id: value.transaction.transactionId,
          status: "complete",
        },
      },
      publicationAttestation: value.publicationAttestation,
      policy,
      signer: { ...signer, sign: bytes => { signCalls += 1; return signer.sign(bytes); } },
    }),
    error => error.code === "release-receipt-locked",
  );
  assert.equal(signCalls, 0);
});

test("receipt verification rejects partial state, transaction drift, and untrusted signatures", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  await assert.rejects(
    authorizeReleaseReceipt({ ...value, transaction: transactionFor(value.verified, value.publicationAttestation, "partial"), policy, signer }),
    error => error.code === "release-receipt-transaction-incomplete",
  );
  const receipt = await authorizeReleaseReceipt({ ...value, policy, signer });
  const changed = structuredClone(value.transaction);
  changed.targets[1].result.artifacts[0].sha256 = hash("7");
  assert.throws(
    () => verifyReleaseReceiptDocument({
      receipt,
      policy,
      verified: value.verified,
      transaction: changed,
      transactionPath: value.transactionPath,
      transactionSha256: sha256(canonicalJson(changed)),
    }),
    error => error.code === "release-receipt-artifact-drift",
  );
  const otherKeys = generateKeyPairSync("ed25519");
  const otherPolicy = createPublicationSignerPolicy({
    identity: "https://example.test/other",
    publicKeyPem: otherKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  });
  assert.throws(
    () => verifyReleaseReceiptDocument({ receipt, policy: otherPolicy, ...value }),
    error => new Set(["release-receipt-signer-policy-drift", "publication-signature-threshold"]).has(error.code),
  );
});

test("receipt document and schema keep every public object closed", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const receipt = await authorizeReleaseReceipt({ ...value, policy, signer });
  assert.equal(validateReleaseReceipt(receipt), true);
  const changed = structuredClone(receipt);
  changed.unreviewed = true;
  assert.throws(() => validateReleaseReceipt(changed), error => error.code === "invalid-release-receipt");
  const schema = JSON.parse(await readFile("schema/release-receipt.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.statement.additionalProperties, false);
  assert.equal(schema.$defs.target.additionalProperties, false);
  assert.equal(schema.$defs.audit.additionalProperties, false);
});
