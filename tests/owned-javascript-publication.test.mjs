/**
 * Compile, sign and consume owned npm releases without writing to a registry.
 *
 * @file
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { parseCliArguments } from "../src/cli/contract.mjs";
import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { createNpmRegistryAdapter } from "../src/release/npm-registry-adapter.mjs";
import { createEnvironmentCredentialProvider } from "../src/release/credentials.mjs";
import { createPublicationSignerPolicy, publicationSignerPolicySha256 } from "../src/release/publication-attestation.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";
import { verifyComponentPublication } from "../src/release/component-publication.mjs";
import { collectReleaseInventory, hashReleaseInventory } from "../src/release/reproducibility.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const reseal = async root => {
	const path = join(root, "evidence/reproducibility.json"), report = JSON.parse(await readFile(path, "utf8"));
	report.artifacts = [...await collectReleaseInventory(join(root, "release"))].map(([path, item]) => ({ path, bytes: item.bytes.length, mode: item.mode, sha256: sha256(item.bytes) }))
		.sort((a, b) => a.path.localeCompare(b.path));
	const inventorySha256 = hashReleaseInventory(report.artifacts);
	report.candidate = { id: sha256(canonicalJson({ source: report.source, component: report.component, inventorySha256 })), inventorySha256 };
	for(const build of report.builds) build.artifacts = report.artifacts.length;
	await writeFile(path, canonicalJson(report));
};

for(const { reviewed, licensed } of [{ reviewed: false, licensed: true }, { reviewed: true, licensed: true }, { reviewed: false, licensed: false }]) test(licensed ? `${reviewed ? "reviewed" : "ordinary"} owned npm release survives signed publication and producer removal` : "owned npm publication rejects a compiled package without declared license terms", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const { root, directory } = await ownedAnalysisFixture(t, reviewed);
	const config = JSON.parse(await readFile(join(root, "lean-bridge.exports.json"), "utf8"));
	config.package = { ...(licensed ? { license: "MIT" } : {}), description: "Owned npm publication fixture." };
	config.targets = { npm: { name: reviewed ? "@owned/published-review" : "@owned/published-source", version: "1.2.3" } };
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson(config));
	if(licensed) await saveLakeFile(root, "LICENSE", await readFile("LICENSE"));
	const run = (command, args, cwd = root) => processBuildRunner.capture({ command, args, cwd, timeoutMs: 180000 });
	for(const args of [["init", "--quiet"], ["add", "."], ["-c", "user.name=Test author", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "Owned fixture"]]) await run("git", args);
	const compilerEnvironment = { ...process.env
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk")
		, LEAN_BRIDGE_JS_TARGET_RUNTIME: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") };
	const environment = { ...compilerEnvironment, LEAN_BRIDGE_BUILD_BACKEND: reviewed ? "nix" : "auto"
		, LEAN_BRIDGE_RUNTIME_ROOT: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy") };
	let engineInvocations = 0;
	const runner = { capture: async request => {
		assert.equal(request.command, "nix");
		if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
		const flag = name => request.args[request.args.indexOf(name) + 1];
		engineInvocations++;
		await executeComponentEngineRequest({ requestPath: flag("--request")
			, inputRoot: flag("--component"), outputRoot: flag("--output")
			, engineRoot: flag("--engine"), backend: "native-nix"
			, environment: compilerEnvironment });
		return { stdout: "", stderr: "", code: 0 };
	} };
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const policy = createPublicationSignerPolicy({ identity: "owned-author", publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString() });
	const signer = { kind: "test-ed25519", keyId: policy.signers[0].keyId, sign: bytes => sign(null, bytes, privateKey) };
	const policySha256 = publicationSignerPolicySha256(policy), registry = "http://127.0.0.1:4873/";
	const gateRoot = join(directory, "gate"), remote = new Map(); let writes = 0;
	const adapter = createNpmRegistryAdapter({ registry
		, client: {
			permission: async () => "granted"
			, inspect: async ({ coordinate }) => remote.has(coordinate) ? { status: "published", archiveSha256: remote.get(coordinate), registryReference: `${registry}archive.tgz` } : { status: "available" }
			, publish: async ({ coordinate, archivePath }) => { writes++; remote.set(coordinate, sha256(await readFile(archivePath))); }
		}
	});
	const handlers = createCliHandlers({
		gate: options => runComponentReproducibilityGate({ ...options, environment
			, build: options => buildCanonicalProject({ ...options, ...(reviewed ? { runner } : {}) })
			, publication: { registry, tag: "next", access: "public", authMode: "token", signerPolicySha256: policySha256 } })
		, registryAdapters: [adapter], attestationPolicy: policy
		, attestationSigner: signer
		, credentialProvider: createEnvironmentCredentialProvider({ environment: { NPM_TOKEN: "local-test-token" } })
		, deploymentProfileGate: () => assert.fail("Component authors do not need bridge production approval")
	});
	const dry = await handlers.publish(parseCliArguments(["publish", "--dry-run", "--target", "npm", "--output", gateRoot], { cwd: root, environment: {} }));
	if(!licensed)
	{
		assert.equal(dry.status, "failed"); assert.equal(writes, 0);
		assert.equal(dry.diagnostics[0].code, "invalid-component-publication");
		assert.match(dry.diagnostics[0].message, /Declare package.license and include nonempty source license terms/);
		t.diagnostic(JSON.stringify({ unlicensed: true, compiled: true, publicationRejected: true, registryWrites: writes }));
		return;
	}
	assert.equal(dry.status, "ok", JSON.stringify(dry.diagnostics)); assert.equal(writes, 0);
	assert.equal(dry.result.externalRegistryWrites, false);
	const verified = await verifyPublishManifest({ manifestPath: dry.result.publishManifest });
	const verifyEvidence = () => verifyComponentPublication({ manifestPath: dry.result.publishManifest
		, manifest: verified.manifest, manifestSha256: verified.manifestSha256 });
	const reportPath = join(gateRoot, "evidence/reproducibility.json"), reportBytes = await readFile(reportPath);
	const report = JSON.parse(reportBytes);
	assert.equal(report.builds.length, 2); assert.deepEqual(report.differences, []);
	assert.equal(engineInvocations, reviewed ? 2 : 0);
	assert.equal(verified.manifest.targets[0].backendPlan.path, "release/packages/npm/package-set-receipt.json");
	const componentPackage = join(gateRoot, "release/packages/npm/component/package/package.json");
	const originalPackage = await readFile(componentPackage);
	let rejectedMutations = 0;
	await writeFile(componentPackage, canonicalJson({ ...JSON.parse(originalPackage), name: "@attacker/substituted" }));
	await reseal(gateRoot);
	await assert.rejects(verifyEvidence(), /differs from reconstructed package bytes/);
	rejectedMutations++;
	await assert.rejects(verifyPublishManifest({ manifestPath: dry.result.publishManifest }), { code: "invalid-component-publication" });
	await writeFile(componentPackage, originalPackage); await writeFile(reportPath, reportBytes);
	const extra = join(gateRoot, "release/unrequested.txt");
	await writeFile(extra, "Not an authorized component output\n"); await reseal(gateRoot);
	await assert.rejects(verifyEvidence(), /missing or unauthorized files/);
	rejectedMutations++;
	await rm(extra); await writeFile(reportPath, reportBytes);
	for(const [path, mutate] of [
		["javascript-wasm/sbom.json", value => { value.libraries = []; }]
		, ["javascript-wasm/provenance.json", value => { value.source.leanVersion = "0.0.0"; }]
		, ["javascript-wasm/assurance.json", value => { value.checks.compilerOwnedTypes = false; }]
		, ["javascript-wasm/locks/owned-build-plan.json", value => { value.modelSha256 = "0".repeat(64); }]
	]) {
		const absolute = join(gateRoot, "release", path), original = await readFile(absolute);
		const value = JSON.parse(original); mutate(value);
		await writeFile(absolute, canonicalJson(value)); await reseal(gateRoot);
		await assert.rejects(verifyEvidence(), /differs from reconstructed package bytes/); rejectedMutations++;
		await writeFile(absolute, original); await writeFile(reportPath, reportBytes);
	}
	const execute = parseCliArguments(["publish", "--manifest", dry.result.publishManifest], { cwd: root, environment: {} });
	const missing = await handlers.publish(execute);
	assert.equal(missing.diagnostics[0].code, "registry-dependency-unavailable"); assert.equal(writes, 0);
	const dependency = verified.manifest.targets[0].dependencies[0]; remote.set(dependency.coordinate, dependency.sha256);
	const published = await handlers.publish(execute);
	assert.equal(published.status, "ok", JSON.stringify(published.diagnostics));
	assert.equal(published.result.transaction.status, "complete");
	assert.equal((await handlers.publish(execute)).status, "ok"); assert.equal(writes, 1);
	const receipt = JSON.parse(await readFile(join(gateRoot, "release-receipt.json"), "utf8"));
	assert.equal(receipt.statement.predicate.release.componentGraph.path, "javascript-wasm/locks/owned-build-plan.json");
	const consumer = join(directory, "consumer");
	await saveLakeFile(consumer, "package.json", '{"name":"owned-release-consumer","version":"1.0.0","private":true,"type":"module"}\n');
	const archiveName = dry.result.packages.component.split("/").at(-1), runtimeName = dry.result.packages.runtime.split("/").at(-1);
	for(const name of [archiveName, runtimeName, "release-receipt.json", "release-receipt.sha256", "publication-signer-policy.json", "publication-signer-policy.sha256", "verify-release-archive.mjs"])
		await cp(join(gateRoot, "release/packages/npm", name), join(consumer, name));
	await rm(root, { recursive: true }); await rm(gateRoot, { recursive: true });
	const verifyArgs = ["verify-release-archive.mjs"
		, "--archive", archiveName
		, "--receipt", "release-receipt.json", "--policy"
		, "publication-signer-policy.json", "--policy-sha256", policySha256
		, "--subject", verified.manifest.targets[0].archives[0].path
		, "--coordinate", verified.manifest.targets[0].coordinate];
	await run(process.execPath, verifyArgs, consumer);
	await assert.rejects(run(process.execPath, verifyArgs.map(value => value === policySha256 ? "0".repeat(64) : value), consumer), error =>
		JSON.parse(error.details.stderr).code === "release-signer-policy-untrusted"); rejectedMutations++;
	const archivePath = join(consumer, archiveName), archiveBytes = await readFile(archivePath);
	await writeFile(archivePath, Buffer.concat([archiveBytes, Buffer.from("changed")]));
	await assert.rejects(run(process.execPath, verifyArgs, consumer), error =>
		JSON.parse(error.details.stderr).code === "release-archive-bytes-drift"); rejectedMutations++;
	await writeFile(archivePath, archiveBytes);
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", `./${runtimeName}`, `./${archiveName}`], consumer);
	await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(config.targets.npm.name)};
const resource=api.newTicket(1n<<120n,"published\\0🙂");
assert.equal(api.serial(resource),1n<<120n);
assert.equal(api.label(resource),"published\\0🙂");
resource.dispose();assert.equal(api.close(),true);console.log("owned published consumer passed");
`);
	assert.equal((await run(process.execPath, ["call.mjs"], consumer)).stdout, "owned published consumer passed\n");
	t.diagnostic(JSON.stringify({ reviewed, cleanBuilds: 2, engineInvocations
		, injectedTransport: reviewed, actualIsolation: false
		, signedPublication: true, idempotentWrites: writes
		, standaloneVerification: true, installedNode: true
		, producerRemoved: true, rejectedMutations }));
});
