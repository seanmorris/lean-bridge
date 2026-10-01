/**
 * Require executed wasm32 owner lifetimes and reconstruct their compiled inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferRuntime } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { ownedAggregateLeaseRuntime } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../../src/backends/php/owned-zend-php.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedPhpWasmTransferProbe } from "./owned-php-wasm-transfer-probe.mjs";
import { assertOwnedPhpWasmBorrowCi } from "./owned-php-wasm-borrow-ci.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { ownedPhpInstalledReceiverProbe } from "./owned-php-receiver-fixture.mjs";
import { ownedPhpWasmInstalledHost } from "./owned-php-wasm-packages.mjs";

export const ownedPhpWasmBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-wasm-borrows";

/**
 * Reconstruct installed artifacts and check every Node and Chromium arrangement.
 *
 * @param packages - Installed npm and Composer execution reports.
 * @param lean - Complete source compiled by both independent builds.
 * @param receiverExports - Require nominal receiver members and anchors.
 */
export const assertOwnedPhpWasmBorrowPackages = async (packages, lean, receiverExports = false) => {
	assert.equal(packages.profile, receiverExports ? "installed-owned-php-wasm-receivers" : "installed-owned-php-wasm-borrows");
	flags(packages, ["compiledLean", "installedPackage", "cliAdmission"]);
	assert.equal(packages.runtimeIdentity, hash(packages.runtimeManifest));
	assert.equal(packages.runtimeManifest.pointerBits, 32);
	assert.deepEqual(packages.runtimeManifest.pins, phpWasmCopiedPins);
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
		assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, receiverExports ? 10 : 9); assert.equal(model.pointerBits, 32);
		assert.equal(model.exports.length, receiverExports ? 27 : 26); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, receiverExports ? 20 : 19);
		if(receiverExports) assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		const generated = generateCompiledPhpWasmOwned(model, item.inputs.metadata, generateCompiledPhpWasmLeanAdapters(model));
		assert.deepEqual(item.receipt.ownedGraph, generated.receipt); assert.equal(item.receipt.modelSha256, hash(model));
		assert.equal(item.packageReceipt.componentIdentity, hash(item.receipt));
		assert.equal(item.receipt.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.packageReceipt.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.observer.runtimeIdentity, packages.runtimeIdentity);
		assert.equal(item.observer.testOnly, true); digest(item.observer.binarySha256);
		assert.deepEqual(item.reproducedArchives, item.packageReceipt.archives);
		assert.deepEqual(item.rejected, [...Array(9).fill("php-wasm-component.json"), ...Object.keys(generated.receipt.files).sort(), ...Array(receiverExports ? 11 : 6).fill("php-wasm-component.json")]);
		for(const build of [item.cliBuild, item.repeatedCliBuild])
		{ assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["php-wasm"]); }
		validatePackageSetReceipt(item.packageSetReceipt); assert.equal(item.verification.status, "ok");
		assert.equal(item.verification.result.verified, true); assert.equal(item.verification.result.receiptSha256, hash(item.packageSetReceipt));
		const consumer = (receiverExports ? await ownedPhpInstalledReceiverProbe() : await fixture("owned-installed-php-borrows"))
			.replace("require __DIR__ . '/vendor/autoload.php';", "// The host has already loaded the installed Composer or embedded autoloader.")
			.replace("'ordinaryAutoload' => true", "'phpBits' => PHP_INT_SIZE * 8, 'ordinaryAutoload' => true");
		assert.equal(item.consumerSha256, sha256(consumer));
		if(receiverExports) assert.equal(item.runnerSha256, sha256(ownedPhpWasmInstalledHost(item.packageReceipt.npmSettings.name, true)));
		const names = compileOwnedPhpZendModel(model.bindingIr, { transferredInputs: true, anchoredResults: true, receiverExports }).functions.map(fn => fn.publicName).sort();
		const checkRun = run => {
			assert.equal(run.observed.checks, receiverExports ? 222 : 176); assert.equal(run.observed.phpBits, 32);
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
};
export const ownedPhpWasmBorrowScope = Object.freeze({
	profiles: ["php-wasm"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true
	, installedNpm: true, installedComposer: true
	, publicExports: 26, anchoredResults: 19, consumingExports: 4, pointerBits: 32
	, wholeValueOwners: true, originalOwnerTransfers: true, emptyValues: true
	, recursiveValues: true, transitiveExpiration: true, sharedRoots: true
	, independentRetains: true, canonicalIdentity: true, borrowOnlyExecuted: true
	, callerModes: ["weak", "strict"], loadingModes: ["startup", "lazy"]
	, callbackReentry: true, returnedClosures: true, retainedExceptions: true
	, zendAllocationFaults: true, phpConstructionFaults: true
	, requestBailouts: true
	, nativeFiberAndForkCompanion: true, wasmFiberExecution: false
	, parsedNegativeVariants: 6, node: true, chromium: true
	, sourceFreeInstallation: true, offlineInstall: true
	, deterministicReassembly: true
	, independentRebuild: true, documentationExecuted: true, combinedCRelease: true
	, receiverAnchors: false, callbackResultAnchors: false
	, docker: false, otherConsumerBindings: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha256(bytes)]));
