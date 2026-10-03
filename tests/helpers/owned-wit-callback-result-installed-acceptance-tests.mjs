/**
 * Reject forged installed-WIT callback-result acceptance receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertInstalledWitCallbackAcceptance, installedWitCallbackEvidencePath
	, installedWitCallbackScope, installedWitCallbackSourcePaths } from "./owned-wit-callback-result-installed-acceptance.mjs";

const receipt = async () => JSON.parse(await readFile(installedWitCallbackEvidencePath, "utf8"));
const zero = "0".repeat(64);

test("installed WIT callback acceptance freezes all six source-free relocated packages", async () => {
	const record = await receipt(); await assertInstalledWitCallbackAcceptance(record);
	assert.deepEqual(record.scope, installedWitCallbackScope);
	assert.deepEqual(Object.keys(record.sources), await installedWitCallbackSourcePaths());
	assert.equal(Object.keys(record.archive.reports).length, 6);
});

test("installed WIT callback acceptance rejects source, execution, package and TAP forgeries", async t => {
	const original = await receipt(), source = Object.keys(original.sources)[0];
	const reports = unpackOwnedCallbackReports(original.archive), name = Object.keys(reports)[0];
	const mutations = [
		item => { item.schemaVersion++; }, item => { item.kind += "-forged"; }
		, item => { item.acceptance = "pending"; }
		, item => { item.previous.sha256 = zero; }
		, item => { item.scope.installedPackage = false; }
		, item => { item.sources[source] = zero; }
		, item => { delete item.sources[source]; }, item => { item.log.text += "\n"; }
		, item => { item.log.sha256 = zero; }
		, item => { item.archive.reports[name].sha256 = zero; }
		, item => { delete item.archive.reports[name]; }
	];
	let rejected = 0;
	for(const mutation of mutations)
	{
		const changed = structuredClone(original); mutation(changed);
		await assert.rejects(assertInstalledWitCallbackAcceptance(changed)); rejected++;
	}
	const reportMutations = [
		item => { item.result.checks++; }
		, item => { item.executions.initial.code = 1; }
		, item => { item.package.sha256 = zero; }
		, item => { item.sourceRemoved = false; }
		, item => { item.ownedValues.callbackResultAnchors.maximumDepth++; }
	];
	for(const mutation of reportMutations)
	{
		const changedReports = structuredClone(reports); mutation(changedReports[name]);
		const changed = structuredClone(original); changed.archive = packOwnedCallbackReports(changedReports);
		await assert.rejects(assertInstalledWitCallbackAcceptance(changed)); rejected++;
	}
	assert.equal(rejected, 16); t.diagnostic(`${rejected} installed WIT receipt forgeries rejected`);
});
