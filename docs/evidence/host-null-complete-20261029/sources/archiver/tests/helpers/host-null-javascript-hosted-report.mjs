/**
 * Closed semantic contract for the hosted JavaScript/browser HostNull report.
 * Package bytes and GitHub provenance are authenticated by the archive layer;
 * this module proves what the retained executions actually established.
 *
 * @file
 */
import assert from "node:assert/strict";
import { validateComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";

export const hostNullJavaScriptRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const hostNullJavaScriptBrowsers = Object.freeze([
	"chromium", "firefox", "webkit"
]);
export const hostNullJavaScriptResult = Object.freeze({
	checks: 39, rejections: 17, positions: 5, nestedOptionDistinct: true
});

const exactKeys = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, `${label} must be an object`);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
};
const digest = (value, label) => assert.match(
	value, /^[a-f0-9]{64}$/u, label);
const result = (value, label) => {
	exactKeys(value, [
		"checks", "nestedOptionDistinct", "positions", "rejections"
	], label);
	assert.deepEqual(value, hostNullJavaScriptResult, label);
};

/**
 * Authenticate both author routes, Node/strict TypeScript and all browser
 * contexts without permitting HostNull to collapse into Option or omission.
 *
 * @param report - Parsed build/host-null/npm/report.json.
 * @param options - Closed execution expectation.
 * @param options.requireBrowsers - Require Chromium, Firefox and WebKit.
 */
export const checkHostNullJavaScriptHostedReport = (
	report, { requireBrowsers = true } = {}
) => {
	exactKeys(report, ["runs", "schemaVersion"], "report");
	assert.equal(report.schemaVersion, 1);
	assert.ok(Array.isArray(report.runs));
	assert.deepEqual(report.runs.map(run => run.path)
		, hostNullJavaScriptRoutes);
	const browserVersions = {}, summaries = [];
	let sourceSha256, consumerSha256, runtimeIdentity;
	for(const run of report.runs)
	{
		exactKeys(run, [
			"browsers", "compilerFreePath", "consumerSha256", "node"
			, "offlineInstall", "packagesRelocatedBeforeInstallation", "path"
			, "producerBuildsRemovedBeforeInstallation", "receipt", "result"
			, "sourceRelocatedBeforeInstallation", "sourceRemovedBeforeInstallation"
			, "sourceSha256", "typescript"
		], `run ${run.path}`);
		assert.match(run.node, /^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/u
			, `${run.path} Node version`);
		for(const flag of [
			"compilerFreePath", "offlineInstall"
			, "packagesRelocatedBeforeInstallation"
			, "producerBuildsRemovedBeforeInstallation"
			, "sourceRelocatedBeforeInstallation"
			, "sourceRemovedBeforeInstallation"
		]) assert.equal(run[flag], true, `${run.path} ${flag}`);
		digest(run.sourceSha256, `${run.path} source`);
		digest(run.consumerSha256, `${run.path} consumer`);
		sourceSha256 ??= run.sourceSha256;
		consumerSha256 ??= run.consumerSha256;
		assert.equal(run.sourceSha256, sourceSha256, "route source identity");
		assert.equal(run.consumerSha256, consumerSha256
			, "route consumer identity");
		exactKeys(run.typescript, ["executed", "strict"]
			, `${run.path} TypeScript`);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		result(run.result, `${run.path} Node result`);
		assert.equal(validateComponentPackageReceipt(run.receipt), true);
		assert.equal(run.receipt.component.id, "host_null_demo@1.0.0");
		assert.equal(run.receipt.package.package, "host-null-demo@1.0.0");
		assert.equal(run.receipt.schemaVersion, 2);
		runtimeIdentity ??= run.receipt.runtime;
		assert.deepEqual(run.receipt.runtime, runtimeIdentity
			, "routes must share one runtime archive");
		assert.ok(Array.isArray(run.browsers));
		assert.deepEqual(run.browsers.map(item => item.engine)
			, requireBrowsers ? hostNullJavaScriptBrowsers : []
			, `${run.path} browser engines`);
		for(const browser of run.browsers)
		{
			exactKeys(browser, ["engine", "result", "version"]
				, `${run.path} ${browser.engine}`);
			assert.ok(typeof browser.version === "string"
				&& browser.version.length > 0, `${browser.engine} version`);
			browserVersions[browser.engine] ??= browser.version;
			assert.equal(browser.version, browserVersions[browser.engine]
				, `${browser.engine} route identity`);
			exactKeys(browser.result, ["page", "react", "worker"]
				, `${run.path} ${browser.engine} contexts`);
			for(const [context, value] of Object.entries(browser.result))
				result(value, `${run.path} ${browser.engine} ${context}`);
		}
		summaries.push(Object.freeze({
			path: run.path, node: run.node
			, componentArchive: run.receipt.package.archive
			, componentSha256: run.receipt.package.sha256
			, runtimeArchive: run.receipt.runtime.archive
			, runtimeSha256: run.receipt.runtime.sha256
			, browserExecutions: run.browsers.length * 3
		}));
	}
	assert.deepEqual(Object.keys(browserVersions)
		, requireBrowsers ? hostNullJavaScriptBrowsers : []);
	return Object.freeze({
		routes: Object.freeze(summaries)
		, browserVersions: Object.freeze({
			...browserVersions
		})
		, sourceSha256, consumerSha256
		, checksPerExecution: hostNullJavaScriptResult.checks
		, rejectionsPerExecution: hostNullJavaScriptResult.rejections
		, positions: hostNullJavaScriptResult.positions
		, nestedOptionDistinct: true
	});
};
