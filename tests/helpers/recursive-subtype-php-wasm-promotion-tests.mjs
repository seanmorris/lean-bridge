/**
 * Restrict recursive checked PHP-Wasm claims to the two archived author routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { recursiveSubtypePhpWasmProducer } from "./recursive-subtype-php-wasm-evidence.mjs";
import {
	promoteRecursiveSubtypePhpWasm
	, recursiveSubtypePhpWasmConversion
	, recursiveSubtypePhpWasmField
	, recursiveSubtypePhpWasmLimit
	, recursiveSubtypePhpWasmParameter
	, recursiveSubtypePhpWasmReferences
	, recursiveSubtypePhpWasmResult
} from "./recursive-subtype-php-wasm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", [
	"show", `${recursiveSubtypePhpWasmProducer}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("recursive checked PHP-Wasm promotion derives two installed references", async () => {
	const references = await recursiveSubtypePhpWasmReferences();
	assert.deepEqual(references.map(item => [item.id, item.route, item.sourcePath]), [
		["recursive-subtype-php-wasm-ordinary-installed", "ordinary", "ordinary-source"]
		, ["recursive-subtype-php-wasm-reviewed-installed", "reviewed", "reviewed-ir"]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["php-wasm"]);
		assert.equal(reference.revision, recursiveSubtypePhpWasmProducer);
		assert.deepEqual(reference.counts, {
			executions: 12, checks: 24, php: "8.4.1", wordBits: 32
			, loadCeiling: 8, diskFloorBytes: 2 * 1024 * 1024 * 1024
		});
		assert.equal(reference.artifacts.length, 3);
		assert.ok(reference.command.includes("run-recursive-subtype-php-wasm-ci.sh"));
		assert.ok(reference.scope.includes("cycle and depth limits"));
		for(const suffix of ["index.json", `${reference.route}/report.json`
			, `${reference.route}/package-set-receipt.json`
			, "sources/src/backends/php/copied-graph-zend.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("recursive checked PHP-Wasm promotion rejects narrowed or changed references", async () => {
	const original = predecessor(), references = await recursiveSubtypePhpWasmReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteRecursiveSubtypePhpWasm(original, changed));
	for(const mutate of [
		item => { item.route = "reviewed"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.profiles.push("php-native"); }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.checks = 23; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
		, item => { item.scope = "Every recursive Subtype works"; }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteRecursiveSubtypePhpWasm(original, changed));
	}
	const promoted = await promoteRecursiveSubtypePhpWasm(original, references);
	await assert.rejects(promoteRecursiveSubtypePhpWasm(promoted, references), /Already promoted/u);
});

test("recursive checked PHP-Wasm promotion supplements exactly six existing cells", async () => {
	const original = predecessor(), references = await recursiveSubtypePhpWasmReferences();
	const proposed = await promoteRecursiveSubtypePhpWasm(original, references);
	const { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(-2), proposed.evidence.slice(-2));
	assert.equal(proposed.evidence.length, original.evidence.length + 2);
	assert.equal(proposed.observations.length, original.observations.length);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = after.filter((cell, index) => JSON.stringify(cell) !== JSON.stringify(before[index]));
	assert.deepEqual(changed.map(cell => cell.id).sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"]
			.map(position => `php-wasm/subtype/${path}/${position}`)).sort());
	for(const cell of changed)
	{
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const id = `recursive-subtype-php-wasm-${route}-installed`;
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed"); assert.equal(stage.evidence.at(-1), id);
		}
		assert.ok(cell.limitations.includes(recursiveSubtypePhpWasmLimit));
		assert.ok(cell.conversionNote.includes(recursiveSubtypePhpWasmConversion));
		assert.equal(cell.hostType, {
			parameter: recursiveSubtypePhpWasmParameter
			, result: recursiveSubtypePhpWasmResult
			, field: recursiveSubtypePhpWasmField
		}[cell.position]);
	}
});

test("recursive checked PHP-Wasm documentation publishes the exact boundary", async () => {
	const php = await readFile("docs/php.md", "utf8");
	assert.ok(php.includes("recursive-subtype-php-wasm-20261015.md"));
	for(const text of ["recursive Chain", "128 copied levels", "caller graphs"])
		assert.ok(php.toLowerCase().includes(text.toLowerCase()), text);
	const reference = await readFile("docs/reference/types.md", "utf8");
	assert.ok(reference.includes("recursive-subtype-php-wasm-20261015.md"));
	for(const text of ["recursive variant", "shared Fin bounds", "shared caller values"])
		assert.ok(reference.toLowerCase().includes(text.toLowerCase()), text);
});
