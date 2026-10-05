/**
 * Verify original direct reports and reject altered runtime claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackRuntime, assertOwnedPerlCallbackRuntimeMatrix
	, ownedPerlCallbackRuntimeReports } from "./owned-perl-callback-result-runtime-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_REPORTS ?? "build/owned-perl-callback-results";
const reports = async () => Object.fromEntries(await Promise.all(ownedPerlCallbackRuntimeReports
	.map(async name => [name, JSON.parse(await readFile(join(directory, name), "utf8"))])));

test("Perl callback evidence reconstructs all six original direct-runtime reports", { skip: !enabled }, async () => {
	await assertOwnedPerlCallbackRuntimeMatrix(await reports());
});

test("Perl callback evidence rejects changed source, scope, ABI and raw execution", { skip: !enabled }, async t => {
	const originals = await reports();
	const mutations = [
		item => { item.schemaVersion++; }
		, item => { item.finalAcceptance = true; }
		, item => { item.kind = "owned-perl-callback-results-installed"; }
		, item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }
		, item => { item.variant = item.variant === "host" ? "combined" : "host"; }
		, item => { item.actualLean = false; }
		, item => { item.installedPackage = true; }
		, item => { item.options.callbackResultAnchors = false; }
		, item => { item.options.hostCallbacks = !item.options.hostCallbacks; }
		, item => { item.options.receiverExports = !item.options.receiverExports; }
		, item => { item.input.component.id += "-changed"; }
		, item => { item.input.metadata.extra = true; }
		, item => { item.input.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }
		, item => { item.input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, item => { item.input.sourceIdentity.sourceTreeSha256 = "0".repeat(64); }
		, item => { item.input.sourceIdentity.modules[0].source.path = "Wrong.lean"; }
		, item => { item.input.sourceIdentity.modules[0].interface.sha256 = "0".repeat(64); }
		, item => {
			item.input.sourceIdentity.exportConfigurationSource = canonicalJson({ schemaVersion: 1, modules: [] });
			item.input.sourceIdentity.exportConfigurationSha256 = sha256(item.input.sourceIdentity.exportConfigurationSource);
		}
		, item => { item.input.sourceIdentity.request.contracts = {}; }
		, ...["nativeSourceSha256", "declarationsSha256", "valuesSha256", "xsSha256"]
			.map(key => item => { item[key] = "0".repeat(64); })
		, item => { item.probe = "print qq(ok\\n);"; item.probeSha256 = sha256(item.probe); }
		, item => { item.observations.pop(); }
		, item => { item.observations[1] = structuredClone(item.observations[0]); }
		, item => { item.observations[0].perl = "/usr/bin/perl"; }
		, item => { item.observations[0].execution.code = 1; }
		, item => { item.observations[0].execution.stderr = "leaked ownership"; }
		, item => { item.observations[0].execution.stdout = "{}\n"; }
		, item => { item.observations[0].observed.checks++; }
		, item => { item.observations[0].finalAcceptance = true; }
		, item => {
			const observation = item.observations[0]; observation.observed.perlVersion = "v5.40.0";
			observation.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(observation.observed))) + "\n";
		}
		, item => {
			const observation = item.observations[0]; observation.observed.threaded = 1 - observation.observed.threaded;
			observation.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(observation.observed))) + "\n";
		}
		, ...["managedLive", "nativeLive", "identities", "owners", "active", "cleanupStatus"]
			.map(key => item => {
				const observation = item.observations[0]; observation.observed[key]++;
				observation.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(observation.observed))) + "\n";
			})
		, item => {
			const observation = item.observations[0]; observation.observed.phases.native--;
			observation.observed.checks--;
			observation.execution.stdout = JSON.stringify(JSON.parse(canonicalJson(observation.observed))) + "\n";
		}
	];
	let rejected = 0;
	for(const [name, original] of Object.entries(originals))
	{
		for(const [index, mutate] of mutations.entries())
		{
			const item = structuredClone(original); mutate(item);
			await assert.rejects(() => assertOwnedPerlCallbackRuntime(name, item), undefined, `${name}: mutation ${index}`);
			++rejected;
		}
		const missing = structuredClone(originals); delete missing[name];
		await assert.rejects(() => assertOwnedPerlCallbackRuntimeMatrix(missing)); ++rejected;
	}
	const injected = { ...originals, "injected.json": originals[ownedPerlCallbackRuntimeReports[0]] };
	await assert.rejects(() => assertOwnedPerlCallbackRuntimeMatrix(injected)); ++rejected;
	t.diagnostic(`${rejected} altered report or matrix claims rejected`);
});
