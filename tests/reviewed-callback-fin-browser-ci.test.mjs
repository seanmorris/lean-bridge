/**
 * Fail-closed controls for hosted reviewed callback-Fin browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reviewedCallbackBrowserConsumer, reviewedCallbackBrowserPackage
	, reviewedCallbackNodeExpected
} from "./helpers/reviewed-callback-fin-consumer.mjs";
import {
	assertReviewedCallbackFinBrowserReport, assertReviewedCallbackFinBrowserTap
	, checkReviewedCallbackFinBrowserCi, parseReviewedCallbackFinBrowserCiArgs
	, reviewedCallbackFinBrowserTitles
} from "./helpers/reviewed-callback-fin-browser-ci.mjs";
import { reviewedCallbackFinReview } from "./helpers/reviewed-callback-fin-fixture.mjs";

const commit = "a".repeat(40);
const runtime = { node: process.version, platform: process.platform
	, arch: process.arch };
const tap = `TAP version 13
# Subtest: ${reviewedCallbackFinBrowserTitles[0]}
ok 1 - ${reviewedCallbackFinBrowserTitles[0]}
  ---
  duration_ms: 1
  type: 'test'
  ...
# Subtest: ${reviewedCallbackFinBrowserTitles[1]}
ok 2 - ${reviewedCallbackFinBrowserTitles[1]}
  ---
  duration_ms: 1
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2
`;
const profiles = ["browser-javascript", "browser-react", "browser-worker"];
const engines = ["chromium", "firefox", "webkit"];
const report = hostReply => {
	const expected = reviewedCallbackNodeExpected[hostReply ? "r2" : "r1"];
	const review = hostReply ? "R2" : "R1";
	const observation = profile => ({ schemaVersion: 1, profile
		, module: "reviewedcallbacks"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: expected, hostVersion: "test-browser" });
	const receipt = { bindingIrSha256: "b".repeat(64)
		, package: { package: "reviewedcallbacks@1.0.0" } };
	return { schemaVersion: 1, profile: "npm", path: "reviewed-source", review
		, reviewedBindingIrSha256: hashBindingIr(reviewedCallbackFinReview({ hostReply }))
		, receipt, receiptSha256: sha256(canonicalJson(receipt)), observed: expected
		, browsers: profiles.map(profile => {
			const variants = profile === "browser-react"
				? ["production", "strict"] : ["production"];
			return { profile, review, observation: observation(profile)
				, browser: { requestedEngines: engines, installedAssets: []
					, framework: [], deployments: []
					, executions: engines.flatMap(engine => variants.map(variant => ({
						engine, variant, observation: observation(profile)
						, failedAssetRecovery: true
						, ...profile === "browser-react" ? { pendingUnmount: true } : {}
					})))
					, installedSourcesRemoved: true, externalNetworkBlocked: true }
			};
		})
		, browserConsumerSha256: sha256(reviewedCallbackBrowserConsumer)
		, browserPackageSha256: sha256(reviewedCallbackBrowserPackage)
		, typescript: { strict: true, skipLibCheck: false }
		, dispatch: "not measured", reproducible: true
		, sourceRemovedBeforeInstallation: true };
};

test("reviewed callback Fin browser CI requires two terminal reviews and six browser cells", () => {
	const options = { producer: commit, tap: "run.tap", runtime: "runtime.json"
		, r1: "r1.json", r2: "r2.json" };
	assert.deepEqual(parseReviewedCallbackFinBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value])), options);
	assertReviewedCallbackFinBrowserTap(tap);
	assert.deepEqual(checkReviewedCallbackFinBrowserCi(options, {
		tap, runtime, r1: report(false), r2: report(true)
	}), { schemaVersion: 1, producerCommit: commit, runtime
		, reports: [
			{ review: "R1", profiles, engines
				, receiptSha256: report(false).receiptSha256 }
			, { review: "R2", profiles, engines
				, receiptSha256: report(true).receiptSha256 }
		]
	});
	for(const changed of [
		tap.replace("ok 1", "not ok 1")
		, tap.replace("# pass 2", "# pass 1")
		, tap.replace("# skipped 0", "# skipped 1")
		, tap.replace("1..2", "1..1")
	]) assert.throws(() => assertReviewedCallbackFinBrowserTap(changed));
	for(const args of [[], ["--producer", commit]
		, ["--producer", "short", "--tap", "x", "--runtime", "x"
			, "--r1", "x", "--r2", "x"]])
		assert.throws(() => parseReviewedCallbackFinBrowserCiArgs(args));
});

test("reviewed callback Fin browser reports reject missing directions, engines and lifecycle evidence", () => {
	for(const hostReply of [false, true])
		assert.doesNotThrow(() => assertReviewedCallbackFinBrowserReport(
			report(hostReply), hostReply));
	const mutations = [
		value => { value.browsers.pop(); }
		, value => { value.browsers[0].browser.requestedEngines.pop(); }
		, value => { value.browsers[0].browser.executions[0].failedAssetRecovery = false; }
		, value => { value.browsers[1].browser.executions[0].pendingUnmount = false; }
		, value => { value.observed.checks--; }
		, value => { value.browserConsumerSha256 = "0".repeat(64); }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(report(false)); mutate(changed);
		assert.throws(() => assertReviewedCallbackFinBrowserReport(changed, false));
	}
});

test("hosted browser workflow cannot omit reviewed callback Fin acceptance or retained failures", async () => {
	const source = await readFile(
		".github/workflows/callback-checked-record-browser.yml", "utf8");
	for(const required of [
		"bash scripts/run-reviewed-callback-fin-browser-ci.sh \"$PWD/build/lean-link-spike/lazy\""
		, "build/reviewed-callback-fin-browser-ci/"
		, "if: always() && steps.callback_fin.outcome != 'success'"
		, "run: exit 1"
	]) assert.ok(source.includes(required), required);
	for(const [before, after] of [
		["bash scripts/run-reviewed-callback-fin-browser-ci.sh", "true"]
		, ["build/reviewed-callback-fin-browser-ci/", "build/omitted/"]
		, ["steps.callback_fin.outcome", "steps.unknown.outcome"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
	]) {
		const changed = source.replace(before, after);
		assert.notEqual(changed, source);
		assert.equal([
			"bash scripts/run-reviewed-callback-fin-browser-ci.sh"
			, "build/reviewed-callback-fin-browser-ci/"
			, "steps.callback_fin.outcome", "if-no-files-found: error"
		].every(required => changed.includes(required)), false);
	}
});
