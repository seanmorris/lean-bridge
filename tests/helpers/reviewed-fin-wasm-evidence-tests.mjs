/**
 * Authenticate the four installed npm Fin runs and retain the failed harness diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedFinWasmIr } from "./reviewed-fin-wasm-fixture.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";

const directory = "docs/evidence/reviewed-fin-npm-20261007";
const identities = {
	"ordinary-scalar": "b169d6a38f8facfa63760b529065f0955d5a2b166bc3591961a83f9628cd251a"
	, "reviewed-scalar": "e15c8c2fdf880cba85163b8c040e6a8f1bc65abcebd88c2435b0b41bcd562658"
	, "ordinary-structural": "06bf95f3655b83f6da2b520dc2c2dd891363ca62af9b8c40e2b2099abedcb97c"
	, "reviewed-structural": "eb908163d52e8dfc3d24a7327eec6e7e9c366715030ab6284fe33b7c22d4af19"
};
const read = path => readFile(path, "utf8");
const receipt = async () => JSON.parse(await read(`${directory}/receipt.json`));

test("npm Fin archives retain both routes, exact scalar/structural ABIs and installed package checks", async () => {
	const archive = await receipt();
	assert.equal(archive.revision, "3190d5ff252ef44ea52534e58850b2b6197a4a6c");
	assert.equal(archive.execution, "local");
	assert.equal(archive.planNode, 1438);
	assert.equal(archive.scope.sourceDispatchCountersObserved, false);
	assert.deepEqual(archive.runs.map(run => run.id), Object.keys(identities));
	for(const run of archive.runs)
	{
		assert.equal(run.report.path, `${directory}/${run.id}.json`);
		assert.equal(run.report.sha256, identities[run.id]);
		const bytes = await read(run.report.path), report = JSON.parse(bytes);
		assert.equal(sha256(bytes), identities[run.id]);
		const selection = run.id.endsWith("scalar") ? "scalar" : "structural";
		const reviewed = run.id.startsWith("reviewed");
		assert.equal(report.selection, selection);
		assert.equal(report.path, reviewed ? "reviewed-ir" : "ordinary-source");
		assert.equal(report.privateAbi, selection === "scalar" ? 2 : 6);
		assert.equal(report.independentBuilds, 2);
		for(const flag of ["reproducible", "offlineInstall", "sourceRemovedBeforeInstallation", "compilerFreePath"])
			assert.equal(report[flag], true, flag);
		const expected = reviewedFinWasmIr(selection);
		assert.deepEqual(report.refinements, Object.fromEntries(expected.declarations.map(item => [item.source.declaration, item.source.extensions["lean-lang.org/refinements"]])));
		assert.equal(report.sourceSha256, sha256(await read("tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean")));
		assert.equal(report.consumerSha256, sha256(await read("tests/fixtures/reviewed-fin-wasm/javascript.mjs")));
		if(reviewed) assert.equal(report.reviewedSourceSha256, sha256(canonicalJson(expected)));
		else assert.equal(Object.hasOwn(report, "reviewedSourceSha256"), false);
		assert.equal(report.typescript.strict, true);
		assert.equal(report.typescript.skipLibCheck, false);
		assert.equal(report.typescript.sourceSha256, sha256(reviewedFinWasmTypeScript(selection)));
		assert.deepEqual(report.executions.map(item => item.profile), ["node-javascript", "node-typescript"]);
		const result = { module: "reviewed-fin", selection, checks: selection === "scalar" ? 50 : 200, rejections: selection === "scalar" ? 126 : 270 };
		for(const execution of report.executions) assert.deepEqual(execution.result, result);
		assert.deepEqual(report.browser.map(item => item.profile), ["browser-javascript", "browser-react", "browser-worker"]);
		for(const { profile, browser } of report.browser)
		{
			assert.deepEqual(browser.requestedEngines, ["chromium", "firefox", "webkit"]);
			assert.equal(browser.externalNetworkBlocked, true);
			assert.equal(browser.installedSourcesRemoved, true);
			const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
			assert.deepEqual(browser.executions.map(item => `${item.engine}:${item.variant}`).sort(), browser.requestedEngines.flatMap(engine => variants.map(variant => `${engine}:${variant}`)).sort());
			for(const execution of browser.executions)
			{
				assert.deepEqual(execution.observation.results, result);
				assert.equal(execution.observation.profile, profile);
				assert.equal(execution.failedAssetRecovery, true);
				assert.ok(execution.assets.length >= 2);
				for(const asset of execution.assets)
				{
					assert.equal(asset.status, 200);
					assert.equal(asset.mime, "application/wasm");
					assert.match(asset.sha256, /^[a-f0-9]{64}$/u);
				}
				if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
				if(profile === "browser-worker") assert.deepEqual(execution.lifecycle, { created: 2, live: 0, terminated: 2 });
			}
		}
		assert.equal(report.mismatches.length, reviewed && selection === "structural" ? 8 : 0);
		for(const mismatch of report.mismatches)
		{
			assert.equal(mismatch.code, "reviewed-ir-source-mismatch");
			assert.equal(mismatch.outputAbsent, true);
		}
	}
});

test("npm Fin archives preserve the successful run and both original scalar expectation failures", async () => {
	const archive = await receipt();
	const digest = "117cebe9aaff0c7456b6c5da89c9e602287b65ad2eea6f94f8e5985425b9703d";
	const log = await read(archive.log.path);
	assert.equal(archive.log.sha256, digest);
	assert.equal(sha256(log), digest);
	assert.match(log, /^# pass 4$/mu);
	assert.match(log, /^# fail 0$/mu);
	assert.match(log, /^# skipped 0$/mu);
	assert.doesNotMatch(log, /^not ok /mu);
	const failures = ["fd5f29ede072ee3796c609c83819e3bd13e1f0c24d3f17755646b1394598eca0", "cd25b0a50beece38e1c7c1eb8b7d74c5dd48e4df8fd729ab52f03996aab009fe"];
	assert.equal(archive.earlierFailures.length, failures.length);
	for(const [index, failure] of archive.earlierFailures.entries())
	{
		const bytes = await read(failure.log.path);
		assert.equal(failure.log.sha256, failures[index]);
		assert.equal(sha256(bytes), failures[index]);
		assert.match(bytes, /^not ok /mu);
		if(index === 1) assert.ok(bytes.includes("wrong rejection: mirror raw bound: Component scalar call failed (6)"));
	}
});