const fixture = name => readFile(`tests/fixtures/structured-types/${name}.php`, "utf8");
const block = (text, heading, language) => {
	const section = text.split(heading + "\n")[1]?.split("\n### ")[0]; assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, heading + "/" + language); return match[1] + "\n";
};
const snapshot = state => {
	assert.equal(state.runtimeState, 2); assert.equal(state.runtimeInitRuns, 1);
	assert.equal(state.componentInitRuns, 1); assert.equal(state.liveIdentities, 0);
};
const mutations = [
	["share-is-independent", "src/Api.php", "return new self(Internal\\Native::owner('share', $type, $owner), $type, $payload, $retain);", "return $this->retain();"]
	, ["retain-is-shared", "src/Api.php", "return $retain($payload);", "return $this->share();"]
	, ["wrapper-identity", "src/Internal/Native.php", "Native::sameIdentity($this->type, $this->resource, $other->resource)", "$this->resource === $other->resource"]
	, ["last-root", "extension.c", "if (!--lease->roots) lease->invalid = 1;", "--lease->roots;"]
	, ["empty-root", "extension.c", "if (!--lease->roots) lease->invalid = 1;", "if (!--lease->roots && lease->owner.batch.entries) lease->invalid = 1;"]
	, ["unpublished-owner", "src/Internal/Native.php", "if ($unpublishedOwner !== null) self::owner('close', $fn['result'], $unpublishedOwner);", "/* broken: rely on exception-held resource destruction */"]
];

/**
 * Reconstruct generated Zend/PHP sources and the test's allocation probes.
 *
 * @param item - Complete runtime execution with captured Lean compiler inputs.
 * @param receiverExports - Require nominal members and their negative probes.
 */
