#!/usr/bin/env node
/**
 * Reconcile true owned checked-record PHP-Wasm execution into the type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const reportPath = "build/owned-checked-record-php-wasm/packages.json";
const implementationCommit = "d19542e89ab9b26db57ea3fdcd88ce135fecb30b";
const command = "source scripts/env.sh && LEAN_BRIDGE_OWNED_CHECKED_RECORD_PHP_WASM_TEST=1 LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=build/owned-checked-record-php-wasm-input/php-wasm-runtime npm run test:owned-checked-record-php-wasm";
const evidencePath
	= "docs/evidence/owned-checked-record-php-wasm-local-qualification-20261022.json";
const markdownPath
	= "docs/evidence/owned-checked-record-php-wasm-local-qualification-20261022.md";
const sourcePaths = [
	".github/workflows/owned-checked-record-php-wasm.yml"
	, "package.json"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/update-owned-checked-record-php-wasm-inventory.mjs"
	, "src/abi/owned-refinement-model.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-callbacks.mjs"
	, "src/backends/javascript/owned-wasm-callbacks.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/build/owned-callback-carriers.mjs"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
	, "tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php-wasm.php"
	, "tests/helpers/owned-checked-record-fixture.mjs"
	, "tests/helpers/owned-checked-record-javascript-fixture.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-checked-record-php-wasm-packaging.test.mjs"
	, "tests/test-profiles.test.mjs"
	, evidencePath
	, markdownPath
];

const writeImmutable = async (path, contents) => {
	try
	{
		assert.equal(await readFile(path, "utf8"), contents
			, `Never rewrite committed evidence: ${path}`);
	}
	catch(error)
	{
		if(error.code !== "ENOENT") throw error;
		await writeFile(path, contents, { flag: "wx" });
	}
};

const raw = await readFile(reportPath);
const report = JSON.parse(raw);
assert.equal(report.schemaVersion, 1);
assert.equal(report.profile, "installed-owned-checked-record-php-wasm");
assert.deepEqual(report.reports.map(item => item.mode), ["full", "result-only"]);

const routeName = observation => observation.reviewed ? "reviewed-ir" : "ordinary-source";
const routes = [];
for(const mode of report.reports)
{
	assert.equal(mode.compiledLean, true);
	assert.equal(mode.installedPackage, true);
	assert.equal(mode.observations.length, 2);
	for(const observation of mode.observations)
	{
		const nodeChecks = observation.executions.map(item => item.observed.checks);
		const browserExecutions = observation.browser.observations
			.flatMap(item => item.executions);
		const browserChecks = browserExecutions.map(item => item.observed.checks);
		assert.equal(new Set([...nodeChecks, ...browserChecks]).size, 1);
		assert.equal(observation.executions.length, 8);
		assert.equal(browserExecutions.length, 8);
		for(const execution of [...observation.executions, ...browserExecutions])
		{
			assert.equal(execution.cleaned.liveIdentities, 0);
			assert.equal(execution.refreshed.liveIdentities, 0);
			assert.equal(execution.requestRecovery, true);
		}
		for(const key of ["sourceFreeInstallation", "handoffRemoved"
			, "deterministicReassembly", "receiptVerifiedWithoutProducer"
			, "independentlyRebuiltExactly", "authorRemoved"])
			assert.equal(observation[key], true, key);
		routes.push({
			mode: mode.mode, authorRoute: routeName(observation)
			, modelSchemaVersion: observation.model.schemaVersion
			, modelExports: observation.model.exports.length
			, hostCallbacks: observation.model.ownedGraph.hostCallbacks?.signatures.length ?? 0
			, inputTransfers: observation.model.ownedGraph.inputTransfers?.exports.length ?? 0
			, nodeExecutions: observation.executions.length
			, browserExecutions: browserExecutions.length
			, checksPerExecution: nodeChecks[0]
			, tamperRejections: observation.rejected.length
			, consumerSha256: observation.consumerSha256
			, sourceFreeInstallation: observation.sourceFreeInstallation
			, handoffRemoved: observation.handoffRemoved
			, deterministicReassembly: observation.deterministicReassembly
			, receiptVerifiedWithoutProducer: observation.receiptVerifiedWithoutProducer
			, independentlyRebuiltExactly: observation.independentlyRebuiltExactly
			, zeroLiveIdentitiesAfterCleanupAndRefresh: true
			, requestRecovery: true
			, archives: observation.packageReceipt.archives.map(({ archive, bytes, sha256 }) => ({
				archive, bytes, sha256
			}))
		});
	}
}
assert.deepEqual(routes.map(item => [item.mode, item.authorRoute]), [
	["full", "ordinary-source"], ["full", "reviewed-ir"]
	, ["result-only", "ordinary-source"], ["result-only", "reviewed-ir"]
]);
assert.deepEqual(routes.map(item => item.checksPerExecution), [137, 137, 4, 4]);

const qualification = canonicalJson({
	schemaVersion: 1
	, profile: "installed-owned-checked-record-php-wasm-local-qualification"
	, implementationCommit, command
	, scope: "Acyclic PHP-Wasm owned checked records with copied nested checks, resource fields, exact per-site constructors, borrowed and transferred parameters, leased results, synchronous host callbacks, returned Lean closures, explicit typed recovery, ordinary source and independently reviewed Binding IR. Every source-free offline npm/Composer installation is physically relocated before Node and Chromium execution. Recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch counts and peak memory remain separate work. The recurring workflow rebuilds the same pinned compiler inputs and retains the original package handoffs."
	, rawReportSha256: sha256(raw)
	, installedCli: report.reports[0].installedCli
	, runtimeIdentity: report.reports[0].runtimeIdentity
	, routes
});
await writeImmutable(evidencePath, qualification);
const markdown = `# PHP-Wasm owned checked-record local qualification\n\n`
	+ `Implementation: \`${implementationCommit}\`\n\n`
	+ `Ordinary Lean source and independently reviewed Binding IR each produced a full package and a standalone result-only package. Every route reproduced its Composer API, npm component and npm shared-runtime archives, removed its author and build trees, installed offline, physically relocated the installation and verified the package-set receipt without its producer.\n\n`
	+ `The full routes passed 137 checks in each of eight Node and eight Chromium executions. They cover a copied nested checked record, an owned checked record carrying a resource, borrowed and transferred inputs, leased results, exact constructor rejection before transfer, synchronous checked-record callback arguments and replies, invalid explicit recovery before callback entry, returned Lean closure checks, exception identity, explicit cleanup, finalizer fallback, zero live identities and later-request recovery. The result-only routes passed four checks in each context without checked-input, transfer or callback metadata.\n\n`
	+ `The machine-readable [qualification record](owned-checked-record-php-wasm-local-qualification-20261022.json) pins the implementation, runtime, installed CLI, package hashes and exact route counts. The recurring workflow rebuilds all four routes and retains each original handoff. Recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch counts and peak memory remain separate work.\n`;
await writeImmutable(markdownPath, markdown);

const files = [];
for(const path of sourcePaths)
	files.push({ path, sha256: sha256(await readFile(path)) });
const commonScope = "Fresh Lean ordinary-source and independently reviewed packages exercise the copied Window check inside Booking and the owned Claim check across Ticket resources. Full packages cover borrowed and transferred inputs, leased results, exact constructor rejection before transfer, synchronous host callbacks, invalid explicit recovery before callback entry, returned Lean closures, exception identity and cleanup. Standalone result-only packages expose Lean-produced proof-free Claim results without checked inputs, transfer or callback metadata. Every route reproduces Composer API, npm component and npm shared-runtime archives, removes author/build roots, installs offline, physically relocates the installed tree and passes eight Node plus eight Chromium startup/lazy weak/strict executions with zero live identities and later-request recovery.";
const boundary = "This local evidence covers the tested acyclic Booking, Window and Claim shapes, the quota bound and synchronous callbacks only. It does not establish recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch counts, peak memory or hosted acceptance. The pinned PHP-Wasm runtime, browser and external compiler distributions remain trusted inputs represented by recorded identities.";
const artifact = (mode, route, name, digest) => ({
	path: `owned-checked-record-php-wasm/evidence/${mode}/${route}/handoff/packages/php-wasm/archives/${name}`
	, sha256: digest
});
const records = [];
for(const route of routes)
{
	const id = `owned-checked-record-php-wasm-${route.authorRoute}-${route.mode}-installed`;
	records.push({
		id, kind: "installed", revision: implementationCommit, command
		, scope: `${commonScope} ${boundary}`, files
		, artifacts: [
			...route.archives.map(item => artifact(
				route.mode, route.authorRoute === "reviewed-ir" ? "reviewed" : "ordinary"
				, item.archive, item.sha256
			))
			, { path: "owned-checked-record-php-wasm/packages.json", sha256: sha256(raw) }
		]
	});
}

const document = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const record of records)
{
	const index = document.evidence.findIndex(entry => entry.id === record.id);
	if(index === -1) document.evidence.push(record);
	else document.evidence[index] = record;
}
const append = (value, addition) => value.includes(addition)
	? value : `${value} ${addition}`;
for(const source of ["ordinary-source", "reviewed-ir"])
for(const position of ["parameter", "result"])
{
	const id = `checked-record-php-wasm-${source}-${position}`;
	const index = document.observations.findIndex(item => item.id === id);
	assert.notEqual(index, -1, id);
	const observation = document.observations[index];
	const full = `owned-checked-record-php-wasm-${source}-full-installed`;
	const evidence = position === "parameter" ? [full] : [full
		, `owned-checked-record-php-wasm-${source}-result-only-installed`];
	observation.scope = append(observation.scope
		, `Additional owned checked-record PHP-Wasm acceptance: ${commonScope}`);
	observation.hostTypes["checked-record"][position]
		= append(observation.hostTypes["checked-record"][position]
			, position === "parameter"
				? "The tested generated Booking and Claim values preserve copied checked fields and Ticket resource owners; each consumed site runs its selected constructor before any transfer."
				: "The tested generated Booking and Claim values project copied payloads and Ticket resource owners without proof fields.");
	for(const stage of Object.values(observation.stages))
	{
		for(const evidenceId of evidence)
			if(!stage.evidence.includes(evidenceId)) stage.evidence.push(evidenceId);
		stage.note = append(stage.note
			, `Additional owned checked-record acceptance: ${commonScope}`);
	}
	if(!observation.limitations.includes(boundary)) observation.limitations.push(boundary);
	observation.conversionNotes["checked-record"] = append(
		observation.conversionNotes["checked-record"] ?? ""
		, "PHP-Wasm represents the tested proof-backed Booking and Claim as generated readonly PHP objects. Window is copied; Claim retains a Ticket owner. Borrowed calls preserve the caller, transferred calls validate before moving the owner, and Lean-produced results omit proofs."
	).trim();
}
for(const source of ["ordinary-source", "reviewed-ir"])
{
	const id = `php-wasm-owned-callback-results-${source}`;
	const index = document.observations.findIndex(item => item.id === id);
	assert.notEqual(index, -1, id);
	const observation = document.observations[index];
	const evidence = `owned-checked-record-php-wasm-${source}-full-installed`;
	if(!observation.shapes.includes("checked-record"))
		observation.shapes.push("checked-record");
	observation.scope = append(observation.scope
		, `Additional checked-record callback acceptance: ${commonScope}`);
	observation.hostTypes["checked-record"] = {
		"callback-parameter": "Generated proof-free Claim with a live Ticket owner"
		, "callback-result": "Generated Claim checked by the selected Lean constructor with an explicit typed recovery"
	};
	for(const stage of Object.values(observation.stages))
	{
		if(!stage.evidence.includes(evidence)) stage.evidence.push(evidence);
		stage.note = append(stage.note
			, `Additional checked-record callback acceptance: ${commonScope}`);
	}
	if(!observation.limitations.includes(boundary)) observation.limitations.push(boundary);
	observation.conversionNotes["checked-record"]
		= "A host callback receives a proof-free generated Claim whose Ticket is borrowed for the call. Host replies and explicit recovery values run mkClaim; an invalid explicit recovery rejects before callback entry and is never replaced by automatic recovery. Returned Lean closures validate host Claim inputs and project proof-free Claim results.";
}

assert.equal(new Set(document.evidence.map(entry => entry.id)).size
	, document.evidence.length, "Duplicate type-surface evidence ids");
for(const evidence of document.evidence)
	for(const file of evidence.files)
	{
		try
		{
			file.sha256 = sha256(await readFile(file.path));
		}
		catch(error)
		{
			if(error.code !== "ENOENT") throw error;
		}
	}
await writeFile(inventoryPath, JSON.stringify(document, null, 2) + "\n");
process.stdout.write("Recorded four local PHP-Wasm owned checked-record routes and reconciled parameters, results and callbacks.\n");
