/**
 * Reconstruct all eight callback-release targets and their installed JVM peers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { javascriptWasmOwnedPins, javascriptWasmTargetHeaders } from "../../src/build/javascript-wasm-owned-artifacts.mjs";
import { javascriptWasmOwnedProfile } from "../../src/build/javascript-wasm-owned-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertOwnedRubyCallbackCombinedRelease } from "./owned-ruby-callback-result-acceptance.mjs";
import { ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { assertOwnedDotnetCallbackPackageInputs } from "./owned-dotnet-callback-result-package-evidence.mjs";
import { assertOwnedDotnetCallbackInstalledExecution } from "./owned-dotnet-callback-result-package-execution.mjs";
import { assertOwnedJvmCallbackPackageInputs, assertOwnedJvmCallbackInstalledExecution } from "./owned-jvm-callback-result-package-evidence.mjs";

const hash = value => sha256(canonicalJson(value));
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const cli = async (report, readSource) => {
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = report;
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
	assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
	assert.equal(inventorySha256, hash(inventory)); digest(archive.sha256); assert.ok(archive.bytes > 0);
	assert.equal(report.runtimeIncluded, true); assert.equal(report.javascriptWasmInputsIncluded, true);
	assert.equal(report.phpWasmInputsIncluded, false);
	const config = JSON.parse((await readSource("config/cli-package.v1.json")).toString());
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(report.sourceDateEpoch, config.sourceDateEpoch);
	const inputPaths = ["source/.lean-wasm-patched", "source/LICENSE"
		, ...javascriptWasmTargetHeaders.map(name => `cmake/include/lean/${name}`)];
	const manifestName = "javascript-wasm-compiler-inputs.json";
	const extras = ["README.md", "package.json", "runtime/wasm/main.mjs"
		, "runtime/wasm/main.wasm"
		, ...[...inputPaths, manifestName, manifestName + ".sha256"].map(path => `runtime/javascript-wasm/${path}`)];
	assert.deepEqual(report.files.map(file => file.path).sort(), [...config.files, ...extras].sort());
	for(const path of config.files)
	{
		const mode = ["scripts/lean-bridge.mjs", "scripts/create-publication-signer-policy.mjs"].includes(path) ? 0o755 : 0o644;
		assert.deepEqual(report.files.find(file => file.path === path), { path, mode, ...identity(await readSource(path)) }, path);
	}
	for(const file of report.files)
	{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
	const inputFiles = Object.fromEntries(inputPaths.map(path => {
		const { bytes, sha256 } = report.files.find(file => file.path === `runtime/javascript-wasm/${path}`);
		return [path, { bytes, sha256 }];
	}));
	const inputs = { schemaVersion: 1
		, kind: "lean-bridge-javascript-wasm-compiler-inputs"
		, profile: javascriptWasmOwnedProfile, pins: javascriptWasmOwnedPins
		, files: inputFiles };
	const inputsBytes = canonicalJson(inputs), inputsIdentity = sha256(inputsBytes);
	for(const [name, bytes] of [[manifestName, inputsBytes], [manifestName + ".sha256", `${inputsIdentity}  ${manifestName}\n`]])
	{
		const path = `runtime/javascript-wasm/${name}`;
		assert.deepEqual(report.files.find(file => file.path === path), { path, mode: 0o644, ...identity(bytes) });
	}
	return inputsIdentity;
};

const fixture = {
	source: ownedDotnetCallbackResultCombinedSource
	, exports: [["receiverExports", 5], ["resultAnchors", 1], ["inputTransfers", 2]]
	, cProbe: source => {
		const original = "owned_aggregates_callback_record_argument1_t_host";
		assert.equal(source.split(original).length, 3);
		return source.replaceAll(original, "owned_aggregates_apply_twice_argument1_t_host");
	}
};

/**
 * Bind native/Wasm contracts, original archives and all installed peer runs.
 *
 * @param item - Original eight-target release report after producer removal.
 * @param readSource - Current source reader, or authenticated frozen source bytes.
 * @param options - Explicit CPAN participation and independent-build requirement.
 */
