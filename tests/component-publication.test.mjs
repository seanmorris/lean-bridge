/**
 * Exercises version-two component publication with the shared signed transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";
import { authorizePublication, createPublicationSignerPolicy, publicationSignerPolicySha256 } from "../src/release/publication-attestation.mjs";
import { createNpmRegistryAdapter } from "../src/release/npm-registry-adapter.mjs";
import { createEnvironmentCredentialProvider } from "../src/release/credentials.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { parseCliArguments } from "../src/cli/contract.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { collectReleaseInventory, hashReleaseInventory } from "../src/release/reproducibility.mjs";
import { verifyComponentPublication } from "../src/release/component-publication.mjs";

const execute = promisify(execFile);

test("ordinary component evidence signs, publishes, resumes, and rejects byte or destination drift", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-component-publication-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "project");
	await cp("tests/fixtures/onboarding/small", project, { recursive: true });
	await writeFile(join(project, "lean-bridge.exports.json"), canonicalJson({
		schemaVersion: 1
		, targets: { npm: { name: "@example/verified-math", version: "2.3.4-beta.1" } }
	}));
	await execute("git", ["init", "--quiet"], { cwd: project });
	await execute("git", ["add", "."], { cwd: project });
	await execute("git", ["-c", "user.name=Test author", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "Component fixture"], { cwd: project });
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const policy = createPublicationSignerPolicy({ identity: "component-author", publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString() });
	const registry = "http://127.0.0.1:4873/";
	const result = await runComponentReproducibilityGate({
		projectRoot: project
		, outputRoot: join(root, "gate")
		, engineRoot: process.cwd()
		, publication: { registry, tag: "next", access: "public", authMode: "token", signerPolicySha256: publicationSignerPolicySha256(policy) }
		, build: async ({ projectRoot, outputRoot }) => {
			await execute(process.execPath, ["scripts/build-plain-component-side-module.mjs", "--project", projectRoot, "--output", outputRoot]);
			return { backend: "test-local-compiler", engineIdentitySha256: sha256("test-local-compiler") };
		}
	});
	const verified = await verifyPublishManifest({ manifestPath: result.publishManifest });
	assert.equal(verified.manifest.schemaVersion, 2);
	assert.equal(verified.authorizationDocument.candidate.component, "onboarding-small@1.0.0");
	assert.equal(verified.manifest.targets[0].name, "@example/verified-math");
	assert.equal(verified.manifest.targets[0].version, "2.3.4-beta.1");
	assert.equal(verified.manifest.targets[0].coordinate, "@example/verified-math@2.3.4-beta.1");
	// Even self-consistent unsigned evidence cannot substitute a different npm name.
	const receiptPath = join(root, "gate/release/packages/npm/component-package-receipt.json");
	const reportPath = join(root, "gate/evidence/reproducibility.json");
	const [receiptSource, reportSource] = await Promise.all([receiptPath, reportPath].map(path => readFile(path, "utf8")));
	const wrongReceipt = JSON.parse(receiptSource);
	wrongReceipt.package.package = "@example/substituted@2.3.4-beta.1";
	await writeFile(receiptPath, canonicalJson(wrongReceipt));
	const wrongReport = JSON.parse(reportSource);
	const inventory = await collectReleaseInventory(join(root, "gate/release"));
	wrongReport.artifacts = [...inventory].map(([path, item]) => ({ path, bytes: item.bytes.length, mode: item.mode, sha256: sha256(item.bytes) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	const inventorySha256 = hashReleaseInventory(wrongReport.artifacts);
	wrongReport.candidate = { id: sha256(canonicalJson({ source: wrongReport.source, component: wrongReport.component, inventorySha256 })), inventorySha256 };
	for(const build of wrongReport.builds) build.receiptSha256 = sha256(canonicalJson(wrongReceipt));
	await writeFile(reportPath, canonicalJson(wrongReport));
	const verificationRequest = {
		manifestPath: result.publishManifest, manifest: verified.manifest
		, manifestSha256: verified.manifestSha256
	};
	await assert.rejects(() => verifyComponentPublication(verificationRequest), /npm package coordinate differs from the bundled author configuration/);
	await assert.rejects(() => verifyPublishManifest({ manifestPath: result.publishManifest }), { code: "invalid-component-publication" });
	await Promise.all([writeFile(receiptPath, receiptSource), writeFile(reportPath, reportSource)]);
	await assertJsonSchema("component-publication", verified.manifest);
	await assertJsonSchema("component-authorization", verified.authorizationDocument);
	await assert.rejects(assertJsonSchema("component-authorization", { ...verified.authorizationDocument, unexpected: true }));
	for(const path of ["schema/component-publication.schema.json", "schema/component-authorization.schema.json"])
	{
		const schema = JSON.parse(await readFile(path, "utf8"));
		assert.equal(schema.additionalProperties, false);
		assert.equal(schema.properties.schemaVersion.const, 2);
	}
	assert.equal(verified.authorizationDocument.candidate.flakeLockSha256, undefined);
	assert.equal(verified.authorizationDocument.candidate.source.repository, "local");
	const signer = { kind: "test-ed25519", keyId: policy.signers[0].keyId, sign: bytes => sign(null, bytes, privateKey) };
	await assertJsonSchema("publication-attestation", await authorizePublication({ verified, policy, signer }));
	const remote = new Map();
	let writes = 0;
	const adapter = createNpmRegistryAdapter({ registry
	, client: {
		permission: async () => "granted"
		, inspect: async ({ coordinate }) => remote.has(coordinate) ? { status: "published", archiveSha256: remote.get(coordinate), registryReference: `${registry}archive.tgz` } : { status: "available" }
		, publish: async ({ coordinate, archivePath, tag, access }) => { assert.equal(tag, "next"); assert.equal(access, "public"); writes++; remote.set(coordinate, sha256(await readFile(archivePath))); }
	} });
	const handlers = createCliHandlers({
		registryAdapters: [adapter], attestationPolicy: policy
		, attestationSigner: signer
		, credentialProvider: createEnvironmentCredentialProvider({ environment: { NPM_TOKEN: "local-test-token" } })
		, deploymentProfileGate: () => assert.fail("Ordinary component authors do not use Lean Bridge's production approvals")
	});
	const request = parseCliArguments(["publish", "--manifest", result.publishManifest], { cwd: project, environment: {} });
	const missing = await handlers.publish(request);
	assert.equal(missing.diagnostics[0].code, "registry-dependency-unavailable");
	assert.equal(writes, 0);
	const dependency = verified.manifest.targets[0].dependencies[0];
	remote.set(dependency.coordinate, dependency.sha256);
	const published = await handlers.publish(request);
	assert.equal(published.status, "ok", JSON.stringify(published.diagnostics));
	assert.equal(published.result.transaction.status, "complete");
	assert.ok(published.result.releaseReceipt);
	assert.equal(published.result.releaseReceipt.targets[0].coordinate, "@example/verified-math@2.3.4-beta.1");
	assert.ok(published.result.releaseReceipt.targets[0].install.commands[0].includes(`--registry '${registry}'`));
	await assertJsonSchema("release-receipt", JSON.parse(await readFile(join(root, "gate/release-receipt.json"), "utf8")));
	await assertJsonSchema("registry-transaction", JSON.parse(await readFile(join(root, "gate/registry-transaction.json"), "utf8")));
	const resumed = await handlers.publish(request);
	assert.equal(resumed.status, "ok", JSON.stringify(resumed.diagnostics));
	assert.equal(writes, 1);
	assert.ok(remote.has("@example/verified-math@2.3.4-beta.1"));
	assert.equal(remote.has("onboarding-small@1.0.0"), false);
	const changed = structuredClone(verified.manifest);
	changed.targets[0].destination.endpoint = "https://attacker.invalid/";
	const source = canonicalJson(changed);
	await writeFile(result.publishManifest, source);
	await writeFile(join(root, "gate/publish-manifest.sha256"), `${sha256(source)}  publish-manifest.json\n`);
	await assert.rejects(verifyPublishManifest({ manifestPath: result.publishManifest }), { code: "invalid-component-publication" });
	await writeFile(result.publishManifest, canonicalJson(verified.manifest));
	await writeFile(join(root, "gate/publish-manifest.sha256"), `${verified.manifestSha256}  publish-manifest.json\n`);
	await writeFile(resolve(root, "gate", verified.manifest.targets[0].archives[0].path), "changed");
	await assert.rejects(verifyPublishManifest({ manifestPath: result.publishManifest }), { code: "invalid-component-publication" });
});
