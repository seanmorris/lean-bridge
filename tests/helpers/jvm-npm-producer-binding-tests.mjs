/**
 * Bind historical JVM generators and the npm command to their actual producers.
 * These checks inspect sources and metadata without generating packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	ownedJvmCallProducer, ownedJvmCallReceipt, ownedJvmCallSources
} from "./owned-jvm-call-evidence.mjs";
import {
	ownedJvmConversionProducer, ownedJvmConversionReceipt
	, ownedJvmConversionSources
} from "./owned-jvm-conversion-evidence.mjs";
import {
	ownedJavaScriptNpmEvidenceCommands, ownedJavaScriptNpmEvidenceProducer
} from "./owned-javascript-npm-evidence.mjs";
import { ownedJavaScriptNpmTestCommand } from "./owned-javascript-wasm-ci.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

for(const [kind, producer, path, sources, count] of [
	["calls", ownedJvmCallProducer, ownedJvmCallReceipt, ownedJvmCallSources, 6]
	, ["conversions", ownedJvmConversionProducer, ownedJvmConversionReceipt
		, ownedJvmConversionSources, 4]
]) {
	test(`JVM ${kind} producer authenticates every recorded source and Lean input`, async () => {
		const bytes = await readFile(path);
		assert.equal(sha256(bytes), sha256(bytesAtProducer(producer, path)));
		execFileSync("git", ["merge-base", "--is-ancestor", producer, "HEAD"]);
		const record = JSON.parse(bytes);
		assert.deepEqual(Object.keys(record.sources).sort(), sources);
		assert.equal(Object.keys(record.reports).length, count);
		for(const [source, digest] of Object.entries(record.sources))
			assert.equal(sha256(bytesAtProducer(producer, source, digest)), digest, source);
		for(const [mode, report] of Object.entries(record.reports))
		{
			const fixture = kind === "calls"
				? { values: "owned-cpp-composition", scalars: "owned-scalars"
					, signatures: "owned-dotnet-callables" }[mode.split("-")[0]]
				: mode.startsWith("scalars-") ? "owned-scalars" : "owned-cpp-composition";
			const identity = report.input.sourceIdentity;
			assert.equal(identity.modules.length, 1);
			assert.equal(sha256(bytesAtProducer(producer,
				`tests/fixtures/onboarding/${fixture}/Owned.lean`
			)), identity.modules[0].source.sha256, mode);
			assert.equal(sha256(bytesAtProducer(producer, "src/analyze/NativeExports.lean"))
				, identity.extractorSha256, mode);
		}
	});
}

test("npm evidence command matches its original producer without narrowing current CI", async () => {
	const path = "docs/evidence/owned-javascript-npm-integration-20260928.json";
	const bytes = await readFile(path);
	assert.equal(sha256(bytes), sha256(bytesAtProducer(ownedJavaScriptNpmEvidenceProducer, path)));
	const record = JSON.parse(bytes);
	for(const source of ["tests/helpers/owned-javascript-npm-evidence.mjs"
		, "tests/helpers/owned-javascript-wasm-ci.mjs"])
		assert.equal(sha256(bytesAtProducer(ownedJavaScriptNpmEvidenceProducer
			, source, record.sources[source])), record.sources[source], source);
	const original = await moduleAtProducer(ownedJavaScriptNpmEvidenceProducer
		, "tests/helpers/owned-javascript-npm-evidence.mjs");
	assert.deepEqual(ownedJavaScriptNpmEvidenceCommands, original.ownedJavaScriptNpmEvidenceCommands);
	assert.deepEqual(Object.fromEntries(Object.entries(record.runs)
		.map(([name, run]) => [name, run.command])), ownedJavaScriptNpmEvidenceCommands);
	assert.doesNotMatch(ownedJavaScriptNpmEvidenceCommands.execution, /owned-subtype-javascript-packaging/u);
	assert.match(ownedJavaScriptNpmTestCommand, /owned-subtype-javascript-packaging/u);
});
