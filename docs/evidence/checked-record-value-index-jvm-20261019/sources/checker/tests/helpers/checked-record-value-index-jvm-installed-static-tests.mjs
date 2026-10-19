/**
 * Fast controls for value-index Maven identities, probes, and retained records.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexJvmProfiles, checkedRecordValueIndexJvmRoutes
} from "./checked-record-value-index-jvm-fixture.mjs";
import {
	checkedRecordValueIndexJvmClasses, checkedRecordValueIndexJvmNamespace
} from "./checked-record-value-index-jvm-package.mjs";
import {
	checkedRecordValueIndexJvmInputNames
	, checkedRecordValueIndexJvmProbeSource
	, checkedRecordValueIndexKotlinNullSource
	, checkCheckedRecordValueIndexJvmProbe
	, checkCheckedRecordValueIndexKotlinNullProbe
} from "./checked-record-value-index-jvm-probe.mjs";
import {
	checkedRecordValueIndexJvmRetainedMembers
} from "./checked-record-value-index-jvm-report.mjs";

const identity = source => ({
	bytes: Buffer.byteLength(source), sha256: sha256(source)
});

test("value-index Maven identity closes Java and Kotlin public classes", () => {
	assert.equal(checkedRecordValueIndexJvmNamespace
		, "org.leanbridge.checkedrecordvalueindices");
	assert.deepEqual(checkedRecordValueIndexJvmClasses, [
		"Ab", "Api", "EmptySized", "EmptyToken", "Off", "On"
		, "UnicodeToken", "WideToken", "ZeroToken"
	]);
	const receipt = { files: {
		"META-INF/MANIFEST.MF": identity("Manifest-Version: 1.0\n\n")
		, "org/leanbridge/checkedrecordvalueindices/Api.class": identity("api")
		, "org/leanbridge/checkedrecordvalueindices/kotlin/Api.class": identity(
			"kotlin-api")
	} };
	const retained = checkedRecordValueIndexJvmRetainedMembers(receipt);
	assert.deepEqual(retained, [
		"META-INF/MANIFEST.MF"
		, "META-INF/lean-bridge/package-receipt.json"
		, "org/leanbridge/checkedrecordvalueindices/Api.class"
		, "org/leanbridge/checkedrecordvalueindices/kotlin/Api.class"
	]);
	assert.equal(new Set(retained).size, retained.length);
});

test("value-index JVM probes require every checked input in full APIs", () => {
	for(const profile of checkedRecordValueIndexJvmProfiles)
	{
		const source = checkedRecordValueIndexJvmProbeSource(profile);
		for(const name of checkedRecordValueIndexJvmInputNames)
			assert.match(source, new RegExp(`\\b${name}\\b`, "u"));
		const full = {
			profile, route: "ordinary-source", source
			, sourceSha256: sha256(source), archiveSha256: "a".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "Probe.class": identity("class") }
		};
		assert.doesNotThrow(() => checkCheckedRecordValueIndexJvmProbe(
			full, profile, full.route));
		const diagnostics = checkedRecordValueIndexJvmInputNames.map(name => {
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
		assert.doesNotThrow(() => checkCheckedRecordValueIndexJvmProbe(
			resultOnly, profile, resultOnly.route));
		assert.throws(() => checkCheckedRecordValueIndexJvmProbe({
			...resultOnly, run: { ...resultOnly.run, stderr: diagnostics.split("\n")
				.slice(0, -2).join("\n") + "\n" }
		}, profile, resultOnly.route));
	}
});

test("value-index Kotlin nullability covers every surviving operation", () => {
	for(const route of checkedRecordValueIndexJvmRoutes)
	{
		const valid = checkedRecordValueIndexKotlinNullSource(route, false);
		const control = {
			route, invalid: false, source: valid, sourceSha256: sha256(valid)
			, archiveSha256: "c".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "NullProbeKt.class": identity("class") }
		};
		assert.doesNotThrow(() =>
			checkCheckedRecordValueIndexKotlinNullProbe(control, route, false));
		const invalid = checkedRecordValueIndexKotlinNullSource(route, true);
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
			checkCheckedRecordValueIndexKotlinNullProbe(negative, route, true));
		assert.equal(lines.length, route.startsWith("result-only-") ? 4 : 12);
	}
});
