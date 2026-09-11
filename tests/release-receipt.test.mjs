/**
 * Tests the release receipt behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { canonicalJson } from "../src/capsule/node.mjs";
import {
	createPublicationSignerPolicy,
	publicationSignerPolicySha256,
} from "../src/release/publication-attestation.mjs";
import {
	authorizeReleaseReceipt,
	createReleaseReceiptStatement,
	releaseInstallFor,
	validateReleaseReceipt,
	verifyReleaseReceipt,
	verifyReleaseReceiptDocument,
	writeReleaseReceipt,
} from "../src/release/release-receipt.mjs";

import { archiveFixtures, fixture, hash, policy, sha256, signer, transactionFor } from "./helpers/release-receipt-fixture.mjs";

const execute = promisify(execFile);

test("managed receipt commands use canonical registry coordinates", () => {
  const target = (ecosystem, name, version, coordinate) => ({
    ecosystem
    , name
    , version
    , coordinate
    , operation: "publish"
    , archives: []
  });
  assert.deepEqual(releaseInstallFor(target("nuget", "LeanBridge.Alpha", "0.0.0", "LeanBridge.Alpha@0.0.0")), {
    kind: "nuget"
    , commands: ["dotnet add package LeanBridge.Alpha --version 0.0.0"]
  });
  assert.deepEqual(releaseInstallFor(target("maven", "org.leanbridge:lean-alpha", "0.0.0", "org.leanbridge:lean-alpha:0.0.0")), {
    kind: "maven"
    , commands: ["mvn dependency:get -Dartifact=org.leanbridge:lean-alpha:0.0.0"]
  });
  assert.deepEqual(releaseInstallFor(target("rubygems", "lean_bridge_alpha", "0.0.0", "lean_bridge_alpha@0.0.0")), {
    kind: "rubygems"
    , commands: ["gem install lean_bridge_alpha --version 0.0.0"]
  });
});

test("receipt signs completed registry coordinates, package hashes, locks, and install commands", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const statement = createReleaseReceiptStatement({ ...value, policy });
  assert.equal(statement.predicate.release.flake.sha256, hash("2"));
  assert.equal(statement.predicate.release.componentGraph.sha256, hash("9"));
  assert.equal(statement.predicate.registryTransaction.targets[1].registryReference.startsWith("https://registry.npmjs.org/"), true);
  assert.deepEqual(statement.predicate.registryTransaction.targets[1].install, {
    kind: "npm"
    , commands: ["npm install @lean-bridge/alpha@1.2.3"]
  });
  assert.deepEqual(statement.predicate.registryTransaction.targets[0].install, {
    kind: "retained-archive"
    , commands: ["tar -xf release/packages/c/alpha.tar.gz"]
  });
  assert.equal(statement.subject.some(item => item.digest.sha256 === sha256(archiveFixtures.npm.bytes)), true);
});

test("writer emits one content-addressed receipt and verifies it independently", async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const transactionResult = {
    transaction: {
      path: value.transactionPath
      , sha256: value.transactionSha256
      , id: value.transaction.transactionId
      , status: "complete"
    }
  };
  const written = await writeReleaseReceipt({
    verified: value.verified
    , transactionResult
    , publicationAttestation: value.publicationAttestation
    , policy
    , signer
  });
  assert.equal(written.receiptSha256, sha256(await readFile(written.path, "utf8")));
  assert.equal(await readFile(written.hashPath, "utf8"), `${written.receiptSha256}  release-receipt.json\n`);
  assert.equal(written.targets[1].coordinate, "@lean-bridge/alpha@1.2.3");
  assert.equal(written.targets[1].install.commands[0], "npm install @lean-bridge/alpha@1.2.3");
  assert.equal(written.archiveHandoffs.length, 2);

  const npmDirectory = join(value.root, "release/packages/npm");
  const verifier = join(npmDirectory, "verify-release-archive.mjs");
  const receipt = join(npmDirectory, "release-receipt.json");
  const policyPath = join(npmDirectory, "publication-signer-policy.json");
  const trustedPolicySha256 = publicationSignerPolicySha256(policy);
  const verifierArguments = archive => [
    verifier
    , "--archive", archive
    , "--receipt", receipt
    , "--policy", policyPath
    , "--policy-sha256", trustedPolicySha256
    , "--subject", archiveFixtures.npm.path
    , "--coordinate", "@lean-bridge/alpha@1.2.3"
  ];
  const consumerRoot = await mkdtemp(join(tmpdir(), "lean-bridge-receipt-consumer-"));
  t.after(() => rm(consumerRoot, { recursive: true, force: true }));
  const checkedArchive = await execute(process.execPath, verifierArguments(join(value.root, archiveFixtures.npm.path)), {
    cwd: consumerRoot
  });
  const checked = JSON.parse(checkedArchive.stdout);
  assert.equal(checked.verified, true);
  assert.equal(checked.bytes, archiveFixtures.npm.bytes.length);
  assert.equal(checked.sha256, sha256(archiveFixtures.npm.bytes));
  assert.equal(checked.signerPolicySha256, trustedPolicySha256);

  const tamperedRoot = await mkdtemp(join(tmpdir(), "lean-bridge-tampered-archive-"));
  t.after(() => rm(tamperedRoot, { recursive: true, force: true }));
  const tamperedArchive = join(tamperedRoot, archiveFixtures.npm.path.split("/").at(-1));
  await writeFile(tamperedArchive, "tampered archive\n");
  await assert.rejects(
    execute(process.execPath, verifierArguments(tamperedArchive), { cwd: tamperedRoot }),
    error => error.stderr.includes("release-archive-bytes-drift"),
  );

  const replacementKeys = generateKeyPairSync("ed25519");
  const replacementPolicy = createPublicationSignerPolicy({
    identity: "https://example.test/replacement"
    , publicKeyPem: replacementKeys.publicKey.export({ type: "spki", format: "pem" }).toString()
  });
  const replacementPolicyPath = join(tamperedRoot, "publication-signer-policy.json");
  await writeFile(replacementPolicyPath, canonicalJson(replacementPolicy));
  const replacedPolicyArguments = verifierArguments(join(value.root, archiveFixtures.npm.path));
  replacedPolicyArguments[replacedPolicyArguments.indexOf(policyPath)] = replacementPolicyPath;
  await assert.rejects(
    execute(process.execPath, replacedPolicyArguments, { cwd: tamperedRoot }),
    error => error.stderr.includes("release-signer-policy-untrusted"),
  );

  const verified = await verifyReleaseReceipt({
    receiptPath: written.path
    , policy
    , verifyPublishPlan: async ({ manifestPath }) => {
      assert.equal(manifestPath, value.verified.manifestPath);
      return value.verified;
    }
  });
  assert.equal(verified.status, "verified");
  assert.equal(verified.receipt.sha256, written.receiptSha256);
  assert.equal(verified.validSignatures, 1);

  let signCalls = 0;
  const idempotent = await writeReleaseReceipt({
    verified: value.verified
    , transactionResult
    , publicationAttestation: value.publicationAttestation
    , policy
    , signer: { ...signer, sign: bytes => { signCalls += 1; return signer.sign(bytes); } }
  });
  assert.equal(idempotent.receiptSha256, written.receiptSha256);
  assert.equal(signCalls, 0);

  await rm(written.hashPath);
  await assert.rejects(
    writeReleaseReceipt({
      verified: value.verified
      , transactionResult
      , publicationAttestation: value.publicationAttestation
      , policy
      , signer
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
      verified: value.verified
      , transactionResult: {
        transaction: {
          path: value.transactionPath
          , sha256: value.transactionSha256
          , id: value.transaction.transactionId
          , status: "complete"
        }
      }
      , publicationAttestation: value.publicationAttestation
      , policy
      , signer: { ...signer, sign: bytes => { signCalls += 1; return signer.sign(bytes); } }
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
      receipt
      , policy
      , verified: value.verified
      , transaction: changed
      , transactionPath: value.transactionPath
      , transactionSha256: sha256(canonicalJson(changed))
    }),
    error => error.code === "release-receipt-artifact-drift",
  );
  const otherKeys = generateKeyPairSync("ed25519");
  const otherPolicy = createPublicationSignerPolicy({
    identity: "https://example.test/other"
    , publicKeyPem: otherKeys.publicKey.export({ type: "spki", format: "pem" }).toString()
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
  assert.equal(schema.$defs.archiveSubject.additionalProperties, false);
  assert.equal(schema.$defs.audit.additionalProperties, false);
});