export const assertOwnedJvmCallbackCombinedRelease = async (item, readSource = readFile, options = {}) => {
	const { cpan = false, independentRebuild = true } = options;
	assert.equal(typeof cpan, "boolean"); assert.equal(typeof independentRebuild, "boolean");
	assert.equal(item.independentProducerBuild, independentRebuild);
	if(!independentRebuild)
		for(const field of ["independentBuild", "independentPackageSetReceipt"])
			assert.equal(Object.hasOwn(item, field), false, field);
	assert.ok(["ordinary", "reviewed"].includes(item.mode));
	const readCli = report => cli(report, readSource);
	await assertOwnedRubyCallbackCombinedRelease(item, item.mode, ["nuget", "maven", ...cpan ? ["cpan", "cpan"] : []], { ...fixture, cli: readCli });
	assert.equal(await readCli(item.cli), item.compilerInputsIdentity);
	for(const name of ["main.mjs", "main.wasm"])
		assert.equal(item.cli.files.find(file => file.path === `runtime/wasm/${name}`).sha256, item.inventory[`@lean-bridge/runtime/internal/${name}`].sha256);
	const targets = {
		c: { name: "owned-callback-combinations", version: "1.2.3" }
		, cpp: { name: "owned-cpp-callback-combinations", version: "1.2.3" }
		, cargo: { name: "owned-callback-results", version: "1.2.3" }
		, pypi: { name: "owned-callback-results", version: "1.2.3" }
		, rubygems: { name: "owned-callback-results", version: "1.2.3" }
		, npm: { name: `@owned/${item.mode}-callback-combinations`, version: "1.2.3" }
		, nuget: { name: "Owned.CallbackResults", version: "1.2.3" }
		, maven: { name: "org.leanbridge:owned-callback-results", version: "1.2.3" }
		, ...cpan ? { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } } : {}
	};
	const shared = { schemaVersion: 1, planNode: 1219, mode: item.mode
		, combined: true, input: item.nativeInput
		, componentReceipt: item.native.receipt
		, runtimeReceipt: item.nativeRuntime };
	const dotnet = item.installedDotnet;
	const managed = await assertOwnedDotnetCallbackPackageInputs({ ...shared
		, adapterReceipt: dotnet.adapterReceipt
		, compiledProjection: dotnet.compiledProjection
		, manifest: dotnet.manifest }, targets);
	await assertOwnedDotnetCallbackInstalledExecution(dotnet, managed.projection, true);
	assert.equal(dotnet.checks, 57); assert.equal(dotnet.relocatedChecks, 57);
	for(const name of ["cliRemovedBeforeConsumerInstall", "offlineInstall", "handoffRemovedBeforeRelocatedExecution"])
		assert.equal(dotnet[name], true, name);
	const jvm = { ...shared, ...item.installedJvm };
	const { model, projection, libraries, pom } = await assertOwnedJvmCallbackPackageInputs(jvm, targets);
	assert.deepEqual(model, item.native.model);
	validatePackageSetReceipt(item.receipt);
	if(independentRebuild)
	{
		validatePackageSetReceipt(item.independentPackageSetReceipt);
		assert.deepEqual(item.independentPackageSetReceipt, item.receipt);
	}
	assert.deepEqual(item.receipt.component, model.component);
	assert.deepEqual(item.receipt.profiles.map(profile => profile.id), ["javascript-wasm-owned-v1", "native-library-v1"]);
	for(const profile of item.receipt.profiles)
	{
		const compiled = profile.id === "native-library-v1" ? item.native : item.wasm;
		assert.equal(profile.bindingIrSha256, compiled.model.bindingIrSha256);
		if(profile.id === "native-library-v1") assert.equal(profile.runtimeIdentity, compiled.receipt.runtimeIdentity);
		for(const pkg of item.receipt.packages.filter(value => value.profile === profile.id)) assert.equal(pkg.runtimeIdentity, profile.runtimeIdentity);
	}
	const packages = item.receipt.packages.filter(pkg => pkg.target === "maven");
	assert.equal(packages.length, 1); const pkg = packages[0];
	assert.equal(pkg.name, jvm.manifest.name); assert.equal(pkg.version, jvm.manifest.version);
	assert.equal(pkg.runtimeIdentity, jvm.manifest.runtimeIdentity); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.artifacts.length, 2);
	const pomFile = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	assert.deepEqual(pomFile, { path: pomFile.path, ...identity(pom) });
	const nuget = item.receipt.packages.filter(pkg => pkg.target === "nuget");
	assert.equal(nuget.length, 1); assert.equal(nuget[0].name, dotnet.manifest.name);
	assert.equal(nuget[0].version, dotnet.manifest.version); assert.equal(nuget[0].runtimeIdentity, dotnet.manifest.runtimeIdentity);
	for(const build of [item.built, ...independentRebuild ? [item.independentBuild] : []])
	{
		assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0); assert.deepEqual(build.diagnostics, []);
		assert.equal(build.result.kind, "lean-bridge-multi-profile-release"); assert.equal(build.result.schemaVersion, 2);
		assert.deepEqual([...build.result.targets].sort(), Object.keys(targets).sort());
		assert.deepEqual(build.result.component, model.component);
		assert.equal(build.result.source.treeSha256, item.receipt.source.treeSha256);
		assert.equal(build.result.source.configurationSha256, model.sourceIdentity.exportConfigurationSha256);
		assert.deepEqual(build.result.policies, { sourceReadOnly: true, profilesCompiledOnce: true, componentBinariesRebuiltByProjection: false });
		assert.equal(build.result.profiles.length, 2);
		for(const profile of build.result.profiles)
		{
			const compiled = profile.profile === "native-library-v1" ? item.native : item.wasm;
			assert.equal(profile.bindingIrSha256, compiled.model.bindingIrSha256);
			assert.equal(profile.evidence.sha256, hash(compiled.receipt));
		}
		assert.deepEqual(build.result.packages.map(value => value.target).sort(), [...new Set(item.receipt.packages.map(value => value.ecosystem))].sort());
		const archives = build.result.packages.flatMap(value => value.archives);
		assert.deepEqual(archives.map(file => file.path).sort(), item.receipt.packages.flatMap(value => value.artifacts.map(file => file.path)).sort());
		for(const file of archives)
			assert.equal(file.sha256, item.receipt.packages.flatMap(value => value.artifacts).find(value => value.path === file.path).sha256);
	}
	if(independentRebuild)
	{
		const { output: firstOutput, ...first } = item.built.result;
		const { output: secondOutput, ...second } = item.independentBuild.result;
		assert.notEqual(firstOutput, secondOutput); assert.deepEqual(first, second);
	}
	await assertOwnedJvmCallbackInstalledExecution(jvm, projection, libraries, pkg);
	return { model, targets };
};
