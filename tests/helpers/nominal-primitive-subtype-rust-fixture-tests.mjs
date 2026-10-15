/**
 * Test primitive Rust selection, caller scope and every constructor mutation site.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeRustRoutes, nominalPrimitiveSubtypeRustModes, nominalPrimitiveSubtypeRustConfiguration, nominalPrimitiveSubtypeRustCaller, nominalPrimitiveSubtypeRustCounts, nominalPrimitiveSubtypeRustSelection, parseNominalPrimitiveSubtypeRustResult } from "./nominal-primitive-subtype-rust-fixture.mjs";
import { nominalPrimitiveSubtypeRustModelMutations } from "./nominal-primitive-subtype-rust-model-controls.mjs";

test("primitive-base Rust configurations preserve source routes, exact caller counts and result-only APIs", async () => {
	for(const route of nominalPrimitiveSubtypeRustRoutes) for(const mode of nominalPrimitiveSubtypeRustModes)
	{
		const configuration = nominalPrimitiveSubtypeRustConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
			, targets: { cargo: { name: "nominalprimitivesubtypes", version: "1.0.0" } } });
		if(mode === "result-only") assert.equal(configuration.contracts, undefined);
		assert.equal(await nominalPrimitiveSubtypeRustCaller(route), await nominalPrimitiveSubtypeRustCaller("ordinary"));
		const counts = nominalPrimitiveSubtypeRustCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypeRustResult(JSON.stringify(counts), mode), counts);
		assert.equal(counts.wordBits, 64); assert.equal(counts.rounds, 256);
		assert.equal(counts.snapshotControls, 30);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypeRustResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypeRustResult(JSON.stringify({ ...counts, extra: true }), mode));
	}
	assert.throws(() => nominalPrimitiveSubtypeRustConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypeRustConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypeRustCaller("unknown"));
	assert.throws(() => parseNominalPrimitiveSubtypeRustResult("{}", "unknown"));
});

test("primitive-base Rust gates reject disabled, misspelled or repeated selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypeRustSelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypeRustSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypeRustSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const value of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nominalPrimitiveSubtypeRustSelection({ ...enabled, [prefix + name]: value }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypeRustSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypeRustSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nominalPrimitiveSubtypeRustSelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
});

test("primitive-base Rust model controls target all nineteen constructors and the independent Fin field", async t => {
	for(const route of nominalPrimitiveSubtypeRustRoutes) for(const mode of nominalPrimitiveSubtypeRustModes)
	{
		// The retained Python compiler IR shares the native model; no Rust crate is executed here.
		const original = await readFile(`docs/evidence/nominal-primitive-subtype-python-20261014/${route}/${mode}/records/build-0/model.json`);
		const model = JSON.parse(original), mutations = nominalPrimitiveSubtypeRustModelMutations(mode);
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
	assert.throws(() => nominalPrimitiveSubtypeRustModelMutations("unknown"));
	t.diagnostic("Checks mutation targets against original native compiler IR; installed Rust acceptance remains separate.");
});
