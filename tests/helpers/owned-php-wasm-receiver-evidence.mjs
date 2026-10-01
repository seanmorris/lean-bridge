/**
 * Reconstruct PHP-Wasm receiver artifacts and require every installed route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedPhpPlainInstalledReceiverProbe, ownedPhpUnanchoredReceiverProbe } from "./owned-php-receiver-fixture.mjs";
import { ownedPhpWasmInstalledHost } from "./owned-php-wasm-packages.mjs";
import { assertOwnedPhpWasmBorrowRuntime, assertOwnedPhpWasmBorrowFibers, assertOwnedPhpWasmBorrowPackages } from "./owned-php-wasm-borrow-evidence.mjs";
import { assertOwnedPhpWasmReceiverCi } from "./owned-php-wasm-receiver-ci.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

export const ownedPhpWasmReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-wasm-receivers";
export const ownedPhpWasmReceiverScope = Object.freeze({
	profiles: ["php-wasm"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedNpm: true
	, installedComposer: true, publicExports: 27, receiverExports: 16
	, anchoredResults: 20, consumingExports: 4
	, pointerBits: 32, nominalOwners: true, readOnlyProperties: true
	, receiverAnchors: true, remainingParameterAnchors: true
	, originalOwnerTransfers: true, independentRetains: true, emptyValues: true
	, recursiveValues: true, transitiveExpiration: true, canonicalIdentity: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, callbacksWithoutAnchors: true, installedReceiverOnly: true
	, callbackReentry: true, returnedClosures: true, retainedExceptions: true
	, zendAllocationFaults: true, phpConstructionFaults: true
	, requestBailouts: true
	, parsedNegativeVariants: 8, restoredAfterMutations: true
	, nativeFiberAndForkCompanion: true, wasmFiberExecution: false
	, callerModes: ["weak", "strict"], loadingModes: ["startup", "lazy"]
	, node: true, chromium: true, sourceFreeInstallation: true
	, offlineInstall: true
	, deterministicReassembly: true, independentRebuild: true
	, documentationExecuted: true, combinedCRelease: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const snapshot = value => {
	assert.equal(value.runtimeState, 2); assert.equal(value.runtimeInitRuns, 1);
	assert.equal(value.componentInitRuns, 1); assert.equal(value.liveIdentities, 0);
};
const block = (source, heading, language) => {
	const section = source.split(heading + "\n")[1]?.split("\n### ")[0]; assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match); return match[1] + "\n";
};
const resourceConsumer = (consuming, unanchored, installed) => {
	let source = ownedPhpPlainInstalledReceiverProbe(consuming);
	if(unanchored)
	{
		source = source.slice(0, source.indexOf("use Brick")) + ownedPhpUnanchoredReceiverProbe.slice(ownedPhpUnanchoredReceiverProbe.indexOf("use Brick"));
		source = source.replace("function dispose(array $values): void {\n    foreach ($values as $value) $value->close();\n}", `function dispose(mixed $value): void {
    if ($value instanceof Big || $value instanceof Bytes) return;
    if (is_object($value)) {
        if (method_exists($value, 'close')) { $value->close(); return; }
        $value = get_object_vars($value);
    }
    if (is_array($value)) foreach ($value as $child) dispose($child);
}`);
		source = source.replace("use LeanOwnedAggregates\\Internal\\Native;\n", "");
		source = source.slice(0, source.indexOf("gc_collect_cycles(); Native::close();"))
			+ "gc_collect_cycles(); echo json_encode(['checks' => $checks, 'ordinaryAutoload' => true]);\n";
	}
	return source.replace("require __DIR__ . '/vendor/autoload.php';", installed
		? "// The host loads the installed public autoloader." : "require __DIR__ . '/autoload.php';")
		.replace("'ordinaryAutoload' => true", "'ordinaryAutoload' => true, 'phpBits' => PHP_INT_SIZE * 8");
};

/**
 * Reconstruct independently disabled callbacks, transfers and result anchors.
 *
 * @param item - Actual direct or installed resource-only observation.
 * @param lean - Base Lean fixture source.
 * @param installed - Require npm and Composer installation evidence.
 */
