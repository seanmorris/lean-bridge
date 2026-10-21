/**
 * Fast controls for zero-payload Maven identities, probes and retained files.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	zeroPayloadJvmProfiles, zeroPayloadJvmRoutes
} from "./zero-payload-checked-record-jvm-fixture.mjs";
import {
	zeroPayloadJvmClasses, zeroPayloadJvmNamespace
} from "./zero-payload-checked-record-jvm-package.mjs";
import {
	checkZeroPayloadJvmProbe, checkZeroPayloadKotlinNullProbe
	, zeroPayloadJvmInputNames, zeroPayloadJvmProbeSource
	, zeroPayloadKotlinNullSource
} from "./zero-payload-checked-record-jvm-probe.mjs";

const identity = source => ({
	bytes: Buffer.byteLength(source), sha256: sha256(source)
});

test("zero-payload Maven identity closes Java and Kotlin public classes", () => {
	assert.equal(zeroPayloadJvmNamespace
		, "org.leanbridge.zeropayloadcheckedrecords");
	assert.deepEqual(zeroPayloadJvmClasses, [
		"Api", "Mark", "MarkBlank", "MarkMarked", "Marker", "Token", "Witness"
	]);
	const receipt = { files: {
		"META-INF/MANIFEST.MF": identity("Manifest-Version: 1.0\n\n")
		, "org/leanbridge/zeropayloadcheckedrecords/Api.class": identity("api")
		, "org/leanbridge/zeropayloadcheckedrecords/kotlin/Api.class": identity(
			"kotlin-api")
	} };
	const retained = [
		...Object.keys(receipt.files), "META-INF/lean-bridge/package-receipt.json"
	].sort();
	assert.deepEqual(retained, [
		"META-INF/MANIFEST.MF", "META-INF/lean-bridge/package-receipt.json"
		, "org/leanbridge/zeropayloadcheckedrecords/Api.class"
		, "org/leanbridge/zeropayloadcheckedrecords/kotlin/Api.class"
	]);
	assert.equal(new Set(retained).size, retained.length);
});

test("zero-payload JVM probes require every checked input in full APIs", () => {
	for(const profile of zeroPayloadJvmProfiles)
	{
		const source = zeroPayloadJvmProbeSource(profile);
		for(const name of zeroPayloadJvmInputNames)
			assert.match(source, new RegExp(`\\b${name}\\b`, "u"));
		const full = {
			profile, route: "ordinary-source", source
			, sourceSha256: sha256(source), archiveSha256: "a".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "Probe.class": identity("class") }
		};
		assert.doesNotThrow(() => checkZeroPayloadJvmProbe(
			full, profile, full.route));
		const diagnostics = zeroPayloadJvmInputNames.map(name => {
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
		assert.doesNotThrow(() => checkZeroPayloadJvmProbe(
			resultOnly, profile, resultOnly.route));
		assert.throws(() => checkZeroPayloadJvmProbe({
			...resultOnly, run: { ...resultOnly.run
				, stderr: diagnostics.split("\n").slice(0, -2).join("\n") + "\n" }
		}, profile, resultOnly.route));
	}
});

test("zero-payload Kotlin nullability covers every surviving argument", () => {
	for(const route of zeroPayloadJvmRoutes)
	{
		const valid = zeroPayloadKotlinNullSource(route, false);
		const control = {
			route, invalid: false, source: valid, sourceSha256: sha256(valid)
			, archiveSha256: "c".repeat(64)
			, run: { code: 0, stdout: "", stderr: "" }
			, outputs: { "NullProbeKt.class": identity("class") }
		};
		assert.doesNotThrow(() =>
			checkZeroPayloadKotlinNullProbe(control, route, false));
		const invalid = zeroPayloadKotlinNullSource(route, true);
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
			checkZeroPayloadKotlinNullProbe(negative, route, true));
		assert.equal(lines.length, route.startsWith("result-only-") ? 3 : 8);
	}
});
