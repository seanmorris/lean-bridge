/**
 * Context-isolation source contracts and adversarial report controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedCheckedRecordMixedSelection } from "./owned-checked-record-mixed-fixture.mjs";
import { ownedCheckedRecordPhpWasmPeerSelection } from "./owned-checked-record-php-wasm-peer.mjs";
import * as generator from "./owned-checked-record-php-wasm-contexts.mjs";
import {
	checkOwnedCheckedRecordPhpWasmContextsEvidence, requiresOwnedCheckedRecordPhpWasmContexts
} from "./owned-checked-record-php-wasm-context-evidence.mjs";
import { syntheticOwnedCheckedRecordPhpWasmContexts } from "./owned-checked-record-php-wasm-context-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const original = path => readFileSync(path);
const fixture = (mode, reviewed) => {
	const primaryIr = ownedCheckedRecordMixedSelection(`${reviewed ? "reviewed" : "ordinary"}-${mode}`).reviewedIr;
	const peerIr = ownedCheckedRecordPhpWasmPeerSelection(reviewed).reviewedIr;
	const leanSha256 = sha256(original(
		"tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"));
	const sourceIdentity = { ...reviewed ? { reviewedBindingIr: {} } : {}
		, modules: [{ module: "OwnedCheckedRecords"
			, source: { sha256: leanSha256 } }] };
	const model = ir => ({ schemaVersion: 6, pointerBits: 32
		, component: ir.component
		, bindingIr: ir, sourceIdentity
		, exports: ir.declarations.map(item => ({ bindingId: item.id }))
		, ownedGraph: { transport: "owned-zend-v1" } });
	const primary = { reviewed, model: model(primaryIr)
		, receipt: { runtimeIdentity: sha256("runtime") }
		, packageReceipt: { npmSettings: { name: "@test/primary" }
			, archives: [{ archive: "primary.tgz", bytes: 7, sha256: sha256("primary") }] } };
	const build = { status: "ok", result: { targets: ["php-wasm"] } };
	const peer = { reviewed, model: model(peerIr), receipt: primary.receipt
		, sourceUnchanged: true, independentlyRebuiltExactly: true
		, cliBuild: build, repeatedCliBuild: build
		, verification: { status: "ok", result: { verificationType: "local-package-set" } }
		, packageReceipt: { npmSettings: { name: "@test/peer" }
			, archives: [{ archive: "peer.tgz", bytes: 4, sha256: sha256("peer") }] } };
	return { primary, peer, context: syntheticOwnedCheckedRecordPhpWasmContexts(primary, peer, mode, original) };
};

test("PHP-Wasm checked-record contexts preserve all four source and API routes", () => {
	for(const mode of ["full", "result-only"])
	for(const reviewed of [false, true])
	{
		const { primary, peer, context } = fixture(mode, reviewed);
		assert.equal(peer.model.bindingIr.declarations.length, 3);
		assert.equal(peer.model.bindingIr.types.some(type => type.kind === "callback"), false);
		const selected = ownedCheckedRecordPhpWasmPeerSelection(reviewed);
		assert.equal(selected.configuration.targets["php-wasm"].hostCallbacks, false);
		assert.equal(context.contract.mode, mode);
		assert.notEqual(context.contract.primary.claim_for, context.contract.peer.claim_for);
		assert.deepEqual(checkOwnedCheckedRecordPhpWasmContextsEvidence(context, primary, mode, original, generator)
			, { nodeExecutions: 32, chromiumExecutions: 32 });
	}
});

test("PHP-Wasm context replay rejects missing cells, foreign evidence and weakened cleanup", () => {
	const mutations = [
		value => { delete value.peer; }
		, value => { value.authorRemoved = false; }
		, value => { value.sourceFreeInstallation = false; }
		, value => { value.peer.reviewed = !value.peer.reviewed; }
		, value => { value.peer.receipt.runtimeIdentity = sha256("foreign runtime"); }
		, value => { value.peer.model.component.name = "same-component"; }
		, value => { value.peer.model.ownedGraph.inputTransfers = {}; }
		, value => { value.peer.model.exports.pop(); }
		, value => { value.peer.independentlyRebuiltExactly = false; }
		, value => { value.peer.sourceUnchanged = false; }
		, value => { value.peer.cliBuild.result.targets = ["php-native"]; }
		, value => { value.peer.verification.result.verificationType = "inferred"; }
		, value => { value.consumerSha256 = sha256("different caller"); }
		, value => { value.programSha256 = sha256("different program"); }
		, value => { value.runnerSha256 = sha256("different runner"); }
		, value => { value.contract.primary.claim_for = value.contract.peer.claim_for; }
		, value => { value.executions.pop(); }
		, value => { value.executions[1] = value.executions[0]; }
		, value => { value.executions[0].first.observed.lateRejections++; }
		, value => { value.executions[0].first.observed.rejections--; }
		, value => { value.executions[0].first.observed.contextIsolation = false; }
		, value => { value.executions[0].first.observed.staleContextRejected = false; }
		, value => { value.executions[0].first.observed.independentRetains = false; }
		, value => { value.executions[0].refreshed.snapshot.liveIdentities = 1; }
		, value => { value.executions[0].refreshed.snapshot.componentInitRuns = 1; }
		, value => { value.executions[0].requestRecovery = false; }
		, value => { value.browser.observations.pop(); }
		, value => { value.browser.observations[0].executions.pop(); }
		, value => { value.browser.observations[0].sourceSha256 = sha256("foreign source"); }
		, value => { value.browser.observations[0].executions[0].refreshed.snapshot.runtimeInitRuns++; }
		, value => { value.installed.archives.pop(); }
		, value => { delete value.installed.npmLock.packages["node_modules/@test/peer"]; }
	];
	for(const mode of ["full", "result-only"])
	{
		const { primary, context } = fixture(mode, true);
		for(const mutate of mutations)
		{
			const changed = structuredClone(context); mutate(changed);
			assert.throws(() => checkOwnedCheckedRecordPhpWasmContextsEvidence(changed, primary, mode, original, generator), mutate.toString());
		}
	}
});

test("PHP-Wasm context Node and browser programs parse without evaluating packages", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-checked-context-syntax-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const mode of ["full", "result-only"])
	{
		const { context } = fixture(mode, false);
		const sources = [generator.ownedCheckedRecordPhpWasmContextNode("@test/primary", context.contract)
			, generator.ownedCheckedRecordPhpWasmContextBrowser(context.contract, "embedded", "startup", "primary-first")
			, generator.ownedCheckedRecordPhpWasmContextBrowser(context.contract, "composer", "lazy", "peer-first")];
		for(const [index, source] of sources.entries())
		{
			const path = `${mode}-${index}.mjs`; await saveLakeFile(directory, path, source);
			execFileSync(process.execPath, ["--check", join(directory, path)], { timeout: 10000 });
		}
	}
});

test("PHP-Wasm context acceptance is required only for producers containing its runner", () => {
	assert.equal(requiresOwnedCheckedRecordPhpWasmContexts(original), true);
	const old = execFileSync("git", ["show", "aac4044c0596954713c06d6ffc876a989bfcedbc:tests/helpers/owned-php-wasm-packages.mjs"]);
	assert.equal(requiresOwnedCheckedRecordPhpWasmContexts(() => old), false);
	const source = original("tests/helpers/owned-php-wasm-packages.mjs").toString("utf8");
	assert.ok(source.includes('checkedRecords ? await buildOwnedCheckedRecordPhpWasmPeer('));
	assert.ok(source.includes('"checked-peer-handoff"'));
	assert.ok(source.includes("crossRuntime = { ...await checkOwnedCheckedRecordPhpWasmContexts({"));
});