export const assertOwnedPhpWasmBorrowRuntime = async (item, receiverExports = false) => {
	const native = generateOwnedNativeValueAdapters({ ...item.input, wordBits: 32
		, hostCallbacks: true, transferredInputs: true
		, anchoredResults: true, receiverExports });
	const extension = generateOwnedPhpZendExtension(native), { model } = extension;
	const borrowOnly = item.borrowOnly;
	assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
	assert.equal(item.sourceSha256, sha256(extension.source)); digest(item.binarySha256); digest(item.runtimeIdentity);
	assert.equal(model.functions.length, receiverExports ? 27 : borrowOnly ? 22 : 26);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, receiverExports ? 20 : borrowOnly ? 18 : 19);
	assert.equal(model.functions.filter(fn => fn.transfers?.length).length, borrowOnly ? 0 : 4);
	if(receiverExports)
	{
		assert.equal(borrowOnly, false); flags(item, ["receiverExports", "restoredAfterMutations"]);
		assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
		assert.equal(model.functions.find(fn => fn.name === "chooseTicket").anchor, 1);
		assert.equal(model.functions.find(fn => fn.name === "retainTicket").anchor, 0);
	}
	const files = { ...generateOwnedPhpZendPhp(model), ...bundledBrickMath()
		, "owned-values.h": native.typesHeader, "owned-values-codec.h": native.source
		, "owned-leases.h": (borrowOnly ? ownedAggregateLeaseRuntime : ownedAggregateTransferRuntime)({ anchoredResults: true })
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "extension.c": ownedPhpWasmTransferProbe(extension.source, { consume: "static void lgo_whole_consume(void *opaque) {" })
		, "check.php": await fixture(`owned-php-wasm-${borrowOnly ? "borrow-only" : "borrows"}`)
		, "checkpoints.php": await fixture("owned-php-wasm-borrow-checkpoints")
		, "bailouts.php": await fixture("owned-php-wasm-borrow-bailouts")
		, "recovery.php": await fixture("owned-php-wasm-borrow-recovery")
		, "probe.php": (await fixture("owned-php-zend-generated-probe"))
			.replace("$checks = 0;", "$checks = 0; require __DIR__ . '/checkpoints.php';")
			.replace("global $model;", "global $model, $functions; $functions[$name] = true;")
			.replace("$item instanceof Resource", "$item instanceof Resource || $item instanceof \\LeanOwnedAggregates\\Value")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	if(receiverExports)
	{
		const members = (await fixture("owned-php-wasm-receivers")).replace("<?php\n", "");
		const first = "$root = ticket(); $alias = $root->share(); $view = owned_call('retainTicket', [$root]);";
		assert.equal(files["check.php"].split(first).length, 2);
		files["check.php"] = files["check.php"].replace(first, members + "\nreceiver_members(); balanced();\n\n" + first);
	}
	files["src/Internal/Wire.php"] = files["src/Internal/Wire.php"]
		.replace("private static function checkpoint(): void {}", "private static function checkpoint(): void { \\owned_php_checkpoint(); }")
		.replace("        $stack = [new GraphWireFrame($type, $value, 0)];", "        self::checkpoint();\n        $stack = [new GraphWireFrame($type, $value, 0)];");
	files["src/Internal/Values.php"] = files["src/Internal/Values.php"].replace("        Native::owner('check', $type, $owner);", "        \\owned_php_checkpoint('owner');\n        Native::owner('check', $type, $owner);");
	for(const [path, identity] of Object.entries(hashes(files))) assert.equal(item.files[path], identity, path);
	assert.equal(item.files[native.carriers.module + ".lean"], sha256(native.carriers.leanSource));
	const selected = mutations.map(parts => [...parts]);
	if(receiverExports)
	{
		selected[0][2] = selected[0][2].replace("new self", "new static");
		const choose = files["src/Api.php"].match(/return choose_ticket\(\$this->get\(\), (\$[a-zA-Z_][a-zA-Z_0-9]*)\);/u);
		assert.ok(choose);
		selected.push(["receiver-replaces-parameter-anchor", "src/Api.php", choose[0], `return choose_ticket(${choose[1]}->get(), $this);`]);
		selected.push(["receiver-transfer-is-snapshot", "src/Api.php", "return transfer_ticket($this);", "return transfer_ticket($this->retain());"]);
	}
	assert.deepEqual(item.mutants, borrowOnly ? [] : selected.map(([name, path, before, after]) => {
		assert.equal(files[path].split(before).length, 2, name);
		return { name, path, sourceSha256: sha256(files[path].replace(before, after)), parsed: true, semanticRejection: true };
	}));
	assert.deepEqual(item.observations.map(value => value.strict), [0, 1]);
	for(const value of item.observations)
	{
		assert.equal(value.phpBits, 32); assert.equal(value.checks, receiverExports ? 2643 : borrowOnly ? 25 : 2595);
		assert.equal(value.live, 0); assert.equal(value.identities, 0);
		assert.deepEqual(value.functions, borrowOnly ? ["echoArray", "echoList", "echoNested", "echoOption"] : model.functions.map(fn => fn.name).sort());
		if(borrowOnly) continue;
		assert.equal(value.heldErrors, 448);
		assert.deepEqual(value.faults, {
			borrow: { zend: { before: 103, after: 0 }, php: { before: 73, after: 0 } }
			, move: { zend: { before: 26, after: 72 }, php: { before: 17, after: 56 } }
			, mixed: { zend: { before: 5, after: 3 }, php: { before: 2, after: 2 } }
			, copy: { zend: { before: 49, after: 0 }, php: { before: 37, after: 0 } }
		});
	}
	assert.deepEqual(item.bailouts.map(value => [value.strict, value.consume, value.mode]), borrowOnly ? []
		: [0, 1].flatMap(strict => [false, true].flatMap(consume => Array.from({ length: 9 }, (_, mode) => [strict, consume, mode]))));
	for(const bailout of item.bailouts)
	{
		assert.equal(bailout.status, [0, 1, 5].includes(bailout.mode) ? 0 : 1);
		for(const state of [bailout.before, bailout.after])
		{
			for(const key of ["live", "nativeLive", "identities", "scopes", "depth"]) assert.equal(state[key], 0, key);
			assert.equal(state.current, false); assert.equal(state.runtimeState, 2);
		}
	}
};

/**
 * Check native Fiber/process guards separately from actual wasm32 execution.
 *
 * @param item - Native companion report, never counted as a Wasm execution.
 * @param receiverExports - Require checked methods and properties in guards.
 */
