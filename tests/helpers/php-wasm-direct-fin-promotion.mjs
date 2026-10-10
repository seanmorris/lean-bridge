/**
 * Reconcile direct PHP-Wasm Fin coverage with its original installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpWasmDirectFinArchive, phpWasmDirectArchiveRoot, phpWasmDirectProducer } from "./php-wasm-fin-direct-archive.mjs";
import { phpWasmFinPromotionConversion, phpWasmFinPromotionLimit, phpWasmFinPromotionNestedOnly } from "./php-wasm-fin-promotion-references.mjs";

export const phpWasmDirectPromotionDigest = "0584e1582db5f6afabf4f6509cc415ef1df0aa3bfca3581681a23ef67b1290ce";
export const phpWasmDirectPromotionEnvironment = "Local Node 22.23.2 and Chromium 152.0.7977.75 execute PHP 8.4.1 on wasm32, with php-wasm 0.1.0, Lean 4.32.2 and Emscripten 3.1.68. Each fixture runs eight Node configurations (embedded/Composer, startup/lazy, weak/strict) and four Chromium bundled configurations (startup/lazy, weak/strict).";
export const phpWasmDirectPromotionLimit = "Source and adapter dispatch are unmeasured. These local runs do not establish hosted acceptance, native PHP, Firefox/WebKit, browser Composer, checked Subtype, refined callbacks or graph/owned refinement transports. Selected source snapshots are not a complete dependency closure. Package digests and sizes are retained, not their binary archives.";
export const phpWasmDirectPromotionConversion = "Use Brick Math integers with exact closed bounds for scalar Fin, direct Array/List/Option compositions, pairs, active Except branches and copied record/variant fields. Empty Array/List (Fin 0) and absent Option (Fin 0) are valid; present Fin 0 values reject. Bounds wider than 64 bits stay exact on wasm32. Weak and strict callers retain inputs and can recover after rejection.";
const common = [
	"tests/helpers/php-wasm-direct-fin-promotion.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-archive.mjs"
	, "tests/helpers/php-wasm-fin-direct-report.mjs"
	, "tests/helpers/php-wasm-fin-observation.mjs"
];

/**
 * Validate both original source routes and all execution modes before selecting evidence.
 *
 * @param read - File reader, replaceable for corruption tests.
 */
export const phpWasmDirectPromotionReferences = async (read = readFile) => {
	const { index, files } = await assertPhpWasmDirectFinArchive(phpWasmDirectPromotionDigest, read);
	const originals = [{ path: `${phpWasmDirectArchiveRoot}/index.json`, sha256: phpWasmDirectPromotionDigest }
		, ...index.files.map(file => ({ path: `${phpWasmDirectArchiveRoot}/${file.path}`, sha256: file.sha256 }))];
	const references = [];
	for(const [route, sourcePath] of [["ordinary", "ordinary-source"], ["reviewed", "reviewed-ir"]])
	{
		const report = JSON.parse(files.get(`${route}.json`));
		for(const row of report.reports)
		{
			assert.equal(row.profile, "php-wasm");
			assert.equal(row.path, route === "ordinary" ? "ordinary-source" : "reviewed-source");
			const checks = row.fixture === "scalar" ? 2028 : 14089;
			references.push({ id: `php-wasm-direct-fin-${row.fixture}-${route}-installed`
				, sourcePath, fixture: row.fixture, checks, revision: phpWasmDirectProducer
				, scope: `${sourcePath} ${row.fixture}: ${Object.keys(row.refinements).length} exports, twelve installed executions with ${checks} checks each, two-root package reproduction and source-free offline installation. ${phpWasmDirectPromotionEnvironment} ${phpWasmDirectPromotionLimit}`
				, command: "LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST=1 LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST=1 node --test --test-concurrency=1 tests/helpers/php-wasm-fin-direct-tests.mjs && node scripts/check-php-wasm-direct-fin-reports.mjs --directory build/php-wasm-fin-direct"
				, files: originals.map(file => ({ ...file }))
				, artifacts: Object.entries(row.archives).map(([path, sha256]) => ({ path, sha256 })) });
		}
	}
	return references;
};

/**
 * Supplement existing Fin cells without overlapping observations or changing other types.
 *
 * @param original - Inventory before the direct-value supplement.
 * @param references - The four independently authenticated fixture selections.
 */
export const promotePhpWasmDirectFin = async (original, references) => {
	const expected = [];
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["scalar", "containers"])
		expected.push([
			`php-wasm-direct-fin-${fixture}-${route}-installed`
			, route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, fixture, fixture === "scalar" ? 2028 : 14089
		]);
	assert.deepEqual(references.map(item => [item.id, item.sourcePath, item.fixture, item.checks]), expected);
	const inventory = structuredClone(original);
	const validators = await Promise.all(common.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already supplemented: " + reference.id);
		assert.equal(reference.revision, phpWasmDirectProducer);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision
			, scope: reference.scope, command: reference.command
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })) });
	}
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["products", "records"])
	{
		const id = `php-wasm-fin-${fixture}-${route}`, matches = inventory.observations.filter(item => item.id === id);
		assert.equal(matches.length, 1, id);
		const [item] = matches;
		assert.deepEqual(item.profiles, ["php-wasm"]); assert.deepEqual(item.shapes, ["fin"]);
		assert.equal(item.path, route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(item.conversionNotes.fin, phpWasmFinPromotionConversion);
		item.conversionNotes.fin = phpWasmDirectPromotionConversion;
		if(fixture === "records") continue;
		assert.deepEqual(item.positions, ["parameter", "result"]);
		const selected = references.filter(reference => reference.sourcePath === item.path);
		assert.equal(selected.length, 2);
		item.scope += " Additional direct scalar and Array/List/Option exports have separate local installed observations: seven scalar exports with 2,028 checks and twelve container exports with 14,089 checks per execution.";
		assert.equal(item.limitations[0], phpWasmFinPromotionLimit);
		item.limitations[0] = phpWasmDirectPromotionLimit;
		item.limitations.push("The earlier product reports retain their original nested-only scope and Node/Chromium versions. The direct-value supplement records its own producer and runtime.", phpWasmDirectPromotionEnvironment);
		for(const [name, stage] of Object.entries(item.stages))
		{
			assert.equal(stage.state, "passed");
			stage.evidence.push(...selected.map(reference => reference.id));
			if(name === "installedExecution")
			{
				assert.ok(stage.note.includes(phpWasmFinPromotionNestedOnly));
				stage.note = stage.note.replace(phpWasmFinPromotionLimit, "The earlier product report covers nested values; direct values are established separately below.");
			}
			stage.note += ` Direct scalar and Array/List/Option acceptance uses producer ${phpWasmDirectProducer}. ${phpWasmDirectPromotionEnvironment} ${phpWasmDirectPromotionLimit}`;
		}
	}
	return inventory;
};
