/**
 * Closed verifier contract for hosted callback Fin Perl evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	callbackFinPerlTestName, callbackFinPerlVerification, checkCallbackFinPerlReport
} from "./helpers/callback-fin-perl-ci.mjs";

const digest = character => character.repeat(64);
const tap = `TAP version 13
# Subtest: ${callbackFinPerlTestName}
ok 1 - ${callbackFinPerlTestName}
  ---
  duration_ms: 1
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2
`;
const packageSet = ["runtime", "component"].map(role => ({
	role
	, artifacts: [{ path: `archives/${role}.tar.gz`
		, bytes: 1, sha256: digest("a") }]
}));
const observations = (route, mode) => ["a", "b", "c", "d"]
	.map((character, index) => ({
		schemaVersion: 1, route, mode, checks: 31, calls: 5, rejected: 5
		, hostVersion: index < 2 ? "v5.36.3" : "v5.38.2"
		, perlSha256: digest(character), bindingIrSha256: digest("e")
		, installedFiles: Object.fromEntries(Array.from({ length: 11 }
			, (_, file) => [`file-${file}`, { bytes: file, sha256: digest("f") }]))
		, packages: structuredClone(packageSet)
		, sourceRemovedBeforeInstallation: true
		, handoffRemovedBeforeExecution: true, relocated: true, repeated: true
	}));
const report = () => ({
	schemaVersion: 1
	, reports: ["ordinary", "reviewed"].flatMap(route =>
		["prebuilt-only", "build-xs"].flatMap(mode =>
			observations(route, mode)))
});

test("callback Fin Perl verifier closes every route, mode and ABI", () => {
	assert.deepEqual(checkCallbackFinPerlReport(report()), {
		routes: ["ordinary", "reviewed"], modes: ["prebuilt-only", "build-xs"]
		, interpreterCount: 4, reports: 16
	});
	const verified = callbackFinPerlVerification("b".repeat(40), tap, report());
	assert.equal(verified.kind, "perl");
	assert.equal(verified.producerCommit, "b".repeat(40));
	const duplicate = report(); duplicate.reports[1].perlSha256 = digest("a");
	assert.throws(() => checkCallbackFinPerlReport(duplicate));
	const incomplete = report(); incomplete.reports.pop();
	assert.throws(() => checkCallbackFinPerlReport(incomplete));
});
