/**
 * Fail closed over installed context-isolation reports and exact producer callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedCheckedRecordPhpWasmContextRun } from "./owned-checked-record-php-wasm-contexts.mjs";

export const ownedCheckedRecordPhpWasmContextModule
	= "tests/helpers/owned-checked-record-php-wasm-contexts.mjs";

/**
 * Historical producers without the context runner retain their original scope.
 *
 * @param original - Authenticated producer source reader.
 */
export const requiresOwnedCheckedRecordPhpWasmContexts = original => original(
	"tests/helpers/owned-php-wasm-packages.mjs").toString("utf8").includes(
	'import { checkOwnedCheckedRecordPhpWasmContexts } from "./owned-checked-record-php-wasm-contexts.mjs";');

/**
 * Check all host permutations and bind generated selectors and callers to source.
 * Archive bytes are independently checked by the enclosing hosted replay.
 *
 * @param context - Installed combined-component observation.
 * @param primary - Main package observation.
 * @param mode - Full or result-only primary API.
 * @param original - Authenticated producer source reader.
 * @param generator - Exact producer module, never the reported selectors.
 */
export const checkOwnedCheckedRecordPhpWasmContextsEvidence = (context, primary, mode, original, generator) => {
	assert.deepEqual(Object.keys(context).sort(), ["authorRemoved", "browser"
		, "consumerSha256", "contract", "executions", "installed", "peer"
		, "profile", "programSha256", "runnerSha256", "schemaVersion"
		, "sourceFreeInstallation"]);
	assert.equal(context.schemaVersion, 1);
	assert.equal(context.profile, "installed-owned-checked-record-php-wasm-contexts");
	assert.equal(context.sourceFreeInstallation, true); assert.equal(context.authorRemoved, true);
	const peer = context.peer;
	assert.equal(peer.reviewed, primary.reviewed);
	assert.equal(peer.model.schemaVersion, 6); assert.equal(peer.model.pointerBits, 32);
	assert.equal(peer.model.component.name, "owned-checked-records-peer");
	assert.notEqual(peer.model.component.id, primary.model.component.id);
	assert.equal(peer.receipt.runtimeIdentity, primary.receipt.runtimeIdentity);
	assert.equal(peer.model.ownedGraph.transport, "owned-zend-v1");
	assert.equal(peer.model.ownedGraph.inputTransfers, undefined);
	assert.equal(peer.model.ownedGraph.hostCallbacks, undefined);
	assert.deepEqual(peer.model.exports.map(item => item.bindingId).sort()
		, ["claimFor", "newTicket", "serial"].map(name => `lean:OwnedCheckedRecords.${name}`));
	assert.equal(Boolean(peer.model.sourceIdentity.reviewedBindingIr), primary.reviewed);
	assert.equal(peer.model.sourceIdentity.modules.find(item => item.module === "OwnedCheckedRecords")?.source.sha256
		, sha256(original("tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean")));
	assert.equal(peer.sourceUnchanged, true); assert.equal(peer.independentlyRebuiltExactly, true);
	for(const build of [peer.cliBuild, peer.repeatedCliBuild])
	{
		assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["php-wasm"]);
	}
	assert.equal(peer.verification.status, "ok");
	assert.equal(peer.verification.result.verificationType, "local-package-set");
	const contract = generator.ownedCheckedRecordPhpWasmContextContract(primary.model, peer.model, mode);
	assert.deepEqual(context.contract, contract);
	assert.equal(context.consumerSha256, sha256(original(generator.ownedCheckedRecordPhpWasmContextsCaller)));
	assert.equal(context.programSha256, sha256(generator.ownedCheckedRecordPhpWasmContextProgram));
	const name = primary.packageReceipt.npmSettings.name;
	assert.equal(context.runnerSha256, sha256(generator.ownedCheckedRecordPhpWasmContextNode(name, contract)));
	const expected = [];
	for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["primary-first", "peer-first"])
	for(const strict of [0, 1]) expected.push([arrangement, loading, peerMode, order, strict]);
	assert.deepEqual(context.executions.map(run => [run.arrangement, run.loading, run.peerMode, run.order, run.strict]), expected);
	for(const run of context.executions) assertOwnedCheckedRecordPhpWasmContextRun(run, mode);
	const browsers = ["embedded", "composer"].flatMap(arrangement =>
		["startup", "lazy"].flatMap(peerMode => ["primary-first", "peer-first"].map(order => [arrangement, peerMode, order])));
	assert.deepEqual(context.browser.observations.map(item => [item.arrangement, item.peerMode, item.order]), browsers);
	assert.match(context.browser.bundleSha256, /^[a-f0-9]{64}$/u);
	for(const item of context.browser.observations)
	{
		assert.equal(typeof item.version, "string"); assert.ok(item.version.length > 0);
		assert.match(item.executableSha256, /^[a-f0-9]{64}$/u);
		assert.equal(item.sourceSha256, sha256(generator.ownedCheckedRecordPhpWasmContextBrowser(contract, item.arrangement, item.peerMode, item.order)));
		assert.deepEqual(item.executions.map(run => [run.realm, run.loading, run.mode]), ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(strict => ["chromium", loading, strict])));
		for(const run of item.executions)
		{
			assert.deepEqual([run.arrangement, run.peerMode, run.order, run.strict], [item.arrangement, item.peerMode, item.order, run.mode === "strict" ? 1 : 0]);
			assertOwnedCheckedRecordPhpWasmContextRun(run, mode);
		}
	}
	const installed = context.installed;
	assert.deepEqual(Object.keys(installed.npmLock.packages).sort(), [
		"", "node_modules/php-wasm"
		, "node_modules/@lean-bridge/php-wasm-copied-runtime"
		, `node_modules/${name}`
		, `node_modules/${peer.packageReceipt.npmSettings.name}`].sort());
	const archives = new Map();
	for(const item of [...primary.packageReceipt.archives, ...peer.packageReceipt.archives])
	{
		if(archives.has(item.archive)) assert.deepEqual(archives.get(item.archive), item);
		else archives.set(item.archive, item);
	}
	assert.deepEqual(installed.archives, [...archives.values()]);
	return { nodeExecutions: context.executions.length
		, chromiumExecutions: context.browser.observations.reduce((sum, item) => sum + item.executions.length, 0) };
};
