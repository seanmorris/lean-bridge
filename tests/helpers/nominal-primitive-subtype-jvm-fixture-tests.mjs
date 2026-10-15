/**
 * Isolated controls for the nineteen-base JVM selection, callers, stand-in and probe sources.
 * Nothing here compiles, builds or installs a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 as sha } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeJvmCaller, nominalPrimitiveSubtypeJvmConfiguration, nominalPrimitiveSubtypeJvmCounts, nominalPrimitiveSubtypeJvmLeanSource, nominalPrimitiveSubtypeJvmModel, nominalPrimitiveSubtypeJvmReview, nominalPrimitiveSubtypeJvmSelection, parseNominalPrimitiveSubtypeJvmResult } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { checkNominalPrimitiveSubtypeJvmProbe, checkNominalPrimitiveSubtypeKotlinNullProbe, nominalPrimitiveSubtypeJvmInputNames, nominalPrimitiveSubtypeJvmProbeSource, nominalPrimitiveSubtypeKotlinNullSource } from "./nominal-primitive-subtype-jvm-probe.mjs";
import { nominalPrimitiveSubtypeJvmMutants } from "./nominal-primitive-subtype-jvm-caller-tests.mjs";

test("primitive-base JVM selection refuses misspelled gates and keeps the complete matrix by default", () => {
	assert.deepEqual(nominalPrimitiveSubtypeJvmSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.deepEqual(nominalPrimitiveSubtypeJvmSelection({ LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "1", LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES: "full" }).modes, ["full"]);
	for(const environment of [{ LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "1", LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES: "full,full" }
		, { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "1", LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES: "nix" }
		, { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_OUTPUT: "build/x" }])
		assert.throws(() => nominalPrimitiveSubtypeJvmSelection(environment), JSON.stringify(environment));
});

test("primitive-base JVM review and configuration rename only the colliding Pair record", async () => {
	for(const mode of ["full", "result-only"])
	{
		const review = nominalPrimitiveSubtypeJvmReview(mode), text = JSON.stringify(review);
		assert.ok(review.types.some(type => type.name === "PacketPair")); assert.ok(!review.types.some(type => type.name === "Pair"));
		assert.doesNotMatch(text, /"NominalPrimitiveSubtypes\.Pair"|"lean:NominalPrimitiveSubtypes\.Pair"/u);
		assert.equal(review.declarations.some(item => item.name === "echoA"), mode === "full");
		assert.ok(review.declarations.some(item => item.name === "producePair"));
		const configuration = nominalPrimitiveSubtypeJvmConfiguration("ordinary", mode);
		assert.deepEqual(configuration.targets, { maven: { name: "org.leanbridge:nominalprimitivesubtypes", version: "1.0.0" } });
		assert.ok(!JSON.stringify(configuration).includes("NominalPrimitiveSubtypes.Pair\""));
		assert.equal(Object.hasOwn(configuration, "contracts"), mode === "full");
		assert.equal(Object.hasOwn(nominalPrimitiveSubtypeJvmConfiguration("reviewed", mode), "exports"), false);
	}
	const lean = await nominalPrimitiveSubtypeJvmLeanSource();
	assert.equal((lean.match(/\bPacketPair\b/gu) ?? []).length, 4); assert.doesNotMatch(lean, /\bPair\b/u);
	assert.ok(lean.includes("def producePair (value : RawPacket) : PacketPair"));
});

test("primitive-base JVM callers select API sections, reviewed labels and every base", async () => {
	for(const profile of ["java", "kotlin"]) for(const mode of ["full", "result-only"])
	{
		const ordinary = await nominalPrimitiveSubtypeJvmCaller(profile, "ordinary", mode), reviewed = await nominalPrimitiveSubtypeJvmCaller(profile, "reviewed", mode);
		assert.doesNotMatch(ordinary, /FULL_ONLY|RESULT_ONLY/u);
		assert.equal(ordinary.includes("Api.echoA") || ordinary.includes("Api::echoA"), mode === "full");
		assert.equal(ordinary.includes("ROUNDS") && (mode === "full" ? ordinary.includes("natB") : !ordinary.includes("natB")), true);
		for(const field of nominalPrimitiveSubtypeFields) assert.ok(ordinary.includes(field.name), `${profile} ${mode} ${field.name}`);
		assert.equal(reviewed.includes("value0."), mode === "full"); assert.ok(!reviewed.includes("arg0."));
		assert.equal(ordinary.replaceAll(/arg([01])\./gu, "value$1."), reviewed);
		assert.ok(ordinary.includes("Api::produce") || ordinary.includes("Api.produce"));
		assert.ok(ordinary.includes("wordBits") && ordinary.includes(":64"));
		const model = await nominalPrimitiveSubtypeJvmModel(profile, mode);
		assert.ok(model.includes(`package org.leanbridge.nominalprimitivesubtypes${profile === "kotlin" ? ".kotlin" : ""};`));
		assert.equal(model.includes("public static Packet echoA"), mode === "full"); assert.ok(model.includes("public static long wordBits()"));
		for(const mutant of [...nominalPrimitiveSubtypeJvmMutants.shared, ...mode === "full" ? nominalPrimitiveSubtypeJvmMutants.full : []])
			assert.ok(model.includes(`mutant("${mutant}")`), `${mode} ${mutant}`);
		for(const mutant of mode === "full" ? [] : nominalPrimitiveSubtypeJvmMutants.full) assert.ok(!model.includes(`mutant("${mutant}")`), mutant);
	}
	await assert.rejects(nominalPrimitiveSubtypeJvmCaller("scala", "ordinary", "full"));
	for(const profile of ["java", "kotlin"]) for(const mode of ["full", "result-only"])
	{
		const counts = nominalPrimitiveSubtypeJvmCounts[profile][mode];
		assert.deepEqual(parseNominalPrimitiveSubtypeJvmResult(JSON.stringify(counts), profile, mode), counts);
		assert.equal(counts.rejections, mode === "full" ? 283 : 0); assert.equal(counts.snapshotControls, 9); assert.equal(counts.wordBits, 64);
		assert.throws(() => parseNominalPrimitiveSubtypeJvmResult(JSON.stringify({ ...counts, checks: counts.checks - 1 }), profile, mode));
	}
	// Kotlin never passes a null packet by construction; Java does, so its host rejections differ by exactly one.
	assert.equal(nominalPrimitiveSubtypeJvmCounts.java.full.hostRejections, nominalPrimitiveSubtypeJvmCounts.kotlin.full.hostRejections + 1);
});

test("primitive-base JVM probe sources name every input export and the null probes keep adjacent controls", () => {
	assert.equal(nominalPrimitiveSubtypeJvmInputNames.length, 8);
	const java = nominalPrimitiveSubtypeJvmProbeSource("java"), kotlin = nominalPrimitiveSubtypeJvmProbeSource("kotlin");
	for(const name of nominalPrimitiveSubtypeJvmInputNames) assert.ok(java.includes(`Api.${name}(`) && kotlin.includes(`Api.${name}(`), name);
	assert.ok(java.includes("Api.combine(null, null)") && kotlin.includes("fun combine(left: Packet, right: Packet)"));
	const digest = "a".repeat(64), outputs = { "Probe.class": { bytes: 1, sha256: digest } };
	checkNominalPrimitiveSubtypeJvmProbe({ profile: "java", mode: "full", source: java, sourceSha256: sha(java), archiveSha256: digest, run: { code: 0, stdout: "", stderr: "" }, outputs }, "java", "full");
	assert.throws(() => checkNominalPrimitiveSubtypeJvmProbe({ profile: "java", mode: "full", source: java, sourceSha256: sha(java), archiveSha256: digest, run: { code: 1, stdout: "", stderr: "x" }, outputs: {} }, "java", "full"));
	const lines = java.split("\n"), stderr = nominalPrimitiveSubtypeJvmInputNames.map(name => {
		const line = lines.findIndex(value => value.includes(`Api.${name}(`)) + 1;
		return `probe.java:${line}:40: compiler.err.cant.resolve.location.args: kindname.method, ${name}, , compiler.misc.type.null, (compiler.misc.location: kindname.class, org.leanbridge.nominalprimitivesubtypes.Api, null)`;
	}).join("\n") + "\n8 errors\n";
	checkNominalPrimitiveSubtypeJvmProbe({ profile: "java", mode: "result-only", source: java, sourceSha256: sha(java), archiveSha256: digest, run: { code: 1, stdout: "", stderr }, outputs: {} }, "java", "result-only");
	assert.throws(() => checkNominalPrimitiveSubtypeJvmProbe({ profile: "java", mode: "result-only", source: java, sourceSha256: sha(java), archiveSha256: digest, run: { code: 1, stdout: "", stderr: stderr.replace("echoB", "echoA") }, outputs: {} }, "java", "result-only"));
	for(const mode of ["full", "result-only"])
	{
		const control = nominalPrimitiveSubtypeKotlinNullSource(mode, false), invalid = nominalPrimitiveSubtypeKotlinNullSource(mode, true);
		assert.ok(control.includes("fun produce() = Api.produce(RawPacket(org.leanbridge.nominalprimitivesubtypes.Unit.INSTANCE, true, 42"));
		assert.ok(invalid.includes("fun produce() = Api.produce(null)"));
		assert.equal(control.split("\n").length, invalid.split("\n").length);
		assert.equal(invalid.includes("fun aliases() = Api.aliases(null, null)"), mode === "full");
		assert.ok(!invalid.includes("RawPacket(") && !invalid.includes("Packet("));
		const lines = mode === "full" ? [2, 3, 4, 4, 5] : [2];
		const stderr = lines.map(line => `NullProbe.kt:${line}:20: error: [NULL_FOR_NONNULL_TYPE] Null cannot be a value of a non-null type.`).join("\n") + "\n";
		checkNominalPrimitiveSubtypeKotlinNullProbe({ mode, invalid: true, source: invalid, sourceSha256: sha(invalid), archiveSha256: digest, run: { code: 1, stdout: "", stderr }, outputs: {} }, mode, true);
		assert.throws(() => checkNominalPrimitiveSubtypeKotlinNullProbe({ mode, invalid: true, source: invalid, sourceSha256: sha(invalid), archiveSha256: digest, run: { code: 1, stdout: "", stderr: stderr.replace("NULL_FOR_NONNULL_TYPE", "UNRESOLVED_REFERENCE") }, outputs: {} }, mode, true));
	}
});
