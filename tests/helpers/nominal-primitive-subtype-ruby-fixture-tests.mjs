/**
 * Test primitive Ruby selection, caller scope and every constructor mutation site.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeRubyRoutes, nominalPrimitiveSubtypeRubyModes, nominalPrimitiveSubtypeRubyConfiguration, nominalPrimitiveSubtypeRubyCaller, nominalPrimitiveSubtypeRubyCounts, nominalPrimitiveSubtypeRubySelection, parseNominalPrimitiveSubtypeRubyResult } from "./nominal-primitive-subtype-ruby-fixture.mjs";
import { nominalPrimitiveSubtypeRubyModelMutations } from "./nominal-primitive-subtype-ruby-controls.mjs";

test("primitive-base Ruby configurations preserve source routes, exact caller counts and result-only APIs", async () => {
	for(const route of nominalPrimitiveSubtypeRubyRoutes) for(const mode of nominalPrimitiveSubtypeRubyModes)
	{
		const configuration = nominalPrimitiveSubtypeRubyConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
			, targets: { rubygems: { name: "nominalprimitivesubtypes", version: "1.0.0" } } });
		if(mode === "result-only") assert.equal(configuration.contracts, undefined);
		assert.equal(await nominalPrimitiveSubtypeRubyCaller(route), await nominalPrimitiveSubtypeRubyCaller("ordinary"));
		const counts = nominalPrimitiveSubtypeRubyCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypeRubyResult(JSON.stringify(counts), mode), counts);
		assert.equal(counts.wordBits, 64); assert.equal(counts.rounds, 256);
		assert.equal(counts.snapshotControls, 12);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypeRubyResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypeRubyResult(JSON.stringify({ ...counts, extra: true }), mode));
	}
	assert.throws(() => nominalPrimitiveSubtypeRubyConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypeRubyConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypeRubyCaller("unknown"));
	assert.throws(() => parseNominalPrimitiveSubtypeRubyResult("{}", "unknown"));
});

test("primitive-base Ruby gates reject disabled, misspelled or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypeRubySelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypeRubySelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypeRubySelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const value of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nominalPrimitiveSubtypeRubySelection({ ...enabled, [prefix + name]: value }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypeRubySelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypeRubySelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nominalPrimitiveSubtypeRubySelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
});

test("primitive-base Ruby model controls target all nineteen constructors and the independent Fin field", async t => {
	for(const route of nominalPrimitiveSubtypeRubyRoutes) for(const mode of nominalPrimitiveSubtypeRubyModes)
	{
		// The retained Python compiler IR shares the native model; no Ruby gem is executed here.
		const original = await readFile(`docs/evidence/nominal-primitive-subtype-python-20261014/${route}/${mode}/records/build-0/model.json`);
		const model = JSON.parse(original), mutations = nominalPrimitiveSubtypeRubyModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 42 : 23);
		assert.equal(new Set(mutations.map(([label]) => label)).size, mutations.length);
		for(const field of nominalPrimitiveSubtypeFields)
		{
			assert.equal(mutations.filter(([label]) => label === "invented output constructor: " + field.name).length, 1);
			assert.equal(mutations.filter(([label]) => label === "replaced input constructor: " + field.name).length, mode === "full" ? 1 : 0);
		}
		for(const [label, mutate] of mutations)
		{
			const changed = structuredClone(model); mutate(changed);
			assert.notEqual(canonicalJson(changed), canonicalJson(model), label);
		}
		assert.equal(canonicalJson(model), original.toString());
	}
	assert.throws(() => nominalPrimitiveSubtypeRubyModelMutations("unknown"));
	t.diagnostic("Checks mutation targets against original native compiler IR; installed Ruby acceptance remains separate.");
});
