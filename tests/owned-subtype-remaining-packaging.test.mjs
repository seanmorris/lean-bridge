/**
 * Source-free acceptance for checked owned aggregates in the remaining hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { generateOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedDotnetEvidence } from "../src/build/owned-dotnet-artifacts.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../src/build/owned-wit-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packageOwnedNuget } from "../src/release/owned-nuget.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { verifyFinContainerEdgeFileClosure } from "./helpers/fin-container-edge-closure.mjs";
import { installFinContainerEdgeDotnet, runFinContainerEdgeDotnet } from "./helpers/fin-container-edge-dotnet-closure.mjs";
import { installFinContainerEdgeJvm, runFinContainerEdgeJvm } from "./helpers/fin-container-edge-jvm-closure.mjs";
import { installFinContainerEdgePhp, runFinContainerEdgePhp } from "./helpers/fin-container-edge-php-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedSubtypePackageReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_REMAINING_TEST === "1";
const selectedLane = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_REMAINING_PROFILE;
const lanes = ["dotnet", "jvm", "php-native", "wit-wasi"];
if(enabled) assert.ok(lanes.includes(selectedLane), "Select exactly one remaining owned Subtype host lane");

const specifications = Object.freeze({
	dotnet: {
		target: "nuget"
		, settings: { name: "LeanBridge.OwnedSubtypes", version: "1.0.0" }
		, profiles: ["dotnet"]
	}
	, jvm: {
		target: "maven"
		, settings: { name: "org.leanbridge:owned-subtypes", version: "1.0.0" }
		, profiles: ["java", "kotlin"]
	}
	, "php-native": {
		target: "php-native"
		, settings: { name: "lean-bridge/owned-subtypes", version: "1.0.0" }
		, profiles: ["php-native"]
	}
	, "wit-wasi": {
		target: "wit-wasi"
		, settings: { name: "owned-subtypes", version: "1.0.0" }
		, profiles: ["wit-wasi"]
	}
});
const extensions = { dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c" };
const sourceProfiles = { dotnet: "dotnet", java: "java", kotlin: "kotlin", "php-native": "php" };
const markers = {
	dotnet: "owned-subtype-dotnet"
	, java: "owned-subtype-java"
	, kotlin: "owned-subtype-kotlin"
	, "php-native": "owned-subtype-php"
	, "wit-wasi": "owned-subtype-wit"
};
const reports = [];
const json = async path => JSON.parse(await readFile(path, "utf8"));

test.after(async () => {
	if(enabled && reports.length === 2)
		await saveLakeFile("build/owned-subtype-remaining-packaging", `${selectedLane}.json`, canonicalJson({
			schemaVersion: 1
			, profile: "installed-owned-subtype-remaining"
			, lane: selectedLane
			, reports: reports.toSorted((left, right) => left.route.localeCompare(right.route))
		}));
});

test("remaining hosts generate callback-free checked transfer copies", () => {
	const ir = ownedSubtypePackageReviewedIr(), before = structuredClone(ir);
	const generated = {
		dotnet: generateOwnedDotnetPackage(ir, null, { transferredInputs: true, hostCallbacks: false })
		, jvm: generateOwnedJvmPackage(ir, null, { transferredInputs: true, hostCallbacks: false })
		, "php-native": generateOwnedPhpPackage(ir, null, { transferredInputs: true, hostCallbacks: false })
	};
	assert.deepEqual(ir, before);
	for(const [profile, output] of Object.entries(generated))
	{
		assert.equal(output.c.callbacks.length, 0, profile);
		assert.ok(output.c.copies?.some(copy => copy.id === "lean:Owned.Bundle"), profile);
		assert.equal(output.contract.inputTransfers.validation, "before-consumption", profile);
		assert.deepEqual(output.c.functions.map(item => item.name), [
			"newTicket", "serial", "echoRecord", "echoRecordAlternate", "transferRecord"
		], profile);
	}
});

test("remaining owned Subtype fixtures and required matrix stay registered", async () => {
	for(const [profile, extension] of Object.entries(extensions))
	{
		const path = profile === "wit-wasi" ? "tests/fixtures/structured-types/owned-subtype-installed.c"
			: `tests/fixtures/structured-types/owned-subtype-${sourceProfiles[profile]}.${extension}`;
		assert.ok((await readFile(path, "utf8")).includes(profile === "wit-wasi" ? "owned-subtype-c" : markers[profile]), path);
	}
	const source = await readFile(".github/workflows/owned-subtype-remaining.yml", "utf8");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "lane: [dotnet, jvm, php-native, wit-wasi]"
		, "cancel-in-progress: true"
		, "npm run test:owned-subtype-remaining"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-subtype-remaining-packaging/${{ matrix.lane }}.json"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

const environmentFor = lane => {
	const environment = nativeFixtureEnvironment(specifications[lane].profiles);
	if(lane === "php-native") return { ...environment
		, LEAN_BRIDGE_PHP: resolve(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php")
		, LEAN_BRIDGE_COMPOSER: resolve(process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer") };
	if(lane === "wit-wasi") return { ...environment
		, CC: resolve(process.env.CC ?? "/usr/bin/cc")
		, LEAN_BRIDGE_WASM_TOOLS: resolve(process.env.LEAN_BRIDGE_WASM_TOOLS ?? ".toolchains/wasm-tools/bin/wasm-tools")
		, LEAN_BRIDGE_WASMTIME_C_API: resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42") };
	return environment;
};

const reassemble = async ({ lane, root, output, environment, settings, projection }) => {
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	let verified, rebuilt;
	const common = { working: join(root, "reassembled"), nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	if(lane === "dotnet")
	{
		const adapterRoot = join(output, "native/owned-dotnet-binding"), dotnetRoot = join(output, "native/dotnet");
		verified = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		rebuilt = await packageOwnedNuget({ ...common, adapterRoot, dotnetRoot });
	}
	else if(lane === "jvm")
	{
		const adapterRoot = join(output, "native/owned-jvm-binding"), jvmRoot = join(output, "native/jvm");
		verified = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		rebuilt = await packageOwnedMaven({ ...common, adapterRoot, jvmRoot });
	}
	else if(lane === "php-native")
	{
		const adapterRoot = join(output, "native/owned-php-binding");
		verified = await ownedPhpEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		rebuilt = await packageOwnedPhp({ ...common, adapterRoot, environment });
	}
	else
	{
		const witRoot = join(output, "native/owned-wit-adapter");
		verified = await readVerifiedOwnedWitHost({ ...common, witRoot });
		rebuilt = await packageOwnedWasi({ ...common, witRoot });
	}
	assert.deepEqual(rebuilt.packages, projection.packages);
	for(const pkg of rebuilt.packages)
		assert.deepEqual(await readFile(join(common.working, "archives", pkg.archive))
			, await readFile(join(output, "archives", pkg.archive)), pkg.archive);
	const result = { packages: rebuilt.packages.map(pkg => ({ archive: pkg.archive, sha256: pkg.sha256 }))
		, componentReceiptSha256: sha256(canonicalJson(verified.receipt)) };
	await rm(common.working, { recursive: true, force: true });
	return result;
};

const fixtureFor = async profile => {
	if(profile === "wit-wasi")
	{
		const source = (await readFile("tests/fixtures/structured-types/owned-subtype-installed.c", "utf8"))
			.replace("owned-subtype-c:", "owned-subtype-wit:");
		return { source: () => source, success: markers[profile]
			, wit: [/resource ticket/u, /echo-record-alternate: func/u, /transfer-record: func/u]
			, verifyInstalledPackage: input => import("./helpers/fin-container-edge-closure.mjs")
				.then(module => module.verifyFinContainerEdgeArchiveClosure(input)) };
	}
	const source = await readFile(`tests/fixtures/structured-types/owned-subtype-${sourceProfiles[profile]}.${extensions[profile]}`, "utf8");
	const fixture = { source: () => source, success: markers[profile] };
	if(profile === "dotnet") fixture.installDotnet = input => installFinContainerEdgeDotnet({ ...input
		, receiptKind: "lean-bridge-owned-nuget-package", receiptSchemaVersion: 2 });
	else if(profile === "java" || profile === "kotlin") fixture.installJvm = input => installFinContainerEdgeJvm({ ...input
		, receiptKind: "lean-bridge-owned-maven-package", receiptSchemaVersion: 2 });
	else fixture.installPhp = input => installFinContainerEdgePhp({ ...input
		, receiptKind: "lean-bridge-owned-php-package", receiptSchemaVersion: 1 });
	return fixture;
};

const relocate = async ({ lane, root, consumers, observations, packages, witReceiptBytes }) => {
	const repeated = {};
	for(const profile of specifications[lane].profiles)
	{
		const original = join(consumers, profile), destination = join(root, `relocated-${profile}`);
		await rename(original, destination);
		await assert.rejects(access(original), { code: "ENOENT" });
		let executions;
		if(profile === "dotnet") executions = [await runFinContainerEdgeDotnet({
			...observations[profile].dotnetEnvironment, root: destination })];
		else if(profile === "java" || profile === "kotlin") executions = [await runFinContainerEdgeJvm({
			...observations[profile].jvmEnvironment, root: destination })];
		else if(profile === "php-native") executions = await Promise.all(["weak", "strict"].map(mode => runFinContainerEdgePhp({
			...observations[profile].phpEnvironment, root: destination }, mode)));
		else
		{
			const pkg = packages.find(item => item.role === "component");
			const installed = join(destination, `${pkg.name}-${pkg.version}-wit-wasi`);
			await verifyFinContainerEdgeFileClosure({
				installed
				, receiptPath: "lean-bridge-package.json"
				, receiptBytes: witReceiptBytes });
			executions = [await runCopied(join(destination, "consumer"), [], destination, {
				...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib") })];
			await verifyFinContainerEdgeFileClosure({
				installed
				, receiptPath: "lean-bridge-package.json"
				, receiptBytes: witReceiptBytes });
		}
		for(const execution of executions)
		{
			assert.equal(execution.stderr, "");
			assert.equal(execution.stdout, `${markers[profile]}:${observations[profile].checks}\n`);
		}
		repeated[profile] = { checks: observations[profile].checks, runs: executions.length };
	}
	return repeated;
};

for(const route of ["ordinary", "reviewed"]) test(`installed ${route} checked owned Subtypes execute in ${selectedLane ?? "unselected"}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const lane = selectedLane, specification = specifications[lane];
	const scratch = await mkdtemp(join(tmpdir(), `lean-owned-subtype-${lane}-${route}-`));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(scratch, { recursive: true, force: true });
		else t.diagnostic(`Retained failed ${lane} owned Subtype inputs: ${scratch}`);
	});
	const author = join(scratch, "author"), output = join(scratch, "producer");
	const handoff = join(scratch, "handoff"), consumers = join(scratch, "consumers");
	await cp(resolve("tests/fixtures/onboarding/owned-subtypes"), author, { recursive: true });
	const config = route === "ordinary" ? await json(join(author, "lean-bridge.exports.json"))
		: { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { [specification.target]: specification.settings };
	if(route === "reviewed" && lane === "wit-wasi") config.targets.c = specification.settings;
	await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(config));
	if(route === "reviewed") await saveLakeFile(author, "api.binding-ir.json", canonicalJson(ownedSubtypePackageReviewedIr()));
	const environment = environmentFor(lane), before = await lakeInputState(author);
	const built = await buildCanonicalProject({
		projectRoot: author
		, outputRoot: output
		, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${route}/${lane}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(author), before);
	const projection = built.projections.find(item => item.ecosystem === specification.target);
	assert.ok(projection, specification.target);
	const model = await json(join(output, "native/component/model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
	assert.equal(model.ownedGraph.hostCallbacks, undefined);
	assert.ok(model.ownedGraph.inputTransfers);
	const echo = model.bindingIr.declarations.find(item => item.name === "echoRecord");
	const alternate = model.bindingIr.declarations.find(item => item.name === "echoRecordAlternate");
	assert.equal(echo.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCount");
	assert.equal(alternate.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCountAlternate");
	const reassembled = await reassemble({ lane, root: scratch, output, environment
		, settings: specification.settings, projection });
	const receipt = await copyPackageSetHandoff(output, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await rm(author, { recursive: true, force: true });
	await rm(output, { recursive: true, force: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	const packages = receipt.packages.filter(item => item.target === specification.target);
	const observations = {};
	for(const profile of specification.profiles)
	{
		observations[profile] = await installCopiedConsumer({
			profile
			, consumer: consumers
			, handoff
			, packages, environment, fixture: await fixtureFor(profile) });
		assert.ok(observations[profile].checks >= 100);
	}
	let witReceiptBytes;
	if(lane === "wit-wasi")
	{
		const pkg = packages.find(item => item.role === "component");
		witReceiptBytes = await readFile(join(consumers, "wit-wasi", `${pkg.name}-${pkg.version}-wit-wasi`, "lean-bridge-package.json"));
	}
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const repeated = await relocate({ lane, root: scratch, consumers, observations, packages, witReceiptBytes });
	const reported = Object.fromEntries(specification.profiles.map(profile => {
		const observation = observations[profile];
		return [profile, { checks: observation.checks, consumerSha256: observation.consumerSha256 }];
	}));
	reports.push({ route, lane, sourceUnchanged: true, sourceFreeInstallation: true
		, relocatedInstallation: true, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, compilerSelectedConstructors: true
		, transferredInputCheckedBeforeHandoff: true, immutableInstalledInputs: true
		, reassembled
		, packageSetReceiptSha256: sha256(canonicalJson(receipt))
		, repeated, observations: reported
	});
	complete = true;
	t.diagnostic(`${route}/${lane}: ${specification.profiles.map(profile => `${profile}=${observations[profile].checks}`).join(", ")}`);
});
