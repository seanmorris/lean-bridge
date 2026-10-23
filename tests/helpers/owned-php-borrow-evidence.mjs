/**
 * Reconstruct native PHP ownership artifacts and require installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedReceiverHistoricalBytes } from "./owned-receiver-history.mjs";
import { assertOwnedPhpCi } from "./owned-php-ci.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedPhpBorrowCommand = "npm run test:owned-php-borrows";
export const ownedPhpBorrowScope = Object.freeze({
	profiles: ["php-native"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedComposer: true, publicExports: 26, anchoredResults: 19
	, consumingExports: 4, callerModes: ["weak", "strict"]
	, wholeValueOwners: true, originalOwnerTransfers: true, emptyValues: true
	, recursiveValues: true, transitiveExpiration: true, sharedRoots: true
	, independentRetains: true, canonicalIdentity: true
	, rawResourceViews: "borrowed-from-whole-owner", borrowOnlyExecuted: true
	, callbackReentry: true, returnedClosures: true
	, phpAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, forkRejection: true, fiberRejection: true
	, parsedNegativeVariants: 5, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, deterministicReassembly: true
	, documentationExecuted: true, combinedCRelease: true
	, automaticShutdown: true, privateGmp: true
	, receiverAnchors: false, callbackResultAnchors: false, wasm: false
	, docker: false, otherConsumerBindings: false, installedSupportPromotions: 0
});
const capabilities = { transferredInputs: true, anchoredResults: true };
const producerCommit = "3da93d67603c56529d9b4dce76f53ae60a8fdf51";
const historical = path => bytesAtProducer(producerCommit, path);
let producerPromise;
const producerAtMilestone = () => producerPromise ??= Promise.all([
	"src/backends/c/owned-package.mjs"
	, "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/owned-php-artifacts.mjs"
	, "src/release/package-set-receipt.mjs"
	, "tests/helpers/brick-math.mjs"
	, "tests/helpers/owned-php-ci.mjs"
	, "tests/helpers/owned-rust-borrow-fixture.mjs"
].map(path => moduleAtProducer(producerCommit, path))).then(modules =>
	Object.assign({}, ...modules));
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const block = (text, heading, language) => {
	const section = text.split(heading + "\n")[1]?.split("\n### ")[0]; assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, heading + "/" + language); return match[1] + "\n";
};

/**
 * Independently reconstruct the instrumented C adapter compiled by the probe.
 *
 * @param c - Freshly regenerated C package.
 * @param calls - Freshly regenerated PHP callback shims.
 * @param transferred - Whether the probe includes original-owner moves.
 */
const nativeProbe = (c, calls, transferred) => {
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(transferred) assert.equal(c.source.split(handoff).length, 2);
	return `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;${transferred ? "\nstatic size_t handoffs = 0;" : ""}
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${transferred ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
${calls.nativeSource}
size_t owned_test_live(void) { return live; }
${transferred ? "size_t owned_test_handoffs(void) { return handoffs; }\n" : ""}\
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`;
};

/**
 * Require the actual Lean calls, host faults and independently parsed mutants.
 *
 * @param item - One source path's complete runtime report.
 * @param model - Compiler-authenticated native model.
 * @param producer - Immutable producer module closure.
 */
const runtime = async (item, model, producer) => {
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	const calls = producer.generateOwnedPhpCalls(model.bindingIr, capabilities);
	const c = producer.generateOwnedCPackage({ ...item.input, hostCallbacks: true, ...capabilities });
	assert.equal(item.consumerSha256, sha256(historical(
		"tests/fixtures/structured-types/owned-php-borrows.php")));
	assert.equal(item.nativeSourceSha256, sha256(nativeProbe(c, calls, true)));
	assert.equal(item.publicHeaderSha256, sha256(c.publicHeader));
	assert.deepEqual(item.generated, hashes(calls.files));
	assert.equal(item.observed.checks, 2332); assert.equal(item.observed.heldErrors, 379);
	assert.equal(item.observed.live, 0); assert.equal(item.observed.identities, 0);
	assert.deepEqual(item.observed.functions, calls.functions.map(fn => fn.name).sort());
	assert.deepEqual(item.observed.faults, {
		borrow: { php: { before: 75, after: 0 }, native: { before: 109, after: 0 } }
		, move: { php: { before: 20, after: 55 }, native: { before: 13, after: 89 } }
		, mixed: { php: { before: 7, after: 4 }, native: { before: 2, after: 2 } }
	});
	const mutations = [
		["last-root", "src/Internal/OwnedRuntime.php", "if (--$this->roots === 0) $this->invalidate();", "--$this->roots;"]
		, ["share-is-independent", "src/Api.php", "return new self($lease, $type, $payload, $retain);", "return $this->retain();"]
		, ["retain-is-shared", "src/Api.php", "return $retain($payload);", "return $this->share();"]
		, ["wrapper-identity", "src/Internal/OwnedRuntime.php", "return ($this->equalCall)($this, $other);", "return $this === $other;"]
		, ["callback-never-expires", "src/Internal/OwnedRuntime.php", "if (isset($this->scope)) $this->scope->active = false;", "/* broken: callback scope remains active */"]
	].map(([name, path, before, after]) => {
		assert.equal(calls.files[path].split(before).length, 2, name);
		return { name, path, sourceSha256: sha256(calls.files[path].replace(before, after)), parsed: true, semanticRejection: true };
	});
	assert.deepEqual(item.mutants, mutations);
};

