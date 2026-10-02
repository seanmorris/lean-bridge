/**
 * Reject incomplete, substituted or weakened Ruby callback acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { unpackOwnedCallbackReports } from "./helpers/owned-callback-result-evidence.mjs";
import { ownedRubyCallbackEvidencePath, assertOwnedRubyCallbackAcceptance
	, assertOwnedRubyCallbackReport } from "./helpers/owned-ruby-callback-result-acceptance.mjs";
import { ownedRubyCallbackReportMutations } from "./helpers/owned-ruby-callback-result-report-mutations.mjs";

const read = async () => JSON.parse(await readFile(ownedRubyCallbackEvidencePath, "utf8"));

test("Ruby callback acceptance reconstructs all runtime and original installed reports", async () => {
	await assertOwnedRubyCallbackAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-ruby-callback-result-evidence.test.mjs"), "contract");
});

test("Ruby callback acceptance rejects partial execution, substituted sources and inflated claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.retainedHostCallbacks = true; }
		, value => { value.scope.installedSupportPromotions++; }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { delete value.sources["tests/owned-ruby-callback-result-packaging.test.mjs"]; }
		, value => { value.sources["src/backends/ruby/owned-callables.mjs"] = "0".repeat(64); }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace("# pass 12", "# pass 11"); value.run.sha256 = sha256(value.run.text); }
		, value => { delete value.archive.reports["build/owned-ruby-callback-results/reviewed-combined-release.json"]; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRubyCallbackAcceptance(changed), undefined, mutate.toString());
	}
});

test("Ruby callback reports reject forged lifetime, fault, package and browser outcomes", async () => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	for(const [name, mutate] of ownedRubyCallbackReportMutations())
	{
		const path = `build/owned-ruby-callback-results/${name}.json`;
		const item = structuredClone(reports[path]); mutate(item);
		await assert.rejects(() => assertOwnedRubyCallbackReport(path, item), undefined, name + ": " + mutate.toString());
	}
});
