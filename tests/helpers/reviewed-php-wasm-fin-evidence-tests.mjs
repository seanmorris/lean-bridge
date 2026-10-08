/**
 * Keep reviewed PHP-Wasm Fin evidence tied to the original producer, packages and executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertReviewedPhpWasmFinExecution, assertReviewedPhpWasmFinReport, reviewedPhpWasmFinDirectory, reviewedPhpWasmFinFiles, reviewedPhpWasmFinHarness, reviewedPhpWasmFinIdentities, reviewedPhpWasmFinRevision, reviewedPhpWasmFinSourcePaths } from "./reviewed-php-wasm-fin-evidence.mjs";

const original = async file => {
	const bytes = await readFile(file.path);
	assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
	return bytes;
};
const receipt = async () => {
	const bytes = await readFile(`${reviewedPhpWasmFinDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "267b96187f7264a76f294aa737e50a8185780723dc9d6422ae51d96261dc3663");
	return JSON.parse(bytes);
};
const readSourceFor = record => async path => {
	const pinned = record.sourceFiles.find(item => item.path === path);
	assert.ok(pinned, path);
	let source;
	if(pinned.archivePath)
	{
		assert.equal(path, reviewedPhpWasmFinHarness.path); assert.equal(pinned.archivePath, reviewedPhpWasmFinHarness.archivePath);
		source = (await original(record.artifacts.find(file => file.path === pinned.archivePath))).toString();
	}
	else source = beforeFinRefinementSource(path, await readFile(path, "utf8"), pinned.sha256);
	assert.equal(sha256(source), pinned.sha256, path);
	return source;
};
const selection = async () => {
	const record = await receipt(), readSource = readSourceFor(record);
	const archive = JSON.parse(await original(record.artifacts.find(file => file.path.endsWith("/reviewed.json"))));
	return { record, archive, readSource };
};

test("reviewed PHP-Wasm Fin archive authenticates both independent contracts, every installed arrangement and original source", async () => {
	const { record, archive, readSource } = await selection();
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1443);
	assert.equal(record.execution, "local"); assert.equal(record.revision, reviewedPhpWasmFinRevision);
	assert.deepEqual(record.sourceFiles.map(file => file.path), reviewedPhpWasmFinSourcePaths);
	for(const file of record.sourceFiles) await readSource(file.path);
	assert.deepEqual(record.sourceFiles.filter(file => file.archivePath), [reviewedPhpWasmFinHarness]);
	assert.equal(record.artifacts.length, 4);
	for(const [name, pinned] of Object.entries(reviewedPhpWasmFinFiles))
	{
		const file = record.artifacts.find(file => file.path === `${reviewedPhpWasmFinDirectory}/${name}`);
		assert.equal(file.originalPath, pinned.original); assert.equal(file.sha256, pinned.sha256);
		await original(file);
	}
	const harness = record.artifacts.find(file => file.path === reviewedPhpWasmFinHarness.archivePath);
	assert.equal(harness.originalPath, `git:${reviewedPhpWasmFinRevision}:${reviewedPhpWasmFinHarness.path}`);
	assert.equal(harness.sha256, reviewedPhpWasmFinHarness.sha256);
	await original(harness);
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.match(record.sourceIdentityScope, /no claim that the later integrated harness ran/u);
	assert.deepEqual(record.scope, {
		profile: "php-wasm"
		, sourcePath: "reviewed-source"
		, reviewedContracts: true
		, fixtures: [{ name: "products", exports: 11, executions: 12, checksPerExecution: 2039 }
			, { name: "records", exports: 13, executions: 12, checksPerExecution: 2053 }]
		, dispatch: "not measured", hostedCi: false, binaryArchivesRetained: false
		, subtype: false, callbacks: false, ownedOrGraphRefinements: false });
	assert.equal(record.producerEnvironment.nodeVersion, "v22.23.3");
	assert.equal(record.producerEnvironment.browserVersion, "154.0.8037.57");
	assert.equal(record.producerEnvironment.measuredHostGlibc, "not measured");
	assert.equal(record.producerEnvironment.declaredNativeGlibcFloor, "2.36");
	await assertReviewedPhpWasmFinReport(archive, record, readSource);
	const text = async name => (await original(record.artifacts.find(file => file.path.endsWith(`/${name}`)))).toString();
	assertReviewedPhpWasmFinExecution(await text("original.tap"), await text("original.queue"));
});

test("reviewed PHP-Wasm validation refuses lost executions, changed reviews and forged package observations", async () => {
	const { record, archive, readSource } = await selection();
	const mutations = [
		report => { report.phpWasm.executions.pop(); }
		, report => { report.phpWasm.executions[0].mode = "strict"; }
		, report => { report.phpWasm.executions[0].observation.checks--; }
		, report => { report.phpWasm.executions[0].observation.word_bits = 64; }
		, report => { report.phpWasm.executions[0].phases[0].libraries = []; }
		, report => { report.phpWasm.executions[8].requests = []; }
		, report => { report.phpWasm.nodeVersion = "v99.0.0"; }
		, report => { report.phpWasm.browserVersion = "99.0.0"; }
		, report => { report.dispatch = "measured"; }
		, report => { report.path = "ordinary-source"; }
		, report => { report.label = `fin-${report.fixture}`; }
		, report => { report.reproducible = false; }
		, report => { report.phpWasm.offlineInstall = false; }
		, report => { report.sourceRemovedBeforeInstallation = false; }
		, report => { report.phpWasm.component.wasmLibrary.sha256 = "0".repeat(64); }
		, report => { report.phpWasm.consumerSources.strict = report.phpWasm.consumerSources.weak; }
		, report => { report.phpWasm.component.exports.pop(); }
		, report => { delete report.refinements[Object.keys(report.refinements)[0]]; }
		, report => { report.reviewedBindingIrSha256 = "0".repeat(64); }
		, report => { report.phpWasm.component.sourceIdentity.reviewedBindingIr.semanticSha256 = "0".repeat(64); }
		, report => { report.phpWasm.component.sourceIdentity.reviewedBindingIr.sourceSha256 = "0".repeat(64); }
		, report => {
			const identity = report.phpWasm.component.sourceIdentity, review = JSON.parse(identity.reviewedBindingIr.source);
			if(report.fixture === "products")
				review.declarations.find(item => item.id === "lean:FinProducts.first").source.extensions["lean-lang.org/refinements"].parameters[0].arguments[0].bound = "9";
			else review.types.find(item => item.id === "lean:FinRecords.Tile").source.extensions["lean-lang.org/nominal-refinements"].fields[0].bound = "4";
			identity.reviewedBindingIr.source = canonicalJson(review);
			identity.reviewedBindingIr.sourceSha256 = sha256(identity.reviewedBindingIr.source);
			identity.reviewedBindingIr.semanticSha256 = report.reviewedBindingIrSha256 = hashBindingIr(review);
		}
		, report => {
			const identity = report.phpWasm.component.sourceIdentity, config = JSON.parse(identity.exportConfigurationSource);
			config.exports = [];
			identity.exportConfigurationSource = canonicalJson(config);
			identity.exportConfigurationSha256 = sha256(identity.exportConfigurationSource);
		}
	];
	for(const [index, report] of archive.reports.entries()) for(const [mutation, mutate] of mutations.entries())
	{
		const changed = structuredClone(archive); mutate(changed.reports[index]);
		// Rebind receipt identities so mutations must fail the independent contract checks too.
		const rebound = { ...record, identities: changed.reports.map(reviewedPhpWasmFinIdentities) };
		await assert.rejects(() => assertReviewedPhpWasmFinReport(changed, rebound, readSource), assert.AssertionError, `${report.fixture}/${mutation}`);
	}
	const changed = structuredClone(archive); changed.reports[0].receiptSha256 = "0".repeat(64);
	await assert.rejects(() => assertReviewedPhpWasmFinReport(changed, record, readSource), assert.AssertionError);
	for(const path of ["src/analyze/NativeExports.lean", "tests/fixtures/onboarding/native-fin-products/FinProducts.lean"])
		await assert.rejects(() => assertReviewedPhpWasmFinReport(archive, record, async source => (await readSource(source)) + (source === path ? "\n" : "")), assert.AssertionError);
});

test("reviewed PHP-Wasm execution authentication rejects incomplete tests, fixture builds and realm selections", async () => {
	const record = await receipt();
	const text = async name => (await original(record.artifacts.find(file => file.path.endsWith(`/${name}`)))).toString();
	const tap = await text("original.tap"), queue = await text("original.queue");
	for(const [changedTap, changedQueue] of [
		[tap.replace("# pass 2", "# pass 1"), queue]
		, [tap.replace("# skipped 0", "# skipped 1"), queue]
		, [tap.replace("ok 2 -", "not ok 2 -"), queue]
		, [tap.replace("exit=0", "exit=1"), queue]
		, [tap.replace("# reviewed-fin-records build 1: wasm32\n", ""), queue]
		, [tap.replace("# reviewed-fin-products: PHP-Wasm Chromium bundled/lazy/strict\n", ""), queue]
		, [tap, queue.replace("exit=0", "exit=1")]
		, [tap, queue.replace(reviewedPhpWasmFinRevision, "0".repeat(40))]
		, [tap, queue.replace("LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=1", "LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=0")]
		, [tap + "# pass 2\n", queue]
	])
		assert.throws(() => assertReviewedPhpWasmFinExecution(changedTap, changedQueue), assert.AssertionError);
});
