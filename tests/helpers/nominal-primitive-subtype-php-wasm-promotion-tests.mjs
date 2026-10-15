/**
 * Restrict nineteen-base nominal PHP-Wasm claims to installed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	readTypeSurface, typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import {
	nominalPrimitiveSubtypePhpWasmPromotionPredecessor
} from "./nominal-primitive-subtype-php-wasm-promotion-history.mjs";
import {
	nominalPrimitiveSubtypePhpWasmProducer
} from "./nominal-primitive-subtype-php-wasm-provenance.mjs";
import {
	nominalPrimitiveSubtypePhpWasmConversion
	, nominalPrimitiveSubtypePhpWasmField
	, nominalPrimitiveSubtypePhpWasmLimit
	, nominalPrimitiveSubtypePhpWasmParameter
	, nominalPrimitiveSubtypePhpWasmProfiles
	, nominalPrimitiveSubtypePhpWasmReferences
	, nominalPrimitiveSubtypePhpWasmResult
	, promoteNominalPrimitiveSubtypePhpWasm
} from "./nominal-primitive-subtype-php-wasm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", [
	"show"
	, `${nominalPrimitiveSubtypePhpWasmPromotionPredecessor}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base PHP-Wasm promotion authenticates four installed selections", async () => {
	const references = await nominalPrimitiveSubtypePhpWasmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision),
		Array(4).fill(nominalPrimitiveSubtypePhpWasmProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypePhpWasmProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath,
			reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, {
			checks: full ? 1821 : 612, hostRejections: 8, php: "8.4.1"
			, rejections: full ? 283 : 0, rounds: 256, snapshotControls: 12
			, wordBits: 32, word_bits: 32
		});
		assert.equal(reference.counts.executions, 12);
		assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.packageFiles,
			{ api: 18, component: 59, runtime: 22 });
		assert.equal(reference.counts.semanticControls, full ? 55 : 53);
		assert.equal(reference.counts.recordControls,
			reference.counts.records * 2);
		assert.equal(reference.counts.loadCeiling, 8);
		assert.deepEqual(reference.counts.runtime, {
			node: "v22.23.2", chromium: "152.0.7977.75", php: "8.4.1"
			, phpWasm: "0.1.0", npm: "10.9.8"
			, composer: "Composer version 2.5.5 2023-03-21 11:50:05"
		});
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_WASM_MAX_LOAD='8'"));
		assert.ok(reference.command.includes("LEAN_NUM_THREADS='1'"));
		assert.ok(reference.command.includes("EMCC_CORES='2'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypePhpWasmLimit));
		assert.equal(reference.artifacts.length, 3);
		assert.equal(reference.artifacts.filter(item => item.path.endsWith(".tgz")).length, 2);
		assert.equal(reference.artifacts.filter(item => item.path.endsWith(".zip")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/php/copied-values.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/php-native.php"
			, "checkers/nominal-primitive-subtype-php-wasm-report.mjs"
			, `${label}/records/weak.php`, `${label}/records/strict.php`
			, `${label}/records/report.json`, `${label}/records/executions/0.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base PHP-Wasm promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor();
	const references = await nominalPrimitiveSubtypePhpWasmReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypePhpWasm(original, changed));
	for(const mutate of [
		item => { item.profiles.push("php-native"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 64; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 4; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.runtime.chromium = "151.0.7922.34"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypePhpWasm(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypePhpWasm(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypePhpWasm(promoted, references),
		/Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "nominal-subtype-php-wasm-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlapping-field"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypePhpWasm(changed, references),
			/Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base PHP-Wasm promotion supplements six cells only", async () => {
	const original = predecessor();
	const references = await nominalPrimitiveSubtypePhpWasmReferences();
	const proposed = await promoteNominalPrimitiveSubtypePhpWasm(original, references);
	const { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(proposed.evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length),
		proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "php-wasm");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state);
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nominal-primitive-subtype-php-wasm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypePhpWasmConversion));
		assert.equal(cell.hostType, {
			parameter: nominalPrimitiveSubtypePhpWasmParameter
			, result: nominalPrimitiveSubtypePhpWasmResult
			, field: nominalPrimitiveSubtypePhpWasmField
		}[cell.position]);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"]
			.map(position => `php-wasm/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base PHP-Wasm docs name the accepted boundary", async () => {
	for(const path of ["docs/php.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"]){
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-php-wasm-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source,
			docPages.find(item => item.source === path)
			, { revision: nominalPrimitiveSubtypePhpWasmPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nominal-primitive-subtype-php-wasm-20261015/index.json")), path);
		if(path === "docs/php.md") assert.ok(compiled.links.includes(
			"https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-php-wasm.yml"
		));
		}
	const php = await readFile("docs/php.md", "utf8");
	for(const text of ["all nineteen primitive bases", "32-bit", "normalization"
		, "wasm32 PHP 8.4.1", "Node 22.23.2", "Chromium 152.0.7977.75"
		, "standalone result-only", "load-admission ceiling of 8"])
		assert.ok(php.includes(text), text);
	assert.match(php, /consumer PHP source remains required/ui);
	const row = php.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypePhpWasmField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypePhpWasmConversion));
});
