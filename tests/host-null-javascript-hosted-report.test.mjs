/** @file */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkHostNullJavaScriptHostedReport
	, hostNullJavaScriptBrowsers
	, hostNullJavaScriptResult
	, hostNullJavaScriptRoutes
} from "./helpers/host-null-javascript-hosted-report.mjs";

const hash = value => value.repeat(64);
const receipt = (route, runtime = null) => ({
	schemaVersion: 2, kind: "lean-bridge-component-package-receipt"
	, component: { id: "host_null_demo@1.0.0", name: "host_null_demo", version: "1.0.0" }
	, source: { treeSha256: hash(route === "ordinary-source" ? "1" : "2") }
	, bindingIrSha256: hash(route === "ordinary-source" ? "3" : "4")
	, provenanceSha256: hash(route === "ordinary-source" ? "5" : "6")
	, componentBundleSha256: hash(route === "ordinary-source" ? "7" : "8")
	, componentIdentitySha256: hash(route === "ordinary-source" ? "9" : "a")
	, componentArtifactSha256: hash("b"), runtimeRequirementSha256: hash("c")
	, runtime: runtime ?? {
		package: "@lean-bridge/runtime@0.0.0-abi2.test"
		, archive: "lean-bridge-runtime-0.0.0-abi2.test.tgz", sha256: hash("d")
	}
	, package: {
		package: "host-null-demo@1.0.0", archive: "host-null-demo-1.0.0.tgz"
		, sha256: hash(route === "ordinary-source" ? "e" : "f")
	}
	, policies: { componentCompiledOnce: true, runtimeShared: true
		, runtimeBinaryInComponent: false, nativeCallablesOnly: true }
	, verificationCommand: "node verify-component-package-receipt.mjs --receipt component-package-receipt.json"
});
const browser = engine => ({
	engine, version: `${engine}-1`
	, result: { page: hostNullJavaScriptResult
		, react: hostNullJavaScriptResult, worker: hostNullJavaScriptResult }
});
const report = () => {
	const runtime = receipt("ordinary-source").runtime;
	return { schemaVersion: 1
		, runs: hostNullJavaScriptRoutes.map(path => ({
			path, node: "v22.23.3", sourceSha256: hash("1")
			, consumerSha256: hash("2"), offlineInstall: true
			, compilerFreePath: true, sourceRelocatedBeforeInstallation: true
			, sourceRemovedBeforeInstallation: true
			, producerBuildsRemovedBeforeInstallation: true
			, packagesRelocatedBeforeInstallation: true
			, typescript: { strict: true, executed: true }
			, result: hostNullJavaScriptResult
			, browsers: hostNullJavaScriptBrowsers.map(browser)
			, receipt: receipt(path, structuredClone(runtime))
		}))
	};
};

test("host-null hosted report closes two routes and every JavaScript/browser execution", () => {
	const checked = checkHostNullJavaScriptHostedReport(report());
	assert.deepEqual(Object.keys(checked.browserVersions)
		, hostNullJavaScriptBrowsers);
	assert.equal(checked.routes.length, 2);
	assert.ok(checked.routes.every(route => route.browserExecutions === 9));
	assert.deepEqual([
		checked.checksPerExecution, checked.rejectionsPerExecution
		, checked.positions, checked.nestedOptionDistinct
	], [39, 17, 5, true]);
});

test("host-null hosted report rejects missing engines, collapsed values and route drift", () => {
	for(const mutate of [
		value => value.runs[0].browsers.pop()
		, value => { value.runs[1].result.nestedOptionDistinct = false; }
		, value => { value.runs[0].browsers[0].result.worker.positions = 4; }
		, value => { value.runs[1].consumerSha256 = hash("3"); }
		, value => { value.runs[1].receipt.runtime.sha256 = hash("4"); }
		, value => { value.runs[0].typescript.strict = false; }
		, value => { value.runs[1].sourceRemovedBeforeInstallation = false; }
	]) {
		const candidate = structuredClone(report()); mutate(candidate);
		assert.throws(() => checkHostNullJavaScriptHostedReport(candidate));
	}
});

test("local Node-only rehearsal is explicit and cannot pass hosted acceptance", () => {
	const local = report();
	for(const run of local.runs) run.browsers = [];
	assert.doesNotThrow(() => checkHostNullJavaScriptHostedReport(
		local, { requireBrowsers: false }));
	assert.throws(() => checkHostNullJavaScriptHostedReport(local));
});
