/**
 * Reject incomplete, substituted or weakened Python callback acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { unpackOwnedCallbackReports } from "./helpers/owned-callback-result-evidence.mjs";
import { ownedPythonCallbackEvidencePath, assertOwnedPythonCallbackAcceptance
	, assertOwnedPythonCallbackReport } from "./helpers/owned-python-callback-result-acceptance.mjs";
import { ownedPythonCallbackReportMutations } from "./helpers/owned-python-callback-result-report-mutations.mjs";

const read = async () => JSON.parse(await readFile(ownedPythonCallbackEvidencePath, "utf8"));

test("Python callback acceptance reconstructs all runtime and original installed reports", async () => {
	await assertOwnedPythonCallbackAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-python-callback-result-evidence.test.mjs"), "contract");
});

test("Python callback acceptance rejects partial execution, substituted sources and inflated claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.retainedHostCallbacks = true; }
		, value => { value.scope.installedSupportPromotions++; }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { delete value.sources["tests/owned-python-callback-result-packaging.test.mjs"]; }
		, value => { value.sources["src/backends/python/owned-callables.mjs"] = "0".repeat(64); }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace("# pass 13", "# pass 12"); value.run.sha256 = sha256(value.run.text); }
		, value => { delete value.archive.reports["build/owned-python-callback-results/reviewed-combined-release.json"]; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPythonCallbackAcceptance(changed), undefined, mutate.toString());
	}
});

test("Python callback reports reject forged lifetime, fault, package and browser outcomes", async () => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	for(const [name, mutate] of ownedPythonCallbackReportMutations())
	{
		const path = `build/owned-python-callback-results/${name}.json`;
		const item = structuredClone(reports[path]); mutate(item);
		await assert.rejects(() => assertOwnedPythonCallbackReport(path, item), undefined, name + ": " + mutate.toString());
	}
});
