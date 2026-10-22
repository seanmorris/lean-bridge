#!/usr/bin/env node
/**
 * Retain the exact local PHP-Wasm callback Subtype qualification and publish
 * its two author routes into the type-surface inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkCallbackSubtypePhpWasmReport
} from "../tests/helpers/callback-subtype-php-wasm-report.mjs";

const implementationCommit = "6249ba2f4018ecfd4997067806688dff5acfb028";
const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_PHP_WASM_OUTPUT
	?? "build/callback-subtype-php-wasm-local");
const evidencePath
	= "docs/evidence/callback-subtype-php-wasm-local-qualification-20261022.json";
const markdownPath
	= "docs/evidence/callback-subtype-php-wasm-local-qualification-20261022.md";
const inventoryPath = "docs/type-surface.v1.json";
const command = "source scripts/env.sh && LEAN_BRIDGE_PHP_SOURCE=/app/build/php-wasm-sdk/php8.4-src LEAN_BRIDGE_PHP_EMSDK=/app/.toolchains/emsdk-php-wasm LEAN_BRIDGE_PHP_WASM_HOST=/app/build/php-wasm-host/node_modules/php-wasm LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=/app/build/php-wasm-subtype-entry-input/php-wasm-runtime LEAN_BRIDGE_CALLBACK_SUBTYPE_PHP_WASM_OUTPUT=build/callback-subtype-php-wasm-local npm run test:callback-subtype-php-wasm";

const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
const writeDraftEvidence = async (path, source) => {
	const current = await readFile(path, "utf8").catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
	if(current === null) await writeFile(path, source, { flag: "wx" });
	else assert.equal(current, source, `Refusing to rewrite changed evidence: ${path}`);
};
assert.equal(git(["rev-parse", "HEAD"]), implementationCommit
	, "Qualification is draft-only at the exact implementation commit");
for(const path of [evidencePath, markdownPath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]), ""
		, `Never rewrite committed qualification evidence: ${path}`);

const reports = [];
for(const route of ["ordinary", "reviewed"])
{
	await checkCallbackSubtypePhpWasmReport(
		path => readFile(`${output}/${route}/${path}`)
		, { route, producerCommit: implementationCommit }
	);
	const bytes = await readFile(`${output}/${route}/report.json`);
	const report = JSON.parse(bytes);
	const executions = report.phpWasm.executions;
	assert.equal(executions.length, 12);
	assert.ok(executions.every(execution =>
		JSON.stringify(execution.observation) === JSON.stringify(report.observation)));
	reports.push({
		route
		, reportSha256: sha256(bytes)
		, bindingIrSha256: report.phpWasm.component.bindingIrSha256
		, modelSha256: report.builds[0].modelSha256
		, receiptSha256: report.builds[0].receiptSha256
		, packageSetSha256: report.builds[0].packageSetSha256
		, independentBuilds: report.independentBuilds
		, reproducible: report.reproducible
		, sourceRemovedBeforeInstallation: report.sourceRemovedBeforeInstallation
		, offlineInstall: report.offlineInstall
		, compilerFreeReplay: report.compilerFreeReplay
		, relocatedInstallation: report.relocatedInstallation
		, nodeExecutions: executions.filter(item => item.realm === "node").length
		, chromiumExecutions: executions.filter(item => item.realm === "chromium").length
		, observation: report.observation
		, callbackBoundaries: report.callbackBoundaries
		, archives: report.receipt.packages.map(pkg => ({
			role: pkg.role, ecosystem: pkg.ecosystem
			, path: pkg.artifacts[0].path
			, bytes: pkg.artifacts[0].bytes
			, sha256: pkg.artifacts[0].sha256
		}))
	});
}
assert.deepEqual(reports.map(item => item.route), ["ordinary", "reviewed"]);
assert.deepEqual(reports.map(item => item.observation), [
	{ callback_calls: 8, checks: 28, php: "8.4.1", rejections: 9, word_bits: 32 }
	, { callback_calls: 8, checks: 28, php: "8.4.1", rejections: 9, word_bits: 32 }
]);

const indexBytes = await readFile(`${output}/index.json`);
const ordinary = JSON.parse(await readFile(`${output}/ordinary/report.json`));
const qualification = {
	schemaVersion: 1
	, profile: "installed-callback-subtype-php-wasm-local-qualification"
	, implementationCommit, command
	, verifier: `node scripts/check-callback-subtype-php-wasm-reports.mjs --directory build/callback-subtype-php-wasm-local --producer ${implementationCommit}`
	, scope: "Synchronous copied-value PHP-Wasm host callbacks returning selected Nat Subtypes and returned Lean closures accepting selected Nat Subtypes. Ordinary Lean source and independently reviewed Binding IR each produce two identical package sets, install offline after author-source removal, relocate physically, and execute through weak and strict PHP in startup and lazy Node and Chromium contexts. Scalar, mixed ordinary/checked and admitted Array/Option/Result carriers are covered. Retained or asynchronous host callbacks, arbitrary predicates, recursive or generic refined callback payloads, owned callback payloads, dispatch counts and memory bounds remain separate work. Hosted release-floor acceptance remains gated by the recurring workflow."
	, indexSha256: sha256(indexBytes)
	, runtimeIdentity: ordinary.phpWasm.component.runtimeIdentity
	, runtimePins: ordinary.phpWasm.runtime.pins
	, compiler: ordinary.phpWasm.component.compiler
	, reports
};
await writeDraftEvidence(evidencePath
	, JSON.stringify(qualification, null, 2) + "\n");
await writeDraftEvidence(markdownPath
	, `# PHP-Wasm callback Subtype local qualification\n\n`
	+ `Implementation: \`${implementationCommit}\`\n\n`
	+ `Ordinary Lean source and independently reviewed Binding IR each produced the same package set twice. Both routes removed the author source, installed the Composer API, npm component and npm shared runtime offline, moved the installation, and passed the unchanged public PHP caller in eight Node and four Chromium startup/lazy, weak/strict contexts.\n\n`
	+ `Every execution passed 28 checks with nine expected rejections and eight callback entries. The checks cover scalar and mixed host callbacks, nested \`Result (Option Subtype)\` replies, returned Lean closures, nested \`Array (Option Subtype)\` inputs, explicit checked recovery, first-error identity, idempotent closure cleanup, rejection before callback entry, and later-call recovery.\n\n`
	+ `The machine-readable [qualification record](callback-subtype-php-wasm-local-qualification-20261022.json) pins the implementation, runtime, compiler, report, package and archive identities. The [recurring workflow](../../.github/workflows/callback-subtype-php-wasm.yml) rebuilds and retains the original handoffs. Retained or asynchronous callbacks, arbitrary predicates, recursive or generic refined payloads, owned callback payloads, dispatch counts and memory bounds remain separate work.\n`);

const sourcePaths = [
	".github/workflows/callback-subtype-php-wasm.yml"
	, "scripts/check-callback-subtype-php-wasm-reports.mjs"
	, "tests/callback-subtype-php-wasm.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/php-wasm.php"
	, "tests/helpers/callback-subtype-php-wasm-fixture.mjs"
	, "tests/helpers/callback-subtype-php-wasm-installed-tests.mjs"
	, "tests/helpers/callback-subtype-php-wasm-report.mjs"
	, "tests/helpers/callback-subtype-php-wasm-tests.mjs"
];
const files = [];
for(const path of [evidencePath, markdownPath, ...sourcePaths])
	files.push({ path, sha256: sha256(await readFile(path)) });
const artifacts = reports.flatMap(report => [
	{ path: `callback-subtype-php-wasm-local/${report.route}/report.json`
		, sha256: report.reportSha256 }
	, ...report.archives.map(item => ({
		path: `callback-subtype-php-wasm-local/${report.route}/handoff/${item.path}`
		, sha256: item.sha256
	}))
]);
const evidenceId = "callback-subtype-php-wasm-local-installed";
const evidence = {
	id: evidenceId, kind: "installed", revision: implementationCommit, command
	, scope: "Ordinary-source and independently reviewed PHP-Wasm packages reproduce complete Composer API, npm component and npm shared-runtime archives from two author roots. Both source-free offline installations are physically relocated before eight Node and four Chromium startup/lazy, weak/strict executions. Every execution passes 28 checks, including exact typed recovery for host callback Subtype results, selected-constructor checks for returned Lean-closure inputs, nested copied containers, original Throwable identity, idempotent cleanup, rejection before callback entry and later-call recovery. This is local wasm32 PHP 8.4.1 acceptance; the recurring workflow remains the hosted release-floor gate."
	, files, artifacts
};

const document = JSON.parse(await readFile(inventoryPath, "utf8"));
const evidenceIndex = document.evidence.findIndex(item => item.id === evidenceId);
if(evidenceIndex === -1) document.evidence.push(evidence);
else document.evidence[evidenceIndex] = evidence;
const limitation = "Acceptance covers the fixture's selected Nat Subtypes in synchronous copied-value host callbacks and returned Lean closures on wasm32 PHP 8.4.1. Retained or asynchronous host callbacks, arbitrary predicates, recursive or generic refined callback payloads, owned callback payloads, dispatch cost and memory bounds remain separate work.";
const hosted = "The exact local reports and archive identities are retained. The recurring workflow rebuilds and retains original package handoffs; hosted release-floor acceptance is not claimed by this local evidence.";
for(const route of ["ordinary", "reviewed"])
{
	const path = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
	const sourceLabel = route === "ordinary" ? "ordinary-source" : "reviewed-IR";
	const observation = {
		id: `callback-subtype-php-wasm-${route}`
		, profiles: ["php-wasm"], shapes: ["subtype"]
		, positions: ["callback-parameter", "callback-result"], path
		, scope: "Checked inputs to returned Lean closures and checked results produced by synchronous host callbacks. Host-only callbacks do not expose closure lease functions. Generated PHP uses an exact checked recovery for host-produced selected results."
		, hostTypes: { subtype: {
			"callback-parameter": "base values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "base values from a host callback checked by Lean with an explicit typed recovery"
		}}
		, conversionNotes: { subtype: "Wrap a host callback that returns a selected Subtype with the generated with_recovery(callback, value). The recovery is validated before callback entry and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body." }
		, stages: Object.fromEntries([
			["analysis", `Fresh Lean analysis preserves the selected ${sourceLabel} constructors and both callback directions for PHP-Wasm.`]
			, ["generation", "Generated PHP and Zend descriptors retain host-versus-closure direction, checked payloads and exact typed recovery without proof fields."]
			, ["compilation", "The pinned Emscripten toolchain compiles the 32-bit Lean component and selected-constructor boundaries."]
			, ["packaging", `The ${sourceLabel} package set reproduces, installs offline after author-source removal and replays after physical relocation.`]
			, ["installedExecution", `Installed Node and Chromium callers check acceptance, exact rejection, exception identity, cleanup and recovery on the ${sourceLabel} route.`]
		].map(([stage, note]) => [stage, {
			state: "passed", evidence: [evidenceId], note
		}]))
		, limitations: [limitation, hosted]
	};
	const index = document.observations.findIndex(item =>
		item.id === observation.id);
	if(index === -1) document.observations.push(observation);
	else document.observations[index] = observation;
}
assert.equal(new Set(document.evidence.map(item => item.id)).size
	, document.evidence.length);
assert.equal(new Set(document.observations.map(item => item.id)).size
	, document.observations.length);
await writeFile(inventoryPath, JSON.stringify(document, null, 2) + "\n");
process.stdout.write(canonicalJson({
	qualification: evidencePath, evidence: evidenceId
	, routes: reports.map(item => ({
		route: item.route, executions: item.nodeExecutions + item.chromiumExecutions
		, checks: item.observation.checks
	}))
}));
