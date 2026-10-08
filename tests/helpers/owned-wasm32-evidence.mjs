/**
 * Bind wasm32 ownership claims to compiled transport and runtime observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { ownedWasm32Bindings, ownedWasm32Probe } from "./owned-wasm32-probes.mjs";

export const ownedWasm32Commands = {
	wasm: "LEAN_BRIDGE_OWNED_WASM32_TEST=1 node --test --test-concurrency=1 tests/owned-wasm32-transport.test.mjs"
	, native: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs"
};
export const ownedWasm32Scope = {
	profiles: ["php-wasm"], privateTransport: true, installedPackage: false
	, primitives: 19, wordBits: 32, identityBits: 64
	, sourcePaths: ["ordinary-source"], retainedLeanClosures: true
	, hostCallbacks: false, transferredInputs: false, anchoredResults: false
	, promotedCells: 0, nativeGeneratedBytesUnchanged: true
};
const passing = (run, command) => {
	assert.equal(run.status, "passed"); assert.equal(run.command, command);
	assert.equal(sha256(run.text), run.sha256);
	for(const [key, value] of Object.entries({ tests: 4, pass: 4, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP/mu);
};

/**
 * Require execution, both reports, retained artifacts and failure propagation.
 *
 * @param workflow - Complete consumer-matrix workflow text.
 */
export const assertOwnedWasm32Ci = workflow => {
	const step = workflow.split("        id: type_corpus_php_wasm\n")[1]?.split("      - name:")[0];
	assert.ok(step);
	assert.ok(step.includes("          " + ownedWasm32Commands.wasm + "\n"));
	for(const fixture of ["owned-scalars", "owned-aggregates"])
		assert.ok(step.includes(`          test -s build/owned-wasm32/${fixture}.json\n`));
	const upload = workflow.split("      - name: Upload owned wasm32 transport evidence\n")[1]?.split("      - name:")[0];
	assert.ok(upload?.includes("        if: always()\n"));
	for(const fixture of ["owned-scalars", "owned-aggregates"])
		assert.ok(upload.includes(`            build/owned-wasm32/${fixture}.json\n`));
	assert.ok(upload.includes("          if-no-files-found: error\n"));
	const observation = workflow.split("\n").find(line => line.includes("record --consumer php-wasm"));
	assert.ok(observation.includes(ownedWasm32Commands.wasm));
	assert.ok(workflow.includes('[ "${{ steps.type_corpus_php_wasm.outcome }}" != success ]; then\n            wasm_result=failed'));
	// The PHP-Wasm job enforces its own corpus outcome.
	const wasmJob = workflow.split("\n  php-wasm-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	const enforcement = wasmJob?.split("      - name: Enforce PHP support\n")[1]?.split("\n\n")[0];
	assert.ok(enforcement?.includes("steps.type_corpus_php_wasm.outcome != 'success'"));
};

/**
 * Regenerate layouts and C probes, then require the exact observed failure checks.
 *
 * @param record - New transport acceptance, not an installed package receipt.
 */
export const assertOwnedWasm32Execution = async record => {
	assert.deepEqual(record.scope, ownedWasm32Scope);
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), ["native", "wasm"]);
	for(const [name, command] of Object.entries(ownedWasm32Commands)) passing(record.runs[name], command);
	assert.deepEqual(Object.keys(record.reports).sort(), ["owned-aggregates", "owned-scalars"]);
	for(const [fixture, report] of Object.entries(record.reports))
	{
		const scalars = fixture === "owned-scalars";
		assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "wasm32-owned-value-transport");
		assert.equal(report.fixture, fixture); assert.equal(report.installedPackage, false);
		assert.equal(report.inputs.wordBits, 32);
		const generated = generateOwnedNativeValueAdapters(report.inputs), { carriers, layout } = generated;
		assert.equal(layout.wordBits, 32);
		assert.equal(report.adapterSha256, sha256(generated.source));
		assert.equal(report.layoutSha256, sha256(canonicalJson(layout)));
		assert.equal(report.exports, scalars ? 8 : 22); assert.equal(report.callbacks, scalars ? 0 : 4);
		assert.equal(layout.functions.length, report.exports); assert.equal(layout.callbacks.length, report.callbacks);
		if(scalars) assert.equal(layout.nodes.filter(node => node.kind === "primitive").length, 19);
		const source = await readFile(`tests/fixtures/onboarding/${fixture}/Owned.lean`, "utf8");
		const authoredProbe = await readFile(`tests/fixtures/structured-types/owned-native-${scalars ? "scalars" : "values"}.c`, "utf8");
		assert.equal(report.originalLeanSha256, sha256(source));
		assert.equal(report.originalProbeSha256, sha256(authoredProbe));
		const compiledSource = scalars ? source
			.replace("word := 18446744073709551615, signedWord := -9223372036854775808", "word := 4294967295, signedWord := -2147483648")
			.replace("p.word.toUInt64 == 18446744073709551615 && p.signedWord.toInt == -9223372036854775808", "p.word.toUInt64 == 4294967295 && p.signedWord.toInt == -2147483648") : source;
		const compiledProbe = scalars ? authoredProbe
			.replace(".S_word = UINT64_MAX, .S_signedWord = INT64_MIN", ".S_word = UINT32_MAX, .S_signedWord = INT32_MIN")
			.replace("p->S_word == UINT64_MAX && p->S_signedWord == INT64_MIN", "p->S_word == UINT32_MAX && p->S_signedWord == INT32_MIN") : authoredProbe;
		assert.equal(report.inputs.sourceIdentity.modules[0].source.sha256, sha256(compiledSource));
		assert.equal(report.inputs.sourceIdentity.sourceTreeSha256, sha256(compiledSource));
		for(const [path, source] of Object.entries({
			"Owned.lean": compiledSource, "check.c": compiledProbe
			, "carriers.h": carriers.header, "owned-values.h": generated.typesHeader
			, "owned-values-codec.h": generated.source
			, "owned-leases.h": ownedAggregateLeaseSource
			, "allocation-guard.h": nativeAllocationGuardHeader
			, [`${carriers.module}.lean`]: carriers.leanSource
			, [`${scalars ? "scalar" : "value"}-bindings.h`]: ownedWasm32Bindings(generated, scalars)
			, "probe.c": ownedWasm32Probe(generated, scalars)
		})) assert.equal(report.files[path], sha256(source), path);
		assert.deepEqual(report.runtimeManifest.pins, phpWasmCopiedPins);
		assert.equal(report.runtimeManifest.pointerBits, 32);
		assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
		assert.equal(report.compiler, report.runtimeManifest.compiler.version);
		assert.equal(report.inputs.sourceIdentity.leanCommit, phpWasmCopiedPins.leanCommit);
		assert.match(report.wasmSha256, /^[a-f0-9]{64}$/u);
		assert.equal(report.executions.length, 2);
		for(const observed of report.executions) assert.deepEqual(observed, {
			checks: scalars ? 372 : 30039, boundaryChecks: scalars ? 165 : 18
			, failures: scalars ? 10 : 92, wordBits: 32, phpBits: 32
			, phpVersion: "8.4.1", live: 0, identities: 0
			, runtimeInitializations: 1, componentInitializations: 1, retired: scalars
		});
	}
	assertOwnedWasm32Ci(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
