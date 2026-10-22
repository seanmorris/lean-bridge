/**
 * Close the complete PHP-Wasm refinement entry promotion topology.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phpWasmRefinementCiMatrix } from "./php-wasm-refinement-ci-matrix.mjs";
import {
	checkPhpWasmRefinementEntryMatrix
	, phpWasmRefinementEntryMatrix
	, phpWasmRefinementEntryMatrixLocation
} from "./php-wasm-refinement-entry-matrix.mjs";

const revision = "a".repeat(40);
const result = cell => cell.checker === "callback" ? {
	schemaVersion: 1, family: cell.family, route: cell.route
	, producerCommit: revision, records: 29, executions: 12, controls: 7
} : {
	schemaVersion: 1, family: cell.family, route: cell.route
	, producerCommit: revision, records: 31, executions: 12, calls: 9
	, counts: { validator: 2, constructor: 0, adapter: 9, source: 7 }
};
const observation = cell => ({
	cell: cell.id
	, ...phpWasmRefinementEntryMatrixLocation(cell, revision)
	, result: result(cell)
});
const observations = () => phpWasmRefinementEntryMatrix.map(observation);

test("the complete PHP-Wasm refinement entry topology has 28 exact route cells", () => {
	assert.equal(phpWasmRefinementEntryMatrix.length, 28);
	assert.equal(new Set(phpWasmRefinementEntryMatrix.map(cell => cell.id)).size, 28);
	const byKind = Object.fromEntries(
		["copied", "owned", "callback", "indexed"].map(kind => [
			kind
			, phpWasmRefinementEntryMatrix.filter(cell => cell.kind === kind).length
		])
	);
	assert.deepEqual(byKind, {
		copied: 8, owned: 4, callback: 4, indexed: 12
	});
	assert.deepEqual([...new Set(phpWasmRefinementEntryMatrix
		.map(cell => cell.ownerNode))], [1824, 1825, 1826, 1827]);
	assert.deepEqual([...new Set(phpWasmRefinementEntryMatrix
		.map(cell => cell.route))], ["ordinary", "reviewed"]);
});

test("the entry topology is pinned to workflow matrices, artifacts and run layouts", async () => {
	const groups = [...new Set(phpWasmRefinementEntryMatrix.map(item => item.workflow))];
	assert.deepEqual(groups, [
		"php-wasm-refinement-entry", "php-wasm-owned-refinement-entry"
		, "php-wasm-callback-entry", "php-wasm-indexed-refinement-entry"
	]);
	for(const workflow of groups)
	{
		const lane = phpWasmRefinementCiMatrix.find(item => item.id === workflow);
		assert.ok(lane && lane.kind === "measurement");
		const cells = phpWasmRefinementEntryMatrix.filter(item => item.workflow === workflow);
		assert.deepEqual([...new Set(cells.map(item => item.family))], lane.axes.family);
		assert.deepEqual([...new Set(cells.map(item => item.route))]
			, lane.axes.route ?? ["ordinary", "reviewed"]);
		assert.equal(cells.length, workflow === "php-wasm-callback-entry"
			? lane.cells * 2 : lane.cells);
		const source = await readFile(lane.path, "utf8");
		assert.equal([...source.matchAll(
			/^ {10}LEAN_BRIDGE_[A-Z_]+_FAMILIES: \$\{\{ matrix\.family \}\}$/gmu
		)].length, 1);
		const route = workflow === "php-wasm-callback-entry"
			? "ordinary,reviewed" : "${{ matrix.route }}";
		assert.equal([...source.matchAll(new RegExp(
			"^ {10}LEAN_BRIDGE_[A-Z_]+_ROUTES: "
				+ route.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "$", "gmu"
		))].length, 1);
		for(const item of cells)
		{
			const expected = lane.artifactName
				.replace("${{ matrix.family }}", item.family)
				.replace("${{ matrix.route }}", item.route)
				.replace("${{ github.sha }}", revision);
			assert.equal(phpWasmRefinementEntryMatrixLocation(item, revision).artifact
				, expected);
		}
	}
	const common = await readFile("scripts/run-php-wasm-refinement-entry-ci.sh", "utf8");
	assert.match(common, /records="\$output\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES"/u);
	assert.match(common, /check="\$output\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES\.check\.json"/u);
	const owned = await readFile("scripts/run-php-wasm-owned-refinement-entry-ci.sh", "utf8");
	assert.match(owned, /records="\$output\/\$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES\/\$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES"/u);
	assert.match(owned, /check="\$records\.check\.json"/u);
	const callback = await readFile("scripts/run-php-wasm-callback-entry-ci.sh", "utf8");
	assert.match(callback, /records="\$output\/\$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES\/\$route"/u);
	assert.match(callback, /check="\$output\/\$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES\/\$route\.check\.json"/u);
	for(const item of phpWasmRefinementEntryMatrix)
		assert.equal(item.recordPath, item.kind === "callback"
			? `${item.family}/${item.route}` : `${item.route}/${item.family}`);
});

test("the complete PHP-Wasm refinement entry matrix accepts one closed verifier set", () => {
	assert.deepEqual(checkPhpWasmRefinementEntryMatrix(revision, observations()), {
		schemaVersion: 1, scope: "separate-instrumented-probe"
		, producerCommit: revision, cells: 28, artifacts: 26, workflows: 4
		, records: 860, executions: 336, calls: 216, controls: 28
	});
});

test("the complete PHP-Wasm refinement entry matrix rejects structural forgery", t => {
	const valid = observations(), mutations = [];
	for(const index of valid.keys())
	{
		mutations.push(valid.toSpliced(index, 1));
		mutations.push(valid.with(index, structuredClone(valid[(index + 1) % valid.length])));
	}
	mutations.push([valid[1], valid[0], ...valid.slice(2)]);
	mutations.push([...valid, structuredClone(valid[0])]);
	for(const [key, value] of [
		["cell", "copied/forged/ordinary"]
		, ["artifact", "forged-artifact"]
		, ["workflow", ".github/workflows/forged.yml"]
		, ["recordPath", "../forged"]
		, ["checkPath", "../forged.check.json"]
	]) {
		const changed = structuredClone(valid); changed[0][key] = value;
		mutations.push(changed);
	}
	for(const [key, value] of [
		["producerCommit", "b".repeat(40)], ["family", "forged"]
		, ["route", "forged"], ["records", 0], ["executions", 11]
		, ["calls", 0]
	]) {
		const changed = structuredClone(valid); changed[0].result[key] = value;
		mutations.push(changed);
	}
	const negative = structuredClone(valid);
	negative[0].result.counts.validator = -1; mutations.push(negative);
	const callback = valid.findIndex(item => item.cell.startsWith("callback/"));
	for(const [key, value] of [["records", 0], ["executions", 11], ["controls", 0]])
	{
		const changed = structuredClone(valid); changed[callback].result[key] = value;
		mutations.push(changed);
	}
	const widened = structuredClone(valid);
	widened[0].result.unverified = true; mutations.push(widened);
	for(const changed of mutations)
		assert.throws(() => checkPhpWasmRefinementEntryMatrix(revision, changed));
	assert.equal(mutations.length, 74);
	t.diagnostic(`${mutations.length} missing, duplicate, reordered and forged controls`);
});
