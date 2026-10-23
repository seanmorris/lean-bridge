/**
 * Independently validate the terminal callback checked-record browser acceptance log.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

export const callbackCheckedRecordBrowserTestName
	= "callback checked records install from reproducible ordinary and reviewed npm builds";

const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Reject ambiguous checker invocations before opening retained files.
 *
 * @param args - Arguments after the checker script name.
 */
export const parseCallbackCheckedRecordBrowserCiArgs = args => {
	const usage = "Usage: check-callback-checked-record-browser-ci.mjs --producer <commit> --tap <original-tap> --runtime <independent-runtime-json> --records <retained-record-directory>";
	const allowed = ["producer", "tap", "runtime", "records"], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require exactly one successful, unskipped terminal acceptance test.
 *
 * @param source - Original combined Node test output.
 */
export const assertCallbackCheckedRecordBrowserTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	assert.match(source, new RegExp(
		`^TAP version 13\\n# Subtest: ${callbackCheckedRecordBrowserTestName.replaceAll(" ", "\\s")}`
		, "u"
	));
	assert.match(source, new RegExp(
		`\\nok 1 - ${callbackCheckedRecordBrowserTestName.replaceAll(" ", "\\s")}\\n`
		, "u"
	));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Validate retained CI output independently of the producer process.
 *
 * @param options - Explicit producer selection.
 * @param original - Original TAP and independently observed Node identity.
 */
export const checkCallbackCheckedRecordBrowserCi = (options, original) => {
	const selected = parseCallbackCheckedRecordBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value]));
	assertCallbackCheckedRecordBrowserTap(original.tap);
	exactKeys(original.runtime, ["node", "platform", "arch"]);
	assert.match(original.runtime.node, /^v[0-9]+\./u);
	for(const key of ["platform", "arch"])
		assert.match(original.runtime[key], /^[a-z0-9_-]+$/u);
	return {
		schemaVersion: 1
		, producerCommit: selected.producer
		, runtime: original.runtime
		, routes: ["ordinary", "reviewed"]
		, profiles: ["browser-javascript", "browser-react", "browser-worker"]
		, engines: ["chromium", "firefox", "webkit"]
		, nodeAccepted: true
		, browserAccepted: true
	};
};

const expected = Object.freeze({ checks: 26, rejections: 12
	, callbackCalls: 5 });
const profiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
const routes = Object.freeze(["ordinary", "reviewed"]);
const engines = Object.freeze(["chromium", "firefox", "webkit"]);

/**
 * Authenticate every retained archive and browser observation by exact path.
 *
 * @param directory - Closed retained-record directory.
 * @param producerCommit - Exact producer revision selected outside the test.
 */
export const checkCallbackCheckedRecordBrowserRecords = async (
	directory, producerCommit
) => {
	const read = path => readFile(join(directory, path));
	const json = async path => JSON.parse(await read(path));
	const start = await json("start.json"), report = await json("report.json");
	exactKeys(start, ["schemaVersion", "producerCommit", "routes"
		, "profiles", "engines"]);
	assert.deepEqual(start, { schemaVersion: 1, producerCommit
		, routes: [...routes], profiles: [...profiles], engines: [...engines] });
	exactKeys(report, ["schemaVersion", "producerCommit", "expected"
		, "builds", "routes"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.expected, expected);
	assert.equal(report.builds.length, 3);
	assert.deepEqual(report.builds.map(({ route, attempt }) => ({ route, attempt }))
		, [{ route: "ordinary", attempt: 0 }, { route: "ordinary", attempt: 1 }
			, { route: "reviewed", attempt: 0 }]);
	for(const build of report.builds)
	{
		exactKeys(build, ["route", "attempt", "bindingIrSha256"
			, "receiptSha256", "componentArchiveSha256"
			, "runtimeArchiveSha256"]);
		for(const key of ["bindingIrSha256", "receiptSha256"
			, "componentArchiveSha256", "runtimeArchiveSha256"])
			assert.match(build[key], /^[a-f0-9]{64}$/u);
	}
	for(const key of ["bindingIrSha256", "receiptSha256"
		, "componentArchiveSha256", "runtimeArchiveSha256"])
		assert.equal(report.builds[1][key], report.builds[0][key], key);
	assert.equal(report.builds[2].runtimeArchiveSha256
		, report.builds[0].runtimeArchiveSha256);
	assert.notEqual(report.builds[2].componentArchiveSha256
		, report.builds[0].componentArchiveSha256);
	assert.notEqual(report.builds[2].receiptSha256
		, report.builds[0].receiptSha256);

	const expectedPaths = ["start.json", "report.json"];
	exactKeys(report.routes, routes);
	for(const route of routes)
	{
		const item = report.routes[route];
		exactKeys(item, ["receipt", "files", "node", "typescript", "browsers"]);
		assert.deepEqual(item.node, { ...expected, relocations: 2 });
		assert.equal(item.typescript, true);
		const receipt = JSON.parse(await read(
			`${route}/handoff/component-package-receipt.json`
		));
		assert.deepEqual(item.receipt, receipt);
		const handoff = [receipt.package.archive, receipt.runtime.archive
			, "component-package-receipt.json"
			, "verify-component-package-receipt.mjs"];
		for(const name of handoff)
			assert.match(name, /^[A-Za-z0-9_@.+-]+$/u);
		exactKeys(item.files, handoff);
		for(const name of handoff)
		{
			const path = `${route}/handoff/${name}`, bytes = await read(path);
			assert.deepEqual(item.files[name]
				, { bytes: bytes.length, sha256: sha256(bytes) });
			expectedPaths.push(path);
		}
		assert.deepEqual(item.browsers.map(browser => browser.profile), profiles);
		for(const browser of item.browsers)
		{
			exactKeys(browser, ["schemaVersion", "producerCommit", "route"
				, "profile", "observation", "browser"]);
			assert.equal(browser.schemaVersion, 1);
			assert.equal(browser.producerCommit, producerCommit);
			assert.equal(browser.route, route);
			assert.deepEqual(browser.observation.results, { route, ...expected });
			assert.equal(browser.observation.profile, browser.profile);
			assert.deepEqual(browser.browser.requestedEngines, engines);
			assert.equal(browser.browser.installedSourcesRemoved, true);
			assert.equal(browser.browser.externalNetworkBlocked, true);
			const variants = browser.profile === "browser-react"
				? ["production", "strict"] : ["production"];
			assert.deepEqual(browser.browser.executions.map(({ engine, variant }) => (
				{ engine, variant }
			)), engines.flatMap(engine => variants.map(variant => (
				{ engine, variant }
			))));
			for(const execution of browser.browser.executions)
			{
				assert.equal(execution.failedAssetRecovery, true);
				if(browser.profile === "browser-react")
					assert.equal(execution.pendingUnmount, true);
				assert.deepEqual(execution.observation.results
					, { route, ...expected });
			}
			const path = `${route}/${browser.profile}.json`;
			assert.deepEqual(browser, await json(path)); expectedPaths.push(path);
		}
	}
	assert.deepEqual(await nativeArtifactPaths(directory)
		, expectedPaths.sort());
	return { reportSha256: sha256(await read("report.json"))
		, archiveCount: routes.length * 2
		, browserReportCount: routes.length * profiles.length };
};
