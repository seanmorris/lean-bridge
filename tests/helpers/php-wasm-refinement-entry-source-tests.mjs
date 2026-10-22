/**
 * Fixture controls for reversible nominal and recursive Lean entry markers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import {
	phpWasmRefinementEntryHostedSelection
	, phpWasmRefinementEntrySourceFamilies, phpWasmRefinementEntrySourceFixture
} from "./php-wasm-refinement-entry-source-fixtures.mjs";

const fixtures = phpWasmRefinementEntrySourceFamilies.map(phpWasmRefinementEntrySourceFixture);

test("nominal and recursive entry probes name every authored boundary reversibly", async () => {
	for(const fixture of fixtures)
	{
		const original = await readFile(fixture.path, "utf8");
		const probe = phpWasmRefinementEntrySource(original, fixture);
		assert.notEqual(probe.originalSha256, probe.probeSha256, fixture.namespace);
		assert.equal(probe.entries.length, fixture.constructors.length + fixture.sources.length);
		assert.equal(new Set(probe.entries.map(item => item.symbol)).size, probe.entries.length);
		for(const item of probe.entries)
		{
			assert.ok(probe.source.includes(`export ${item.symbol}`), item.symbol);
			assert.equal(item.label.startsWith(fixture.namespace + "."), true);
		}
		assert.throws(() => phpWasmRefinementEntrySource(probe.source, fixture), /prefix/u);
	}
});

test("recursive match equations remain before their exported wrappers", async () => {
	const fixture = phpWasmRefinementEntrySourceFixture("recursive-subtype");
	const original = await readFile(fixture.path, "utf8");
	const { source } = phpWasmRefinementEntrySource(original, fixture);
	for(const name of ["first", "second"])
	{
		const body = source.indexOf(`def ${name}Body : Chain → Nat`);
		const equation = source.indexOf("| .empty => 0", body);
		const wrapper = source.indexOf(`def ${name} (value : Chain) : Nat := ${name}Body value`);
		assert.ok(body >= 0 && equation > body && wrapper > equation, name);
	}
	assert.ok(source.indexOf("def first (value") < source.indexOf("def secondBody"));
});

test("hosted source selection cannot narrow unless the producer is enabled", () => {
	assert.equal(phpWasmRefinementEntryHostedSelection({}).enabled, false);
	assert.throws(() => phpWasmRefinementEntryHostedSelection({
		LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES: "recursive-subtype"
	}), /requires TEST=1/u);
	const selected = phpWasmRefinementEntryHostedSelection({
		LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES: "recursive-subtype,nominal-full"
		, LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES: "reviewed"
	});
	assert.deepEqual(selected, {
		enabled: true
		, families: ["recursive-subtype", "nominal-full"]
		, routes: ["reviewed"]
	});
	assert.throws(() => phpWasmRefinementEntryHostedSelection({
		LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES: "ordinary,ordinary"
	}), /Duplicate/u);
});
