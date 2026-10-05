/**
 * Reject forged direct callback inputs, source hashes and lifetime diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJvmCallbackRuntime, ownedJvmCallbackRuntimeReports } from "./helpers/owned-jvm-callback-result-runtime-evidence.mjs";

const options = { skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1", timeout: 300000 };
const read = async name => JSON.parse(await readFile(`build/owned-jvm-callback-results/${name}`, "utf8"));
const zero = "0".repeat(64);
const rehashInput = item => { item.compiledInputSha256 = sha256(canonicalJson(item.input)); };
const corruptRawDiagnostic = (item, transform) => {
	const run = item.negativeControls.rejected[0].execution;
	run.stderr = transform(run.stderr); run.stderrSha256 = sha256(run.stderr);
};

test("JVM callback runtime evidence reconstructs all six original source-bound executions", options, async t => {
	for(const name of ownedJvmCallbackRuntimeReports) await assertOwnedJvmCallbackRuntime(name, await read(name));
	assert.equal(ownedJvmCallbackRuntimeReports.length, 6);
	t.diagnostic(JSON.stringify({ reports: 6, languages: 2, rejectedMutants: 16, restoredRuns: 6 }));
});

test("JVM callback runtime evidence rejects forged sources, diagnostics and restoration", options, async t => {
	let rejected = 0;
	for(const name of ownedJvmCallbackRuntimeReports)
	{
		const original = await read(name);
		const changes = [
			item => { item.schemaVersion++; }, item => { item.planNode++; }
			, item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }
			, item => { item.variant = "unsupported"; }
			, item => { item.combined = !item.combined; }
			, item => { item.hostCallbacks = !item.hostCallbacks; }
			, item => { item.actualLean = false; }
			, item => { item.installedPackage = true; }
			, item => { item.profiles.pop(); }
			, item => { item.explicitCleanupWithoutGc = false; }
			, item => { item.options.callbackResultAnchors = false; }
			, item => { item.input.callbackResultAnchors = false; rehashInput(item); }
			, item => { item.input.component.name = "substitute"; rehashInput(item); }
			, item => { item.input.metadata.diagnostics.push({ message: "forged" }); rehashInput(item); }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = zero; rehashInput(item); }
			, item => { item.input.sourceIdentity.sourceTreeSha256 = zero; rehashInput(item); }
			, item => { item.input.sourceIdentity.leanCompilerSha256 = zero; rehashInput(item); }
			, item => { item.input.sourceIdentity.leanCommit = "0".repeat(40); rehashInput(item); }
			, item => { item.input.sourceIdentity.extractorSha256 = zero; rehashInput(item); }
			, item => { item.input.sourceIdentity.exportConfigurationSource = "{}"; rehashInput(item); }
			, item => { item.input.sourceIdentity.exportConfigurationSha256 = zero; rehashInput(item); }
			, ...original.mode === "reviewed" ? [
				item => { item.input.sourceIdentity.reviewedBindingIr.source = "{}"; rehashInput(item); }
				, item => { item.input.sourceIdentity.reviewedBindingIr.sourceSha256 = zero; rehashInput(item); }
			] : []
			, ...["compiledInputSha256", "nativeModelSha256", "bindingIrSha256", "nativeProbeSha256", "nativeHeaderSha256", "guardSha256"]
				.map(key => item => { item[key] = zero; })
			, ...Object.keys(original.compiledSources).map(path => item => { item.compiledSources[path] = zero; })
			, item => { delete item.compiledSources["api.c"]; }
			, item => { item.compiledSources["uncompiled.c"] = zero; }
			, item => { item.generated[Object.keys(item.generated)[0]] = zero; }
			, item => { delete item.generated[Object.keys(item.generated)[0]]; }
			, item => { item.generated["uncompiled.java"] = zero; }
			, ...Object.keys(original.probes).map(path => item => { item.probes[path] = zero; })
			, item => { delete item.probes[Object.keys(item.probes).find(path => path.endsWith(".kt"))]; }
			, item => { item.observed.checks--; }
			, item => { item.observed.kotlinChecks--; }
			, item => { item.observed.live++; }, item => { item.observed.identities++; }
			, item => { item.execution.stderr = "unexpected compiler diagnostic"; }
			, item => { item.execution.stdoutSha256 = zero; }
			, item => { item.execution.stdout = "{}\n"; item.execution.stdoutSha256 = sha256(item.execution.stdout); }
			, item => { item.execution.stdout = JSON.stringify(item.observed, null, 2) + "\n"; item.execution.stdoutSha256 = sha256(item.execution.stdout); }
			, item => { item.negativeControls.rejected.pop(); }
			, item => { item.negativeControls.rejected.reverse(); }
			, item => { item.negativeControls.rejected[0].name += "-forged"; }
			, item => { item.negativeControls.rejected[0].from += " "; }
			, item => { item.negativeControls.rejected[0].to += " "; }
			, item => { item.negativeControls.rejected[0].occurrences++; }
			, item => { item.negativeControls.rejected[0].sourceSha256 = zero; }
			, item => { item.negativeControls.rejected[0].mutantSha256 = zero; }
			, item => { item.negativeControls.rejected[0].compiled = false; }
			, item => { item.negativeControls.rejected[0].semanticRejection = false; }
			, item => { item.negativeControls.rejected[0].assertionLanguage = "kotlin"; }
			, item => { item.negativeControls.rejected[0].assertion += "-forged"; }
			, item => { item.negativeControls.rejected[0].method = "unrelatedFailure"; }
			, item => { item.negativeControls.rejected[0].execution.stderrSha256 = zero; }
			, item => { item.negativeControls.rejected[0].execution.stdoutSha256 = zero; }
			, item => { item.negativeControls.rejected[0].execution.stdout = "unexpected successful output"; }
			, item => corruptRawDiagnostic(item, stderr => stderr.replace("AssertionError", "RuntimeException"))
			, item => corruptRawDiagnostic(item, stderr => stderr.replace(".emptyOwners(", ".unrelatedFailure("))
			, item => corruptRawDiagnostic(item, stderr => stderr + "unrelated native crash\n")
			, item => { delete item.negativeControls.restoration; }
			, item => { item.negativeControls.restoration.compiled = false; }
			, item => { item.negativeControls.restoration.generatedSourcesRestored = false; }
			, item => { item.negativeControls.restoration.observed.checks--; }
			, item => { item.negativeControls.restoration.execution.stdout = "{}\n"; }
			, item => { item.negativeControls.restoration.execution.stdoutSha256 = zero; }
			, item => { item.negativeControls.restoration.execution.stderr = "restoration failed"; }
			, item => { item.unverifiedClaim = true; }
		];
		for(const change of changes)
		{
			const changed = structuredClone(original); change(changed);
			await assert.rejects(() => assertOwnedJvmCallbackRuntime(name, changed), `${name}: ${change}`);
			rejected++;
		}
	}
	assert.ok(rejected >= 450); t.diagnostic(JSON.stringify({ reports: 6, rejected }));
});
