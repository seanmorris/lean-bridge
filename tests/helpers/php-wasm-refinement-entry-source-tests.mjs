/**
 * Fixture controls for reversible nominal and recursive Lean entry markers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";

const nominalConstructors = [
	...nominalPrimitiveSubtypeFields.flatMap(item => [item.constructor + "A", item.constructor + "B"])
	, "unitReject"
];
const nominalSources = [
	"echoA", "echoB", "refuseUnit", "combine", "echoPair"
	, "echoEventA", "echoEventB", "aliases", "produce", "produceGroup"
	, "producePair", "produceEvent", "produceChoices", "wordBits"
];
const fixtureRoot = "tests/fixtures/onboarding/";
const fixtures = [{
	path: fixtureRoot + "nominal-primitive-subtypes/NominalPrimitiveSubtypes.lean"
	, namespace: "NominalPrimitiveSubtypes", prefix: "lb_nominal_primitive_probe"
	, constructors: nominalConstructors, sources: nominalSources, wrappers: {}
}
, {
	path: fixtureRoot + "recursive-subtypes/RecursiveSubtypes.lean"
	, namespace: "RecursiveSubtypes", prefix: "lb_recursive_subtype_probe"
	, constructors: ["plusOne", "plusTwo"]
	, sources: ["first", "second", "echo", "groups", "echoGroups", "produce"]
	, wrappers: {
		first: "(value : Chain) : Nat := firstBody value"
		, second: "(value : Chain) : Nat := secondBody value"
	}
}
, {
	path: fixtureRoot + "recursive-checked-records/RecursiveCheckedRecords.lean"
	, namespace: "RecursiveCheckedRecords"
	, prefix: "lb_recursive_checked_record_probe"
	, constructors: ["plusOne", "plusTwo", "mkPacket", "normalizePacket"]
	, sources: ["first", "second", "echo", "groups", "echoGroups", "produce"]
	, wrappers: {}
}];

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
	const fixture = fixtures[1], original = await readFile(fixture.path, "utf8");
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
