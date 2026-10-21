/**
 * Fast controls for dependent checked-record Maven identities, probes and retained files.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	dependentCheckedRecordJvmProfiles, dependentCheckedRecordJvmRoutes
} from "./dependent-checked-record-jvm-fixture.mjs";
import {
	dependentCheckedRecordJvmClasses, dependentCheckedRecordJvmNamespace
} from "./dependent-checked-record-jvm-package.mjs";
import {
	checkDependentCheckedRecordJvmProbe, checkDependentCheckedRecordKotlinNullProbe
	, dependentCheckedRecordJvmInputNames, dependentCheckedRecordJvmProbeSource
	, dependentCheckedRecordKotlinNullSource
} from "./dependent-checked-record-jvm-probe.mjs";

const identity = source => ({
	bytes: Buffer.byteLength(source), sha256: sha256(source)
});

test("dependent checked-record Maven identity closes Java and Kotlin public classes", () => {
	assert.equal(dependentCheckedRecordJvmNamespace
		, "org.leanbridge.dependentrecords");
	assert.deepEqual(dependentCheckedRecordJvmClasses, ["Api", "Dependent"]);
	const receipt = { files: {
		"META-INF/MANIFEST.MF": identity("Manifest-Version: 1.0\n\n")
		, "org/leanbridge/dependentrecords/Api.class": identity("api")
		, "org/leanbridge/dependentrecords/kotlin/Api.class": identity(
			"kotlin-api")
	} };
	const retained = [
		...Object.keys(receipt.files), "META-INF/lean-bridge/package-receipt.json"
	].sort();
	assert.deepEqual(retained, [
		"META-INF/MANIFEST.MF", "META-INF/lean-bridge/package-receipt.json"
		, "org/leanbridge/dependentrecords/Api.class"
		, "org/leanbridge/dependentrecords/kotlin/Api.class"
	]);
	assert.equal(new Set(retained).size, retained.length);
});

test("dependent checked-record JVM probes require every checked input in full APIs", () => {
	for(const profile of dependentCheckedRecordJvmProfiles)
	{
		const source = dependentCheckedRecordJvmProbeSource(profile);
		for(const name of dependentCheckedRecordJvmInputNames)
			assert.match(source, new RegExp(`\\b${name}\\b`, "u"));
		const full = {
			profile, route: "ordinary-source", source
			, sourceSha256: sha256(source), archiveSha256: "a".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "Probe.class": identity("class") }
		};
		assert.doesNotThrow(() => checkDependentCheckedRecordJvmProbe(
			full, profile, full.route));
		const diagnostics = dependentCheckedRecordJvmInputNames.map(name => {
			const line = source.split("\n").findIndex(value => value.includes(
				profile === "java" ? `Api.${name}(` : `Api::${name}`
			)) + 1;
			return profile === "java"
				? `probe.java:${line}:1: compiler.err.cant.resolve.location.args: kindname.method, ${name}\n`
				: `probe.kt:${line}:1: error: [UNRESOLVED_REFERENCE] Unresolved reference '${name}'\n`;
		}).join("");
		const resultOnly = {
			profile, route: "result-only-reviewed-ir", source
			, sourceSha256: sha256(source), archiveSha256: "b".repeat(64)
			, run: { code: 1, stdout: "", stderr: diagnostics }, outputs: {}
		};
		assert.doesNotThrow(() => checkDependentCheckedRecordJvmProbe(
			resultOnly, profile, resultOnly.route));
		assert.throws(() => checkDependentCheckedRecordJvmProbe({
			...resultOnly, run: { ...resultOnly.run
				, stderr: diagnostics.split("\n").slice(0, -2).join("\n") + "\n" }
		}, profile, resultOnly.route));
	}
});

test("dependent checked-record Kotlin nullability covers every surviving argument", () => {
	for(const route of dependentCheckedRecordJvmRoutes)
	{
		const valid = dependentCheckedRecordKotlinNullSource(route, false);
		const control = {
			route, invalid: false, source: valid, sourceSha256: sha256(valid)
			, archiveSha256: "c".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "NullProbeKt.class": identity("class") }
		};
		assert.doesNotThrow(() =>
			checkDependentCheckedRecordKotlinNullProbe(control, route, false));
		const invalid = dependentCheckedRecordKotlinNullSource(route, true);
		const lines = invalid.trimEnd().split("\n").slice(1);
		const stderr = lines.map((_, index) =>
			`NullProbe.kt:${index + 2}:1: error: [NULL_FOR_NONNULL_TYPE] Null cannot be a value of a non-null type\n`
		).join("");
		const negative = {
			route, invalid: true, source: invalid, sourceSha256: sha256(invalid)
			, archiveSha256: "d".repeat(64)
			, run: { code: 1, stdout: "", stderr }, outputs: {}
		};
		assert.doesNotThrow(() =>
			checkDependentCheckedRecordKotlinNullProbe(negative, route, true));
		assert.equal(lines.length, route.startsWith("result-only-") ? 1 : 3);
	}
});