/**
 * Reconstruct the actual native model, public package and installed inventory.
 *
 * @param record - Reports from ordinary and reviewed builds and installations.
 */
export const assertOwnedPhpBorrowArtifacts = async record => {
	const producer = await producerAtMilestone();
	for(const name of [
		"assertOwnedPhpCi", "createCompiledNativeModel"
		, "generateCompiledNativeLeanAdapters", "generateOwnedCPackage"
		, "generateOwnedPhpCalls", "generateOwnedPhpPackage"
		, "ownedPhpAdapterSources", "validateBrickMathInstall"
		, "validatePackageSetReceipt"
	]) assert.equal(typeof producer[name], "function", name);
	assert.equal(typeof producer.ownedRustBorrowSource, "string");
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = historical(
		"tests/fixtures/onboarding/owned-aggregates/Owned.lean").toString();
	const extractor = sha256(ownedReceiverHistoricalBytes("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean")));
	for(const item of [...record.runtime, ...record.packages])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + producer.ownedRustBorrowSource));
		assert.equal(item.input.sourceIdentity.extractorSha256, extractor);
		const model = producer.createCompiledNativeModel(item.input, {
			ownedGraphs: true, ownedHostCallbacks: true
			, ownedInputTransfers: true, ownedAnchoredResults: true
		});
		assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		if(record.runtime.includes(item))
		{
			await runtime(item, model, producer); continue;
		}
		flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution", "handoffRemoved"
			, "deterministicReassembly", "cliAdmission"
			, "receiptVerifiedWithoutProducer"]);
		assert.equal(item.sourceSha256, sha256(historical(
			"tests/fixtures/structured-types/owned-installed-php-borrows.php")));
		assert.equal(item.loaderSourceSha256, sha256(historical(
			"tests/fixtures/structured-types/owned-installed-php-loader.php")));
		assert.equal(item.cliBuild.status, "ok"); assert.equal(item.verification.status, "ok");
		assert.equal(item.verification.result.verificationType, "local-package-set");
		producer.validatePackageSetReceipt(item.packageSetReceipt);
		const component = item.componentReceipt;
		const native = producer.generateCompiledNativeLeanAdapters(model);
		assert.equal(component.schemaVersion, 5);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
		assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
		assert.deepEqual(component.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(component.headerSha256, sha256(native.header));
		assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		assert.equal(item.adapterReceipt.schemaVersion, 3);
		assert.deepEqual(item.adapterReceipt.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(item.adapterReceipt.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		const php = producer.generateOwnedPhpPackage(
			model.bindingIr, null, capabilities);
		const c = producer.generateOwnedCPackage({
			...item.input, hostCallbacks: true, ...capabilities
		});
		assert.deepEqual(item.adapterReceipt.phpValues, php.contract);
		for(const [path, source] of Object.entries(
			producer.ownedPhpAdapterSources(c, php)))
			assert.deepEqual(item.adapterReceipt.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) });
		const receipt = item.installation.receipt;
		const libraries = Object.fromEntries(Object.entries(receipt.files)
			.filter(([path]) => path.startsWith("native/linux-x64/"))
			.map(([path, file]) => [path.slice("native/linux-x64/".length), file.sha256]));
		const evidence = {
			runtimeIdentity: item.built.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: php.contract
			, library: item.adapterReceipt.library, libraries };
		const packageFiles = producer.generateOwnedPhpPackage(
			model.bindingIr, evidence, capabilities).files;
		for(const [path, source] of Object.entries(packageFiles))
			assert.deepEqual(receipt.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		assert.deepEqual(item.observations.map(value => value.caller), ["weak", "strict"]);
		for(const { observed } of item.observations)
		{
			assert.ok(observed.checks >= 150); flags(observed, ["ordinaryAutoload", "iniDisabled", "heldOriginalError"]);
			assert.deepEqual(observed.functions, php.functions.map(fn => fn.publicName).sort());
		}
		assert.deepEqual(item.observations[0].observed, item.observations[1].observed);
		assert.deepEqual(item.loader.consumer, item.observations[0].observed);
		flags(item.loader, ["privateGmp", "automaticShutdown"]);
		assert.equal(item.loader.liveIdentities, 0); assert.equal(item.loader.idleSessionIdentities, 1);
		assert.deepEqual(item.tamperRejected, ["schema", "missing-anchor", "snapshot-anchor", "empties", "aliases", "export", "source", "boundary", "library"]);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "missing-library"]);
		flags(item.installation, [
			"emptyHome", "emptyCache", "offline", "lockedInstall"
			, "scriptsDisabled", "pluginsDisabled", "composerProjectRemoved"
			, "relocated", "compilerFree", "iniDisabled"]);
		producer.validateBrickMathInstall(
			item.installation, item.installation.deployment);
		assert.deepEqual(receipt.ownedValues, php.contract);
		assert.equal(item.installation.archiveSha256, item.built.packages[0].sha256);
		for(const [path, identity] of Object.entries(receipt.files))
			assert.deepEqual(item.inventory[`vendor/${receipt.name}/${path}`], identity, path);
	}
	const borrow = record.borrowOnly;
	assert.equal(borrow.actualLean, true);
	assert.deepEqual(borrow.observations.map(item => item.mode), ["ordinary", "reviewed"]);
	const testSource = historical("tests/owned-php-borrows.test.mjs").toString();
	const probe = testSource.match(/const source = `([^]*?)`;/u)?.[1].replaceAll("\\\\", "\\"); assert.ok(probe);
	for(const item of borrow.observations)
	{
		assert.equal(item.consumerSha256, sha256(probe));
		assert.equal(Boolean(item.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.sourceIdentity.extractorSha256, extractor);
		const input = { metadata: item.metadata, sourceIdentity: item.sourceIdentity, component: item.component };
		const model = producer.createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true, ownedAnchoredResults: true });
		assert.equal(model.exports.length, 22); assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 18);
		const calls = producer.generateOwnedPhpCalls(
			model.bindingIr, { anchoredResults: true });
		const c = producer.generateOwnedCPackage({
			...input, hostCallbacks: true, anchoredResults: true
		});
		assert.equal(item.nativeSourceSha256, sha256(nativeProbe(c, calls, false)));
		assert.equal(item.publicHeaderSha256, sha256(c.publicHeader));
		assert.deepEqual(item.generated, hashes(calls.files));
		assert.deepEqual(item.observed, { checks: 7, live: 0, identities: 0 });
	}
	const author = historical("docs/publish/php.md").toString();
	const consumer = historical("docs/php.md").toString();
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Anchor a result to an input", "json")) });
	const doc = record.documentation;
	flags(doc, ["cliIntegrated", "borrowOnly", "producerRemoved", "handoffRemoved", "sourceUnchanged", "relocated"]);
	assert.deepEqual(doc.mixedTargets, ["c", "php-native"]);
	assert.deepEqual(doc.sourceHashes, { lean: sha256(block(author, "### Export resource-containing values", "lean"))
		, config: sha256(config)
		, example: sha256(block(consumer, "### Owner-anchored results", "php")) });
	assert.deepEqual(doc.observed, { code: 0, stdout: "42\nexpired\n42\n", stderr: "" });
	producer.validatePackageSetReceipt(doc.packageSetReceipt);
	assert.equal(doc.verification.status, "ok");
	producer.validateBrickMathInstall(doc.installation, doc.installation.deployment);
};

