/**
 * Isolated compiler-record controls. Fabricated records are not compilation evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeJvmProbe, nominalSubtypeJvmInputNames, nominalSubtypeJvmProbeSource } from "./nominal-subtype-jvm-probe.mjs";
import { checkNominalSubtypeKotlinNullProbe, nominalSubtypeKotlinNullSource } from "./nominal-subtype-jvm-nullability.mjs";

const output = { bytes: 1, sha256: "a".repeat(64) };

test("nominal JVM API probe controls require all thirteen input methods and the input record", () => {
	assert.deepEqual(nominalSubtypeJvmInputNames, ["first", "second", "combine", "nested", "echo", "aliases", "echoGroups", "echoPair", "inspectAliasPair", "eventFirst", "eventSecond", "echoEvent", "plainFin"]);
	for(const profile of ["java", "kotlin"])
	{
		const source = nominalSubtypeJvmProbeSource(profile);
		const full = { profile, mode: "full", source
			, sourceSha256: sha256(source), archiveSha256: "a".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { [profile === "java" ? "Probe.class" : "ProbeKt.class"]: output } };
		checkNominalSubtypeJvmProbe(full, profile, "full");
		const fullMutations = [record => { record.run.code = 1; }
			, record => { record.outputs = {}; }
			, record => { record.source += "changed"; }
			, record => { record.sourceSha256 = "0".repeat(64); }
			, record => { record.run.stdout = "unexpected"; }
			, record => { record.run.stderr = "unexpected"; }];
		for(const mutate of fullMutations)
		{
			const changed = structuredClone(full); mutate(changed);
			assert.throws(() => checkNominalSubtypeJvmProbe(changed, profile, "full"));
		}
		const errors = [...nominalSubtypeJvmInputNames, "EnvelopePair"].map(name => {
			const marker = name === "EnvelopePair" ? name : `Api.${name}(`;
			const line = source.split("\n").findIndex(value => value.includes(marker)) + 1;
			return profile === "java" ? `probe.java:${line}:1: compiler.err.cant.resolve.location: ${name}\n`
				: `probe.kt:${line}:1: error: [UNRESOLVED_REFERENCE] Unresolved reference '${name}'.\n`;
		});
		const negative = { ...full, mode: "result-only", outputs: {}, run: { code: 1, stdout: "", stderr: errors.join("") } };
		checkNominalSubtypeJvmProbe(negative, profile, "result-only");
		const mutations = [record => { record.run.code = 0; }
			, record => { record.run.stderr = errors.slice(1).join(""); }
			, record => { record.run.stderr = errors.slice(1).join("") + errors[1]; }
			, record => { record.run.stderr = record.run.stderr.replace("first", "unknown"); }
			, record => { record.run.stderr = record.run.stderr.replace(/:\d+:1:/u, ":999:1:"); }
			, record => { record.run.stderr = record.run.stderr.replace(/compiler\.err\.cant\.resolve\.location|UNRESOLVED_REFERENCE/u, "unrelated-error"); }
			, record => { record.run.stderr += "warning: unrelated\n"; }
			, record => { record.outputs["Unexpected.class"] = output; }
			, record => { record.archiveSha256 = "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(negative); mutate(changed);
			assert.throws(() => checkNominalSubtypeJvmProbe(changed, profile, "result-only"));
		}
	}
});

test("Kotlin nullability probe controls reject unrelated diagnostics beside compiling controls", () => {
	for(const mode of ["full", "result-only"]) for(const invalid of [false, true])
	{
		const source = nominalSubtypeKotlinNullSource(mode, invalid), count = mode === "full" ? 4 : 1;
		const stderr = Array.from({ length: count }, (_, index) => `NullProbe.kt:${index + 2}:1: error: [NULL_FOR_NONNULL_TYPE] Null is not allowed.\n`).join("");
		const record = { mode, invalid, source
			, sourceSha256: sha256(source), archiveSha256: "a".repeat(64)
			, run: { code: invalid ? 1 : 0, stdout: "", stderr: invalid ? stderr : "" }
			, outputs: invalid ? {} : { "META-INF/main.kotlin_module": output, "NullProbeKt.class": output } };
		checkNominalSubtypeKotlinNullProbe(record, mode, invalid);
		const mutations = [item => { item.run.code = invalid ? 0 : 1; }
			, item => { item.invalid = !invalid; }, item => { item.mode = "unknown"; }
			, item => { item.sourceSha256 = "0".repeat(64); }
			, item => { item.run.stdout = "unexpected"; }
			, item => { item.run.stderr += "warning: unrelated\n"; }
			, ...invalid ? [item => { item.run.stderr = ""; }
				, item => { item.run.stderr = item.run.stderr.replace("NULL_FOR_NONNULL_TYPE", "UNRESOLVED_REFERENCE"); }
				, item => { item.run.stderr = item.run.stderr.replace(":2:1:", ":99:1:"); }
				, item => { item.outputs["NullProbeKt.class"] = output; }]
				: [item => { item.outputs = {}; }, item => { item.outputs["Unexpected.class"] = output; }]];
		for(const mutate of mutations)
		{
			const changed = structuredClone(record); mutate(changed);
			assert.throws(() => checkNominalSubtypeKotlinNullProbe(changed, mode, invalid));
		}
	}
});
