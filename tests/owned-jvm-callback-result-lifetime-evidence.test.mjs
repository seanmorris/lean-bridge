/**
 * Reject forged compiler inputs, callback lifetime counts and detector evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJvmCallbackLifetimeEvidence } from "./helpers/owned-jvm-callback-result-lifetime-evidence.mjs";

const zero = "0".repeat(64);
const rehashLog = (item, change) => {
	const text = gunzipSync(Buffer.from(item.compilationLogGzipBase64, "base64")).toString("utf8");
	const altered = change(text); assert.notEqual(altered, text);
	item.compilationLogGzipBase64 = gzipSync(altered).toString("base64");
	item.compilationSha256 = sha256(altered);
};
const forgeObservation = (run, observed, key) => {
	observed[key]++; run.stdout = JSON.stringify(observed) + "\n";
};
const changesFor = kind => kind === "gc" ? [
	item => { item.actualGc = false; }
	, item => { item.compiler = "c1"; }
	, item => { item.observed.javaOriginals--; }
	, item => { item.observed.kotlinReplies--; }
	, item => { item.observed.rounds = 0; }
	, item => { forgeObservation(item.execution, item.observed, "live"); }
	, item => { forgeObservation(item.restoredExecution, item.restored, "identities"); }
	, item => { item.execution.code = 1; }
	, item => { item.restoredExecution.stdout = "{}"; }
	, item => { item.instrumentedRuntimeSha256 = zero; }
	, item => { item.instrumentedBindingsSha256 = zero; }
	, item => { item.compilationSha256 = zero; }
	, item => { delete item.compilationLogGzipBase64; }
	, item => { item.restoredCompilationSha256 = zero; }
	, item => { item.optimized.pop(); }
	, item => { item.restoredOptimized[0].lines = []; }
	, item => { rehashLog(item, text => text.replaceAll("compiler='c2'", "compiler='c1'")); }
	, item => { rehashLog(item, text => text.replaceAll("<task_done success='1'", "<task_done success='0'")); }
	, item => { rehashLog(item, text => text.replaceAll("CallbackResult read (", "CallbackResult unrelated (")); }
	, item => { item.mutations.pop(); }
	, item => { item.mutations[0].sourceSha256 = zero; }
	, item => { item.mutations[0].compiled = false; }
	, item => { item.mutations[0].execution.code = 0; }
	, item => { item.mutations[0].execution.stderr = "java.lang.AssertionError: unrelated failure"; }
	, item => { item.mutations[1].semanticRejection = false; }
	, item => { item.mutations[1].optimized.pop(); }
	, item => { rehashLog(item.mutations[1], text => text.replaceAll("compiler='c2'", "compiler='c1'")); }
] : kind === "faults" ? [
	item => { item.explicitCleanupWithoutGc = false; }
	, item => { forgeObservation(item.execution, item.observed, "checks"); }
	, item => { forgeObservation(item.execution, item.observed, "live"); }
	, item => { item.observed.identities++; }
	, item => { item.observed.cases.pop(); }
	, item => { item.observed.cases[0].faults[0]--; }
	, item => { item.observed.cases[1].enteredFaults[0] = 0; }
	, item => { item.observed.cases[2].publishedFaults[1] = 0; }
	, item => { item.observed.cases[3].faults[1] = 0; }
	, item => { item.observed.cases[4].returnedFaults[0] = 0; }
	, item => { item.observed.cases[7].successes[1] = 0; }
	, item => { item.execution.stdout = "{}"; }
	, item => { item.execution.stderr = "allocation fault escaped"; }
	, item => { item.instrumentedRuntimeSha256 = zero; }
	, item => { item.instrumentedBindingsSha256 = zero; }
] : kind === "process" ? [
	item => { item.profile = "host"; }
	, item => { item.combined = !item.combined; }
	, item => { item.capabilities.hostCallbacks = !item.capabilities.hostCallbacks; }
	, item => { item.scope.fork = true; }
	, item => { item.scope.installedMaven = true; }
	, item => { item.scope.nativeThreadExit = false; }
	, item => { item.scope.stronglyReachableOwners = false; }
	, item => { item.guardSha256 = zero; }
	, item => { delete item.probeFiles[Object.keys(item.probeFiles)[0]]; }
	, item => { item.observations[0].threadExits = 0; }
	, item => { item.observations[0].threadExitErrors = 1; }
	, item => { forgeObservation(item.executions[0], item.observations[0], "live"); }
	, item => { item.observations[0].checks--; }
	, item => { item.observations.pop(); }
	, item => { item.executions[0].code = 1; }
	, item => { item.executions[0].stdout = "{}"; }
	, item => { item.executions.pop(); }
] : [
	item => { item.combined = !item.combined; }
	, item => { item.observations[0].observed.checks--; }
	, item => { item.observations[0].execution.stdout = "{}"; }
	, item => { item.sanitized.observations[1].execution.stderr = "detector warning"; }
	, item => { item.sanitized.observations[0].observed.identities = 1; }
	, item => { item.sanitized.observations.pop(); }
	, item => { item.nativeSanitizers.pop(); }
	, item => { item.nativeControlsSha256 = zero; }
	, item => { item.driverSha256 = zero; }
	, item => { item.sanitizedSources.pop(); }
	, item => { item.leanRuntimeInstrumented = true; }
	, item => { item.jvmInstrumented = true; }
	, item => { item.leakSanitizer = true; }
	, item => { item.sanitized.environment.ASAN_OPTIONS = "detect_leaks=0"; }
	, item => { item.sanitized.environment.UBSAN_OPTIONS = "halt_on_error=0"; }
	, item => { item.sanitized.rejected.pop(); }
	, item => { item.sanitized.rejected[0].execution.code = 0; }
	, item => { item.sanitized.rejected[0].execution.stderr = "unrelated JVM failure"; }
	, item => { item.sanitized.rejected[1].execution.stderr = "runtime error: shift exponent 40 is too large"; }
	, item => { item.sanitized.rejected[1].execution.stdout = '{"checks":47}'; }
	, item => { item.sanitized.rejected[1].diagnostic = "unrelated failure"; }
];

test("JVM callback lifetime reports reconstruct inputs and reject forged execution evidence", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	let reports = 0, rejected = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const kind of ["gc", "faults", "process", "sanitizers"])
	for(const combined of ["gc", "faults"].includes(kind) ? [true] : [false, true])
	{
		const name = ["gc", "faults"].includes(kind) ? mode + ".json"
			: kind === "process" ? `${mode}${combined ? "" : "-no-host"}-process.json`
				: `${mode}-${combined ? "combined" : "no-host"}-sanitizers.json`;
		const directory = ["gc", "faults"].includes(kind) ? `owned-jvm-callback-result-${kind}` : "owned-jvm-callback-results";
		const original = JSON.parse(await readFile(`build/${directory}/${name}`, "utf8"));
		await assertOwnedJvmCallbackLifetimeEvidence(kind, name, original); reports++;
		const changes = [
			item => { item.schemaVersion = 2; }
			, item => { item.unverifiedClaim = true; }
			, item => { item.mode = mode === "ordinary" ? "reviewed" : "ordinary"; }
			, item => { item.input.callbackResultAnchors = false; }
			, item => { item.input.hostCallbacks = !combined; }
			, item => { item.input.valueCopies = false; }
			, item => { item.input.transferredInputs = !combined; }
			, item => { item.input.metadata.schemaVersion = 999; }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = zero; }
			, item => { item.input.sourceIdentity.extractorSha256 = zero; }
			, item => { item.input.sourceIdentity.exportConfigurationSha256 = zero; }
			, item => { item.input.sourceIdentity.exportConfigurationSource += " "; }
			, item => { const files = item.generated ?? item.generatedFiles; delete files[Object.keys(files)[0]]; }
			, item => { const files = item.generated ?? item.generatedFiles; files[Object.keys(files)[0]] = zero; }
			, item => { item.sourceHashes[Object.keys(item.sourceHashes)[0]] = zero; }
			, item => { delete item.sourceHashes[Object.keys(item.sourceHashes)[0]]; }
			, item => { if(kind === "process") item.nativeSourceSha256 = zero; else item.nativeProbeSha256 = zero; }
			, ...kind === "process" ? [] : [
				item => { item.actualLean = false; }
				, item => { item.installedPackage = true; }
				, item => { item.javaProbeSha256 = zero; }
				, item => { item.kotlinProbeSha256 = zero; }
			]
			, ...changesFor(kind)
		];
		for(const change of changes)
		{
			const altered = structuredClone(original); change(altered);
			await assert.rejects(assertOwnedJvmCallbackLifetimeEvidence(kind, name, altered), undefined, `${kind}/${name}: ${change}`);
			rejected++;
		}
	}
	assert.equal(reports, 12); t.diagnostic(JSON.stringify({ reports, rejected }));
});