export const assertOwnedPhpWasmBorrowFibers = async (item, receiverExports = false) => {
	assert.equal(item.profile, receiverExports ? "native-zend-receiver-fibers" : "native-zend-borrow-fibers"); assert.equal(item.wasm32, false);
	assert.match(item.phpVersion, /^PHP 8\./u);
	const options = { ...item.input, hostCallbacks: true, transferredInputs: true, anchoredResults: true, receiverExports };
	const wasm = generateOwnedNativeValueAdapters({ ...options, wordBits: 32 });
	const native = generateOwnedNativeValueAdapters({ ...options, wordBits: 64 });
	const extension = generateOwnedPhpZendExtension(wasm), { model } = extension;
	assert.equal(wasm.typesHeader, native.typesHeader); assert.equal(wasm.carriers.header, native.carriers.header);
	assert.equal(wasm.carriers.callbackSource, native.carriers.callbackSource);
	assert.ok(!model.types.some(node => ["usize", "isize"].includes(node.name)));
	const files = { ...generateOwnedPhpZendPhp(model), ...bundledBrickMath()
		, "owned-values.h": native.typesHeader, "owned-values-codec.h": native.source
		, "owned-leases.h": ownedAggregateTransferRuntime({ anchoredResults: true })
		, "extension.c": ownedPhpWasmTransferProbe(extension.source.replace(
			'_Static_assert(sizeof(void *) == 4 && sizeof(zend_long) == 4, "32-bit PHP-Wasm required");',
			'_Static_assert(sizeof(void *) == 8 && sizeof(zend_long) == 8, "64-bit native Fiber companion required");'),
		{ consume: "static void lgo_whole_consume(void *opaque) {" })
		, "check.php": await fixture("owned-php-wasm-borrow-fibers")
		, "probe.php": (await fixture("owned-php-zend-generated-probe"))
			.replace("$item instanceof Resource", "$item instanceof Resource || $item instanceof \\LeanOwnedAggregates\\Value")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	if(receiverExports)
	{
		const fiber = "    reject(fn() => $view->equals($root), 5);";
		const fork = "        reject(fn() => transfer_ticket($root), 6);";
		assert.equal(files["check.php"].split(fiber).length, 2); assert.equal(files["check.php"].split(fork).length, 2);
		files["check.php"] = files["check.php"].replace(fiber, fiber + `
    reject(fn() => $root->serial, 5);
    reject(fn() => $root->retainTicket(), 5);
    reject(fn() => $root->transferTicket(), 5);`)
			.replace(fork, `        reject(fn() => $root->serial, 6);
        reject(fn() => $root->retainTicket(), 6);
        reject(fn() => $root->transferTicket(), 6);
` + fork);
	}
	assert.deepEqual(item.files, hashes(files));
	assert.deepEqual(item.observations, [0, 1].map(strict => ({ strict
		, checks: receiverExports ? 40 : 34, phpBits: 64
		, fiberExecution: true, forkExecution: true
		, live: 0, identities: 0 })));
};

/**
 * Validate the complete enabled gate without promoting unrelated support cells.
 *
 * @param record - Frozen execution reports, source identities and exact TAP log.
 */
export const assertOwnedPhpWasmBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpWasmBorrowScope);
	assert.equal(record.run.command, ownedPhpWasmBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 12, pass: 12, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => [item.mode, item.borrowOnly]), [["ordinary", false], ["reviewed", false]]);
	assert.deepEqual(record.borrowOnly.map(item => [item.mode, item.borrowOnly]), [["ordinary", true], ["reviewed", true]]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	for(const item of [...record.runtime, ...record.borrowOnly])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + (item.borrowOnly ? "" : ownedRustBorrowSource)));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
		await assertOwnedPhpWasmBorrowRuntime(item);
		assert.equal(item.runtimeIdentity, record.packages.runtimeIdentity);
	}
	await assertOwnedPhpWasmBorrowFibers(record.nativeFibers);
	await assertOwnedPhpWasmBorrowPackages(record.packages, lean + ownedRustBorrowSource);
	const author = await readFile("docs/publish/php.md", "utf8"), consumer = await readFile("docs/php.md", "utf8");
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Anchor a result to an input", "json")) });
	const doc = record.documentation;
	flags(doc, ["sourceUnchanged", "authorRemoved", "handoffRemoved", "borrowOnly"]);
	assert.equal(doc.build.status, "ok"); assert.deepEqual([...doc.build.result.targets].sort(), ["c", "php-wasm"]);
	assert.equal(doc.build.result.profiles.length, 2); digest(doc.build.result.sourceApiSha256);
	assert.equal(doc.leanSha256, sha256(block(author, "### Export resource-containing values", "lean")));
	assert.equal(doc.configurationSha256, sha256(config));
	assert.equal(doc.consumerSha256, sha256(block(consumer, "### Owner-anchored results", "php")));
	assert.deepEqual(doc.observed, { output: "42\nexpired\n42\n", unmodifiedExample: true });
	validatePackageSetReceipt(doc.packageSetReceipt); assert.equal(doc.verification.status, "ok");
	assert.equal(doc.verification.result.receiptSha256, hash(doc.packageSetReceipt));
	assertOwnedPhpWasmBorrowCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
