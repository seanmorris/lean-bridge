/**
 * Preserve complete callback evidence and reject weakened acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assembleComponentNpmRuntime } from "../src/release/component-npm-package.mjs";
import { ownedCallbackResultEvidencePath, assertOwnedCallbackResultAcceptance
	, assertOwnedCallbackReportData, assertOwnedCallbackRuntimeInventory, packOwnedCallbackReports
	, unpackOwnedCallbackReports } from "./helpers/owned-callback-result-evidence.mjs";

const read = async () => JSON.parse(await readFile(ownedCallbackResultEvidencePath, "utf8"));

test("callback evidence shares JSON nodes without dropping original report bytes", () => {
	const common = { values: Array.from({ length: 300 }, (_, i) => ({ index: i, label: "entry " + i })) };
	const reports = { first: { common, result: 1 }, second: { common, result: 2 } };
	const archive = packOwnedCallbackReports(reports);
	assert.ok(canonicalJson(archive).length < canonicalJson(reports).length);
	assert.deepEqual(unpackOwnedCallbackReports(archive), reports);
	for(const mutate of [
		value => { value.format = "unchecked"; }
		, value => { delete value.nodes[Object.keys(value.nodes)[0]]; }
		, value => { value.nodes[Object.keys(value.nodes)[0]] = { changed: true }; }
		, value => { value.reports.first.bytes++; }
		, value => { value.reports.first.sha256 = "0".repeat(64); }
		, value => { value.reports.first.data.common.values.extra = true; }
		, value => { const unused = { unused: true }; value.nodes[sha256(canonicalJson(unused))] = unused; }
	]) {
		const changed = structuredClone(archive); mutate(changed);
		assert.throws(() => unpackOwnedCallbackReports(changed), undefined, mutate.toString());
	}
	assert.throws(() => packOwnedCallbackReports({ result: { $node: "reserved" } }));
});

test("callback evidence reconstructs every compiled and installed configuration", async () => {
	await assertOwnedCallbackResultAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-callback-result-evidence.test.mjs"), "contract");
});

test("callback evidence rejects partial execution and expanded support claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.callbackInputTransfers = true; }
		, value => { value.scope.retainedHostCallbacks = true; }
		, value => { value.scope.installedSupportPromotions++; }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { delete value.sources["tests/helpers/owned-callback-result-evidence.mjs"]; }
		, value => { value.sources["src/analyze/callback-signature.mjs"] = "0".repeat(64); }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.combinedRun.text = value.combinedRun.text.replace("# pass 1", "# pass 0"); value.combinedRun.sha256 = sha256(value.combinedRun.text); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedCallbackResultAcceptance(changed), undefined, mutate.toString());
	}
});

test("callback evidence rejects rehashed reports with missing lifetime or install checks", async () => {
	const record = await read(), reports = unpackOwnedCallbackReports(record.archive);
	// A passing baseline prevents an unrelated receipt failure from satisfying every negative case.
	await assertOwnedCallbackReportData(reports, record.sources);
	const changes = [
		["metadata-ordinary", value => { value.models[0].ownedGraph.callbackResultAnchors.signatures[0].parameter++; }]
		, ["runtime-reviewed-false", value => { value.result.identities++; }]
		, ["runtime-ordinary-true", value => { value.result.allocationFailures--; }]
		, ["runtime-reviewed-true", value => { value.restored.live++; }]
		, ["runtime-ordinary-false", value => { value.mutations[0].compiled = false; }]
		, ["wasm-ordinary-true", value => { value.privateAbi.callbackResultAnchors.signatures.pop(); }]
		, ["wasm-reviewed-false", value => { value.faultCounts.host--; }]
		, ["wasm-reviewed-true", value => { value.live[0]++; }]
		, ["coexistence-ordinary-false", value => { value.runtimeInitializations++; }]
		, ["coexistence-reviewed-true", value => { value.liveLegacyHandles++; }]
		, ["wasm-ordinary-mutants", value => { value.observations.pop(); }]
		, ["wasm-reviewed-mutants", value => { value.observations[0].semanticRejection = false; }]
		, ["wasm-reviewed-combinations", value => { value.borrowedTransferRejected = false; }]
		, ["ordinary-c-package", value => { value.installed.checks--; }]
		, ["reviewed-c-package", value => { value.cmake = false; }]
		, ["ordinary-c-package", value => { value.independentRebuild = false; }]
		, ["reviewed-c-package", value => { value.receipt.callbackResultAnchors.maximumDepth++; }]
		, ["ordinary-c-package", value => { value.cli.files[0].sha256 = "0".repeat(64); }]
		, ["ordinary-combined-package", value => { value.documentation.output = "42n\n"; }]
		, ["reviewed-combined-package", value => { value.producerAndCliRemovedBeforeInstall = false; }]
		, ["ordinary-combined-package", value => { value.installedC.checks--; }]
		, ["reviewed-combined-package", value => { value.wasm.model.ownedGraph.inputTransfers.exports.pop(); }]
		, ["ordinary-combined-package", value => { value.browser.executions.pop(); }]
		, ["reviewed-combined-package", value => { value.browser.executions[0].assets.pop(); }]
		, ["npm-package", value => { value.reports[0].sourceRemovedBeforeInstall = false; }]
		, ["npm-package", value => { value.reports[1].installedTypeScript = false; }]
		, ["npm-package", value => { value.reports[0].browser.executions[0].checks--; }]
		, ["npm-package", value => { value.reports[1].browser.executions[0].reruns--; }]
		, ["npm-package", value => { value.reports[0].rejected--; }]
		, ["npm-package", value => { value.reports[1].inventory["@lean-bridge/runtime/internal/owned-wasm-callbacks.mjs"].sha256 = "0".repeat(64); }]
		, ["npm-package", value => { value.reports[0].receipt.ownedGraph.callbackResultAnchors.signatures.pop(); }]
	];
	const missing = structuredClone(reports); delete missing[Object.keys(missing)[0]];
	await assert.rejects(() => assertOwnedCallbackReportData(missing, record.sources));
	for(const [name, mutate] of changes)
	{
		const changed = structuredClone(reports); mutate(changed[`build/owned-callback-results/${name}.json`]);
		// Rehash altered reports so rejection exercises semantics, not archive hashes.
		const unpacked = unpackOwnedCallbackReports(packOwnedCallbackReports(changed));
		await assert.rejects(() => assertOwnedCallbackReportData(unpacked, record.sources), undefined, name + ": " + mutate.toString());
	}
});

test("callback runtime receipts select historical sources without normalizing fresh package bytes", async () => {
	const record = await read(), reports = unpackOwnedCallbackReports(record.archive);
	const frozen = [reports["build/owned-callback-results/ordinary-combined-package.json"].inventory
		, reports["build/owned-callback-results/reviewed-combined-package.json"].inventory
		, ...reports["build/owned-callback-results/npm-package.json"].reports.map(item => item.inventory)];
	for(const inventory of frozen)
	{
		await assertOwnedCallbackRuntimeInventory(inventory, record.sources);
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(inventory), /component-runtime/);
	}
	// Assemble source modules through the production packager. Stub runtime payloads
	// exercise source inventory validation only, not compiled/installed execution.
	const runtime = await assembleComponentNpmRuntime({
		mainModule: "// fixture\n", mainWasm: new Uint8Array()
		, runtimeRequirement: { profile: "inventory-test" } });
	const fresh = Object.fromEntries([...runtime.files].map(([path, bytes]) =>
		[`@lean-bridge/runtime/${path}`, { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }]));
	const names = ["component-runtime", "owned-wasm-calls", "owned-wasm-borrow-registry", "owned-wasm-callbacks"];
	const liveSources = Object.fromEntries(await Promise.all(names.map(async name => {
		const path = `src/release/${name}.mjs`; return [path, sha256(await readFile(path))];
	})));
	const runtimePath = "src/release/component-runtime.mjs";
	assert.notEqual(liveSources[runtimePath], record.sources[runtimePath], "Cross-version controls require distinct sources");
	await assertOwnedCallbackRuntimeInventory(fresh);
	await assertOwnedCallbackRuntimeInventory(fresh, liveSources);
	await assert.rejects(() => assertOwnedCallbackRuntimeInventory(fresh, record.sources), /component-runtime/);
	await assert.rejects(() => assertOwnedCallbackRuntimeInventory(frozen[0], liveSources), /component-runtime/);
	for(const name of names)
	{
		const path = `src/release/${name}.mjs`, key = `@lean-bridge/runtime/internal/${name}.mjs`;
		const readEdited = async candidate => await readFile(candidate, "utf8") + (candidate === path ? "\n// unrelated edit\n" : "");
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(frozen[0], record.sources, readEdited));
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(fresh, liveSources, readEdited));
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(fresh, undefined, readEdited));
		const missing = { ...record.sources }; delete missing[path];
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(frozen[0], missing), /Missing runtime source identity/);
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(frozen[0], { ...record.sources, [path]: "1".repeat(64) }));
		const wrongInventory = structuredClone(frozen[0]); wrongInventory[key].bytes++;
		await assert.rejects(() => assertOwnedCallbackRuntimeInventory(wrongInventory, record.sources));
	}
	await assert.rejects(() => assertOwnedCallbackRuntimeInventory(fresh, null));
});
