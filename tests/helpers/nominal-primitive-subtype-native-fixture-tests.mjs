/**
 * Test native gate selection and caller expectations without claiming package execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeNativeProfiles, nominalPrimitiveSubtypeNativeRoutes, nominalPrimitiveSubtypeNativeModes, nominalPrimitiveSubtypeNativeConfiguration, nominalPrimitiveSubtypeNativeCaller, nominalPrimitiveSubtypeNativeCounts, nominalPrimitiveSubtypeNativeSelection, parseNominalPrimitiveSubtypeNativeResult } from "./nominal-primitive-subtype-native-fixture.mjs";
import { nominalPrimitiveSubtypeNativeModelMutations } from "./nominal-primitive-subtype-native-controls.mjs";

test("primitive-base native configurations require both public packages and exact caller counts", async () => {
	for(const route of nominalPrimitiveSubtypeNativeRoutes) for(const mode of nominalPrimitiveSubtypeNativeModes)
	{
		const configuration = nominalPrimitiveSubtypeNativeConfiguration(route, mode);
		validateExportConfiguration(configuration);
		assert.deepEqual(configuration, nominalPrimitiveSubtypeConfiguration(route, ["c", "cpp"], mode === "result-only"));
		if(mode === "result-only") assert.equal(configuration.contracts, undefined);
		for(const profile of nominalPrimitiveSubtypeNativeProfiles)
		{
			const source = await nominalPrimitiveSubtypeNativeCaller(profile, route, mode);
			const prefix = (mode === "result-only" ? "#define PRIMITIVE_RESULT_ONLY\n" : "")
				+ (route === "reviewed" ? '#define PRIMITIVE_PARAMETER_PREFIX "value"\n' : "");
			assert.equal(source, prefix + await nominalPrimitiveSubtypeNativeCaller(profile, "ordinary", "full"));
			const counts = nominalPrimitiveSubtypeNativeCounts[profile][mode];
			assert.deepEqual(parseNominalPrimitiveSubtypeNativeResult(JSON.stringify(counts), profile, mode), counts);
			assert.equal(counts.wordBits, 64); assert.equal(counts.rounds, 256);
			for(const key of Object.keys(counts))
				assert.throws(() => parseNominalPrimitiveSubtypeNativeResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), profile, mode));
			assert.throws(() => parseNominalPrimitiveSubtypeNativeResult(JSON.stringify({ ...counts, extra: true }), profile, mode));
		}
	}
	assert.throws(() => nominalPrimitiveSubtypeNativeConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypeNativeConfiguration("ordinary", "unknown"));
	for(const args of [["unknown", "ordinary", "full"], ["c", "unknown", "full"], ["c", "ordinary", "unknown"]])
		await assert.rejects(nominalPrimitiveSubtypeNativeCaller(...args));
	assert.throws(() => parseNominalPrimitiveSubtypeNativeResult("{}", "unknown", "full"));
	assert.throws(() => parseNominalPrimitiveSubtypeNativeResult("{}", "c", "unknown"));
});

test("primitive-base native gates reject disabled selections and single-profile bypasses", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypeNativeSelection({}), {
		enabled: false, profiles: ["c", "cpp"]
		, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypeNativeSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypeNativeSelection({ [prefix + "TEST"]: flag }));
	for(const profiles of ["", "c", "cpp", "c,cpp", null])
		assert.throws(() => nominalPrimitiveSubtypeNativeSelection({ ...enabled, [prefix + "PROFILES"]: profiles }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const value of ["", "unknown", valid + ",", valid + "," + valid, true, null])
			assert.throws(() => nominalPrimitiveSubtypeNativeSelection({ ...enabled, [prefix + name]: value }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypeNativeSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypeNativeSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const flag of [undefined, "0"])
		assert.throws(() => nominalPrimitiveSubtypeNativeSelection({ [prefix + "TEST"]: flag, [prefix + "OUTPUT"]: "explicit" }));
});

test("primitive-base native model controls target all nineteen constructors and the independent Fin field", async t => {
	for(const route of nominalPrimitiveSubtypeNativeRoutes) for(const mode of nominalPrimitiveSubtypeNativeModes)
	{
		// Python's original compiler model uses the same native IR; no C/C++ package is executed here.
		const original = await readFile(`docs/evidence/nominal-primitive-subtype-python-20261014/${route}/${mode}/records/build-0/model.json`);
		const model = JSON.parse(original), mutations = nominalPrimitiveSubtypeNativeModelMutations(mode);
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
	assert.throws(() => nominalPrimitiveSubtypeNativeModelMutations("unknown"));
	t.diagnostic("Checks mutation targets against retained native compiler IR; installed C/C++ acceptance remains separate.");
});
