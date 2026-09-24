/**
 * Installed WIT composition, fork isolation and immutable evidence lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertWitComposition, assertWitMixedPackages, assertWitCompositionExecution, assertWitCompositionIntegration, witCompositionExecutionPath } from "./helpers/wit-composition-evidence.mjs";
import { beforeWitCompositionIntegration, reverseWitCompositionUpdate, witCompositionHistoryPath } from "./helpers/wit-composition-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("WIT composition source transitions preserve literal tokens and unrelated edits", () => {
	const previous = "prefix\n$& $` $' 🌿\nsuffix\n", current = "prefix\nnew $& $` $' 🌿\nsuffix\n";
	const update = { path: "src/backends/wit/copied-host.mjs"
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits: [{ start: 7, previous: "$& $` $' 🌿", current: "new $& $` $' 🌿" }] };
	assert.equal(reverseWitCompositionUpdate(current, update), previous);
	assert.throws(() => reverseWitCompositionUpdate(current + "// extra\n", update));
	assert.throws(() => reverseWitCompositionUpdate(current, { ...update, edits: [] }));
	assert.throws(() => reverseWitCompositionUpdate(current, { ...update, edits: [{ ...update.edits[0], start: 8 }] }));
});

test("installed WIT composition records both authoring paths and exact public documentation", async () => {
	await assertWitCompositionExecution(await json(witCompositionExecutionPath));
});

test("WIT composition rejects omitted scopes, lost ownership and accepted fork reuse", async () => {
	const original = (await json(witCompositionExecutionPath)).reports.composition;
	for(const mutate of [
		report => { report.observations.pop(); }
		, report => { report.observations[0].scenarios.pop(); }
		, report => { report.observations[0].scenarios[0].visibility = "global"; }
		, report => { report.observations[0].scenarios[0].observation.independentResult = false; }
		, report => { report.observations[0].scenarios[2].observation.cleanupAfterBothClosed = false; }
		, report => { report.observations[0].scenarios[3].observation.unopenedPeerRejected = false; }
		, report => { report.observations[0].scenarios[3].observation.childStatus = 14; }
		, report => { report.observations[0].documentation.stdout = ""; }
		, report => { report.observations[0].sourceFree = false; }
		, report => { report.observations[0].packages[0].libraries = {}; }
	]) {
		const altered = structuredClone(original); mutate(altered);
		assert.throws(() => assertWitComposition(altered));
	}
});

test("mixed C and WIT evidence requires the same component and shared retirement", async () => {
	const original = (await json(witCompositionExecutionPath)).reports.mixed;
	for(const mutate of [
		report => { report.observations.pop(); }
		, report => { report.observations[0].packages[0].manifest.bindingIrSha256 = "0".repeat(64); }
		, report => { report.observations[0].scenarios.pop(); }
		, report => { report.observations[0].scenarios[0].observation.sharedRetirement = false; }
		, report => { report.observations[0].libraries = {}; }
	]) {
		const altered = structuredClone(original); mutate(altered);
		assert.throws(() => assertWitMixedPackages(altered));
	}
});

test("WIT composition receipts reject missing regressions and rewritten original failures", async () => {
	const original = await json(witCompositionExecutionPath);
	for(const mutate of [
		record => { record.finalAcceptance = true; }
		, record => { record.structuredCallbacks = true; }
		, record => { record.ownedResourceAggregates = true; }
		, record => { record.originalFork.report.observations[0].scenarios[3].observation.childStatus = 0; }
		, record => { record.reports.mixed.observations.pop(); }
		, record => { delete record.reports.callables; }
		, record => { delete record.logs.mixed; }
		, record => { record.reports.composition.observations[0].faultSourceSha256 = "0".repeat(64); }
		, record => { record.reports.isolation.results.pop(); }
		, record => { record.reports.recursive.observations[0].installed.nodelete = false; }
		, record => { record.logs.composition.text = record.logs.composition.text.replace("# skipped 0", "# skipped 1"); }
		, record => { record.logs.mixed.text = record.logs.mixed.text.replace("# pass 2", "# pass 1"); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		for(const [name, report] of Object.entries(altered.reports)) altered.reportHashes[name] = sha256(canonicalJson(report));
		for(const log of Object.values(altered.logs)) log.sha256 = sha256(log.text);
		await assert.rejects(() => assertWitCompositionExecution(altered));
	}
});

test("WIT composition preserves committed predecessor bytes without hiding unrelated changes", async () => {
	const record = await json(witCompositionHistoryPath);
	await assertWitCompositionIntegration(record);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(beforeWitCompositionIntegration(update.path, source)), update.previousSha256);
		assert.equal(sha256(reverseWitCompositionUpdate(source, update)), update.previousSha256);
		assert.notEqual(sha256(beforeWitCompositionIntegration(update.path, source + "\n// unrelated\n")), update.previousSha256);
	}
});

test("downstream CI requires installed WIT composition and retains both reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_WIT_GRAPH_COMPOSITION_TEST=1 LEAN_BRIDGE_WIT_MIXED_PACKAGES_TEST=1 node --test tests/wit-graph-composition.test.mjs";
	assert.ok(workflow.includes(`          ${command}\n`));
	assert.ok(workflow.split("\n").find(line => line.includes("record --consumer wit-wasi")).includes(command));
	for(const name of ["composition", "mixed-packages"])
	{
		assert.ok(workflow.includes(`          test -s build/recursive-wit/${name}.json\n`));
		assert.ok(workflow.includes(`            build/recursive-wit/${name}.json\n`));
	}
});