/**
 * Require complete, unskipped execution before accepting a frozen receipt.
 *
 * @param record - Complete milestone receipt.
 */
export const assertOwnedPhpBorrowExecution = async record => {
	const producer = await producerAtMilestone();
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpBorrowScope);
	assert.equal(record.baselineRevision
		, "25745d5f3683a3919b40bbc8ce64f6140e615e39");
	assert.equal(record.run.command, ownedPhpBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 10, pass: 10, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedPhpBorrowArtifacts(record);
	producer.assertOwnedPhpCi(historical(
		".github/workflows/consumer-matrix.yml").toString());
};

/**
 * Require the executed ownership gate and every report in the consumer job.
 *
 * @param workflow - Complete workflow source.
 * @param manifest - Complete npm script manifest.
 */
export const assertOwnedPhpBorrowCi = (workflow, manifest) => {
	assertOwnedPhpCi(workflow);
	const step = workflow.split("      - name: Execute owned native PHP values and source-free Composer releases\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-php-borrows\n"));
	for(const [directory, reports] of [
		["owned-php-borrows", ["ordinary", "reviewed", "borrow-only"]]
		, ["owned-php-borrow-packaging", ["ordinary", "reviewed", "documentation"]]
	]) {
		for(const name of reports)
			assert.ok(step.includes(`          test -s build/${directory}/${name}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer php-native"));
	assert.ok(recorded?.includes(" && npm run test:owned-php-borrows"));
	assert.equal(manifest.scripts["test:owned-php-borrows"], "LEAN_BRIDGE_OWNED_PHP_BORROW_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-borrows.test.mjs tests/owned-php-borrow-packaging.test.mjs tests/owned-php-borrow-documentation.test.mjs");
};
