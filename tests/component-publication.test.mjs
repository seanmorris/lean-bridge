/**
 * Exercises version-two component publication with the shared signed transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
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
const externalEngine = process.env.LEAN_BRIDGE_LAKE_ENGINE;
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
	, LEAN_BRIDGE_RUNTIME_ROOT: resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy") };
// CI uses the pinned Nix engine. Locally only its command transport is injected;
// source capture, compiler-owned types, linking and publication remain real.
const compileProject = options => buildCanonicalProject({
	...options, engineRoot: process.cwd(), environment, targets: ["npm"]
	, runner: { capture: async request => {
		assert.equal(request.command, "nix");
		if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11\n", stderr: "", code: 0 };
		assert.ok(request.args.includes("run"));
		const flag = name => request.args[request.args.indexOf(name) + 1];
		if(externalEngine) await execute(resolve(externalEngine), ["--request", flag("--request"), "--component", flag("--component"), "--output", flag("--output"), "--backend", "native-nix"], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
		else await executeComponentEngineRequest({ requestPath: flag("--request"), inputRoot: flag("--component"), outputRoot: flag("--output"), engineRoot: process.cwd(), backend: "native-nix" });
		return { stdout: "", stderr: "", code: 0 };
	} }
});

// Recompute unsigned outer inventories so regressions exercise the source checks,
// rather than stopping at an unchanged archive/report hash.
const resealEvidence = async root => {
	const bundlePath = join(root, "release/bundle/component-release-bundle.json");
	const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
	const files = await collectReleaseInventory(join(root, "release/bundle"));
	bundle.files = bundle.files.filter(file => files.has(file.path)).map(file => ({
		...file
		, bytes: files.get(file.path).bytes.length
		, sha256: sha256(files.get(file.path).bytes)
	}));
	bundle.identitySha256 = sha256(canonicalJson(bundle.files));
	await writeFile(bundlePath, canonicalJson(bundle));
	const receiptPath = join(root, "release/packages/npm/component-package-receipt.json");
	const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
	receipt.componentBundleSha256 = sha256(canonicalJson(bundle));
	receipt.componentIdentitySha256 = bundle.identitySha256;
	await writeFile(receiptPath, canonicalJson(receipt));
	const reportPath = join(root, "evidence/reproducibility.json");
	const report = JSON.parse(await readFile(reportPath, "utf8"));
	const inventory = await collectReleaseInventory(join(root, "release"));
	report.artifacts = [...inventory].map(([path, item]) => ({ path, bytes: item.bytes.length, mode: item.mode, sha256: sha256(item.bytes) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	const inventorySha256 = hashReleaseInventory(report.artifacts);
	report.candidate = { id: sha256(canonicalJson({ source: report.source, component: report.component, inventorySha256 })), inventorySha256 };
	for(const build of report.builds) Object.assign(build, { receiptSha256: sha256(canonicalJson(receipt)), componentIdentitySha256: bundle.identitySha256, artifacts: report.artifacts.length });
	await writeFile(reportPath, canonicalJson(report));
};

test("ordinary component evidence signs, publishes, resumes, and rejects byte or destination drift", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-component-publication-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "project");
	await cp("tests/fixtures/onboarding/small", project, { recursive: true });
	await mkdir(join(project, "legal"));
	await rename(join(project, "LICENSE"), join(project, "legal/licence.md"));
	await writeFile(join(project, "legal/NOTICE.txt"), "");
	await writeFile(join(project, "copyright.txt"), "Library attribution fixture.\n");
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
		, environment
		, publication: { registry, tag: "next", access: "public", authMode: "token", signerPolicySha256: publicationSignerPolicySha256(policy) }
		, build: compileProject
	});
	const verified = await verifyPublishManifest({ manifestPath: result.publishManifest });
	assert.equal(verified.manifest.schemaVersion, 2);
	assert.equal(verified.authorizationDocument.candidate.component, "onboarding-small@1.0.0");
	assert.equal(verified.manifest.targets[0].name, "@example/verified-math");
	assert.equal(verified.manifest.targets[0].version, "2.3.4-beta.1");
	assert.equal(verified.manifest.targets[0].coordinate, "@example/verified-math@2.3.4-beta.1");
	for(const [source, packaged] of [["legal/licence.md", "notices/source/legal/licence.md"], ["legal/NOTICE.txt", "notices/source/legal/NOTICE.txt"], ["copyright.txt", "copyright.txt"]])
		assert.equal((await execute("tar", ["-xOf", result.packages.component, `package/${packaged}`])).stdout, await readFile(join(project, source), "utf8"));
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
	const gate = join(root, "gate"), sbomPath = join(gate, "release/bundle/metadata/sbom.json");
	const emptyNoticePath = join(gate, "release/bundle/source/legal/NOTICE.txt");
	const sourceLicensePath = join(gate, "release/bundle/source/legal/licence.md");
	const metadataPath = join(gate, "release/bundle/source/package.json");
	const retained = new Map(await Promise.all([
		receiptPath, reportPath, sbomPath, emptyNoticePath, sourceLicensePath
		, metadataPath, join(gate, "release/bundle/component-release-bundle.json")
	].map(async path => [path, await readFile(path)])));
	for(const [label, mutate, expected] of [
		["omitted notice", sbom => { sbom.notices.pop(); }, /notices differ from the captured source inventory/]
		, ["duplicate notice", sbom => { sbom.notices.push(sbom.notices[0]); }, /notices differ from the captured source inventory/]
		, ["redirected notice", sbom => { sbom.notices[0].path = "source/../LICENSE"; }, /notices differ from the captured source inventory/]
		, ["changed notice hash", sbom => { sbom.notices[0].sha256 = "0".repeat(64); }, /notices differ from the captured source inventory/]
		, ["substituted license", sbom => { sbom.license = "Apache-2.0"; }, /license differs from the captured package.json/]
		, ["missing empty notice", () => rm(emptyNoticePath), /notice differs from the captured source bytes/]
		, ["changed license bytes", () => writeFile(sourceLicensePath, "changed"), /notice differs from the captured source bytes/]
		, ["changed license declaration", () => writeFile(metadataPath, canonicalJson({ license: "Apache-2.0" })), /package.json differs from the captured source bytes/]
	]) await t.test(`resealed evidence rejects ${label}`, async () => {
		try
		{
			const sbom = JSON.parse(retained.get(sbomPath));
			await mutate(sbom);
			await writeFile(sbomPath, canonicalJson(sbom));
			await resealEvidence(gate);
			await assert.rejects(() => verifyComponentPublication(verificationRequest), expected);
		} finally
		{ await Promise.all([...retained].map(([path, bytes]) => writeFile(path, bytes))); }
	});
	await verifyPublishManifest({ manifestPath: result.publishManifest });
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

for(const [label, path, license, contents, permitted] of [
	["COPYING terms", "legal/COPYING", "MIT", null, true]
	, ["REUSE terms", "LICENSES/MIT.txt", "MIT", null, true]
	, ["attribution without terms", "NOTICE", "MIT", null, false]
	, ["attribution inside LICENSES", "LICENSES/NOTICE", "MIT", null, false]
	, ["empty terms", "LICENSE", "MIT", "", false]
	, ["undeclared license", "LICENSE", null, null, false]
	, ["blank license declaration", "LICENSE", "  ", null, false]
]) test(`component publication ${permitted ? "accepts" : "rejects"} ${label}`, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-publication-license-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "project");
	await cp("tests/fixtures/onboarding/small", project, { recursive: true });
	const terms = await readFile(join(project, "LICENSE"));
	await rm(join(project, "LICENSE"));
	await mkdir(dirname(join(project, path)), { recursive: true });
	await writeFile(join(project, path), contents ?? terms);
	await writeFile(join(project, "package.json"), canonicalJson(license === null ? {} : { license }));
	await execute("git", ["init", "--quiet"], { cwd: project });
	await execute("git", ["add", "."], { cwd: project });
	await execute("git", ["-c", "user.name=Test author", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "License fixture"], { cwd: project });
	const run = () => runComponentReproducibilityGate({ projectRoot: project, outputRoot: join(root, "gate"), engineRoot: process.cwd(), environment, build: compileProject });
	if(permitted)
	{
		const result = await run();
		assert.equal(result.result, "passed");
		assert.equal(result.externalRegistryWrites, false);
		await verifyPublishManifest({ manifestPath: result.publishManifest });
		assert.equal((await execute("tar", ["-xOf", result.packages.component, `package/notices/source/${path}`])).stdout, terms.toString());
	}
	else await assert.rejects(run, error => error.code === "invalid-component-publication" && /Declare the component license/.test(error.message));
});