export const assertOwnedPhpWasmReceiverResource = (item, lean, installed = false) => {
	flags(item, ["compiledLean", "sourceUnchanged"]);
	assert.equal(item.schemaVersion, 1); assert.equal(item.installedPackage, installed);
	assert.equal(item.producerInterface, "php-wasm-build-api");
	const unanchored = installed ? false : item.unanchored, consuming = item.consuming;
	assert.equal(typeof unanchored, "boolean"); assert.equal(typeof consuming, "boolean");
	const input = { metadata: item.metadata, component: item.model.component, sourceIdentity: item.model.sourceIdentity };
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256
		, sha256(lean + (unanchored ? ownedRustReceiverSource : ownedJvmPlainReceiverSource)));
	const model = createCompiledPhpWasmModel({ ...input
		, receiverExports: true
		, transferredInputs: consuming, hostCallbacks: unanchored
		, anchoredResults: false });
	assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 10); assert.equal(model.pointerBits, 32);
	assert.equal(model.ownedGraph.resultAnchors, undefined);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), unanchored);
	assert.equal(Boolean(model.ownedGraph.inputTransfers), consuming);
	assert.equal(model.ownedGraph.receiverExports.exports.length, unanchored ? 16 : consuming ? 4 : 3);
	const generated = generateCompiledPhpWasmOwned(model, item.metadata, generateCompiledPhpWasmLeanAdapters(model));
	assert.deepEqual(item.receipt.ownedGraph, generated.receipt);
	assert.equal(Boolean(generated.receipt.files["owned/callbacks.c"]), unanchored);
	assert.equal(item.receipt.modelSha256, hash(model)); assert.equal(item.receipt.runtimeIdentity, item.runtimeIdentity);
	digest(item.runtimeIdentity); assert.equal(item.observer.runtimeIdentity, item.runtimeIdentity);
	assert.equal(item.observer.testOnly, true); digest(item.observer.binarySha256);
	assert.equal(item.consumerSha256, sha256(resourceConsumer(consuming, unanchored, installed)));
	digest(item.runnerSha256);
	const checks = unanchored ? 12 : consuming ? 26 : 25;
	const checkRun = run => {
		assert.equal(run.observed.checks, checks); assert.equal(run.observed.phpBits, 32);
		assert.equal(run.observed.ordinaryAutoload, true); snapshot(run.cleaned);
		if(installed)
		{ assert.equal(run.requestRecovery, true); snapshot(run.refreshed); }
	};
	if(!installed)
	{
		assert.deepEqual(item.observations.map(value => value.strict), [0, 1]);
		for(const run of item.observations) checkRun(run);
		return;
	}
	assert.equal(item.profile, "installed-owned-php-wasm-resource-receivers");
	assert.equal(item.installedCli, false); assert.equal(item.hostCallbacks, false); assert.equal(item.resultAnchors, false);
	flags(item, ["sourceFreeInstallation", "authorRemoved"
		, "handoffRemoved"
		, "independentBuild", "deterministicReassembly"
		, "receiptVerifiedWithoutProducer"]);
	assert.equal(item.runtimeIdentity, hash(item.runtimeManifest));
	assert.deepEqual(item.runtimeManifest.pins, phpWasmCopiedPins);
	assert.equal(item.runtimeManifest.pointerBits, 32);
	assert.equal(item.packageReceipt.componentIdentity, hash(item.receipt));
	assert.equal(item.packageReceipt.runtimeIdentity, item.runtimeIdentity);
	assert.deepEqual(item.reproducedArchives, item.packageReceipt.archives);
	assert.equal(item.runnerSha256, sha256(ownedPhpWasmInstalledHost(item.packageReceipt.npmSettings.name, true)));
	assert.deepEqual(item.executions.map(run => [run.arrangement, run.loading, run.strict])
		, ["embedded", "composer"].flatMap(arrangement => ["startup", "lazy"].flatMap(loading => [0, 1].map(strict => [arrangement, loading, strict]))));
	for(const run of item.executions)
	{ checkRun(run); assert.equal(run.invalidStayedCold, true); }
	assert.deepEqual(item.browser.observations.map(run => run.arrangement), ["embedded", "composer"]);
	for(const browser of item.browser.observations)
	{
		digest(browser.executableSha256); assert.ok(browser.version);
		assert.deepEqual(browser.executions.map(run => [run.loading, run.mode])
			, ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode])));
		for(const run of browser.executions)
		{
			checkRun(run); assert.equal(run.realm, "chromium"); assert.ok(run.requests.length > 0);
			for(const request of run.requests) digest(request.sha256);
			assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete", "recovered"]);
			assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2, 2] : [2, 2, 2, 2, 2]);
		}
	}
	validateBrickMathInstall(item.installed.composerEvidence, item.installed.inventory);
	assert.equal(item.installed.archives.length, 3);
	for(const archive of item.installed.archives)
		assert.deepEqual(archive, item.packageReceipt.archives.find(value => value.archive === archive.archive));
	for(const [from, into] of [["runtime/package", "node_modules/@lean-bridge/php-wasm-copied-runtime"]
		, ["component/package", "node_modules/" + item.packageReceipt.npmSettings.name]
		, ["composer", "vendor/" + item.packageReceipt.composerSettings.name]])
		for(const [path, identity] of Object.entries(item.packageReceipt.files))
			if(path.startsWith(from + "/")) assert.deepEqual(item.installed.inventory[into + path.slice(from.length)], identity, path);
};

