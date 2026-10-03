/**
 * Keep the completed JVM callback milestone in the mandatory contract suite.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedJvmCallbackAcceptance, assertOwnedJvmCallbackReport
	, ownedJvmCallbackEvidencePath } from "./owned-jvm-callback-result-acceptance.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmCallbackEvidencePath, "utf8"));
const zero = "0".repeat(64);
const rehashLog = (run, transform) => {
	const text = transform(run.text); assert.notEqual(text, run.text);
	run.text = text; run.sha256 = sha256(text);
};

test("JVM acceptance reconstructs all 24 original reports and executed probes", async () => {
	await assertOwnedJvmCallbackAcceptance(await read());
	const wrapper = "tests/owned-jvm-callback-result-history.test.mjs";
	assert.equal(classifyRepositoryTest(wrapper), "contract");
	assert.match(await readFile(wrapper, "utf8"), /^import "\.\/helpers\/owned-jvm-callback-result-acceptance-tests\.mjs";$/mu);
});

test("JVM acceptance rejects incomplete runs, substituted sources and inflated scope", async t => {
	const original = await read();
	const changes = [
		item => { item.acceptance = "pending"; }
		, item => { item.schemaVersion++; }
		, item => { item.planNode++; }
		, item => { item.baselineRevision = "0".repeat(40); }
		, item => { item.unverifiedClaim = true; }
		, item => { item.previous.sha256 = zero; }
		, item => { item.sourceHistory.sha256 = zero; }
		, ...[
			"retainedHostCallbacks", "callbackInputTransfers"
			, "asynchronousDelivery"
			, "leanRuntimeInstrumented", "jvmInstrumented", "leakSanitizer"
			, "installedForkGuards", "installedRetirementGuards", "docker"]
			.map(key => item => { item.scope[key] = true; })
		, item => { item.scope.installedSupportPromotions++; }
		, item => { item.scope.directSemanticMutants.profiles.push("kotlin"); }
		, item => { item.scope.optimizedGc.installedPackage = true; }
		, item => { item.scope.directProcess.fork = true; }
		, item => { item.scope.directProcess.installedMaven = true; }
		, item => { item.scope.browsers.pop(); }
		, item => { item.scope.combinedProfiles.pop(); }
		, item => { delete item.sources["src/backends/jvm/owned-callback-arguments.mjs"]; }
		, item => { item.sources["tests/helpers/owned-jvm-callback-result-runtime-evidence.mjs"] = zero; }
		, item => { item.sources["unknown.mjs"] = zero; }
		, item => { item.runs.pop(); }
		, item => { item.runs[0].tests++; }
		, item => { item.runs[0].exitCode = 1; }
		, item => { item.runs[0].unverifiedClaim = true; }
		, item => { item.runs[0].text += "unrecorded"; }
		, item => {
			item.runs[1].text = item.runs[3].text;
			item.runs[1].sha256 = item.runs[3].sha256;
		}
		, item => { rehashLog(item.runs[0], text => text.replace("# pass 7", "# pass 6")); }
		, item => { rehashLog(item.runs[0], text => text.replace("# skipped 0", "# skipped 1")); }
		, item => { rehashLog(item.runs[0], text => text.replace("1..7", "1..6")); }
		, item => { rehashLog(item.runs[0], text => text.replace(/^ok [^\n]+\n/mu, "")); }
		, item => { rehashLog(item.runs[0], text => text + "\n# pass 7\n"); }
		, item => { rehashLog(item.runs[0], text => text + "\nnot ok 8 - unrecorded failure\n"); }
		, item => { item.verification.command = "node --test unrelated.mjs"; }
		, item => { item.verification.exitCode = 1; }
		, item => { rehashLog(item.verification, text => text.replace("# pass 10", "# pass 9")); }
		, item => { rehashLog(item.verification, text => text.replace("# skipped 0", "# skipped 1")); }
		, item => { delete item.archive.reports["build/owned-jvm-callback-results/reviewed-combined-release.json"]; }
		, item => { item.archive.unverifiedClaim = true; }
		, item => { Object.values(item.archive.reports)[0].unverifiedClaim = true; }
		, item => { Object.values(item.archive.reports)[0].sha256 = zero; }
		, item => { Object.values(item.archive.reports)[0].bytes++; }
		, item => { item.archive.reports["build/unrecorded.json"] = Object.values(item.archive.reports)[0]; }
		, item => { item.archive.nodes[sha256("null")] = null; }
	];
	for(const change of changes)
	{
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertOwnedJvmCallbackAcceptance(altered), undefined, change.toString());
	}
	t.diagnostic(`${changes.length} false acceptance claims rejected`);
});

test("JVM acceptance binds every matrix slot to its source mode and lifetime boundary", async t => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	let rejected = 0;
	for(const [path, report] of Object.entries(reports))
	{
		const wrongMode = structuredClone(report);
		wrongMode.mode = report.mode === "ordinary" ? "reviewed" : "ordinary";
		await assert.rejects(() => assertOwnedJvmCallbackReport(path, wrongMode), undefined, path);
		rejected++;
		const changed = structuredClone(report);
		if(path.endsWith("-combined-release.json")) changed.installedJvm.observations[0].jvm.documentation.pop();
		else if(path.endsWith("-package.json")) changed.observations[0].jvm.runtimeExecutions.pop();
		else if(path.endsWith("-runtime.json")) changed.installedPackage = true;
		else if(path.endsWith("-process.json")) changed.scope.fork = true;
		else if(path.endsWith("-sanitizers.json")) changed.leanRuntimeInstrumented = true;
		else if(path.includes("-gc/")) changed.installedPackage = true;
		else changed.observed.identities++;
		await assert.rejects(() => assertOwnedJvmCallbackReport(path, changed), undefined, path);
		rejected++;
	}
	await assert.rejects(() => assertOwnedJvmCallbackReport("build/unrecorded.json", Object.values(reports)[0]));
	assert.equal(rejected, 48); t.diagnostic(`${rejected + 1} false matrix or scope claims rejected`);
});

test("JVM acceptance rejects coherently repacked duplicate and substituted reports", async () => {
	const original = await read();
	for(const [target, replacement] of [
		["reviewed-combined-package", "ordinary-combined-package"]
		, ["ordinary-no-host-package", "ordinary-combined-package"]
		, ["reviewed-combined-release", "ordinary-combined-release"]
	]) {
		const reports = unpackOwnedCallbackReports(original.archive);
		const prefix = "build/owned-jvm-callback-results/";
		reports[prefix + target + ".json"] = reports[prefix + replacement + ".json"];
		await assert.rejects(() => assertOwnedJvmCallbackAcceptance({
			...original, archive: packOwnedCallbackReports(reports)
		}), undefined, target);
	}
});
