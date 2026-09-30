/**
 * Require compiled wasm32 transfers and source-free npm/Composer execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { ownedPhpWasmTransferProbe } from "./owned-php-wasm-transfer-probe.mjs";
import { assertOwnedPhpWasmTransferCi } from "./owned-php-wasm-transfer-ci.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

export const ownedPhpWasmTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-wasm-transfers";
export const ownedPhpWasmTransferScope = Object.freeze({
	profiles: ["php-wasm"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true
	, installedNpm: true, installedComposer: true
	, publicExports: 26, consumingExports: 20, pointerBits: 32
	, callerModes: ["weak", "strict"], loadingModes: ["startup", "lazy"]
	, node: true, chromium: true, sourceFreeInstallation: true
	, deterministicReassembly: true, independentRebuild: true
	, sharedAliases: true, independentRetains: true, callbackReentry: true
	, multipleInputHandoffs: true, recursiveValues: true
	, allocationFaults: true, retainedExceptions: true, requestBailouts: true
	, documentationExecuted: true, combinedCRelease: true
	, transferredInputs: true, anchoredBorrowedResults: false
	, docker: false, otherConsumerBindings: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (record, names) => { for(const name of names) assert.equal(record[name], true, name); };
const block = (text, heading, language) => {
	const section = text.split(heading + "\n")[1]?.split("\n### ")[0]; assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, heading + "/" + language); return match[1] + "\n";
};
const snapshot = state => {
	assert.equal(state.runtimeState, 2); assert.equal(state.runtimeInitRuns, 1);
	assert.equal(state.componentInitRuns, 1); assert.equal(state.liveIdentities, 0);
};

/**
 * Reconstruct product sources and check all installed loading arrangements.
 *
 * @param record - Frozen execution reports from the enabled eight-test gate.
 */
export const assertOwnedPhpWasmTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpWasmTransferScope);
	assert.equal(record.run.command, ownedPhpWasmTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of record.runtime)
	{
		flags(item, ["compiledLean"]); assert.equal(item.installedPackage, false);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const native = generateOwnedNativeValueAdapters({ ...item.input, wordBits: 32, hostCallbacks: true, transferredInputs: true });
		const extension = generateOwnedPhpZendExtension(native);
		assert.equal(item.sourceSha256, sha256(extension.source)); digest(item.binarySha256); digest(item.runtimeIdentity);
		assert.equal(item.files["extension.c"], sha256(ownedPhpWasmTransferProbe(extension.source)));
		assert.equal(item.files["check.php"], sha256(await readFile("tests/fixtures/structured-types/owned-php-wasm-transfers.php")));
		assert.deepEqual(item.observations.map(value => value.strict), [0, 1]);
		for(const observed of item.observations)
		{
			assert.equal(observed.phpBits, 32); assert.equal(observed.checks, 1155);
			assert.equal(observed.heldErrors, 137); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
			assert.deepEqual(observed.functions, extension.model.functions.map(fn => fn.name).sort());
			for(const shape of ["single", "multiple"]) for(const phase of ["before", "after"])
				assert.ok(Number.isSafeInteger(observed.faults[shape][phase]) && observed.faults[shape][phase] > 0);
		}
		assert.deepEqual(item.bailouts.map(value => [value.strict, value.mode]), [0, 1].flatMap(strict => Array.from({ length: 8 }, (_, mode) => [strict, mode])));
		for(const bailout of item.bailouts)
		{
			assert.equal(bailout.status, [0, 1, 5].includes(bailout.mode) ? 0 : 1);
			for(const state of [bailout.before, bailout.after])
			{
				for(const key of ["live", "nativeLive", "identities", "scopes", "depth"]) assert.equal(state[key], 0, key);
				assert.equal(state.current, false); assert.equal(state.runtimeState, 2);
			}
		}
	}
	const packages = record.packages;
	assert.equal(packages.profile, "installed-owned-php-wasm-transfers");
	flags(packages, ["compiledLean", "installedPackage", "cliAdmission"]);
	assert.equal(packages.runtimeIdentity, hash(packages.runtimeManifest));
	assert.equal(packages.runtimeManifest.pointerBits, 32);
	assert.deepEqual(packages.runtimeManifest.pins, phpWasmCopiedPins);
	for(const item of record.runtime) assert.equal(item.runtimeIdentity, packages.runtimeIdentity);
	digest(packages.installedCli.inventorySha256); assert.equal(packages.installedCli.packagingSourceRemoved, true);
	assert.deepEqual(packages.observations.map(item => item.reviewed), [false, true]);
	for(const item of packages.observations)
	{
		flags(item, ["sourceFreeInstallation", "handoffRemoved"
			, "authorRemoved", "sourceUnchanged", "deterministicReassembly"
			, "independentlyRebuiltExactly", "receiptVerifiedWithoutProducer"]);
		assert.equal(Boolean(item.inputs.sourceIdentity.reviewedBindingIr), item.reviewed);
		assert.equal(item.inputs.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const model = createCompiledPhpWasmModel(item.inputs);
		assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 8); assert.equal(model.pointerBits, 32);
		assert.equal(model.exports.length, 26); assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		const generated = generateCompiledPhpWasmOwned(model, item.inputs.metadata, generateCompiledPhpWasmLeanAdapters(model));
		assert.deepEqual(item.receipt.ownedGraph, generated.receipt); assert.equal(item.receipt.modelSha256, hash(model));
		assert.equal(item.packageReceipt.componentIdentity, hash(item.receipt));
		assert.equal(item.receipt.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.packageReceipt.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.observer.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.observer.testOnly, true); digest(item.observer.binarySha256);
		assert.deepEqual(item.reproducedArchives, item.packageReceipt.archives);
		assert.deepEqual(item.rejected, [...Array(9).fill("php-wasm-component.json"), ...Object.keys(generated.receipt.files).sort()]);
		for(const build of [item.cliBuild, item.repeatedCliBuild])
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["php-wasm"]); }
		validatePackageSetReceipt(item.packageSetReceipt); assert.equal(item.verification.status, "ok");
		assert.equal(item.verification.result.verified, true); assert.equal(item.verification.result.receiptSha256, hash(item.packageSetReceipt));
		assert.equal(item.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-php-wasm-transfers.php")));
		const names = compileOwnedPhpZendModel(model.bindingIr, { transferredInputs: true }).functions.map(fn => fn.publicName).sort();
		const checkRun = run => {
			assert.equal(run.observed.checks, 277); assert.equal(run.observed.phpBits, 32);
			flags(run.observed, ["heldOriginalError", "ordinaryAutoload"]);
			assert.deepEqual(run.observed.functions, names);
			assert.equal(run.requestRecovery, true); snapshot(run.cleaned); snapshot(run.refreshed);
		};
		assert.deepEqual(item.executions.map(run => [run.arrangement, run.loading, run.strict]),
			["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => [0, 1].map(strict => [arrangement, loading, strict]))));
		for(const run of item.executions)
		{ checkRun(run); assert.equal(run.invalidStayedCold, true); }
		assert.deepEqual(item.browser.observations.map(value => value.arrangement), ["embedded", "composer"]);
		for(const browser of item.browser.observations)
		{
			digest(browser.executableSha256); assert.ok(browser.version);
			assert.deepEqual(browser.executions.map(run => [run.loading, run.mode]), ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
			for(const run of browser.executions)
			{
				checkRun(run); assert.equal(run.realm, "chromium"); assert.ok(run.requests.length > 0);
				for(const request of run.requests) digest(request.sha256);
				assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete", "recovered"]);
				assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2, 2] : [2, 2, 2, 2, 2]);
			}
		}
		assert.equal(item.installed.archives.length, 3);
		validateBrickMathInstall(item.installed.composerEvidence, item.installed.inventory);
		for(const [from, into] of [["runtime/package", "node_modules/@lean-bridge/php-wasm-copied-runtime"]
			, ["component/package", "node_modules/" + item.packageReceipt.npmSettings.name]
			, ["composer", "vendor/" + item.packageReceipt.composerSettings.name]])
			for(const [path, identity] of Object.entries(item.packageReceipt.files))
				if(path.startsWith(from + "/")) assert.deepEqual(item.installed.inventory[into + path.slice(from.length)], identity, path);
		for(const archive of item.installed.archives)
			assert.deepEqual(archive, item.packageReceipt.archives.find(value => value.archive === archive.archive));
	}
	const author = await readFile("docs/publish/php.md", "utf8"), consumer = await readFile("docs/php.md", "utf8");
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Export consuming inputs", "json")) });
	const doc = record.documentation;
	flags(doc, ["sourceUnchanged", "authorRemoved"]); assert.equal(doc.build.status, "ok");
	assert.deepEqual([...doc.build.result.targets].sort(), ["c", "php-wasm"]);
	assert.equal(doc.build.result.profiles.length, 2); digest(doc.build.result.sourceApiSha256);
	assert.equal(doc.leanSha256, sha256(block(author, "### Export resource-containing values", "lean")));
	assert.equal(doc.configurationSha256, sha256(config));
	assert.equal(doc.consumerSha256, sha256(block(consumer, "### Consuming inputs", "php")));
	assert.deepEqual(doc.observed, { output: "42\n42\nclosed\n", unmodifiedExample: true });
	validatePackageSetReceipt(doc.packageSetReceipt); assert.equal(doc.verification.status, "ok");
	assertOwnedPhpWasmTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