/**
 * Require the complete seventeen-test gate and all thirteen actual reports.
 *
 * @param record - Frozen execution evidence and bound source identities.
 */
export const assertOwnedPhpWasmReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpWasmReceiverScope);
	assert.equal(record.run.command, ownedPhpWasmReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 17, pass: 17, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.resources.map(item => [item.mode, item.consuming, item.unanchored]), ["ordinary", "reviewed"].flatMap(mode =>
		[[mode, false, false], [mode, true, false], [mode, true, true]]));
	assert.deepEqual(record.resourcePackages.map(item => [item.mode, item.consuming]), [["ordinary", false], ["reviewed", true]]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	for(const item of record.runtime)
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + ownedRustReceiverSource));
		await assertOwnedPhpWasmBorrowRuntime(item, true);
		assert.equal(item.runtimeIdentity, record.packages.runtimeIdentity);
	}
	await assertOwnedPhpWasmBorrowFibers(record.nativeFibers, true);
	await assertOwnedPhpWasmBorrowPackages(record.packages, lean + ownedRustReceiverSource, true);
	for(const item of [...record.resources, ...record.resourcePackages])
	{
		assertOwnedPhpWasmReceiverResource(item, lean, record.resourcePackages.includes(item));
		assert.equal(item.runtimeIdentity, record.packages.runtimeIdentity);
	}
	const author = await readFile("docs/publish/php.md", "utf8"), consumer = await readFile("docs/php.md", "utf8");
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Export methods and properties", "json")) });
	const doc = record.documentation;
	flags(doc, ["sourceUnchanged", "sourceFreeInstallation", "authorRemoved", "handoffRemoved", "receiverExports"]);
	assert.equal(doc.inputTransfers, false);
	assert.equal(doc.build.status, "ok"); assert.deepEqual([...doc.build.result.targets].sort(), ["c", "php-wasm"]);
	assert.equal(doc.build.result.profiles.length, 2); digest(doc.build.result.sourceApiSha256);
	assert.deepEqual(doc.mixedTargets, ["c", "php-wasm"]);
	digest(doc.installedCli.inventorySha256); assert.equal(doc.installedCli.packagingSourceRemoved, true);
	assert.equal(doc.leanSha256, sha256(block(author, "### Export resource-containing values", "lean")));
	assert.equal(doc.configurationSha256, sha256(config));
	assert.equal(doc.consumerSha256, sha256(block(consumer, "### Methods and properties", "php")));
	digest(doc.runnerSha256);
	assert.deepEqual(doc.observations, ["startup", "lazy"].map(loading => ({ loading, output: "42\nexpired\n42\n", unmodifiedExample: true })));
	validatePackageSetReceipt(doc.packageSetReceipt); assert.equal(doc.verification.status, "ok");
	assert.equal(doc.verification.result.verified, true);
	assert.equal(doc.verification.result.receiptSha256, hash(doc.packageSetReceipt));
	assertOwnedPhpWasmReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
