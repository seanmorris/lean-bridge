/**
 * Independently verify hosted R1/R2 reviewed callback-Fin browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	reviewedCallbackBrowserConsumer, reviewedCallbackBrowserPackage
	, reviewedCallbackNodeExpected
} from "./reviewed-callback-fin-consumer.mjs";
import { reviewedCallbackFinReview } from "./reviewed-callback-fin-fixture.mjs";

export const reviewedCallbackFinBrowserTitles = Object.freeze([
	"an independently reviewed npm package installs R1 callback bounds in every requested consumer"
	, "an independently reviewed npm package installs R2 with the Wasm host-reply bound"
]);
const profiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
const engines = Object.freeze(["chromium", "firefox", "webkit"]);

const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Reject ambiguous checker invocations before opening retained files.
 *
 * @param args - Arguments after the checker script name.
 */
export const parseReviewedCallbackFinBrowserCiArgs = args => {
	const usage = "Usage: check-reviewed-callback-fin-browser-ci.mjs --producer <commit> --tap <original-tap> --runtime <independent-runtime-json> --r1 <R1-report> --r2 <R2-report>";
	const allowed = ["producer", "tap", "runtime", "r1", "r2"], selected = {};
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
 * Require exactly both successful, unskipped terminal acceptance tests.
 *
 * @param source - Original combined Node test output.
 */
export const assertReviewedCallbackFinBrowserTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	for(const [index, title] of reviewedCallbackFinBrowserTitles.entries())
	{
		const escaped = title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		assert.match(source, new RegExp(`^# Subtest: ${escaped}$`, "mu"));
		assert.match(source, new RegExp(`^ok ${index + 1} - ${escaped}$`, "mu"));
	}
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.2\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

const validateObservation = (value, profile, expected) => {
	exactKeys(value, ["schemaVersion", "profile", "module", "realm"
		, "results", "hostVersion"]);
	assert.deepEqual(value, { schemaVersion: 1, profile
		, module: "reviewedcallbacks"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: expected, hostVersion: value.hostVersion });
	assert.match(value.hostVersion, /\S/u);
};

/**
 * Authenticate one retained review report and all three browser contexts.
 *
 * @param report - Candidate R1 or R2 report.
 * @param hostReply - Select R2.
 */
export const assertReviewedCallbackFinBrowserReport = (report, hostReply) => {
	assert.equal(typeof hostReply, "boolean");
	exactKeys(report, ["schemaVersion", "profile", "path", "review"
		, "reviewedBindingIrSha256", "receipt", "receiptSha256", "observed"
		, "browsers", "browserConsumerSha256", "browserPackageSha256"
		, "typescript", "dispatch", "reproducible"
		, "sourceRemovedBeforeInstallation"]);
	const review = hostReply ? "R2" : "R1";
	const expected = reviewedCallbackNodeExpected[hostReply ? "r2" : "r1"];
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, "npm"); assert.equal(report.path, "reviewed-source");
	assert.equal(report.review, review);
	assert.equal(report.reviewedBindingIrSha256
		, hashBindingIr(reviewedCallbackFinReview({ hostReply })));
	assert.deepEqual(report.observed, expected);
	assert.equal(report.receiptSha256, sha256(canonicalJson(report.receipt)));
	assert.match(report.receipt.bindingIrSha256, /^[a-f0-9]{64}$/u);
	assert.equal(report.receipt.package.package, "reviewedcallbacks@1.0.0");
	assert.equal(report.browserConsumerSha256
		, sha256(reviewedCallbackBrowserConsumer));
	assert.equal(report.browserPackageSha256
		, sha256(reviewedCallbackBrowserPackage));
	assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false });
	assert.equal(report.dispatch, "not measured");
	for(const flag of ["reproducible", "sourceRemovedBeforeInstallation"])
		assert.equal(report[flag], true, flag);
	assert.deepEqual(report.browsers.map(item => item.profile), profiles);
	for(const item of report.browsers)
	{
		exactKeys(item, ["profile", "review", "observation", "browser"]);
		assert.equal(item.review, review); validateObservation(item.observation
			, item.profile, expected);
		const browser = item.browser;
		exactKeys(browser, ["requestedEngines", "installedAssets", "framework"
			, "deployments", "executions", "installedSourcesRemoved"
			, "externalNetworkBlocked"]);
		assert.deepEqual(browser.requestedEngines, engines);
		assert.equal(browser.installedSourcesRemoved, true);
		assert.equal(browser.externalNetworkBlocked, true);
		const variants = item.profile === "browser-react"
			? ["production", "strict"] : ["production"];
		assert.deepEqual(browser.executions.map(({ engine, variant }) => (
			{ engine, variant }
		)), engines.flatMap(engine => variants.map(variant => ({ engine, variant }))));
		for(const execution of browser.executions)
		{
			assert.equal(execution.failedAssetRecovery, true);
			if(item.profile === "browser-react")
				assert.equal(execution.pendingUnmount, true);
			else assert.equal(Object.hasOwn(execution, "pendingUnmount"), false);
			validateObservation(execution.observation, item.profile, expected);
		}
	}
	return { review, profiles: [...profiles], engines: [...engines]
		, receiptSha256: report.receiptSha256 };
};

/**
 * Validate retained CI output independently of the producer process.
 *
 * @param options - Explicit producer selection.
 * @param original - Original TAP, runtime identity and reports.
 */
export const checkReviewedCallbackFinBrowserCi = (options, original) => {
	const selected = parseReviewedCallbackFinBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value]));
	assertReviewedCallbackFinBrowserTap(original.tap);
	exactKeys(original.runtime, ["node", "platform", "arch"]);
	assert.match(original.runtime.node, /^v[0-9]+\./u);
	return { schemaVersion: 1, producerCommit: selected.producer
		, runtime: original.runtime
		, reports: [
			assertReviewedCallbackFinBrowserReport(original.r1, false)
			, assertReviewedCallbackFinBrowserReport(original.r2, true)
		]
	};
};
